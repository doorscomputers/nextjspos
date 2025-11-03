import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/inventory-corrections/bulk-delete
 * Bulk delete multiple pending inventory corrections
 * Only pending corrections can be deleted
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

    // Check permission - need delete permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_DELETE)) {
      return NextResponse.json({
        error: 'Forbidden - You do not have permission to delete inventory corrections'
      }, { status: 403 })
    }

    const body = await request.json()
    const { correctionIds } = body

    if (!correctionIds || !Array.isArray(correctionIds) || correctionIds.length === 0) {
      return NextResponse.json({ error: 'No correction IDs provided' }, { status: 400 })
    }

    console.log(`[BULK DELETE] Attempting to delete ${correctionIds.length} corrections`)

    // Get all corrections to delete
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

    console.log(`[BULK DELETE] Found ${corrections.length} corrections in database`)

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

    // Filter - only pending corrections can be deleted
    const pendingCorrections = corrections.filter(c => c.status === 'pending')
    const alreadyApproved = corrections.filter(c => c.status === 'approved')

    console.log(`[BULK DELETE] ${pendingCorrections.length} pending, ${alreadyApproved.length} already approved`)

    if (pendingCorrections.length === 0) {
      return NextResponse.json({
        error: 'No pending corrections to delete. Approved corrections cannot be deleted.',
        alreadyApprovedCount: alreadyApproved.length
      }, { status: 400 })
    }

    // Soft delete corrections in PARALLEL for maximum speed
    const deletePromises = pendingCorrections.map(async (correction) => {
      try {
        console.log(`[BULK DELETE] Deleting correction ID ${correction.id}`)

        // Soft delete by setting deletedAt
        const deletedCorrection = await prisma.inventoryCorrection.update({
          where: { id: correction.id },
          data: {
            deletedAt: new Date()
          }
        })

        console.log(`[BULK DELETE] Correction ${correction.id} marked as deleted`)

        // Audit logging OUTSIDE main flow for better performance (non-blocking)
        createAuditLog({
          businessId: parseInt(businessId),
          userId: parseInt(user.id.toString()),
          username: user.username,
          action: 'inventory_correction_delete' as AuditAction,
          entityType: EntityType.PRODUCT,
          entityIds: [correction.productId],
          description: `Bulk deleted inventory correction #${correction.id} for ${correction.product.name} (${correction.productVariation.name}) at ${correction.location.name}. Difference was: ${correction.difference}`,
          metadata: {
            correctionId: correction.id,
            locationId: correction.locationId,
            locationName: correction.location.name,
            productId: correction.productId,
            productName: correction.product.name,
            productSku: correction.product.sku,
            variationId: correction.productVariationId,
            variationName: correction.productVariation.name,
            variationSku: correction.productVariation.sku,
            systemCount: parseFloat(correction.systemCount.toString()),
            physicalCount: parseFloat(correction.physicalCount.toString()),
            difference: parseFloat(correction.difference.toString()),
            reason: correction.reason,
            remarks: correction.remarks,
            bulkDelete: true
          },
          requiresPassword: false,
          passwordVerified: false,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        }).catch(err => console.error(`Audit log failed for correction ${correction.id}:`, err))

        return { success: true, id: correction.id }
      } catch (error: any) {
        console.error(`Error deleting correction ${correction.id}:`, error)
        return {
          success: false,
          id: correction.id,
          error: error.message || 'Unknown error'
        }
      }
    })

    // Wait for ALL deletions to complete in parallel
    console.log(`[BULK DELETE] Waiting for ${deletePromises.length} delete promises to complete...`)
    const deleteResults = await Promise.all(deletePromises)
    console.log(`[BULK DELETE] All promises completed`)

    // Categorize results
    const successful: number[] = []
    const failed: { id: number; error: string }[] = []

    deleteResults.forEach(result => {
      if (result.success) {
        successful.push(result.id)
      } else {
        failed.push({
          id: result.id,
          error: result.error || 'Unknown error'
        })
      }
    })

    console.log(`[BULK DELETE] Results: ${successful.length} successful, ${failed.length} failed`)

    return NextResponse.json({
      message: `Bulk delete completed. ${successful.length} deleted, ${failed.length} failed, ${alreadyApproved.length} skipped (already approved)`,
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
    console.error('Error in bulk delete:', error)
    return NextResponse.json({
      error: error.message || 'Failed to bulk delete inventory corrections'
    }, { status: 500 })
  }
}
