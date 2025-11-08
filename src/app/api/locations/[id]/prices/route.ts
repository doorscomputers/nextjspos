import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getLocationPricesForLocation,
  saveProductLocationPrices,
  LocationUnitPriceInput,
} from '@/lib/productLocationPricing'

/**
 * GET /api/locations/[id]/prices
 * Get all product prices for a specific location
 * Useful for Manager view (showing prices for their assigned location)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)
    const { id } = await params
    const locationId = parseInt(id)

    if (isNaN(locationId)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      )
    }

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Validate user can access this location
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Validate location is assigned to user
      const { prisma } = await import('@/lib/prisma')
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: user.id,
          locationId: locationId,
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'Forbidden - Location not assigned to user' },
          { status: 403 }
        )
      }
    }

    // Get URL search params for optional product filtering
    const url = new URL(request.url)
    const productIdsParam = url.searchParams.get('productIds')
    const productIds = productIdsParam
      ? productIdsParam.split(',').map(id => parseInt(id))
      : undefined

    // Get location prices
    const products = await getLocationPricesForLocation(
      locationId,
      businessId,
      productIds
    )

    // Serialize Decimal to string
    const serializedProducts = products.map(product => ({
      ...product,
      prices: product.prices.map(p => ({
        ...p,
        purchasePrice: p.purchasePrice.toString(),
        sellingPrice: p.sellingPrice.toString(),
        multiplier: p.multiplier.toString(),
      })),
    }))

    return NextResponse.json({
      success: true,
      products: serializedProducts,
    })
  } catch (error) {
    console.error('Error fetching location prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location prices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/locations/[id]/prices
 * Save prices for multiple products at a specific location
 * Used by managers to update prices for their assigned location
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)

    // Check permissions
    const canUpdate =
      user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE) ||
      user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const locationId = parseInt(id)

    if (isNaN(locationId)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      )
    }

    // Validate user can edit this location
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Validate location is assigned to user
      const { prisma } = await import('@/lib/prisma')
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: user.id,
          locationId: locationId,
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'Forbidden - Location not assigned to user' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { productPrices } = body as {
      productPrices: {
        productId: number
        prices: LocationUnitPriceInput[]
      }[]
    }

    if (!Array.isArray(productPrices)) {
      return NextResponse.json(
        { error: 'Invalid productPrices data' },
        { status: 400 }
      )
    }

    // Validate location IDs in all prices match the route parameter
    for (const product of productPrices) {
      const invalidPrices = product.prices.filter(
        p => p.locationId !== locationId
      )
      if (invalidPrices.length > 0) {
        return NextResponse.json(
          {
            error: `All prices must be for location ID ${locationId}. Found prices for other locations in product ${product.productId}.`,
          },
          { status: 400 }
        )
      }
    }

    // Save prices for each product
    const { prisma } = await import('@/lib/prisma')
    const results = []

    for (const product of productPrices) {
      try {
        // Validate product exists
        const productExists = await prisma.product.findUnique({
          where: { id: product.productId, businessId },
        })

        if (!productExists) {
          results.push({
            productId: product.productId,
            success: false,
            error: 'Product not found',
          })
          continue
        }

        // Save prices
        await saveProductLocationPrices(
          product.productId,
          businessId,
          product.prices,
          user.id
        )

        results.push({
          productId: product.productId,
          success: true,
        })
      } catch (error: any) {
        results.push({
          productId: product.productId,
          success: false,
          error: error.message || 'Failed to save prices',
        })
      }
    }

    // Check if all succeeded
    const allSucceeded = results.every(r => r.success)
    const someSucceeded = results.some(r => r.success)

    if (allSucceeded) {
      return NextResponse.json({
        success: true,
        message: 'All prices saved successfully',
        results,
      })
    } else if (someSucceeded) {
      return NextResponse.json(
        {
          success: false,
          message: 'Some prices failed to save',
          results,
        },
        { status: 207 } // Multi-Status
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'All prices failed to save',
          results,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error saving location prices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save location prices' },
      { status: 500 }
    )
  }
}
