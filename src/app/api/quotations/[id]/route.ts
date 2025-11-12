import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/quotations/[id]/stock-check - Check stock availability for quotation items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const quotationId = parseInt((await params).id)

    // Fetch quotation with items
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        businessId: parseInt(user.businessId),
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                variations: true,
              },
            },
          },
        },
        customer: true,
      },
    })

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found or access denied' },
        { status: 404 }
      )
    }

    // Check stock availability for each item at the quotation's location
    const itemsWithStock = await Promise.all(
      quotation.items.map(async (item) => {
        // Get current stock for this variation at the quotation's location
        const productHistory = await prisma.productHistory.findFirst({
          where: {
            businessId: parseInt(user.businessId),
            locationId: quotation.locationId,
            productId: item.productId,
            productVariationId: item.productVariationId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        const currentStock = productHistory?.quantityAfter || 0
        const requestedQty = parseFloat(item.quantity.toString())
        const isAvailable = currentStock >= requestedQty
        const shortage = isAvailable ? 0 : requestedQty - currentStock

        return {
          ...item,
          productName: item.product.name,
          productSku: item.product.variations.find(
            (v: any) => v.id === item.productVariationId
          )?.sku || item.product.sku,
          currentStock: parseFloat(currentStock.toString()),
          requestedQuantity: requestedQty,
          isAvailable,
          shortage: parseFloat(shortage.toString()),
        }
      })
    )

    // Calculate overall availability
    const allItemsAvailable = itemsWithStock.every((item) => item.isAvailable)
    const unavailableItems = itemsWithStock.filter((item) => !item.isAvailable)

    return NextResponse.json({
      quotation: {
        ...quotation,
        items: itemsWithStock,
      },
      stockStatus: {
        allItemsAvailable,
        unavailableCount: unavailableItems.length,
        unavailableItems: unavailableItems.map((item) => ({
          productName: item.productName,
          productSku: item.productSku,
          requestedQuantity: item.requestedQuantity,
          currentStock: item.currentStock,
          shortage: item.shortage,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error checking quotation stock:', error)
    return NextResponse.json(
      {
        error: 'Failed to check stock availability',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/quotations/[id] - Delete a quotation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission - use SELL_CREATE permission since quotations are draft sales
    // Users who can create quotations should be able to delete their own drafts
    if (!hasPermission(user, PERMISSIONS.SELL_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing sell.create permission' },
        { status: 403 }
      )
    }

    const quotationId = parseInt((await params).id)

    // Find the quotation first to verify ownership and get details
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        businessId: parseInt(user.businessId),
      },
    })

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the quotation (cascade will delete items)
    await prisma.quotation.delete({
      where: { id: quotationId },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: 'quotation_delete' as AuditAction,
      entityType: 'quotation' as EntityType,
      entityIds: [quotationId],
      description: `Deleted quotation ${quotation.quotationNumber}`,
      metadata: {
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customerName,
        totalAmount: parseFloat(quotation.totalAmount.toString()),
      },
    })

    return NextResponse.json(
      { message: 'Quotation deleted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error deleting quotation:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete quotation',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
