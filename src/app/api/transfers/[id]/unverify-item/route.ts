import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/unverify-item
 * Unverify (edit) a previously verified item before final completion
 * Allows corrections to verified quantities
 * IMPORTANT: Only works when transfer is still "verifying" or "verified" - NOT "completed"
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
    const userId = parseInt(String(user.id))

    const { id } = await params
    const transferId = parseInt(id)

    const body = await request.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VERIFY)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_VERIFY permission' },
        { status: 403 }
      )
    }

    // Get transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // CRITICAL: Can only unverify if transfer NOT completed yet
    if (transfer.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot edit items - transfer already completed and inventory updated' },
        { status: 400 }
      )
    }

    // Validate status - must be verifying or verified
    if (transfer.status !== 'verifying' && transfer.status !== 'verified') {
      return NextResponse.json(
        { error: `Cannot edit items with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Get the item
    const item = await prisma.stockTransferItem.findFirst({
      where: {
        id: parseInt(itemId),
        stockTransferId: transferId,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Unverify the item - reset to unverified state
    const updatedItem = await prisma.stockTransferItem.update({
      where: { id: parseInt(itemId) },
      data: {
        verified: false,
        verifiedBy: null,
        verifiedAt: null,
        // Keep receivedQuantity for user convenience (they can edit it)
        // receivedQuantity: remains as is
        // serialNumbersReceived: remains as is
        hasDiscrepancy: false,
        discrepancyNotes: null,
      },
    })

    // If transfer was "verified", move it back to "verifying"
    if (transfer.status === 'verified') {
      await prisma.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'verifying',
          verifiedBy: null,
          verifiedAt: null,
        },
      })
    }

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_item_unverify' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Unverified item in transfer ${transfer.transferNumber} for correction`,
      metadata: {
        transferNumber: transfer.transferNumber,
        itemId: parseInt(itemId),
        previousReceivedQty: item.receivedQuantity,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Item unverified - you can now edit the quantity',
      item: updatedItem,
    })
  } catch (error: any) {
    console.error('Error unverifying item:', error)
    return NextResponse.json(
      { error: 'Failed to unverify item', details: error.message },
      { status: 500 }
    )
  }
}
