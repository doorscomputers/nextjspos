import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { sendTransferDiscrepancyAlert } from '@/lib/email'

/**
 * POST /api/transfers/[id]/verify-item
 * Verify individual transfer item with checkbox
 * Records received quantity, serial numbers, and discrepancies
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
    const { 
      itemId, 
      receivedQuantity, 
      serialNumbersReceived, 
      hasDiscrepancy, 
      discrepancyNotes 
    } = body

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VERIFY)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_VERIFY permission' },
        { status: 403 }
      )
    }

    // Get transfer
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
    if (transfer.status !== 'verifying') {
      return NextResponse.json(
        { error: `Cannot verify items with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Get the item
    const item = await prisma.stockTransferItem.findFirst({
      where: {
        id: parseInt(itemId),
        stockTransferId: transferId,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Update item verification
    const updatedItem = await prisma.stockTransferItem.update({
      where: { id: parseInt(itemId) },
      data: {
        verified: true,
        verifiedBy: parseInt(userId),
        verifiedAt: new Date(),
        receivedQuantity: receivedQuantity?.toString() || item.quantity,
        serialNumbersReceived: serialNumbersReceived || item.serialNumbersSent,
        hasDiscrepancy: hasDiscrepancy || false,
        discrepancyNotes: discrepancyNotes || null,
      },
    })

    // If there's a discrepancy, mark the transfer
    if (hasDiscrepancy) {
      await prisma.stockTransfer.update({
        where: { id: transferId },
        data: {
          hasDiscrepancy: true,
        },
      })
    }

    // Check if ALL items are now verified
    const allItems = await prisma.stockTransferItem.findMany({
      where: {
        stockTransferId: transferId,
      },
      include: {
        product: true,
        productVariation: true,
      },
    })

    const allVerified = allItems.every(item => item.verified)

    // If all items verified, auto-transition to "verified" status
    if (allVerified) {
      await prisma.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'verified',
          verifiedBy: parseInt(userId),
          verifiedAt: new Date(),
        },
      })

      // Check if there are any discrepancies and send email notification
      const itemsWithDiscrepancies = allItems.filter(item => {
        const sent = parseFloat(item.quantity.toString())
        const received = item.receivedQuantity ? parseFloat(item.receivedQuantity.toString()) : sent
        return sent !== received
      })

      if (itemsWithDiscrepancies.length > 0) {
        // Get transfer with location names
        const transferWithLocations = await prisma.stockTransfer.findUnique({
          where: { id: transferId },
          include: {
            fromLocation: { select: { name: true } },
            toLocation: { select: { name: true } },
          },
        })

        // Send email alert (async, don't wait for it)
        sendTransferDiscrepancyAlert({
          transferNumber: transfer.transferNumber,
          fromLocationName: transferWithLocations?.fromLocation.name || 'Unknown',
          toLocationName: transferWithLocations?.toLocation.name || 'Unknown',
          verifierName: user.username || user.name || `User ${userId}`,
          timestamp: new Date(),
          discrepantItems: itemsWithDiscrepancies.map(item => {
            const sent = parseFloat(item.quantity.toString())
            const received = item.receivedQuantity ? parseFloat(item.receivedQuantity.toString()) : sent
            const difference = received - sent
            return {
              productName: item.product.name,
              variationName: item.productVariation.name,
              sku: item.productVariation.sku || item.product.sku,
              quantitySent: sent,
              quantityReceived: received,
              difference: difference,
              discrepancyType: difference < 0 ? 'shortage' : 'overage',
            }
          }),
        }).catch(err => {
          // Log error but don't fail the request
          console.error('Failed to send discrepancy email:', err)
        })
      }
    }

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_item_verify' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Verified item in transfer ${transfer.transferNumber}${allVerified ? ' - All items verified' : ''}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        itemId: parseInt(itemId),
        hasDiscrepancy: hasDiscrepancy || false,
        discrepancyNotes,
        allItemsVerified: allVerified,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: allVerified ? 'All items verified - transfer ready to complete' : 'Item verified successfully',
      item: updatedItem,
      allItemsVerified: allVerified,
    })
  } catch (error: any) {
    console.error('Error verifying item:', error)
    return NextResponse.json(
      { error: 'Failed to verify item', details: error.message },
      { status: 500 }
    )
  }
}
