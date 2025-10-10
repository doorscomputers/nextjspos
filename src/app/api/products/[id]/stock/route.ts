import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products/[id]/stock?locationId=X
 * Query current stock quantity for a product at a specific location
 * Used for testing and stock verification
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
    const businessId = user.businessId

    const { id } = await params
    const productId = parseInt(id)

    // Get locationId from query params
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const variationId = searchParams.get('variationId')

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId query parameter is required' },
        { status: 400 }
      )
    }

    // If variationId provided, get specific variation stock
    if (variationId) {
      const stock = await prisma.variationLocationDetails.findFirst({
        where: {
          productId,
          productVariationId: parseInt(variationId),
          locationId: parseInt(locationId),
        },
      })

      return NextResponse.json({
        productId,
        variationId: parseInt(variationId),
        locationId: parseInt(locationId),
        quantity: stock?.qtyAvailable?.toString() || '0',
      })
    }

    // Otherwise, get total stock for all variations at this location
    const stocks = await prisma.variationLocationDetails.findMany({
      where: {
        productId,
        locationId: parseInt(locationId),
      },
    })

    const totalQuantity = stocks.reduce(
      (sum, stock) => sum + parseFloat(stock.qtyAvailable.toString()),
      0
    )

    return NextResponse.json({
      productId,
      locationId: parseInt(locationId),
      quantity: totalQuantity.toString(),
      variations: stocks.map(s => ({
        variationId: s.productVariationId,
        quantity: s.qtyAvailable.toString(),
      })),
    })
  } catch (error: any) {
    console.error('Error querying stock:', error)
    return NextResponse.json(
      { error: 'Failed to query stock', details: error.message },
      { status: 500 }
    )
  }
}
