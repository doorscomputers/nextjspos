import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/inventory-corrections/[id]/approve
 * Approve an inventory correction and update stock levels
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission - need approve permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden - You do not have permission to approve inventory corrections' }, { status: 403 })
    }

    const correctionId = parseInt(params.id)

    // Get the correction with all related data
    const correction = await prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } }
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

    // Check if already approved
    if (correction.status === 'approved') {
      return NextResponse.json({
        error: 'This inventory correction has already been approved'
      }, { status: 400 })
    }

    const difference = parseFloat(correction.difference.toString())
    const physicalCount = parseFloat(correction.physicalCount.toString())
    const systemCount = parseFloat(correction.systemCount.toString())

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current inventory
      const inventory = await tx.variationLocationDetails.findFirst({
        where: {
          productVariationId: correction.productVariationId,
          locationId: correction.locationId
        }
      })

      if (!inventory) {
        throw new Error('Inventory record not found for this product at this location')
      }

      const currentQty = parseFloat(inventory.qtyAvailable.toString())

      // 2. Create stock transaction record
      const stockTransaction = await tx.stockTransaction.create({
        data: {
          businessId: parseInt(businessId),
          locationId: correction.locationId,
          productId: correction.productId,
          productVariationId: correction.productVariationId,
          type: 'adjustment',
          quantity: difference, // Can be positive or negative
          unitCost: parseFloat(inventory.purchasePrice?.toString() || '0'),
          balanceQty: physicalCount,
          referenceType: 'inventory_correction',
          referenceId: correctionId,
          createdBy: parseInt(user.id.toString()),
          notes: `Inventory correction: ${correction.reason}${correction.remarks ? ' - ' + correction.remarks : ''}`
        }
      })

      // 3. Update inventory quantity
      await tx.variationLocationDetails.update({
        where: {
          id: inventory.id
        },
        data: {
          qtyAvailable: physicalCount
        }
      })

      // 4. Update correction status
      const updatedCorrection = await tx.inventoryCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'approved',
          approvedBy: parseInt(user.id.toString()),
          approvedAt: new Date(),
          stockTransactionId: stockTransaction.id
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          productVariation: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, name: true } },
          approvedByUser: { select: { username: true, firstName: true, lastName: true } }
        }
      })

      return { correction: updatedCorrection, stockTransaction, inventory }
    })

    // Create comprehensive audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'inventory_correction_approve' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [correction.productId],
        description: `Approved inventory correction #${correctionId} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Stock adjusted from ${systemCount} to ${physicalCount} (${difference >= 0 ? '+' : ''}${difference})`,
        metadata: {
          correctionId,
          stockTransactionId: result.stockTransaction.id,
          locationId: correction.locationId,
          locationName: correction.location.name,
          productId: correction.productId,
          productName: correction.product.name,
          productSku: correction.product.sku,
          variationId: correction.productVariationId,
          variationName: correction.productVariation.name,
          variationSku: correction.productVariation.sku,
          systemCount,
          physicalCount,
          difference,
          reason: correction.reason,
          remarks: correction.remarks,
          beforeQty: systemCount,
          afterQty: physicalCount,
          approvedBy: user.username,
          approvedAt: new Date().toISOString(),
          inventoryValueImpact: difference * parseFloat(result.inventory.purchasePrice?.toString() || '0')
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
      message: `Inventory correction approved successfully. Stock adjusted from ${systemCount} to ${physicalCount}.`,
      correction: result.correction,
      stockTransaction: result.stockTransaction
    })
  } catch (error: any) {
    console.error('Error approving inventory correction:', error)
    return NextResponse.json({
      error: error.message || 'Failed to approve inventory correction'
    }, { status: 500 })
  }
}
