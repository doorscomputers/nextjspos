import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getProductLocationPrices,
  saveProductLocationPrices,
  LocationUnitPriceInput,
} from '@/lib/productLocationPricing'

/**
 * GET /api/products/[id]/location-prices
 * Get all location-specific unit prices for a product
 * Admins can see all locations, Managers only their assigned locations
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
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
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

    // Get location IDs based on user role
    let locationIds: number[] | undefined

    // Super Admin and Admin can see all locations
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Only show assigned locations
      const { prisma } = await import('@/lib/prisma')
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: user.id,
        },
        select: {
          locationId: true,
        },
      })

      locationIds = userLocations.map(ul => ul.locationId)

      if (locationIds.length === 0) {
        return NextResponse.json({
          success: true,
          prices: [],
          message: 'No locations assigned to user',
        })
      }
    }

    // Get location prices
    const prices = await getProductLocationPrices(
      productId,
      businessId,
      locationIds
    )

    // Serialize Decimal to string
    const serializedPrices = prices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      prices: serializedPrices,
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
 * POST /api/products/[id]/location-prices
 * Save location-specific unit prices for a product
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

    // Check permissions - need PRODUCT_UPDATE or PRODUCT_PRICE_EDIT
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
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { prices } = body as { prices: LocationUnitPriceInput[] }

    if (!Array.isArray(prices)) {
      return NextResponse.json(
        { error: 'Invalid prices data' },
        { status: 400 }
      )
    }

    // Validate user can edit these locations
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Validate all location IDs are assigned to user
      const { prisma } = await import('@/lib/prisma')
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: user.id,
        },
        select: {
          locationId: true,
        },
      })

      const assignedLocationIds = userLocations.map(ul => ul.locationId)
      const requestedLocationIds = [...new Set(prices.map(p => p.locationId))]

      const unauthorizedLocations = requestedLocationIds.filter(
        locId => !assignedLocationIds.includes(locId)
      )

      if (unauthorizedLocations.length > 0) {
        return NextResponse.json(
          {
            error: `Forbidden - You are not assigned to location IDs: ${unauthorizedLocations.join(', ')}`,
          },
          { status: 403 }
        )
      }
    }

    // Validate product exists
    const { prisma } = await import('@/lib/prisma')
    const product = await prisma.product.findUnique({
      where: { id: productId, businessId },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Save location prices
    await saveProductLocationPrices(productId, businessId, prices, user.id)

    // Fetch updated prices
    const locationIds = isSuperAdmin || isAdmin
      ? undefined
      : (await prisma.userLocation.findMany({
          where: { userId: user.id },
          select: { locationId: true },
        })).map(ul => ul.locationId)

    const updatedPrices = await getProductLocationPrices(
      productId,
      businessId,
      locationIds
    )

    // Serialize
    const serializedPrices = updatedPrices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      message: 'Location prices saved successfully',
      prices: serializedPrices,
    })
  } catch (error: any) {
    console.error('Error saving location prices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save location prices' },
      { status: 500 }
    )
  }
}
