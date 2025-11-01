import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET - Retrieve Single Stock Transfer
 */
export async function GET(
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
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view transfers' },
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
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      },
    })

    if (!transfer) {
      return NextResponse.json(
        { error: 'Stock transfer not found' },
        { status: 404 }
      )
    }

    // Fetch product and variation details for each item
    const itemsWithDetails = await Promise.all(
      transfer.items.map(async (item) => {
        const [product, variation] = await Promise.all([
          prisma.product.findUnique({
            where: { id: item.productId },
            select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } },
          }),
          prisma.productVariation.findUnique({
            where: { id: item.productVariationId },
            select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } },
          }),
        ])
        return {
          ...item,
          product,
          productVariation: variation,
        }
      })
    )

    // Fetch user details for workflow participants
    const userIds = [
      transfer.createdBy,
      transfer.checkedBy,
      transfer.sentBy,
      transfer.arrivedBy,
      transfer.verifiedBy,
      transfer.completedBy,
    ].filter((id): id is number => id !== null && id !== undefined)

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: { select: { id: true, name: true } }, username: { select: { id: true, name: true } } },
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    // Fetch location names
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: [transfer.fromLocationId, transfer.toLocationId] },
        businessId: parseInt(businessId),
      },
      select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } },
    })
    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // CRITICAL SECURITY: Verify user has access to either source or destination location
    // This check is ALWAYS enforced, regardless of ACCESS_ALL_LOCATIONS permission
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: parseInt(userId) },
      select: { locationId: { select: { id: true, name: true } } },
    })
    const locationIds = userLocations.map(ul => ul.locationId)

    // User must be assigned to EITHER the from location OR the to location
    if (!locationIds.includes(transfer.fromLocationId) && !locationIds.includes(transfer.toLocationId)) {
      return NextResponse.json(
        { error: 'Access denied. You can only view transfers involving your assigned locations.' },
        { status: 403 }
      )
    }

    // Fetch SOD settings and workflow mode for the business
    const [sodSettings, business] = await Promise.all([
      prisma.businessSODSettings.findUnique({
        where: { businessId: parseInt(businessId) },
        select: {
          enforceTransferSOD: { select: { id: true, name: true } },
          allowCreatorToCheck: { select: { id: true, name: true } },
          allowCreatorToSend: { select: { id: true, name: true } },
          allowCheckerToSend: { select: { id: true, name: true } },
          allowCreatorToReceive: { select: { id: true, name: true } },
          allowSenderToComplete: { select: { id: true, name: true } },
          allowCreatorToComplete: { select: { id: true, name: true } },
          allowReceiverToComplete: { select: { id: true, name: true } },
        },
      }),
      prisma.business.findUnique({
        where: { id: parseInt(businessId) },
        select: { transferWorkflowMode: { select: { id: true, name: true } } },
      }),
    ])

    // Build response with user details, location names, SOD settings, and workflow mode
    const response = {
      ...transfer,
      items: itemsWithDetails,
      fromLocationName: locationMap.get(transfer.fromLocationId) || `Location ${transfer.fromLocationId}`,
      toLocationName: locationMap.get(transfer.toLocationId) || `Location ${transfer.toLocationId}`,
      creator: transfer.createdBy ? userMap.get(transfer.createdBy) : null,
      checker: transfer.checkedBy ? userMap.get(transfer.checkedBy) : null,
      sender: transfer.sentBy ? userMap.get(transfer.sentBy) : null,
      arrivalMarker: transfer.arrivedBy ? userMap.get(transfer.arrivedBy) : null,
      verifier: transfer.verifiedBy ? userMap.get(transfer.verifiedBy) : null,
      completer: transfer.completedBy ? userMap.get(transfer.completedBy) : null,
      workflowMode: business?.transferWorkflowMode || 'full',
      sodSettings: sodSettings || {
        enforceTransferSOD: { select: { id: true, name: true } },
        allowCreatorToCheck: false,
        allowCreatorToSend: false,
        allowCheckerToSend: false,
        allowCreatorToReceive: false,
        allowSenderToComplete: false,
        allowCreatorToComplete: false,
        allowReceiverToComplete: { select: { id: true, name: true } },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching stock transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stock transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update Stock Transfer (Limited Updates)
 *
 * Only allows updating basic fields when transfer is still pending.
 * Cannot modify items or amounts after creation.
 */
export async function PUT(
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
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to update transfers' },
        { status: 403 }
      )
    }

    // Get existing transfer
    const existing = await prisma.stockTransfer.findFirst({
      where: {
        id: parseInt(transferId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock transfer not found' },
        { status: 404 }
      )
    }

    // Verify user has access to source location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: parseInt(userId),
            locationId: existing.fromLocationId,
          },
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'You do not have access to update this transfer' },
          { status: 403 }
        )
      }
    }

    // Only allow updates if transfer is still pending
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot update transfer with status: ${existing.status}. Only pending transfers can be updated.` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { transferDate, notes } = body

    // Validate transferDate if provided
    if (transferDate && isNaN(new Date(transferDate).getTime())) {
      return NextResponse.json(
        { error: 'Invalid transfer date' },
        { status: 400 }
      )
    }

    // Update transfer (only allowed fields)
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: parseInt(transferId) },
      data: {
        ...(transferDate && { transferDate: new Date(transferDate) }),
        ...(notes !== undefined && { notes }),
      },
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'stock_transfer_update' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [existing.id],
      description: `Updated Stock Transfer ${existing.transferNumber}`,
      metadata: {
        transferId: existing.id,
        transferNumber: existing.transferNumber,
        changes: { transferDate, notes },
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Transfer updated successfully',
      transfer: updatedTransfer,
    })
  } catch (error) {
    console.error('Error updating stock transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to update stock transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Cancel Stock Transfer
 *
 * BUSINESS RULES:
 * - Can only cancel transfers that are pending or in_transit
 * - Cannot cancel received transfers (use separate return process)
 * - Restores serial numbers to in_stock if they were in_transit
 * - Does NOT affect stock levels (stock never deducted until receive/approve)
 */
export async function DELETE(
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
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to cancel transfers' },
        { status: 403 }
      )
    }

    // Get existing transfer
    const existing = await prisma.stockTransfer.findFirst({
      where: {
        id: parseInt(transferId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock transfer not found' },
        { status: 404 }
      )
    }

    // Verify user has access to source location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: parseInt(userId),
            locationId: existing.fromLocationId,
          },
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'You do not have access to cancel this transfer' },
          { status: 403 }
        )
      }
    }

    // Business Rule: Cannot cancel received transfers
    if (existing.status === 'received') {
      return NextResponse.json(
        { error: 'Cannot cancel a received transfer. Use the return process instead.' },
        { status: 400 }
      )
    }

    // Verify stock was not deducted (safety check)
    if (existing.stockDeducted) {
      return NextResponse.json(
        { error: 'Cannot cancel transfer - stock has already been deducted. Contact support.' },
        { status: 400 }
      )
    }

    // Cancel transfer and restore serial numbers if needed
    await prisma.$transaction(async (tx) => {
      // Mark transfer as cancelled (soft delete)
      await tx.stockTransfer.update({
        where: { id: parseInt(transferId) },
        data: {
          status: 'cancelled',
          deletedAt: new Date(),
        },
      })

      // Restore serial numbers if they were marked as in_transit
      if (existing.status === 'in_transit') {
        for (const item of existing.items) {
          if (item.serialNumbers && item.serialNumbers.length > 0) {
            for (const transferSerial of item.serialNumbers) {
              // Restore serial number to in_stock
              const serialNumberRecord = await tx.productSerialNumber.update({
                where: { id: transferSerial.serialNumberId },
                data: {
                  status: 'in_stock', // Back to available
                  // currentLocationId stays at source (never changed)
                },
              })

              // Create movement record for cancellation
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: serialNumberRecord.id, // CRITICAL: Use actual ID
                  movementType: 'adjustment',
                  fromLocationId: existing.fromLocationId,
                  toLocationId: existing.fromLocationId, // Same location (no movement)
                  referenceType: 'transfer',
                  referenceId: existing.id,
                  movedBy: parseInt(userId),
                  notes: `Transfer ${existing.transferNumber} cancelled - restored to in_stock`,
                },
              })
            }
          }
        }
      }
    }, {
      timeout: 30000,
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'stock_transfer_delete' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [existing.id],
      description: `Cancelled Stock Transfer ${existing.transferNumber}`,
      metadata: {
        transferId: existing.id,
        transferNumber: existing.transferNumber,
        fromLocationId: existing.fromLocationId,
        toLocationId: existing.toLocationId,
        previousStatus: existing.status,
        itemCount: existing.items.length,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: `Transfer ${existing.transferNumber} cancelled successfully`,
      transfer: {
        id: existing.id,
        transferNumber: existing.transferNumber,
        status: 'cancelled',
      },
    })
  } catch (error) {
    console.error('Error cancelling stock transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to cancel stock transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
