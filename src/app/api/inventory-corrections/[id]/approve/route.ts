import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { getCurrentStock, StockTransactionType, updateStock } from '@/lib/stockOperations'
import { sendTelegramInventoryCorrectionAlert } from '@/lib/telegram'

/**
 * POST /api/inventory-corrections/[id]/approve
 * Approve an inventory correction and update stock levels
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

    // Check permission - need approve permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden - You do not have permission to approve inventory corrections' }, { status: 403 })
    }

    const correctionId = Number((await params).id)

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

    const recordedDifference = parseFloat(correction.difference.toString())
    const physicalCount = parseFloat(correction.physicalCount.toString())
    const systemCount = parseFloat(correction.systemCount.toString())

    const result = await prisma.$transaction(async (tx) => {
      const currentQty = await getCurrentStock({
        productVariationId: correction.productVariationId,
        locationId: correction.locationId,
        tx,
      })

      const adjustmentQty = physicalCount - currentQty

      const stockResult = await updateStock({
        tx,
        businessId: businessIdNumber,
        productId: correction.productId,
        productVariationId: correction.productVariationId,
        locationId: correction.locationId,
        quantity: adjustmentQty,
        type: StockTransactionType.ADJUSTMENT,
        referenceType: 'inventory_correction',
        referenceId: correctionId,
        userId: userIdNumber,
        userDisplayName,
        notes: `Inventory correction: ${correction.reason}${correction.remarks ? ' - ' + correction.remarks : ''}`,
        allowNegative: true,
      })

      const updatedCorrection = await tx.inventoryCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'approved',
          approvedBy: userIdNumber,
          approvedAt: new Date(),
          stockTransactionId: stockResult.transaction.id,
          difference: recordedDifference,
          systemCount: currentQty,
          physicalCount: stockResult.newBalance,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          productVariation: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, name: true } },
          approvedByUser: { select: { username: true, firstName: true, lastName: true } },
        },
      })

      return { correction: updatedCorrection, stockResult, previousQty: currentQty }
    })

    const actualDifference = result.stockResult.newBalance - result.previousQty

    try {
      await createAuditLog({
        businessId: businessIdNumber,
        userId: userIdNumber,
        username: user.username,
        action: 'inventory_correction_approve' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [correction.productId],
        description: `Approved inventory correction #${correctionId} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Stock adjusted from ${result.previousQty} to ${result.stockResult.newBalance} (${actualDifference >= 0 ? '+' : ''}${actualDifference})`,
        metadata: {
          correctionId,
          stockTransactionId: result.stockResult.transaction.id,
          locationId: correction.locationId,
          locationName: correction.location.name,
          productId: correction.productId,
          productName: correction.product.name,
          productSku: correction.product.sku,
          variationId: correction.productVariationId,
          variationName: correction.productVariation.name,
          variationSku: correction.productVariation.sku,
          systemCount,
          physicalCount: result.stockResult.newBalance,
          difference: actualDifference,
          reason: correction.reason,
          remarks: correction.remarks,
          beforeQty: result.previousQty,
          afterQty: result.stockResult.newBalance,
          approvedBy: user.username,
          approvedAt: new Date().toISOString(),
          inventoryValueImpact:
            actualDifference *
            (result.stockResult.transaction.unitCost
              ? parseFloat(result.stockResult.transaction.unitCost.toString())
              : 0),
        },
        requiresPassword: false,
        passwordVerified: false,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    // Send Telegram notification to business owner
    try {
      await sendTelegramInventoryCorrectionAlert({
        productName: correction.product.name,
        variationName: correction.productVariation.name,
        sku: correction.productVariation.sku || correction.product.sku,
        previousInventory: result.previousQty,
        currentInventory: result.stockResult.newBalance,
        difference: actualDifference,
        reason: correction.reason,
        remarks: correction.remarks || undefined,
        locationName: correction.location.name,
        correctedBy: userDisplayName,
        timestamp: new Date()
      })
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError)
      // Don't fail the request if Telegram notification fails
    }

    return NextResponse.json({
      message: `Inventory correction approved successfully. Stock adjusted from ${result.previousQty} to ${result.stockResult.newBalance}.`,
      correction: result.correction,
      stockTransaction: result.stockResult.transaction,
    })
  } catch (error: any) {
    console.error('Error approving inventory correction:', error)
    return NextResponse.json({
      error: error.message || 'Failed to approve inventory correction'
    }, { status: 500 })
  }
}
