import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/inventory-corrections/[id]/reject
 * Reject an inventory correction (for mistakenly entered corrections)
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
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      `User#${userIdNumber}`

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission - need reject permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_REJECT)) {
      return NextResponse.json({ error: 'Forbidden - You do not have permission to reject inventory corrections' }, { status: 403 })
    }

    const correctionId = Number((await params).id)

    // Parse request body for rejection reason
    let rejectionReason = ''
    try {
      const body = await request.json()
      rejectionReason = body.reason || ''
    } catch {
      // Body is optional
    }

    // Get the correction with all related data
    const correction = await prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        businessId: businessIdNumber,
        deletedAt: null
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
        createdByUser: { select: { username: true, firstName: true, lastName: true } }
      }
    })

    if (!correction) {
      return NextResponse.json({ error: 'Inventory correction not found' }, { status: 404 })
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(correction.locationId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Check if already processed
    if (correction.status === 'approved') {
      return NextResponse.json({
        error: 'This inventory correction has already been approved and cannot be rejected'
      }, { status: 400 })
    }

    if (correction.status === 'rejected') {
      return NextResponse.json({
        error: 'This inventory correction has already been rejected'
      }, { status: 400 })
    }

    // Update the correction status to rejected
    const updatedCorrection = await prisma.inventoryCorrection.update({
      where: { id: correctionId },
      data: {
        status: 'rejected',
        approvedBy: userIdNumber, // Using approvedBy to track who rejected it
        approvedAt: new Date(),
        remarks: correction.remarks
          ? `${correction.remarks} | REJECTED: ${rejectionReason || 'No reason provided'}`
          : `REJECTED: ${rejectionReason || 'No reason provided'}`
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
        approvedByUser: { select: { username: true, firstName: true, lastName: true } },
        createdByUser: { select: { username: true, firstName: true, lastName: true } }
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: businessIdNumber,
        userId: userIdNumber,
        username: user.username,
        action: 'inventory_correction_reject' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [correction.productId],
        description: `Rejected inventory correction #${correctionId} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Reason: ${rejectionReason || 'No reason provided'}`,
        metadata: {
          correctionId,
          locationId: correction.locationId,
          locationName: correction.location.name,
          productId: correction.productId,
          productName: correction.product.name,
          productSku: correction.product.sku,
          variationId: correction.productVariationId,
          variationName: correction.productVariation.name,
          variationSku: correction.productVariation.sku,
          systemCount: correction.systemCount,
          physicalCount: correction.physicalCount,
          difference: correction.difference,
          reason: correction.reason,
          originalRemarks: correction.remarks,
          rejectionReason,
          rejectedBy: user.username,
          rejectedAt: new Date().toISOString(),
          createdBy: correction.createdByUser?.username
        },
        requiresPassword: false,
        passwordVerified: false,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: `Inventory correction rejected successfully.`,
      correction: updatedCorrection
    })
  } catch (error: any) {
    console.error('Error rejecting inventory correction:', error)
    return NextResponse.json({
      error: error.message || 'Failed to reject inventory correction'
    }, { status: 500 })
  }
}
