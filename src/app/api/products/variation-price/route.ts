import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/products/variation-price?productVariationId=123&locationId=3
 * Get location-specific price for a product variation
 */

// Disable caching for pricing data
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
    const productVariationId = parseInt(searchParams.get('productVariationId') || '')
    const locationId = parseInt(searchParams.get('locationId') || '')

    if (!productVariationId || isNaN(productVariationId)) {
      return NextResponse.json({ error: 'productVariationId is required' }, { status: 400 })
    }

    if (!locationId || isNaN(locationId)) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    // Verify product variation belongs to user's business
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: productVariationId,
        product: {
          businessId,
        },
      },
      select: {
        id: true,
        sellingPrice: true,  // ✅ FIX: Correct field name (not defaultSellingPrice)
        purchasePrice: true, // ✅ FIX: Correct field name (not defaultPurchasePrice)
      },
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    // DEBUG: Log query parameters
    console.log('🔵 GET /api/products/variation-price - Query params:', {
      productVariationId,
      locationId,
      variationDefaultPrice: variation.sellingPrice,
    })

    // Fetch location-specific price
    const locationPrice = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId,
          locationId,
        },
      },
      select: {
        sellingPrice: true,
        pricePercentage: true,
      },
    })

    // DEBUG: Log what was found in database
    console.log('🔵 Location-specific price from DB:', {
      found: !!locationPrice,
      sellingPrice: locationPrice?.sellingPrice?.toString(),
      willUseDefault: !locationPrice,
    })

    // Use location-specific price if available, otherwise use default
    const sellingPrice = locationPrice?.sellingPrice
      ? parseFloat(String(locationPrice.sellingPrice))
      : parseFloat(String(variation.sellingPrice || 0))

    const purchasePrice = parseFloat(String(variation.purchasePrice || 0))

    // DEBUG: Log final response
    console.log('🔵 Returning price:', {
      sellingPrice,
      isLocationSpecific: !!locationPrice,
    })

    const response = NextResponse.json({
      success: true,
      data: {
        productVariationId,
        locationId,
        sellingPrice,
        purchasePrice,
        isLocationSpecific: !!locationPrice,
      },
    })

    // Prevent browser caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Error fetching variation price:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch price',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
