import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'
// import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker' // DISABLED for speed
import { sendTransferAcceptanceAlert } from '@/lib/alert-service'

/**
 * POST /api/transfers/[id]/complete
 * Complete transfer - CRITICAL: Adds stock to destination location
 * Status: verified → completed
 * CRITICAL: This is where stock is added to destination
 * Transfer becomes IMMUTABLE after this
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

    const { id } = await params
    const transferId = parseInt(id)

    const body = await request.json()
    const { notes } = body

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_COMPLETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_COMPLETE permission' },
        { status: 403 }
      )
    }

    // Get transfer with all items, locations, and business workflow mode
    const [transfer, business] = await Promise.all([
      prisma.stockTransfer.findFirst({
        where: {
          id: transferId,
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        include: {
          items: true,
          fromLocation: true,
          toLocation: true,
        },
      }),
      prisma.business.findUnique({
        where: { id: businessIdNumber },
        select: { transferWorkflowMode: true },
      }),
    ])

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    const workflowMode = business?.transferWorkflowMode || 'full'

    // FLEXIBLE STATUS VALIDATION: Accept transfers that have gone through either workflow
    // Simple workflow: in_transit → completed
    // Full workflow: verified/verifying → completed
    // CRITICAL: Allow both to support workflow mode changes mid-transfer
    const validSimpleStatuses = ['in_transit', 'arrived']
    const validFullStatuses = ['verified', 'verifying']
    const allValidStatuses = [...validSimpleStatuses, ...validFullStatuses]

    if (!allValidStatuses.includes(transfer.status)) {
      return NextResponse.json(
        {
          error: `Cannot complete transfer with status: ${transfer.status}. Transfer must be in one of these states: ${allValidStatuses.join(', ')}`
        },
        { status: 400 }
      )
    }

    // If transfer went through full workflow (verified/verifying), validate all items are verified
    if (validFullStatuses.includes(transfer.status)) {
      const unverifiedItems = transfer.items.filter(item => !item.verified)
      if (unverifiedItems.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot complete transfer - ${unverifiedItems.length} items not verified`,
            unverifiedItems: unverifiedItems.map(i => i.id),
          },
          { status: 400 }
        )
      }
    }

    // Validate completer has access to destination location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: parseInt(userId),
          locationId: transfer.toLocationId,
        },
      })
      if (!userLocation) {
        return NextResponse.json(
          { error: 'No access to destination location. Only users assigned to the receiving location can complete transfers.' },
          { status: 403 }
        )
      }
    }

    // CONFIGURABLE SOD VALIDATION
    // Check business rules for separation of duties
    const userRoles = await getUserRoles(userIdNumber)
    const sodValidation = await validateSOD({
      businessId: businessIdNumber,
      userId: userIdNumber,
      action: 'complete',
      entity: {
        id: transfer.id,
        createdBy: transfer.createdBy,
        checkedBy: transfer.checkedBy,
        sentBy: transfer.sentBy,
        receivedBy: transfer.receivedBy
      },
      entityType: 'transfer',
      userRoles
    })

    if (!sodValidation.allowed) {
      return NextResponse.json(
        {
          error: sodValidation.reason,
          code: sodValidation.code,
          configurable: sodValidation.configurable,
          suggestion: sodValidation.suggestion,
          ruleField: sodValidation.ruleField
        },
        { status: 403 }
      )
    }

    // Get user display name for impact report
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      `User#${userIdNumber}`

    // TRANSACTION IMPACT TRACKING: Step 1 - Capture inventory BEFORE transaction (BOTH locations)
    // DISABLED for speed - not needed for demo
    // const impactTracker = new InventoryImpactTracker()
    // const productVariationIds = transfer.items.map(item => item.productVariationId)
    // const locationIds = [transfer.fromLocationId, transfer.toLocationId] // Track BOTH source and destination
    // await impactTracker.captureBefore(productVariationIds, locationIds)

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, add stock to destination location
      for (const item of transfer.items) {
        const productId = item.productId
        const variationId = item.productVariationId

        // CRITICAL FIX: In simplified workflow, receivedQuantity might be 0 (not set during verification)
        // Use original quantity if receivedQuantity is 0 or null
        const receivedQtyValue = item.receivedQuantity
          ? parseFloat(item.receivedQuantity.toString())
          : 0
        const receivedQty = receivedQtyValue > 0
          ? receivedQtyValue
          : parseFloat(item.quantity.toString())

        // Get or create stock record at destination
        let destStock = await tx.variationLocationDetails.findFirst({
          where: {
            productId,
            productVariationId: variationId,
            locationId: transfer.toLocationId,
          },
        })

        if (!destStock) {
          // Create new stock record if doesn't exist
          destStock = await tx.variationLocationDetails.create({
            data: {
              productId,
              productVariationId: variationId,
              locationId: transfer.toLocationId,
              qtyAvailable: 0,
            },
          })
        }

        const currentQty = parseFloat(destStock.qtyAvailable.toString())
        const newQty = currentQty + receivedQty

        // Update stock at destination (add)
        await tx.variationLocationDetails.update({
          where: { id: destStock.id },
          data: {
            qtyAvailable: newQty,
            updatedAt: new Date(),
          },
        })

        // Create stock transaction (positive = addition)
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId,
            productVariationId: variationId,
            locationId: transfer.toLocationId,
            type: 'transfer_in',
            quantity: receivedQty,
            balanceQty: newQty,
            referenceType: 'stock_transfer',
            referenceId: transferId,
            createdBy: parseInt(userId),
            notes: `Transfer ${transfer.transferNumber} received`,
          },
        })

        // CRITICAL: Create ProductHistory entry for Stock History V2 report
        await tx.productHistory.create({
          data: {
            businessId: parseInt(businessId),
            productId,
            productVariationId: variationId,
            locationId: transfer.toLocationId,
            quantityChange: receivedQty, // Positive = addition
            balanceQuantity: newQty, // Balance after transaction
            transactionType: 'transfer_in',
            transactionDate: new Date(), // Date when transfer is completed/received
            referenceType: 'stock_transfer',
            referenceId: transferId,
            referenceNumber: transfer.transferNumber,
            createdBy: parseInt(userId),
            createdByName: userDisplayName,
            reason: `Transfer ${transfer.transferNumber} received from location ${transfer.fromLocationId}`,
          },
        })

        // Handle serial numbers if present
        if (item.serialNumbersReceived) {
          const serialIds = item.serialNumbersReceived as number[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            // Update serial numbers to in_stock at destination
            await tx.productSerialNumber.updateMany({
              where: {
                id: { in: serialIds },
                status: 'in_transit',
              },
              data: {
                status: 'in_stock',
                currentLocationId: transfer.toLocationId,
                updatedAt: new Date(),
              },
            })
          }
        }
      }

      // Update transfer status to completed - IMMUTABLE from now on
      const now = new Date()
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedBy: parseInt(userId),
          completedAt: now,
          verifiedBy: parseInt(userId),
          verifiedAt: now,
          receivedAt: now, // CRITICAL: Set receivedAt for inventory ledger tracking
          verifierNotes: notes || null,
        },
      })

      return updatedTransfer
    }, {
      timeout: 120000, // 2 minutes timeout for slow internet connections
      maxWait: 10000,  // Wait up to 10 seconds to acquire transaction lock
    })

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    // DISABLED for speed - not needed for demo
    // const locationTypes = {
    //   [transfer.fromLocationId]: 'source' as const,
    //   [transfer.toLocationId]: 'destination' as const
    // }
    // const inventoryImpact = await impactTracker.captureAfterAndReport(
    //   productVariationIds,
    //   locationIds,
    //   'transfer',
    //   result.id,
    //   transfer.transferNumber,
    //   locationTypes,
    //   userDisplayName
    // )

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_complete' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Completed transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
        hasDiscrepancy: transfer.hasDiscrepancy,
        notes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    // Send alert notifications (async, don't await)
    // Calculate total quantity from all items
    const totalQuantity = transfer.items.reduce((sum, item) => {
      const qty = item.receivedQuantity
        ? parseFloat(item.receivedQuantity.toString())
        : parseFloat(item.quantity.toString())
      return sum + qty
    }, 0)

    sendTransferAcceptanceAlert({
      transferNumber: transfer.transferNumber,
      fromLocation: transfer.fromLocation.name,
      toLocation: transfer.toLocation.name,
      itemCount: transfer.items.length,
      totalQuantity,
      acceptedBy: user.username,
      notes,
      timestamp: new Date(),
    }).catch((error) => {
      console.error('[AlertService] Failed to send transfer acceptance alert:', error)
    })

    return NextResponse.json({
      message: 'Transfer completed - stock added to destination location',
      transfer: result,
      // inventoryImpact disabled for speed
    })
  } catch (error: any) {
    console.error('Error completing transfer:', error)
    return NextResponse.json(
      { error: 'Failed to complete transfer', details: error.message },
      { status: 500 }
    )
  }
}
