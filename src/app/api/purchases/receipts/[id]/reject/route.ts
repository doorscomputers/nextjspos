import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/purchases/receipts/[id]/reject
 * Reject a pending purchase receipt
 * This action prevents the receipt from being approved and marks it as rejected
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
    const { id: receiptId } = await params

    // Check permission - user must have approval permission to reject
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires PURCHASE_RECEIPT_APPROVE permission' },
        { status: 403 }
      )
    }

    // Get rejection reason from request body
    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Fetch receipt with all details
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: parseInt(receiptId),
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
        supplier: true,
        items: true,
      },
    })

    if (!receipt) {
      return NextResponse.json(
        { error: 'Purchase receipt not found' },
        { status: 404 }
      )
    }

    // Check if already approved
    if (receipt.status === 'approved') {
      return NextResponse.json(
        { error: 'This receipt has already been approved and cannot be rejected. Use Inventory Corrections if adjustments are needed.' },
        { status: 400 }
      )
    }

    // Check if already rejected
    if (receipt.status === 'rejected') {
      return NextResponse.json(
        { error: 'This receipt has already been rejected' },
        { status: 400 }
      )
    }

    // Verify location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocationIds = user.locationIds || []

      if (!userLocationIds.includes(receipt.locationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Update receipt status to rejected
    const updatedReceipt = await prisma.purchaseReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'rejected',
        approvedBy: parseInt(userId), // Record who rejected it
        approvedAt: new Date(), // Record when it was rejected
        notes: receipt.notes
          ? `${receipt.notes}\n\n[REJECTED] ${reason}`
          : `[REJECTED] ${reason}`,
      },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            purchaseItem: true,
          },
        },
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_receipt_reject' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [updatedReceipt.id],
      description: `Rejected GRN ${receipt.receiptNumber}${receipt.purchase ? ` for PO ${receipt.purchase.purchaseOrderNumber}` : ''}`,
      metadata: {
        receiptId: updatedReceipt.id,
        grnNumber: receipt.receiptNumber,
        purchaseId: receipt.purchaseId,
        poNumber: receipt.purchase?.purchaseOrderNumber,
        supplierId: receipt.purchase?.supplierId || receipt.supplierId,
        supplierName: receipt.purchase?.supplier.name || receipt.supplier.name,
        locationId: receipt.locationId,
        itemCount: receipt.items.length,
        rejectionReason: reason,
        rejectedBy: parseInt(userId),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase receipt rejected successfully',
      data: updatedReceipt,
    })
  } catch (error: any) {
    console.error('Error rejecting purchase receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to reject purchase receipt',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
