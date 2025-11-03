import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/products/[id]/last-purchase-cost
 * Get the last purchase cost for a product
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
    const { id: productId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(productId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Get the last purchase item for this product
    const lastPurchaseItem = await prisma.purchaseItem.findFirst({
      where: {
        productId: parseInt(productId),
        purchase: {
          businessId: parseInt(businessId),
          deletedAt: null,
          status: {
            in: ['received', 'approved'], // Only from received/approved purchases
          },
        },
      },
      select: {
        purchasePrice: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!lastPurchaseItem) {
      // If no purchase found, try to get from product variation default cost
      const variation = await prisma.productVariation.findFirst({
        where: {
          productId: parseInt(productId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        select: {
          purchasePrice: true,
        },
      })

      return NextResponse.json({
        lastCost: variation?.purchasePrice ? parseFloat(variation.purchasePrice.toString()) : null,
        source: 'default',
      })
    }

    return NextResponse.json({
      lastCost: parseFloat(lastPurchaseItem.purchasePrice.toString()),
      source: 'purchase',
    })
  } catch (error) {
    console.error('Error fetching last purchase cost:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last purchase cost' },
      { status: 500 }
    )
  }
}
