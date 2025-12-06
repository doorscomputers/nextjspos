import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/purchases/[id]/cancel
 * Cancel a pending Purchase Order
 * Only pending POs (no goods received yet) can be cancelled
 */
export async function POST(
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
    const userId = user.id
    const { id } = await params
    const purchaseId = parseInt(id)

    // Check permission - requires PURCHASE_DELETE or PURCHASE_UPDATE permission
    const hasPermission = user.permissions?.includes(PERMISSIONS.PURCHASE_DELETE) ||
                          user.permissions?.includes(PERMISSIONS.PURCHASE_UPDATE)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to cancel purchase orders' },
        { status: 403 }
      )
    }

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      )
    }

    // Fetch purchase with items
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: businessId,
        deletedAt: null,
      },
      include: {
        items: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Validate PO is in a cancellable state
    if (purchase.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Purchase order is already cancelled' },
        { status: 400 }
      )
    }

    if (purchase.status === 'received') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed (received) purchase order' },
        { status: 400 }
      )
    }

    // Check if any items have been received
    const hasReceivedItems = purchase.items.some(
      (item) => parseFloat(item.quantityReceived.toString()) > 0
    )

    if (hasReceivedItems) {
      return NextResponse.json(
        { error: 'Cannot cancel purchase order with received goods. Use "Close PO" instead to finalize with partial delivery.' },
        { status: 400 }
      )
    }

    // Execute cancellation
    const result = await prisma.$transaction(async (tx) => {
      // Update purchase status to 'cancelled'
      const cancelledPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'cancelled',
          notes: purchase.notes
            ? `${purchase.notes}\n\n[CANCELLED] ${reason}`
            : `[CANCELLED] ${reason}`,
        },
      })

      return { purchase: cancelledPurchase }
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    // Create audit log
    await createAuditLog({
      businessId: businessId,
      userId: parseInt(userId),
      username: user.username,
      action: AuditAction.DELETE, // Using DELETE for cancellation
      entityType: EntityType.PURCHASE,
      entityId: purchaseId,
      description: `Cancelled Purchase Order ${purchase.purchaseOrderNumber}`,
      metadata: {
        purchaseOrderNumber: purchase.purchaseOrderNumber,
        supplierName: purchase.supplier.name,
        totalAmount: parseFloat(purchase.totalAmount.toString()),
        reason: reason,
        itemCount: purchase.items.length,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: {
        purchaseOrderNumber: purchase.purchaseOrderNumber,
        status: 'cancelled',
        reason: reason,
      },
    })
  } catch (error) {
    console.error('Error cancelling purchase order:', error)
    return NextResponse.json(
      {
        error: 'Failed to cancel purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
