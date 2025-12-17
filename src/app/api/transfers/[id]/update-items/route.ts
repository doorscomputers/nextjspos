import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/update-items
 * Update items for a draft transfer
 * Only works when transfer status is 'draft'
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
    const userId = parseInt(String(user.id))

    const { id } = await params
    const transferId = parseInt(id)

    // Check permission - need CREATE or UPDATE permission
    const hasPermission = user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CREATE) ||
                          user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_UPDATE)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { items } = body

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || !item.productVariationId || !item.quantity) {
        return NextResponse.json(
          { error: 'Each item must have productId, productVariationId, and quantity' },
          { status: 400 }
        )
      }
      if (parseFloat(item.quantity) <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be greater than 0' },
          { status: 400 }
        )
      }
    }

    // Get transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId,
        deletedAt: null,
      },
      include: {
        items: true,
        fromLocation: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status - only draft can be edited
    if (transfer.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot edit transfer with status: ${transfer.status}. Only draft transfers can be edited.` },
        { status: 400 }
      )
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)

    if (!hasAccessAllLocations && accessibleLocationIds !== null) {
      if (!accessibleLocationIds.includes(transfer.fromLocationId)) {
        return NextResponse.json(
          { error: 'You do not have access to edit this transfer' },
          { status: 403 }
        )
      }
    }

    // Validate stock availability at source location for each item
    const stockChecks = await Promise.all(
      items.map(async (item: any) => {
        const inventory = await prisma.inventory.findFirst({
          where: {
            productVariationId: parseInt(item.productVariationId),
            locationId: transfer.fromLocationId,
          },
        })

        const availableStock = inventory ? parseFloat(inventory.quantity.toString()) : 0
        const requestedQty = parseFloat(item.quantity)

        // Get product name for error message
        const variation = await prisma.productVariation.findUnique({
          where: { id: parseInt(item.productVariationId) },
          include: { product: true },
        })

        return {
          productId: item.productId,
          productVariationId: item.productVariationId,
          productName: variation?.product?.name || 'Unknown',
          variationName: variation?.name || 'Default',
          requestedQty,
          availableStock,
          isValid: requestedQty <= availableStock,
        }
      })
    )

    const invalidItems = stockChecks.filter(check => !check.isValid)
    if (invalidItems.length > 0) {
      const errorMessages = invalidItems.map(
        item => `${item.productName} (${item.variationName}): requested ${item.requestedQty}, available ${item.availableStock}`
      )
      return NextResponse.json(
        {
          error: 'Insufficient stock for some items',
          details: errorMessages,
        },
        { status: 400 }
      )
    }

    // Update transfer items in a transaction
    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.stockTransferItem.deleteMany({
        where: { stockTransferId: transferId },
      })

      // Create new items
      const itemsData = items.map((item: any) => ({
        stockTransferId: transferId,
        productId: parseInt(item.productId),
        productVariationId: parseInt(item.productVariationId),
        quantity: parseFloat(item.quantity),
        receivedQuantity: 0,
        verified: false,
        hasDiscrepancy: false,
      }))

      await tx.stockTransferItem.createMany({
        data: itemsData,
      })

      // Return updated transfer with items
      return await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          items: {
            include: {
              product: true,
              productVariation: true,
            },
          },
          fromLocation: true,
          toLocation: true,
        },
      })
    })

    // Create audit log
    await createAuditLog({
      businessId,
      userId,
      username: user.username,
      action: 'transfer_update' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Updated items for draft transfer ${transfer.transferNumber} (${items.length} items)`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Transfer items updated successfully',
      transfer: updatedTransfer,
    })
  } catch (error: any) {
    console.error('Error updating transfer items:', error)
    return NextResponse.json(
      { error: 'Failed to update transfer items', details: error.message },
      { status: 500 }
    )
  }
}
