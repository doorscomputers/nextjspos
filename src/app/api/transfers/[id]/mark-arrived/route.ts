import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'

/**
 * POST /api/transfers/[id]/mark-arrived
 * Destination confirms transfer has arrived
 * Status: in_transit → arrived
 * Ready for verification
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
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)

    const { id } = await params
    const transferId = parseInt(id)

    const body = await request.json()
    const { notes } = body

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_RECEIVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_RECEIVE permission' },
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
    if (transfer.status !== 'in_transit') {
      return NextResponse.json(
        { error: `Cannot mark arrived transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Validate receiver has access to destination location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: parseInt(userId),
          locationId: transfer.toLocationId,
        },
      })
      if (!userLocation) {
        return NextResponse.json(
          { error: 'No access to destination location. Only users assigned to the receiving location can mark transfers as arrived.' },
          { status: 403 }
        )
      }
    }

    // CONFIGURABLE SOD VALIDATION
    // Check business rules for separation of duties
    // Note: Mark-arrived uses 'receive' validation as it's part of the receiving workflow
    const userRoles = await getUserRoles(userIdNumber)
    const sodValidation = await validateSOD({
      businessId: businessIdNumber,
      userId: userIdNumber,
      action: 'receive',  // Mark-arrived is the first step of receiving
      entity: {
        id: transfer.id,
        createdBy: transfer.createdBy,
        checkedBy: transfer.checkedBy,
        sentBy: transfer.sentBy,
        receivedBy: transfer.receivedBy
      },
      entityType: 'transfer',
      userRoles
    })

    if (!sodValidation.allowed) {
      return NextResponse.json(
        {
          error: sodValidation.reason,
          code: sodValidation.code,
          configurable: sodValidation.configurable,
          suggestion: sodValidation.suggestion,
          ruleField: sodValidation.ruleField
        },
        { status: 403 }
      )
    }

    // Update transfer to arrived status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'arrived',
        arrivedBy: parseInt(userId),
        arrivedAt: new Date(),
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_arrived' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Transfer ${transfer.transferNumber} arrived at destination`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
        notes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Transfer marked as arrived - ready for verification',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error marking transfer arrived:', error)
    return NextResponse.json(
      { error: 'Failed to mark transfer arrived', details: error.message },
      { status: 500 }
    )
  }
}
