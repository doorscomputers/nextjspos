import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/inventory-corrections/bulk-approve
 * Bulk approve multiple inventory corrections with parallel processing for speed
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json({
        error: 'Forbidden - You do not have permission to approve inventory corrections'
      }, { status: 403 })
    }

    const body = await request.json()
    const { correctionIds } = body

    if (!correctionIds || !Array.isArray(correctionIds) || correctionIds.length === 0) {
      return NextResponse.json({ error: 'No correction IDs provided' }, { status: 400 })
    }

    // Get all corrections to approve
    const corrections = await prisma.inventoryCorrection.findMany({
      where: {
        id: { in: correctionIds.map(id => parseInt(id)) },
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } }
      }
    })

    if (corrections.length === 0) {
      return NextResponse.json({ error: 'No valid corrections found' }, { status: 404 })
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    const unauthorizedCorrections = corrections.filter(c =>
      accessibleLocationIds !== null && !accessibleLocationIds.includes(c.locationId)
    )

    if (unauthorizedCorrections.length > 0) {
      return NextResponse.json(
        {
          error: 'You do not have access to some of the selected locations',
          unauthorizedCount: unauthorizedCorrections.length
        },
        { status: 403 }
      )
    }

    // Filter out already approved corrections
    const pendingCorrections = corrections.filter(c => c.status === 'pending')
    const alreadyApproved = corrections.filter(c => c.status === 'approved')

    if (pendingCorrections.length === 0) {
      return NextResponse.json({
        error: 'All selected corrections are already approved',
        alreadyApprovedCount: alreadyApproved.length
      }, { status: 400 })
    }

    // Process corrections SEQUENTIALLY for data integrity (can parallelize later once working)
    console.log(`[BULK APPROVE] Starting sequential processing of ${pendingCorrections.length} corrections`)
    const approvalResults: Array<{ success: boolean; id: number; error?: string }> = []

    for (const correction of pendingCorrections) {
      try {
        console.log(`\n[BULK APPROVE] ====== Processing correction ID ${correction.id} ======`)
        const difference = parseFloat(correction.difference.toString())
        const physicalCount = parseFloat(correction.physicalCount.toString())
        const systemCount = parseFloat(correction.systemCount.toString())

        console.log(`[BULK APPROVE] Values: system=${systemCount}, physical=${physicalCount}, diff=${difference}`)

        // Use transaction to ensure ALL operations succeed or ALL fail
        const result = await prisma.$transaction(async (tx) => {
          console.log(`[BULK APPROVE] Transaction started for correction ID ${correction.id}`)

          // 1. Get current inventory
          const inventory = await tx.variationLocationDetails.findFirst({
            where: {
              productVariationId: correction.productVariationId,
              locationId: correction.locationId
            }
          })

          if (!inventory) {
            throw new Error(`Inventory record not found for variation ${correction.productVariationId} at location ${correction.locationId}`)
          }

          const currentQty = parseFloat(inventory.qtyAvailable.toString())
          console.log(`[BULK APPROVE] Found inventory ID ${inventory.id}: Current qty = ${currentQty}`)

          // 2. Create stock transaction record (for history/audit trail)
          const stockTransaction = await tx.stockTransaction.create({
            data: {
              businessId: parseInt(businessId),
              locationId: correction.locationId,
              productId: correction.productId,
              productVariationId: correction.productVariationId,
              type: 'adjustment',
              quantity: difference,
              unitCost: parseFloat(inventory.purchasePrice?.toString() || '0'),
              balanceQty: physicalCount,
              referenceType: 'inventory_correction',
              referenceId: correction.id,
              createdBy: parseInt(user.id.toString()),
              notes: `Inventory correction: ${correction.reason}${correction.remarks ? ' - ' + correction.remarks : ''}`
            }
          })
          console.log(`[BULK APPROVE] ✓ Stock transaction created: ID ${stockTransaction.id}`)

          // 3. Update inventory quantity - THIS IS THE CRITICAL UPDATE
          const updatedInventory = await tx.variationLocationDetails.update({
            where: {
              id: inventory.id
            },
            data: {
              qtyAvailable: physicalCount
            }
          })
          console.log(`[BULK APPROVE] ✓ Inventory updated: ${currentQty} → ${parseFloat(updatedInventory.qtyAvailable.toString())}`)

          // 4. Update correction status to approved
          const updatedCorrection = await tx.inventoryCorrection.update({
            where: { id: correction.id },
            data: {
              status: 'approved',
              approvedBy: parseInt(user.id.toString()),
              approvedAt: new Date(),
              stockTransactionId: stockTransaction.id
            }
          })
          console.log(`[BULK APPROVE] ✓ Correction status updated: ${updatedCorrection.status}`)
          console.log(`[BULK APPROVE] ✓ Approved by: ${updatedCorrection.approvedBy} at ${updatedCorrection.approvedAt}`)

          return {
            stockTransactionId: stockTransaction.id,
            inventoryId: inventory.id,
            oldQty: currentQty,
            newQty: parseFloat(updatedInventory.qtyAvailable.toString())
          }
        }, {
          maxWait: 10000, // Maximum time to wait for transaction to start (10 seconds)
          timeout: 30000,  // Maximum time for transaction to complete (30 seconds)
        })

        console.log(`[BULK APPROVE] ✅ Transaction COMMITTED for correction ${correction.id}`)
        console.log(`[BULK APPROVE] Result: Stock TX ${result.stockTransactionId}, Inventory ${result.inventoryId}: ${result.oldQty} → ${result.newQty}`)

        // Verify the update actually persisted by reading it back
        const verifyInventory = await prisma.variationLocationDetails.findUnique({
          where: { id: result.inventoryId },
          select: { qtyAvailable: true }
        })
        console.log(`[BULK APPROVE] 🔍 Verification: Inventory qty is now ${verifyInventory ? parseFloat(verifyInventory.qtyAvailable.toString()) : 'NOT FOUND'}`)

        const verifyCorrection = await prisma.inventoryCorrection.findUnique({
          where: { id: correction.id },
          select: { status: true, approvedBy: true, approvedAt: true }
        })
        console.log(`[BULK APPROVE] 🔍 Verification: Correction status is ${verifyCorrection?.status}, approvedBy=${verifyCorrection?.approvedBy}`)

        // Create audit log for this approval (non-blocking)
        createAuditLog({
          businessId: parseInt(businessId),
          userId: parseInt(user.id.toString()),
          username: user.username,
          action: 'inventory_correction_approve' as AuditAction,
          entityType: EntityType.PRODUCT,
          entityIds: [correction.productId],
          description: `Bulk approved inventory correction #${correction.id} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Stock adjusted from ${systemCount} to ${physicalCount} (${difference >= 0 ? '+' : ''}${difference})`,
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
            physicalCount,
            difference,
            reason: correction.reason,
            remarks: correction.remarks,
            beforeQty: systemCount,
            afterQty: physicalCount,
            approvedBy: user.username,
            approvedAt: new Date().toISOString(),
            bulkApproval: true
          },
          requiresPassword: false,
          passwordVerified: false,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        }).then(() => {
          console.log(`[BULK APPROVE] ✓ Audit log created for correction ${correction.id}`)
        }).catch(err => {
          console.error(`[BULK APPROVE] ❌ Audit log FAILED for correction ${correction.id}:`, err)
        })

        approvalResults.push({ success: true, id: correction.id })
        console.log(`[BULK APPROVE] ====== Correction ${correction.id} completed successfully ======\n`)

      } catch (error: any) {
        console.error(`[BULK APPROVE] ❌ ERROR processing correction ${correction.id}:`, error)
        console.error(`[BULK APPROVE] Error stack:`, error.stack)
        approvalResults.push({
          success: false,
          id: correction.id,
          error: error.message || 'Unknown error'
        })
      }
    }

    console.log(`[BULK APPROVE] Sequential processing completed. Total: ${approvalResults.length}`)

    // Categorize results
    const successful: number[] = []
    const failed: { id: number; error: string }[] = []

    approvalResults.forEach(result => {
      if (result.success) {
        successful.push(result.id)
      } else {
        failed.push({
          id: result.id,
          error: result.error || 'Unknown error'
        })
      }
    })

    console.log(`[BULK APPROVE] Results: ${successful.length} successful, ${failed.length} failed`)

    // VERIFY: Check database to ensure updates persisted
    if (successful.length > 0) {
      console.log(`[BULK APPROVE] Verifying updates in database...`)
      const verifiedCorrections = await prisma.inventoryCorrection.findMany({
        where: {
          id: { in: successful },
          status: 'approved'
        },
        select: { id: true, status: true }
      })
      console.log(`[BULK APPROVE] Verification: ${verifiedCorrections.length} out of ${successful.length} corrections show as approved in database`)

      if (verifiedCorrections.length < successful.length) {
        console.error(`[BULK APPROVE] WARNING: Database verification failed. Expected ${successful.length} approved, found ${verifiedCorrections.length}`)
      }
    }

    return NextResponse.json({
      message: `Bulk approval completed. ${successful.length} approved, ${failed.length} failed, ${alreadyApproved.length} skipped (already approved)`,
      results: {
        successCount: successful.length,
        failedCount: failed.length,
        skippedCount: alreadyApproved.length,
        successful,
        failed,
        skipped: alreadyApproved.map(c => c.id)
      }
    })
  } catch (error: any) {
    console.error('Error in bulk approve:', error)
    return NextResponse.json({
      error: error.message || 'Failed to bulk approve inventory corrections'
    }, { status: 500 })
  }
}
