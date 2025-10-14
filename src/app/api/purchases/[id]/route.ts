import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Fetch a single purchase order by ID (Fixed for Next.js 15)
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Await params in Next.js 15
    const { id } = await params
    const purchaseId = parseInt(id)

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase ID' },
        { status: 400 }
      )
    }

    // Fetch purchase order with all related data
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        items: {
          include: {
            receiptItems: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Manually fetch product and variation details for each item
    const itemsWithDetails = await Promise.all(
      purchase.items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            sku: true,
            enableProductInfo: true,
          },
        })

        const variation = await prisma.productVariation.findUnique({
          where: { id: item.productVariationId },
          select: {
            id: true,
            name: true,
          },
        })

        return {
          ...item,
          product,
          variation,
        }
      })
    )

    const purchaseWithDetails = {
      ...purchase,
      items: itemsWithDetails,
    }

    return NextResponse.json({ data: purchaseWithDetails })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}
