import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/products/[id]/variations
 * Get all variations for a specific product
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

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const productId = parseInt((await params).id)

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get all variations for this product
    const variations = await prisma.productVariation.findMany({
      where: {
        productId,
        deletedAt: null
      },
      select: {
        id: true,
        productId: true,
        name: true,
        sku: true,
        purchasePrice: true,
        sellingPrice: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({
      variations,
      count: variations.length
    })
  } catch (error) {
    console.error('Error fetching product variations:', error)
    return NextResponse.json({ error: 'Failed to fetch product variations' }, { status: 500 })
  }
}
