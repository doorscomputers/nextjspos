import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'

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
    const businessId = user.businessId
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

    // Get transfer with all items and business workflow mode
    const [transfer, business] = await Promise.all([
      prisma.stockTransfer.findFirst({
        where: {
          id: transferId,
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        include: {
          items: true,
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

    // Validate status based on workflow mode
    if (workflowMode === 'simple') {
      // SIMPLIFIED WORKFLOW: Can complete directly from in_transit
      if (transfer.status !== 'in_transit') {
        return NextResponse.json(
          { error: `Cannot complete transfer with status: ${transfer.status}. Transfer must be in transit.` },
          { status: 400 }
        )
      }
      // In simple mode, skip verification requirement
    } else {
      // FULL WORKFLOW: Must be verified or verifying
      if (transfer.status !== 'verified' && transfer.status !== 'verifying') {
        return NextResponse.json(
          { error: `Cannot complete transfer with status: ${transfer.status}` },
          { status: 400 }
        )
      }

      // Validate all items are verified
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
    const impactTracker = new InventoryImpactTracker()
    const productVariationIds = transfer.items.map(item => item.productVariationId)
    const locationIds = [transfer.fromLocationId, transfer.toLocationId] // Track BOTH source and destination
    await impactTracker.captureBefore(productVariationIds, locationIds)

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
            quantityBefore: currentQty,
            quantityAfter: newQty,
            transactionType: 'transfer_in',
            referenceType: 'stock_transfer',
            referenceId: transferId,
            referenceNumber: transfer.transferNumber,
            createdBy: parseInt(userId),
            notes: `Transfer ${transfer.transferNumber} received from location ${transfer.fromLocationId}`,
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
    })

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    const locationTypes = {
      [transfer.fromLocationId]: 'source' as const,
      [transfer.toLocationId]: 'destination' as const
    }
    const inventoryImpact = await impactTracker.captureAfterAndReport(
      productVariationIds,
      locationIds,
      'transfer',
      result.id,
      transfer.transferNumber,
      locationTypes,
      userDisplayName
    )

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

    return NextResponse.json({
      message: 'Transfer completed - stock added to destination location',
      transfer: result,
      inventoryImpact,
    })
  } catch (error: any) {
    console.error('Error completing transfer:', error)
    return NextResponse.json(
      { error: 'Failed to complete transfer', details: error.message },
      { status: 500 }
    )
  }
}
