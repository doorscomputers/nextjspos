import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { sendTransferDiscrepancyAlert } from '@/lib/email'

/**
 * POST /api/transfers/[id]/verify-all
 * Bulk verify all transfer items at once
 *
 * Purpose: Allows users to verify all items in one click after physically checking
 * against printed paper, instead of clicking verify 10+ times individually.
 *
 * This is faster and more efficient than verify-item endpoint which does
 * database operations for each item separately.
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VERIFY)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_VERIFY permission' },
        { status: 403 }
      )
    }

    // Get transfer with items
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        items: {
          include: {
            product: true,
            productVariation: true,
          },
        },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status
    if (transfer.status !== 'verifying') {
      return NextResponse.json(
        { error: `Cannot verify items with status: ${transfer.status}. Status must be 'verifying'.` },
        { status: 400 }
      )
    }

    const now = new Date()

    // Get all unverified items from the transfer
    const unverifiedItems = transfer.items.filter(item => !item.verified)

    // Update each unverified item individually to set both verified AND receivedQuantity
    // We can't use updateMany because we need to conditionally set receivedQuantity
    if (unverifiedItems.length > 0) {
      await Promise.all(
        unverifiedItems.map(item =>
          prisma.stockTransferItem.update({
            where: { id: item.id },
            data: {
              verified: true,
              verifiedBy: parseInt(userId),
              verifiedAt: now,
              // Set receivedQuantity to sent quantity if not already set or if it's 0
              receivedQuantity: item.receivedQuantity && item.receivedQuantity.toString() !== '0'
                ? item.receivedQuantity
                : item.quantity,
            },
          })
        )
      )
    }

    const updateResult = { count: unverifiedItems.length }

    // Update transfer status to 'verified'
    await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'verified',
        verifiedBy: parseInt(userId),
        verifiedAt: now,
      },
    })

    // Check for discrepancies across all items
    const itemsWithDiscrepancies = transfer.items.filter(item => {
      const sent = parseFloat(item.quantity.toString())
      const received = item.receivedQuantity
        ? parseFloat(item.receivedQuantity.toString())
        : sent
      return sent !== received
    })

    // If there are discrepancies, send email notification (async, don't wait)
    if (itemsWithDiscrepancies.length > 0) {
      await prisma.stockTransfer.update({
        where: { id: transferId },
        data: {
          hasDiscrepancy: true,
        },
      })

      sendTransferDiscrepancyAlert({
        transferNumber: transfer.transferNumber,
        fromLocationName: transfer.fromLocation.name,
        toLocationName: transfer.toLocation.name,
        verifierName: user.username || user.name || `User ${userId}`,
        timestamp: now,
        discrepantItems: itemsWithDiscrepancies.map(item => {
          const sent = parseFloat(item.quantity.toString())
          const received = item.receivedQuantity
            ? parseFloat(item.receivedQuantity.toString())
            : sent
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
        console.error('Failed to send discrepancy email:', err)
      })
    }

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_verify_all' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Bulk verified all ${transfer.items.length} items in transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        itemCount: transfer.items.length,
        itemsUpdated: updateResult.count,
        hasDiscrepancies: itemsWithDiscrepancies.length > 0,
        discrepancyCount: itemsWithDiscrepancies.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: `All ${transfer.items.length} items verified successfully - transfer ready to complete`,
      itemsVerified: transfer.items.length,
      itemsUpdated: updateResult.count,
      hasDiscrepancies: itemsWithDiscrepancies.length > 0,
      discrepancyCount: itemsWithDiscrepancies.length,
    })
  } catch (error: any) {
    console.error('Error verifying all items:', error)
    return NextResponse.json(
      { error: 'Failed to verify all items', details: error.message },
      { status: 500 }
    )
  }
}
