import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products/variations/search?sku=XXX
 * Search for a product variation by SKU (exact match)
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
    const sku = searchParams.get('sku')

    if (!sku) {
      return NextResponse.json({ error: 'SKU parameter is required' }, { status: 400 })
    }

    // Search for product variation by exact SKU match
    const variation = await prisma.productVariation.findFirst({
      where: {
        sku: sku.trim(),
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!variation) {
      return NextResponse.json({
        variation: null,
        message: 'No product found with this SKU'
      })
    }

    // Return variation with product info
    return NextResponse.json({
      variation: {
        id: variation.id,
        productId: variation.productId,
        productName: variation.product.name,
        name: variation.name,
        sku: variation.sku,
        purchasePrice: variation.purchasePrice,
        sellingPrice: variation.sellingPrice
      }
    })
  } catch (error: any) {
    console.error('Error searching product variation:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return NextResponse.json({
      error: 'Failed to search product variation',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
