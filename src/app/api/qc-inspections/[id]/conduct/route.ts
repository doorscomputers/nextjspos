import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/qc-inspections/[id]/conduct
 * Conduct/perform a quality control inspection
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_INSPECTION_CONDUCT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const inspectionId = parseInt(id)
    const body = await request.json()
    const {
      items,
      checkItems,
      inspectorNotes,
      overallResult,
    } = body

    // Validate required fields
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid inspection items data' },
        { status: 400 }
      )
    }

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
      },
    })

    if (!inspection) {
      return NextResponse.json(
        { error: 'QC inspection not found' },
        { status: 404 }
      )
    }

    // Check if already inspected
    if (inspection.status === 'inspected' || inspection.status === 'approved') {
      return NextResponse.json(
        { error: 'Inspection already completed' },
        { status: 400 }
      )
    }

    // Update inspection in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update inspection items
      for (const item of items) {
        await tx.qualityControlItem.update({
          where: { id: item.id },
          data: {
            quantityInspected: parseFloat(item.quantityInspected),
            quantityPassed: parseFloat(item.quantityPassed),
            quantityFailed: parseFloat(item.quantityFailed),
            inspectionResult: item.inspectionResult,
            defectType: item.defectType || null,
            defectDescription: item.defectDescription || null,
            defectSeverity: item.defectSeverity || null,
            actionTaken: item.actionTaken || null,
            notes: item.notes || null,
          },
        }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })
      }

      // 2. Create or update check items
      if (checkItems && Array.isArray(checkItems)) {
        // Delete existing check items
        await tx.qualityControlCheckItem.deleteMany({
          where: {
            qualityControlInspectionId: inspectionId,
          },
        })

        // Create new check items
        for (const checkItem of checkItems) {
          await tx.qualityControlCheckItem.create({
            data: {
              qualityControlInspectionId: inspectionId,
              checklistTemplateId: checkItem.checklistTemplateId || null,
              checkName: checkItem.checkName,
              checkCategory: checkItem.checkCategory,
              checkResult: checkItem.checkResult,
              checkValue: checkItem.checkValue || null,
              expectedValue: checkItem.expectedValue || null,
              isCritical: checkItem.isCritical || false,
              notes: checkItem.notes || null,
            },
          })
        }
      }

      // 3. Update inspection status
      const updatedInspection = await tx.qualityControlInspection.update({
        where: { id: inspectionId },
        data: {
          status: 'inspected',
          overallResult: overallResult || null,
          inspectedBy: parseInt(userId),
          inspectedAt: new Date(),
          inspectorNotes: inspectorNotes || null,
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

      return updatedInspection
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_inspection_conduct' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [inspection.id, inspection.purchaseReceiptId],
      description: `Conducted QC Inspection ${inspection.inspectionNumber}`,
      metadata: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        overallResult: overallResult || 'pending',
        purchaseReceiptId: inspection.purchaseReceiptId,
        grnNumber: inspection.purchaseReceipt.grnNumber,
        purchaseId: inspection.purchaseReceipt.purchaseId,
        supplierId: inspection.purchaseReceipt.purchase.supplierId,
        supplierName: inspection.purchaseReceipt.purchase.supplier.name,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC inspection conducted successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error conducting QC inspection:', error)
    return NextResponse.json(
      { error: 'Failed to conduct QC inspection', details: error.message },
      { status: 500 }
    )
  }
}
