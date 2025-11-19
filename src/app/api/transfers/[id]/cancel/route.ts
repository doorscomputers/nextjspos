import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/transfers/[id]/cancel
 * Cancel transfer at any stage (except completed)
 * CRITICAL: Restores stock to origin if already in_transit
 * Restores serial numbers to in_stock at origin location
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

    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      )
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CANCEL)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_CANCEL permission' },
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

    // Cannot cancel completed transfers
    if (transfer.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed transfers - they are immutable' },
        { status: 400 }
      )
    }

    // Cannot cancel already cancelled transfers
    if (transfer.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Transfer is already cancelled' },
        { status: 400 }
      )
    }

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // If stock was already deducted (in_transit or later), restore it
      if (transfer.stockDeducted) {
        for (const item of transfer.items) {
          const productId = item.productId
          const variationId = item.productVariationId
          const quantity = parseFloat(item.quantity.toString())

          // Get stock at origin location
          const originStock = await tx.variationLocationDetails.findFirst({
            where: {
              productId,
              productVariationId: variationId,
              locationId: transfer.fromLocationId,
            },
          }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

          if (!originStock) {
            throw new Error(
              `Stock record not found for product variation ${variationId} at origin location`
            )
          }

          const currentQty = parseFloat(originStock.qtyAvailable.toString())
          const newQty = currentQty + quantity // Restore

          // Update stock at origin (add back)
          await tx.variationLocationDetails.update({
            where: { id: originStock.id },
            data: {
              qtyAvailable: newQty,
              updatedAt: new Date(),
            },
          })

          // Create stock transaction (positive = restoration)
          await tx.stockTransaction.create({
            data: {
              businessId: parseInt(businessId),
              productId,
              productVariationId: variationId,
              locationId: transfer.fromLocationId,
              type: 'transfer_cancel',
              quantity: quantity,
              balanceQty: newQty,
              referenceType: 'stock_transfer',
              referenceId: transferId,
              createdBy: parseInt(userId),
              notes: `Transfer ${transfer.transferNumber} cancelled - stock restored`,
            },
          })

          // Handle serial numbers if present
          if (item.serialNumbersSent) {
            const serialIds = item.serialNumbersSent as number[]

            if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
              // Restore serial numbers to in_stock at origin
              await tx.productSerialNumber.updateMany({
                where: {
                  id: { in: serialIds },
                },
                data: {
                  status: 'in_stock',
                  currentLocationId: transfer.fromLocationId,
                  updatedAt: new Date(),
                },
              })
            }
          }
        }
      }

      // Update transfer status to cancelled
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'cancelled',
          cancelledBy: parseInt(userId),
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      })

      return updatedTransfer
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_cancel' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Cancelled transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        previousStatus: transfer.status,
        stockRestored: transfer.stockDeducted,
        cancellationReason: reason,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: transfer.stockDeducted 
        ? 'Transfer cancelled - stock restored to origin location'
        : 'Transfer cancelled',
      transfer: result,
    })
  } catch (error: any) {
    console.error('Error cancelling transfer:', error)
    return NextResponse.json(
      { error: 'Failed to cancel transfer', details: error.message },
      { status: 500 }
    )
  }
}
