import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { transferStockIn, transferStockOut } from '@/lib/stockOperations'
import { withIdempotency } from '@/lib/idempotency'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'

/**
 * POST - Receive and Approve Stock Transfer (Steps 3 & 4 of 4)
 *
 * CRITICAL TWO-STEP WORKFLOW - THE MAGIC HAPPENS HERE:
 * Step 1: Create transfer (status: pending)
 * Step 2: Send transfer (status: in_transit) - Serial numbers marked in_transit
 * Step 3: Receive transfer (THIS ENDPOINT) - Destination verifies items
 * Step 4: APPROVE AND MOVE STOCK - Stock deducted from source, added to destination
 *
 * CRITICAL REQUIREMENT FROM USER:
 * "When a branch transfers items to another branch, the inventory is not yet
 * deducted from the source branch until the destination branch approve each
 * product verifying the quantity received"
 *
 * This endpoint implements that requirement.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transferId } = await params
  return withIdempotency(request, `/api/transfers/${transferId}/receive`, async () => {
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
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      `User#${userIdNumber}`
    const transferIdNumber = Number(transferId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_RECEIVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to receive transfers' },
        { status: 403 }
      )
    }

    // Get transfer details
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferIdNumber,
        businessId: businessIdNumber,
        deletedAt: null,
      },
      include: {
        fromLocation: {
          select: {
            id: true,
            name: true,
          },
        },
        toLocation: {
          select: {
            id: true,
            name: true,
          },
        },
        items: true, // Serial numbers stored as JSON in serialNumbersSent/serialNumbersReceived
      },
    })

    if (!transfer) {
      return NextResponse.json(
        { error: 'Stock transfer not found' },
        { status: 404 }
      )
    }

    // Verify user has access to destination location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: userIdNumber,
            locationId: transfer.toLocationId,
          },
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'You do not have access to the destination location. Only users assigned to the receiving location can receive transfers.' },
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
      action: 'receive',
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

    // Validate transfer status - accept in_transit, arrived, or verifying
    const validStatuses = ['in_transit', 'arrived', 'verifying']
    if (!validStatuses.includes(transfer.status)) {
      return NextResponse.json(
        { error: `Cannot receive transfer with status: ${transfer.status}. Transfer must be in_transit, arrived, or verifying.` },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Stock should ALWAYS be deducted at SEND, never at RECEIVE
    // This prevents double deductions and ensures ledger accuracy
    // The receive endpoint should ONLY add stock to destination

    const body = await request.json()
    const { receivedDate, items, notes } = body

    // Validate received items
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing received items data' },
        { status: 400 }
      )
    }

    // Validate each item
    for (const receivedItem of items) {
      const transferItem = transfer.items.find(
        (ti) => ti.id === Number(receivedItem.transferItemId)
      )

      if (!transferItem) {
        return NextResponse.json(
          { error: `Transfer item ${receivedItem.transferItemId} not found in this transfer` },
          { status: 400 }
        )
      }

      const quantityReceived = parseFloat(receivedItem.quantityReceived)

        if (quantityReceived <= 0) {
          continue
        }

      if (isNaN(quantityReceived) || quantityReceived <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity received for item ${receivedItem.transferItemId}` },
          { status: 400 }
        )
      }

      if (quantityReceived > parseFloat(transferItem.quantity.toString())) {
        return NextResponse.json(
          {
            error: `Cannot receive more than sent quantity for item ${receivedItem.transferItemId}. Sent: ${transferItem.quantity}, Received: ${quantityReceived}`,
          },
          { status: 400 }
        )
      }

      // If serial numbers expected, validate them
      const serialNumbersSent = transferItem.serialNumbersSent
        ? (Array.isArray(transferItem.serialNumbersSent)
            ? transferItem.serialNumbersSent
            : JSON.parse(transferItem.serialNumbersSent as string))
        : []

      if (serialNumbersSent.length > 0) {
        if (!receivedItem.serialNumberIds || receivedItem.serialNumberIds.length === 0) {
          return NextResponse.json(
            { error: `Serial numbers required for item ${receivedItem.transferItemId}` },
            { status: 400 }
          )
        }

        if (receivedItem.serialNumberIds.length !== quantityReceived) {
          return NextResponse.json(
            {
              error: `Serial number count mismatch for item ${receivedItem.transferItemId}. Expected: ${quantityReceived}, Provided: ${receivedItem.serialNumberIds.length}`,
            },
            { status: 400 }
          )
        }

        // Verify all serial numbers are part of this transfer and in_transit
        for (const snId of receivedItem.serialNumberIds) {
          const snIdNumber = Number(snId)
          const snInTransfer = serialNumbersSent.find(
            (id: number) => id === snIdNumber
          )

          if (!snInTransfer) {
            return NextResponse.json(
              { error: `Serial number ${snId} not part of this transfer` },
              { status: 400 }
            )
          }

          const sn = await prisma.productSerialNumber.findFirst({
            where: {
              id: snIdNumber,
              status: 'in_transit',
            },
          })

          if (!sn) {
            return NextResponse.json(
              { error: `Serial number ${snId} is not in transit` },
              { status: 400 }
            )
          }
        }
      }
    }

    // ✅ CRITICAL SECTION: Receive, Approve, and Move Stock
    // This is where the two-step workflow completes
    await prisma.$transaction(async (tx) => {
      // Update transfer status
      await tx.stockTransfer.update({
        where: { id: transferIdNumber },
        data: {
          status: 'received', // Transfer complete
          stockDeducted: true, // CRITICAL: Stock NOW deducted
          receivedBy: userIdNumber,
          receivedAt: receivedDate ? new Date(receivedDate) : new Date(),
          verifierNotes: notes, // Store receive notes in verifierNotes field
        },
      })

      const deductAtReceive = !transfer.stockDeducted

      // Process each item
      for (const receivedItem of items) {
        const transferItem = transfer.items.find(
          (ti) => ti.id === Number(receivedItem.transferItemId)
        )!

        const quantityReceived = parseFloat(receivedItem.quantityReceived)

        if (quantityReceived <= 0) {
          continue
        }

        // Update transfer item quantity received
        await tx.stockTransferItem.update({
          where: { id: transferItem.id },
          data: {
            receivedQuantity: quantityReceived,
          },
        })

        // STEP 1: Deduct stock from source location if not already processed
        // ⚠️ CRITICAL: This should NEVER happen in modern workflow
        // Stock should ALWAYS be deducted at SEND, not at RECEIVE
        // This code path exists for legacy compatibility only
        if (deductAtReceive) {
          console.warn(`⚠️ WARNING: Transfer ${transfer.transferNumber} - Deducting stock at RECEIVE instead of SEND. This is legacy behavior and may indicate a workflow issue.`)

          await transferStockOut({
            businessId: businessIdNumber,
            productId: transferItem.productId,
            productVariationId: transferItem.productVariationId,
            fromLocationId: transfer.fromLocationId,
            quantity: quantityReceived,
            transferId: transfer.id,
            userId: userIdNumber,
            notes: `Transfer ${transfer.transferNumber} to ${transfer.toLocation.name} (LEGACY: deducted at receive)`,
            userDisplayName,
            tx,
          })
        } else {
          // Modern workflow: Stock already deducted at SEND
          // Verify that the ledger entry exists
          const ledgerEntry = await tx.stockTransaction.findFirst({
            where: {
              productVariationId: transferItem.productVariationId,
              locationId: transfer.fromLocationId,
              type: 'transfer_out',
              referenceType: 'transfer',
              referenceId: transfer.id,
            }
          })

          if (!ledgerEntry) {
            // CRITICAL ERROR: Stock was deducted but ledger entry is missing!
            // This should NEVER happen - it indicates a bug in the SEND process
            throw new Error(
              `CRITICAL INVENTORY ERROR: Transfer ${transfer.transferNumber} - ` +
              `Stock was marked as deducted (stockDeducted=true) but no ledger entry found for ` +
              `variation ${transferItem.productVariationId} at location ${transfer.fromLocationId}. ` +
              `This indicates a data integrity issue that must be investigated immediately.`
            )
          }
        }

        // STEP 2: Add stock to destination location
        await transferStockIn({
          businessId: businessIdNumber,
          productId: transferItem.productId,
          productVariationId: transferItem.productVariationId,
          toLocationId: transfer.toLocationId,
          quantity: quantityReceived,
          transferId: transfer.id,
          userId: userIdNumber,
          notes: `Transfer ${transfer.transferNumber} from ${transfer.fromLocation.name}`,
          userDisplayName,
          tx,
        })

        // STEP 3: Update serial numbers (if applicable)
        if (receivedItem.serialNumberIds && receivedItem.serialNumberIds.length > 0) {
          for (const snId of receivedItem.serialNumberIds) {
            // Update serial number status and location
            const serialNumberRecord = await tx.productSerialNumber.update({
              where: { id: Number(snId) },
              data: {
                status: 'in_stock', // Back to in_stock
                currentLocationId: transfer.toLocationId, // NOW at destination
              },
            })

            // Create movement record for transfer in
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: serialNumberRecord.id, // CRITICAL: Use actual ID
                movementType: 'transfer_in',
                fromLocationId: transfer.fromLocationId,
                toLocationId: transfer.toLocationId,
                referenceType: 'transfer',
                referenceId: transfer.id,
                movedBy: userIdNumber,
                notes: `Transfer ${transfer.transferNumber} received at ${transfer.toLocation.name}`,
              },
            })
          }
        }
      }
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'stock_transfer_receive' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transfer.id],
      description: `Received and Approved Stock Transfer ${transfer.transferNumber} at ${transfer.toLocation.name}`,
      metadata: {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        fromLocationName: transfer.fromLocation.name,
        toLocationId: transfer.toLocationId,
        toLocationName: transfer.toLocation.name,
        itemCount: items.length,
        stockDeducted: true, // Emphasis: NOW deducted
        totalQuantityReceived: items.reduce(
          (sum: number, item: any) => sum + parseFloat(item.quantityReceived),
          0
        ),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch updated transfer
    const updatedTransfer = await prisma.stockTransfer.findUnique({
      where: { id: transfer.id },
      include: {
        fromLocation: true,
        toLocation: true,
        items: true, // Serial numbers stored as JSON in serialNumbersSent/serialNumbersReceived
      },
    })

    return NextResponse.json({
      message: `Transfer received and approved. Stock has been moved from ${transfer.fromLocation.name} to ${transfer.toLocation.name}.`,
      transfer: updatedTransfer,
    })
  } catch (error) {
    console.error('Error receiving stock transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to receive stock transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
