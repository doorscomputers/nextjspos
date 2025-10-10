import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/check-approve
 * Origin checker approves transfer after verifying physical items
 * Status: pending_check → checked
 * CRITICAL: Checker must be different from creator (best practice)
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
    const { notes } = body

    // Check permission - must have CHECK permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CHECK)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_CHECK permission' },
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
    if (transfer.status !== 'pending_check') {
      return NextResponse.json(
        { error: `Cannot approve transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Validate checker has access to origin location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: parseInt(userId),
          locationId: transfer.fromLocationId,
        },
      })
      if (!userLocation) {
        return NextResponse.json(
          { error: 'No access to origin location' },
          { status: 403 }
        )
      }
    }

    // Best practice: Checker should be different from creator
    if (transfer.createdBy === parseInt(userId)) {
      console.warn(`Warning: User ${userId} is checking their own transfer ${transferId}`)
      // Allow but log warning - you can enforce this by uncommenting:
      // return NextResponse.json(
      //   { error: 'Checker must be different from creator' },
      //   { status: 400 }
      // )
    }

    // Update transfer to checked status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'checked',
        checkedBy: parseInt(userId),
        checkedAt: new Date(),
        checkerNotes: notes || null,
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_check_approve' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Approved transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        checkerNotes: notes,
        itemCount: transfer.items.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Transfer approved - ready to send',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error approving transfer:', error)
    return NextResponse.json(
      { error: 'Failed to approve transfer', details: error.message },
      { status: 500 }
    )
  }
}
