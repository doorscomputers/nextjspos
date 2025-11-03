import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/products/[id]/grns
 * Fetch all approved GRNs (Purchase Receipts) that contain this product
 * This is used for creating purchase returns from product page
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
    const businessId = parseInt(String(user.businessId))
    const { id: productId } = await params

    // Check permission - must have PURCHASE_RETURN_CREATE to see this
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch the product to get all variations
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(productId),
        businessId: parseInt(businessId),
      },
      include: {
        variations: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const variationIds = product.variations.map((v) => v.id)

    // Find all approved purchase receipts that contain any variation of this product
    const receipts = await prisma.purchaseReceipt.findMany({
      where: {
        businessId: parseInt(businessId),
        status: 'approved', // Only approved GRNs can be returned
        items: {
          some: {
            productVariationId: {
              in: variationIds,
            },
          },
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        purchase: {
          select: {
            id: true,
            purchaseOrderNumber: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          where: {
            productVariationId: {
              in: variationIds,
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            productVariation: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            purchaseItem: {
              select: {
                unitCost: true,
              },
            },
          },
        },
      },
      orderBy: {
        receiptDate: 'desc',
      },
      take: 20, // Limit to recent 20 GRNs
    })

    // Format response
    const formattedReceipts = receipts.map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.receiptDate,
      status: receipt.status,
      supplierId: receipt.supplierId,
      supplierName: receipt.supplier.name,
      locationId: receipt.locationId,
      locationName: receipt.location?.name || 'Unknown',
      purchaseOrderNumber: receipt.purchase?.purchaseOrderNumber || null,
      items: receipt.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productVariationId: item.productVariationId,
        variationName: item.productVariation.name,
        sku: item.productVariation.sku,
        quantityReceived: Number(item.quantityReceived),
        unitCost: item.purchaseItem?.unitCost
          ? Number(item.purchaseItem.unitCost)
          : item.unitCost
          ? Number(item.unitCost)
          : 0,
      })),
      totalItems: receipt.items.length,
      totalQuantity: receipt.items.reduce(
        (sum, item) => sum + Number(item.quantityReceived),
        0
      ),
    }))

    return NextResponse.json({
      success: true,
      receipts: formattedReceipts,
      count: formattedReceipts.length,
    })
  } catch (error: any) {
    console.error('Error fetching GRNs for product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch GRNs', details: error.message },
      { status: 500 }
    )
  }
}
