import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/qc-inspections/[id]/approve
 * Approve a quality control inspection
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
    if (!user.permissions?.includes(PERMISSIONS.QC_INSPECTION_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const inspectionId = parseInt(id)
    const body = await request.json()
    const { approvalNotes } = body

    // Fetch inspection
    const inspection = await prisma.qualityControlInspection.findFirst({
      where: {
        id: inspectionId,
        businessId: parseInt(businessId),
      },
      include: {
        purchaseReceipt: {
          include: {
            purchase: {
              include: {
                supplier: true,
              },
            },
          },
        },
        items: true,
        checkItems: true,
      },
    })

    if (!inspection) {
      return NextResponse.json(
        { error: 'QC inspection not found' },
        { status: 404 }
      )
    }

    // Check if inspection has been conducted
    if (inspection.status !== 'inspected') {
      return NextResponse.json(
        { error: 'Cannot approve inspection that has not been conducted' },
        { status: 400 }
      )
    }

    // Check if already approved
    if (inspection.status === 'approved') {
      return NextResponse.json(
        { error: 'Inspection already approved' },
        { status: 400 }
      )
    }

    // Update inspection status
    const approvedInspection = await prisma.qualityControlInspection.update({
      where: { id: inspectionId },
      data: {
        status: 'approved',
        approvedBy: parseInt(userId),
        approvedAt: new Date(),
        approvalNotes: approvalNotes || null,
      },
      include: {
        purchaseReceipt: {
          include: {
            purchase: {
              include: {
                supplier: true,
              },
            },
          },
        },
        items: {
          include: {
            product: true,
            productVariation: true,
          },
        },
        checkItems: true,
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_inspection_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [inspection.id, inspection.purchaseReceiptId],
      description: `Approved QC Inspection ${inspection.inspectionNumber}`,
      metadata: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        overallResult: inspection.overallResult,
        purchaseReceiptId: inspection.purchaseReceiptId,
        grnNumber: inspection.purchaseReceipt.grnNumber,
        purchaseId: inspection.purchaseReceipt.purchaseId,
        supplierId: inspection.purchaseReceipt.purchase.supplierId,
        supplierName: inspection.purchaseReceipt.purchase.supplier.name,
        approvalNotes,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC inspection approved successfully',
      data: approvedInspection,
    })
  } catch (error: any) {
    console.error('Error approving QC inspection:', error)
    return NextResponse.json(
      { error: 'Failed to approve QC inspection', details: error.message },
      { status: 500 }
    )
  }
}
