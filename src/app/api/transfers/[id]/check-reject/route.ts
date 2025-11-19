import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { sendTransferRejectionAlert } from '@/lib/alert-service'

/**
 * POST /api/transfers/[id]/check-reject
 * Origin checker rejects transfer, sends back to draft
 * Status: pending_check → draft
 * Creator can then fix issues and resubmit
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
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CHECK)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_CHECK permission' },
        { status: 403 }
      )
    }

    // Get transfer with locations and items
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        fromLocation: true,
        toLocation: true,
        items: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status
    if (transfer.status !== 'pending_check') {
      return NextResponse.json(
        { error: `Cannot reject transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Update transfer back to draft
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'draft',
        checkerNotes: reason,
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_check_reject' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Rejected transfer ${transfer.transferNumber} - returned to draft`,
      metadata: {
        transferNumber: transfer.transferNumber,
        rejectionReason: reason,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    // OPTIMIZED: Send alert notifications (async, fire and forget - don't block response)
    (async () => {
      try {
        const totalQuantity = transfer.items.reduce((sum, item) => {
          return sum + parseFloat(item.quantity.toString())
        }, 0)

        await sendTransferRejectionAlert({
          transferNumber: transfer.transferNumber,
          fromLocation: transfer.fromLocation.name,
          toLocation: transfer.toLocation.name,
          itemCount: transfer.items.length,
          totalQuantity,
          rejectedBy: user.username,
          rejectionReason: reason,
          timestamp: new Date(),
        })
      } catch (error) {
        console.error('[AlertService] Failed to send transfer rejection alert:', error)
      }
    })()

    return NextResponse.json({
      message: 'Transfer rejected - returned to draft for corrections',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error rejecting transfer:', error)
    return NextResponse.json(
      { error: 'Failed to reject transfer', details: error.message },
      { status: 500 }
    )
  }
}
