import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id
    const { id: transferId } = await params

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
        id: parseInt(transferId),
        businessId: parseInt(businessId),
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
        items: {
          include: {
            serialNumbers: {
              include: {
                serialNumber: {
                  select: {
                    id: true,
                    serialNumber: true,
                    imei: true,
                    status: true,
                    productId: true,
                    productVariationId: true,
                  },
                },
              },
            },
          },
        },
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
            userId: parseInt(userId),
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

    // ENFORCE: Receiver must be different from creator, checker, and sender (separation of duties)
    if (transfer.createdBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot receive your own transfer. Only users at the destination location who did not create this transfer can receive it.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    if (transfer.checkedBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot receive a transfer you checked. A different user at the destination must receive this transfer.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    if (transfer.sentBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot receive a transfer you sent. A different user at the destination must receive this transfer.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    // Validate transfer status
    if (transfer.status !== 'in_transit') {
      return NextResponse.json(
        { error: `Cannot receive transfer with status: ${transfer.status}. Only in_transit transfers can be received.` },
        { status: 400 }
      )
    }

    if (transfer.stockDeducted) {
      return NextResponse.json(
        { error: 'Stock has already been deducted for this transfer' },
        { status: 400 }
      )
    }

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
        (ti) => ti.id === parseInt(receivedItem.transferItemId)
      )

      if (!transferItem) {
        return NextResponse.json(
          { error: `Transfer item ${receivedItem.transferItemId} not found in this transfer` },
          { status: 400 }
        )
      }

      const quantityReceived = parseFloat(receivedItem.quantityReceived)

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
      if (transferItem.serialNumbers && transferItem.serialNumbers.length > 0) {
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
          const snInTransfer = transferItem.serialNumbers.find(
            (ts) => ts.serialNumberId === parseInt(snId)
          )

          if (!snInTransfer) {
            return NextResponse.json(
              { error: `Serial number ${snId} not part of this transfer` },
              { status: 400 }
            )
          }

          const sn = await prisma.productSerialNumber.findFirst({
            where: {
              id: parseInt(snId),
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
        where: { id: parseInt(transferId) },
        data: {
          status: 'received', // Transfer complete
          stockDeducted: true, // CRITICAL: Stock NOW deducted
          receivedBy: parseInt(userId),
          receivedAt: receivedDate ? new Date(receivedDate) : new Date(),
          receiveNotes: notes,
        },
      })

      // Process each item
      for (const receivedItem of items) {
        const transferItem = transfer.items.find(
          (ti) => ti.id === parseInt(receivedItem.transferItemId)
        )!

        const quantityReceived = parseFloat(receivedItem.quantityReceived)

        // Update transfer item quantity received
        await tx.stockTransferItem.update({
          where: { id: transferItem.id },
          data: {
            quantityReceived,
          },
        })

        // STEP 1: Deduct stock from source location
        const sourceStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: transferItem.productVariationId,
              locationId: transfer.fromLocationId,
            },
          },
        })

        if (!sourceStock) {
          throw new Error(`Stock record not found at source location for variation ${transferItem.productVariationId}`)
        }

        const newSourceQty = parseFloat(sourceStock.qtyAvailable.toString()) - quantityReceived

        await tx.variationLocationDetails.update({
          where: {
            productVariationId_locationId: {
              productVariationId: transferItem.productVariationId,
              locationId: transfer.fromLocationId,
            },
          },
          data: {
            qtyAvailable: newSourceQty,
          },
        })

        // Create stock transaction for source (negative quantity)
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: transferItem.productId,
            productVariationId: transferItem.productVariationId,
            locationId: transfer.fromLocationId,
            type: 'transfer_out',
            quantity: -quantityReceived, // Negative for deduction
            unitCost: 0,
            balanceQty: newSourceQty,
            referenceType: 'transfer',
            referenceId: transfer.id,
            createdBy: parseInt(userId),
            notes: `Transfer ${transfer.transferNumber} to ${transfer.toLocation.name}`,
          },
        })

        // STEP 2: Add stock to destination location
        const destStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: transferItem.productVariationId,
              locationId: transfer.toLocationId,
            },
          },
        })

        const newDestQty = destStock
          ? parseFloat(destStock.qtyAvailable.toString()) + quantityReceived
          : quantityReceived

        await tx.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: transferItem.productVariationId,
              locationId: transfer.toLocationId,
            },
          },
          update: {
            qtyAvailable: newDestQty,
          },
          create: {
            productId: transferItem.productId,
            productVariationId: transferItem.productVariationId,
            locationId: transfer.toLocationId,
            qtyAvailable: newDestQty,
          },
        })

        // Create stock transaction for destination (positive quantity)
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: transferItem.productId,
            productVariationId: transferItem.productVariationId,
            locationId: transfer.toLocationId,
            type: 'transfer_in',
            quantity: quantityReceived, // Positive for addition
            unitCost: 0,
            balanceQty: newDestQty,
            referenceType: 'transfer',
            referenceId: transfer.id,
            createdBy: parseInt(userId),
            notes: `Transfer ${transfer.transferNumber} from ${transfer.fromLocation.name}`,
          },
        })

        // STEP 3: Update serial numbers (if applicable)
        if (receivedItem.serialNumberIds && receivedItem.serialNumberIds.length > 0) {
          for (const snId of receivedItem.serialNumberIds) {
            // Update serial number status and location
            const serialNumberRecord = await tx.productSerialNumber.update({
              where: { id: parseInt(snId) },
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
                movedBy: parseInt(userId),
                notes: `Transfer ${transfer.transferNumber} received at ${transfer.toLocation.name}`,
              },
            })
          }
        }
      }
    }, {
      timeout: 30000, // 30 seconds for complex transfers
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
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
        items: {
          include: {
            serialNumbers: {
              include: {
                serialNumber: {
                  select: {
                    id: true,
                    serialNumber: true,
                    imei: true,
                    status: true,
                    currentLocationId: true,
                  },
                },
              },
            },
          },
        },
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
}
