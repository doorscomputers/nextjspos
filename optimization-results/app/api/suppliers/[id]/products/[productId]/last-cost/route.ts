import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/[id]/products/[productId]/last-cost
 * Get the last purchase cost for a specific product from a specific supplier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; productId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const supplierId = parseInt(params.id)
    const productId = parseInt(params.productId)

    // Verify supplier belongs to business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Get the most recent purchase item for this product from this supplier
    const lastPurchaseItem = await prisma.purchaseItem.findFirst({
      where: {
        productId,
        purchase: {
          supplierId,
          businessId,
          status: {
            in: ['received', 'partial', 'completed'], // Only from received purchases
          },
        },
      },
      orderBy: [
        { purchase: { purchaseDate: 'desc' } }, // Most recent first
        { id: 'desc' },
      ],
      select: {
        unitCost: { select: { id: true, name: true } },
        purchase: {
          select: {
            purchaseDate: { select: { id: true, name: true } },
            purchaseOrderNumber: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!lastPurchaseItem) {
      return NextResponse.json(
        {
          error: 'No purchase history found for this product from this supplier',
          lastCost: null,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      lastCost: lastPurchaseItem.unitCost.toString(),
      lastPurchaseDate: lastPurchaseItem.purchase.purchaseDate,
      lastPurchaseOrderNumber: lastPurchaseItem.purchase.purchaseOrderNumber,
    })
  } catch (error: any) {
    console.error('Error fetching last purchase cost from supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch last purchase cost',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
