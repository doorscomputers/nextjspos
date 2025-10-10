import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/verify-item
 * Verify individual transfer item with checkbox
 * Records received quantity, serial numbers, and discrepancies
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
    const businessId = user.businessId
    const userId = user.id

    const { id } = await params
    const transferId = parseInt(id)

    const body = await request.json()
    const { 
      itemId, 
      receivedQuantity, 
      serialNumbersReceived, 
      hasDiscrepancy, 
      discrepancyNotes 
    } = body

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

    // Validate status
    if (transfer.status !== 'verifying') {
      return NextResponse.json(
        { error: `Cannot verify items with status: ${transfer.status}` },
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

    // Update item verification
    const updatedItem = await prisma.stockTransferItem.update({
      where: { id: parseInt(itemId) },
      data: {
        verified: true,
        verifiedBy: parseInt(userId),
        verifiedAt: new Date(),
        receivedQuantity: receivedQuantity !== undefined ? receivedQuantity : item.quantity,
        serialNumbersReceived: serialNumbersReceived || item.serialNumbersSent,
        hasDiscrepancy: hasDiscrepancy || false,
        discrepancyNotes: discrepancyNotes || null,
      },
    })

    // If there's a discrepancy, mark the transfer
    if (hasDiscrepancy) {
      await prisma.stockTransfer.update({
        where: { id: transferId },
        data: {
          hasDiscrepancy: true,
        },
      })
    }

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_item_verify' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Verified item in transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        itemId: parseInt(itemId),
        hasDiscrepancy: hasDiscrepancy || false,
        discrepancyNotes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Item verified successfully',
      item: updatedItem,
    })
  } catch (error: any) {
    console.error('Error verifying item:', error)
    return NextResponse.json(
      { error: 'Failed to verify item', details: error.message },
      { status: 500 }
    )
  }
}
