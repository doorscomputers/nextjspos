import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

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

    // Validate status - must be verified OR verifying (if all items verified)
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

    // ENFORCE: Completer must be at destination location and different from previous workflow participants
    if (transfer.createdBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot complete your own transfer. A supervisor or manager at the destination location must complete this transfer.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    if (transfer.sentBy === parseInt(userId)) {
      return NextResponse.json(
        {
          error: 'Cannot complete a transfer you sent. A user at the destination location must complete this transfer.',
          code: 'SAME_USER_VIOLATION'
        },
        { status: 403 }
      )
    }

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, add stock to destination location
      for (const item of transfer.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const receivedQty = item.receivedQuantity 
          ? parseFloat(item.receivedQuantity.toString()) 
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
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedBy: parseInt(userId),
          completedAt: new Date(),
          verifiedBy: parseInt(userId),
          verifiedAt: new Date(),
          verifierNotes: notes || null,
        },
      })

      return updatedTransfer
    })

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
    })
  } catch (error: any) {
    console.error('Error completing transfer:', error)
    return NextResponse.json(
      { error: 'Failed to complete transfer', details: error.message },
      { status: 500 }
    )
  }
}
