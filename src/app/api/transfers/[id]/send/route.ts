import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/send
 * Send transfer - CRITICAL: Deducts stock from origin location
 * Status: checked → in_transit
 * CRITICAL: This is where stock is physically deducted
 * Stock movements are IMMUTABLE after this point unless cancelled
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

    const { id } = await params
    const transferId = parseInt(id)

    const body = await request.json()
    const { notes } = body

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_SEND permission' },
        { status: 403 }
      )
    }

    // Get transfer with all items
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status
    if (transfer.status !== 'checked') {
      return NextResponse.json(
        { error: `Cannot send transfer with status: ${transfer.status}. Must be checked first.` },
        { status: 400 }
      )
    }

    // Validate sender has access to origin location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: parseInt(userId),
          locationId: transfer.fromLocationId,
        },
      })
      if (!userLocation) {
        return NextResponse.json(
          { error: 'No access to origin location' },
          { status: 403 }
        )
      }
    }

    // ENFORCE: Sender must be different from creator and checker (separation of duties)
    if (transfer.createdBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot send your own transfer. A different user must send this transfer for proper control and audit compliance.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    if (transfer.checkedBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot send a transfer you checked. A different user must send this transfer for proper separation of duties.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, deduct stock from origin location
      for (const item of transfer.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())

        // Get current stock at origin location
        const currentStock = await tx.variationLocationDetails.findFirst({
          where: {
            productId,
            productVariationId: variationId,
            locationId: transfer.fromLocationId,
          },
        })

        if (!currentStock) {
          throw new Error(
            `Stock record not found for product variation ${variationId} at origin location`
          )
        }

        const currentQty = parseFloat(currentStock.qtyAvailable.toString())

        // CRITICAL: Validate sufficient stock
        if (currentQty < quantity) {
          throw new Error(
            `Insufficient stock for product variation ${variationId}. ` +
            `Available: ${currentQty}, Required: ${quantity}`
          )
        }

        const newQty = currentQty - quantity

        // Update stock at origin (deduct)
        await tx.variationLocationDetails.update({
          where: { id: currentStock.id },
          data: {
            qtyAvailable: newQty,
            updatedAt: new Date(),
          },
        })

        // Create stock transaction (negative = deduction)
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId,
            productVariationId: variationId,
            locationId: transfer.fromLocationId,
            type: 'transfer_out',
            quantity: -quantity,
            balanceQty: newQty,
            referenceType: 'stock_transfer',
            referenceId: transferId,
            createdBy: parseInt(userId),
            notes: `Transfer ${transfer.transferNumber} sent`,
          },
        })

        // Handle serial numbers if present
        if (item.serialNumbersSent) {
          const serialIds = item.serialNumbersSent as number[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            // Update serial numbers to in_transit status
            await tx.productSerialNumber.updateMany({
              where: {
                id: { in: serialIds },
                status: 'in_stock',
                currentLocationId: transfer.fromLocationId,
              },
              data: {
                status: 'in_transit',
                currentLocationId: null, // Temporarily null during transit
                updatedAt: new Date(),
              },
            })
          }
        }
      }

      // Update transfer status to in_transit
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'in_transit',
          stockDeducted: true, // CRITICAL FLAG
          sentBy: parseInt(userId),
          sentAt: new Date(),
        },
      })

      return updatedTransfer
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_send' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Sent transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
        notes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Transfer sent - stock deducted from origin location',
      transfer: result,
    })
  } catch (error: any) {
    console.error('Error sending transfer:', error)
    return NextResponse.json(
      { error: 'Failed to send transfer', details: error.message },
      { status: 500 }
    )
  }
}
