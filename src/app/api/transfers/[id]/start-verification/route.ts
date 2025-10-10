import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/start-verification
 * Start item-by-item verification process
 * Status: arrived → verifying
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
    if (transfer.status !== 'arrived') {
      return NextResponse.json(
        { error: `Cannot start verification with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Validate verifier has access to destination location
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
          { error: 'No access to destination location' },
          { status: 403 }
        )
      }
    }

    // Update transfer to verifying status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'verifying',
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_verification_start' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Started verification of transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Verification started - verify each item',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error starting verification:', error)
    return NextResponse.json(
      { error: 'Failed to start verification', details: error.message },
      { status: 500 }
    )
  }
}
