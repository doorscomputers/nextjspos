import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/submit-for-check
 * Submit transfer for checking by origin checker
 * Status: draft → pending_check
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    if (transfer.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot submit transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Validate has items
    if (transfer.items.length === 0) {
      return NextResponse.json(
        { error: 'Cannot submit empty transfer' },
        { status: 400 }
      )
    }

    // Update status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'pending_check',
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_submit' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Submitted transfer ${transfer.transferNumber} for checking`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Transfer submitted for checking',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error submitting transfer:', error)
    return NextResponse.json(
      { error: 'Failed to submit transfer', details: error.message },
      { status: 500 }
    )
  }
}
