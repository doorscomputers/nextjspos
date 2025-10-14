import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/stock/query?locationId=X&variationId=Y
 * Query current stock quantity for a product variation at a specific location
 * Used by stock transfer page to check available stock before adding items
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const variationId = searchParams.get('variationId')

    if (!locationId || !variationId) {
      return NextResponse.json(
        { error: 'Both locationId and variationId are required' },
        { status: 400 }
      )
    }

    // Get stock for this variation at this location
    const stock = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: parseInt(variationId),
        locationId: parseInt(locationId),
        productVariation: {
          businessId: parseInt(businessId) // Ensure multi-tenant isolation
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        productVariation: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      }
    })

    if (!stock) {
      return NextResponse.json({
        stock: {
          variationId: parseInt(variationId),
          locationId: parseInt(locationId),
          qtyAvailable: '0',
          product: null,
          variation: null
        }
      })
    }

    return NextResponse.json({
      stock: {
        variationId: stock.productVariationId,
        locationId: stock.locationId,
        qtyAvailable: stock.qtyAvailable.toString(),
        product: stock.product,
        variation: stock.productVariation
      }
    })
  } catch (error: any) {
    console.error('Error querying stock:', error)
    return NextResponse.json(
      { error: 'Failed to query stock', details: error.message },
      { status: 500 }
    )
  }
}
