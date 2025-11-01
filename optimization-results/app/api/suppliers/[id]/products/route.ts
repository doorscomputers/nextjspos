import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/[id]/products
 * Get all products that have been purchased from a specific supplier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const supplierId = parseInt(params.id)

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

    // Get distinct products that have been purchased from this supplier
    // Query PurchaseItem to find all unique product/variation combinations
    const purchasedItems = await prisma.purchaseItem.findMany({
      where: {
        purchase: {
          supplierId,
          businessId,
        },
      },
      select: {
        productId: { select: { id: true, name: true } },
        productVariationId: { select: { id: true, name: true } },
        product: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
          },
        },
      },
      distinct: ['productId'],
    })

    // Extract unique products
    const uniqueProducts = purchasedItems
      .map((item) => item.product)
      .filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      )

    return NextResponse.json({
      products: uniqueProducts,
      count: uniqueProducts.length,
    })
  } catch (error: any) {
    console.error('Error fetching products for supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
