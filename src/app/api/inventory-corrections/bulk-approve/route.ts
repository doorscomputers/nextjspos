import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { getCurrentStock, StockTransactionType, updateStock } from '@/lib/stockOperations'
import { sendTelegramInventoryCorrectionAlert } from '@/lib/telegram'

/**
 * POST /api/inventory-corrections/bulk-approve
 * Bulk approve multiple inventory corrections
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)) {
      return NextResponse.json(
        {
          error: 'Forbidden - You do not have permission to approve inventory corrections',
        },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { correctionIds } = body

    if (!correctionIds || !Array.isArray(correctionIds) || correctionIds.length === 0) {
      return NextResponse.json({ error: 'No correction IDs provided' }, { status: 400 })
    }

    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
      return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
    }
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`

    const corrections = await prisma.inventoryCorrection.findMany({
      where: {
        id: { in: correctionIds.map((id: number | string) => Number(id)) },
        businessId: businessIdNumber,
        deletedAt: null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
      },
    })

    if (corrections.length === 0) {
      return NextResponse.json({ error: 'No valid corrections found' }, { status: 404 })
    }

    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    const unauthorizedCorrections = corrections.filter(
      (c) => accessibleLocationIds !== null && !accessibleLocationIds.includes(c.locationId),
    )

    if (unauthorizedCorrections.length > 0) {
      return NextResponse.json(
        {
          error: 'You do not have access to some of the selected locations',
          unauthorizedCount: unauthorizedCorrections.length,
        },
        { status: 403 },
      )
    }

    const pendingCorrections = corrections.filter((c) => c.status === 'pending')
    const alreadyApproved = corrections.filter((c) => c.status === 'approved')

    if (pendingCorrections.length === 0) {
      return NextResponse.json(
        {
          error: 'All selected corrections are already approved',
          alreadyApprovedCount: alreadyApproved.length,
        },
        { status: 400 },
      )
    }

    const approvalResults: Array<{ success: boolean; id: number; error?: string }> = []

    for (const correction of pendingCorrections) {
      try {
        const recordedDifference = parseFloat(correction.difference.toString())
        const physicalCount = parseFloat(correction.physicalCount.toString())
        const systemCount = parseFloat(correction.systemCount.toString())

        const result = await prisma.$transaction(
          async (tx) => {
            const currentQty = await getCurrentStock({
              productVariationId: correction.productVariationId,
              locationId: correction.locationId,
              tx,
            })

            const adjustmentQty = physicalCount - currentQty
            const notes = `Inventory correction: ${correction.reason}${
              correction.remarks ? ' - ' + correction.remarks : ''
            }`

            const stockResult = await updateStock({
              tx,
              businessId: businessIdNumber,
              productId: correction.productId,
              productVariationId: correction.productVariationId,
              locationId: correction.locationId,
              quantity: adjustmentQty,
              type: StockTransactionType.ADJUSTMENT,
              referenceType: 'inventory_correction',
              referenceId: correction.id,
              userId: userIdNumber,
              userDisplayName,
              notes,
              allowNegative: true,
            })

            await tx.inventoryCorrection.update({
              where: { id: correction.id },
              data: {
                status: 'approved',
                approvedBy: userIdNumber,
                approvedAt: new Date(),
                stockTransactionId: stockResult.transaction.id,
                difference: recordedDifference,
                systemCount: currentQty,
                physicalCount: stockResult.newBalance,
              },
            })

            return {
              stockTransactionId: stockResult.transaction.id,
              previousQty: currentQty,
              newQty: stockResult.newBalance,
              unitCost: stockResult.transaction.unitCost
                ? parseFloat(stockResult.transaction.unitCost.toString())
                : 0,
            }
          },
          {
            maxWait: 10000,
            timeout: 30000,
          },
        )

        approvalResults.push({ success: true, id: correction.id })

        // Send Telegram notification for each approved correction
        sendTelegramInventoryCorrectionAlert({
          productName: correction.product.name,
          variationName: correction.productVariation.name,
          sku: correction.productVariation.sku || correction.product.sku,
          previousInventory: result.previousQty,
          currentInventory: result.newQty,
          difference: result.newQty - result.previousQty,
          reason: correction.reason,
          remarks: correction.remarks || undefined,
          locationName: correction.location.name,
          correctedBy: userDisplayName,
          timestamp: new Date()
        }).catch((telegramError) => {
          console.error(`[BULK APPROVE] Telegram notification failed for correction ${correction.id}:`, telegramError)
        })

        createAuditLog({
          businessId: businessIdNumber,
          userId: userIdNumber,
          username: user.username,
          action: 'inventory_correction_approve' as AuditAction,
          entityType: EntityType.PRODUCT,
          entityIds: [correction.productId],
          description: `Bulk approved inventory correction #${correction.id} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Stock adjusted from ${result.previousQty} to ${result.newQty} (${
            result.newQty - result.previousQty >= 0 ? '+' : ''
          }${result.newQty - result.previousQty})`,
          metadata: {
            correctionId: correction.id,
            stockTransactionId: result.stockTransactionId,
            locationId: correction.locationId,
            locationName: correction.location.name,
            productId: correction.productId,
            productName: correction.product.name,
            productSku: correction.product.sku,
            variationId: correction.productVariationId,
            variationName: correction.productVariation.name,
            variationSku: correction.productVariation.sku,
            systemCount,
            physicalCount: result.newQty,
            difference: result.newQty - result.previousQty,
            reason: correction.reason,
            remarks: correction.remarks,
            beforeQty: result.previousQty,
            afterQty: result.newQty,
            approvedBy: user.username,
            approvedAt: new Date().toISOString(),
            inventoryValueImpact: (result.newQty - result.previousQty) * result.unitCost,
            bulkApproval: true,
          },
          requiresPassword: false,
          passwordVerified: false,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request),
        }).catch((err) => {
          console.error(`[BULK APPROVE] Audit log failed for correction ${correction.id}:`, err)
        })
      } catch (error: any) {
        console.error(`[BULK APPROVE] ERROR processing correction ${correction.id}:`, error)
        approvalResults.push({
          success: false,
          id: correction.id,
          error: error.message || 'Unknown error',
        })
      }
    }

    const successful = approvalResults.filter((r) => r.success).map((r) => r.id)
    const failed = approvalResults.filter((r) => !r.success)

    if (successful.length > 0) {
      const verifiedCorrections = await prisma.inventoryCorrection.findMany({
        where: { id: { in: successful }, status: 'approved' },
        select: { id: true },
      })

      if (verifiedCorrections.length < successful.length) {
        console.warn(
          `[BULK APPROVE] Verification warning: expected ${successful.length} approvals, found ${verifiedCorrections.length}`,
        )
      }
    }

    return NextResponse.json({
      message: `Bulk approval completed. ${successful.length} approved, ${failed.length} failed, ${alreadyApproved.length} skipped (already approved)`,
      results: {
        successCount: successful.length,
        failedCount: failed.length,
        skippedCount: alreadyApproved.length,
        successful,
        failed: failed.map((f) => ({ id: f.id, error: f.error || 'Unknown error' })),
        skipped: alreadyApproved.map((c) => c.id),
      },
    })
  } catch (error: any) {
    console.error('Error in bulk approve:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to bulk approve inventory corrections',
      },
      { status: 500 },
    )
  }
}
