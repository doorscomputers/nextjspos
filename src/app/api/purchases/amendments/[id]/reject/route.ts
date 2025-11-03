import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/purchases/amendments/[id]/reject
 * Reject a purchase amendment
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_AMENDMENT_REJECT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const amendmentId = parseInt(id)
    const body = await request.json()
    const { rejectionReason } = body

    if (!rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Fetch amendment
    const amendment = await prisma.purchaseAmendment.findFirst({
      where: {
        id: amendmentId,
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
      },
    })

    if (!amendment) {
      return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
    }

    // Check if already approved or rejected
    if (amendment.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved amendment' }, { status: 400 })
    }

    if (amendment.status === 'rejected') {
      return NextResponse.json({ error: 'Amendment already rejected' }, { status: 400 })
    }

    // Update amendment status
    const rejectedAmendment = await prisma.purchaseAmendment.update({
      where: { id: amendment.id },
      data: {
        status: 'rejected',
        rejectedBy: parseInt(userId),
        rejectedAt: new Date(),
        rejectionReason,
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_amendment_reject' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [amendment.id, amendment.purchaseId],
      description: `Rejected Amendment #${amendment.amendmentNumber} for PO ${amendment.purchase.referenceNo}`,
      metadata: {
        amendmentId: amendment.id,
        amendmentNumber: amendment.amendmentNumber,
        purchaseId: amendment.purchaseId,
        referenceNo: amendment.purchase.referenceNo,
        supplierId: amendment.purchase.supplierId,
        supplierName: amendment.purchase.supplier.name,
        amendmentReason: amendment.amendmentReason,
        rejectionReason,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete data
    const completeAmendment = await prisma.purchaseAmendment.findUnique({
      where: { id: amendment.id },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Amendment rejected successfully',
      data: completeAmendment,
    })
  } catch (error: any) {
    console.error('Error rejecting amendment:', error)
    return NextResponse.json(
      { error: 'Failed to reject amendment', details: error.message },
      { status: 500 }
    )
  }
}
