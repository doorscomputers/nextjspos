import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products/[id]/stock
 * Get real-time stock availability for a product at a specific location
 * Used by POS to prevent overselling
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

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    const locationIdNumber = parseInt(locationId)

    // Get product with first variation's stock at the specified location
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
        deletedAt: null,
      },
      select: {
        variations: {
          select: {
            variationLocationDetails: {
              where: {
                locationId: locationIdNumber,
              },
            },
          },
          take: 1, // Only get first variation
        },
      },
    })

    if (!product || !product.variations[0]) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const variation = product.variations[0]
    const locationStock = variation.variationLocationDetails[0]

    if (!locationStock) {
      return NextResponse.json({
        productId,
        variationId: variation.id,
        locationId: locationIdNumber,
        qtyAvailable: 0,
      })
    }

    return NextResponse.json({
      productId,
      variationId: variation.id,
      locationId: locationIdNumber,
      qtyAvailable: parseFloat(locationStock.qtyAvailable.toString()),
    })
  } catch (error: any) {
    console.error('[GET /api/products/[id]/stock] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock', details: error.message },
      { status: 500 }
    )
  }
}
