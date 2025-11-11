import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/pos/product-units?productId=123&locationId=2
 * Get unit information and prices for a product (optimized for POS)
 * Now supports location-specific pricing
 */

// Disable caching for POS pricing - must always be fresh
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '')
    const locationId = parseInt(searchParams.get('locationId') || '')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    // Get product with unit information
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        unitId: true,
        subUnitIds: true,
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
            allowDecimal: true,
            baseUnitId: true,
            baseUnitMultiplier: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Parse sub-unit IDs
    const subUnitIds = product.subUnitIds
      ? (typeof product.subUnitIds === 'string'
          ? JSON.parse(product.subUnitIds)
          : product.subUnitIds)
      : []

    // Get all units (primary + sub-units)
    const allUnitIds = [product.unitId, ...subUnitIds].filter(Boolean)
    const units = await prisma.unit.findMany({
      where: {
        id: { in: allUnitIds },
        businessId,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        allowDecimal: true,
        baseUnitId: true,
        baseUnitMultiplier: true,
      },
    })

    // DEBUG: Log query parameters
    console.log('🔵 API /pos/product-units - Query:', { productId, locationId, businessId })

    // Get location-specific unit prices (NEW: location-specific pricing)
    const locationUnitPrices = await prisma.productUnitLocationPrice.findMany({
      where: {
        productId,
        locationId,
        businessId,
      },
      select: {
        unitId: true,
        purchasePrice: true,
        sellingPrice: true,
      },
    })

    // DEBUG: Log what location-specific prices were found
    console.log('🔵 API /pos/product-units - Location-specific prices found:', locationUnitPrices.length)
    locationUnitPrices.forEach(p => {
      console.log(`   Unit ID ${p.unitId}: ₱${p.sellingPrice}`)
    })

    // Get global unit prices as fallback
    const globalUnitPrices = await prisma.productUnitPrice.findMany({
      where: {
        productId,
        businessId,
      },
      select: {
        unitId: true,
        purchasePrice: true,
        sellingPrice: true,
      },
    })

    // DEBUG: Log what global prices were found
    console.log('🔵 API /pos/product-units - Global prices found:', globalUnitPrices.length)
    globalUnitPrices.forEach(p => {
      console.log(`   Unit ID ${p.unitId}: ₱${p.sellingPrice}`)
    })

    // Merge location-specific and global prices (location-specific takes priority)
    const unitPrices = allUnitIds.map(unitId => {
      // First try location-specific price
      const locationPrice = locationUnitPrices.find(up => up.unitId === unitId)
      if (locationPrice) {
        const result = {
          unitId,
          purchasePrice: parseFloat(String(locationPrice.purchasePrice)),
          sellingPrice: parseFloat(String(locationPrice.sellingPrice)),
          isLocationSpecific: true,
        }
        console.log(`🔵 API /pos/product-units - Using LOCATION-SPECIFIC price for unit ${unitId}: ₱${result.sellingPrice}`)
        return result
      }

      // Fall back to global price
      const globalPrice = globalUnitPrices.find(up => up.unitId === unitId)
      if (globalPrice) {
        const result = {
          unitId,
          purchasePrice: parseFloat(String(globalPrice.purchasePrice)),
          sellingPrice: parseFloat(String(globalPrice.sellingPrice)),
          isLocationSpecific: false,
        }
        console.log(`🔵 API /pos/product-units - Using GLOBAL price for unit ${unitId}: ₱${result.sellingPrice}`)
        return result
      }

      console.log(`⚠️ API /pos/product-units - NO PRICE FOUND for unit ${unitId}`)
      return null
    }).filter(Boolean) as Array<{ unitId: number; purchasePrice: number; sellingPrice: number; isLocationSpecific: boolean }>

    console.log('🔵 API /pos/product-units - Final unitPrices array:', JSON.stringify(unitPrices, null, 2))

    // Convert to plain objects for JSON serialization
    const unitsData = units.map(u => ({
      id: u.id,
      name: u.name,
      shortName: u.shortName,
      allowDecimal: u.allowDecimal,
      baseUnitId: u.baseUnitId,
      baseUnitMultiplier: u.baseUnitMultiplier ? parseFloat(String(u.baseUnitMultiplier)) : null,
    }))

    const response = NextResponse.json({
      success: true,
      data: {
        primaryUnitId: product.unitId,
        units: unitsData,
        unitPrices,
      },
    })

    // Prevent browser caching of pricing data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Error fetching product units:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch product units',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
