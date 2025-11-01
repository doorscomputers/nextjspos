import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { addStock, StockTransactionType } from '@/lib/stockOperations'
import bcrypt from 'bcryptjs'
import { sendRefundTransactionAlert } from '@/lib/email'
import { sendTelegramRefundTransactionAlert } from '@/lib/telegram'
import { withIdempotency } from '@/lib/idempotency'
import { getNextReturnNumber } from '@/lib/atomicNumbers'

/**
 * POST /api/sales/[id]/refund - Process a refund for a sale
 * Supports partial and full refunds
 * Requires manager authorization
 * Restores inventory for refunded items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withIdempotency(request, `/api/sales/${id}/refund`, async () => {
    try {
      const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SELL_REFUND)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing sell.refund permission' },
        { status: 403 }
      )
    }

    const saleId = parseInt(id)
    const body = await request.json()
    const { refundItems, refundReason, managerPassword } = body

    // Validate required fields
    if (!refundItems || refundItems.length === 0) {
      return NextResponse.json(
        { error: 'Refund items are required' },
        { status: 400 }
      )
    }

    if (!refundReason) {
      return NextResponse.json({ error: 'Refund reason is required' }, { status: 400 })
    }

    if (!managerPassword) {
      return NextResponse.json(
        { error: 'Manager password is required to process refunds' },
        { status: 400 }
      )
    }

    // Verify manager/admin password
    const managerUsers = await prisma.user.findMany({
      where: {
        businessId: parseInt(user.businessId),
        roles: {
          some: {
            role: {
              name: {
                in: ['Branch Manager', 'Main Branch Manager', 'Branch Admin', 'All Branch Admin', 'Super Admin'],
              },
            },
          },
        },
      },
      select: {
        id: { select: { id: true, name: true } },
        username: { select: { id: true, name: true } },
        password: { select: { id: true, name: true } },
      },
    })

    let passwordValid = false
    let authorizingManager = null

    for (const manager of managerUsers) {
      const isMatch = await bcrypt.compare(managerPassword, manager.password)
      if (isMatch) {
        passwordValid = true
        authorizingManager = manager
        break
      }
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid manager password. Only managers or admins can authorize refunds.' },
        { status: 403 }
      )
    }

    // Fetch the sale
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
        payments: { select: { id: true, name: true } },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Check business ownership
    if (sale.businessId !== parseInt(user.businessId)) {
      return NextResponse.json(
        { error: 'Sale does not belong to your business' },
        { status: 403 }
      )
    }

    // Cannot refund voided or cancelled sales
    if (sale.status === 'voided' || sale.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot refund a ${sale.status} sale` },
        { status: 400 }
      )
    }

    // Validate refund items
    let refundTotal = 0
    for (const refundItem of refundItems) {
      const saleItem = sale.items.find((item) => item.id === refundItem.saleItemId)

      if (!saleItem) {
        return NextResponse.json(
          { error: `Sale item ${refundItem.saleItemId} not found in this sale` },
          { status: 400 }
        )
      }

      const refundQty = parseFloat(refundItem.quantity)
      const itemQty = parseFloat(saleItem.quantity.toString())

      if (refundQty <= 0 || refundQty > itemQty) {
        return NextResponse.json(
          {
            error: `Invalid refund quantity for item ${refundItem.saleItemId}. Max: ${itemQty}`,
          },
          { status: 400 }
        )
      }

      refundTotal += refundQty * parseFloat(saleItem.unitPrice.toString())
    }

    // Process refund in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate refund number atomically
      const returnNumber = await getNextReturnNumber(parseInt(user.businessId), tx)

      // Create customer return record
      const customerReturn = await tx.customerReturn.create({
        data: {
          businessId: parseInt(user.businessId),
          saleId: saleId,
          customerId: sale.customerId,
          locationId: sale.locationId,
          returnNumber,
          returnDate: new Date(),
          reason: refundReason,
          refundAmount: refundTotal,
          status: 'completed',
          processedBy: parseInt(user.id),
          authorizedBy: authorizingManager.id,
          authorizedByUsername: authorizingManager.username,
        },
      })

      // Process each refund item
      for (const refundItem of refundItems) {
        const saleItem = sale.items.find((item) => item.id === refundItem.saleItemId)
        if (!saleItem) continue

        const refundQty = parseFloat(refundItem.quantity)

        // Create return item record
        await tx.customerReturnItem.create({
          data: {
            returnId: customerReturn.id,
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            productVariationId: saleItem.productVariationId,
            quantity: refundQty,
            unitPrice: parseFloat(saleItem.unitPrice.toString()),
          },
        })

        // Restore inventory using centralized helper
        await addStock(
          saleItem.productVariationId,
          sale.locationId,
          refundQty,
          {
            type: StockTransactionType.RETURN,
            referenceType: 'return',
            referenceId: customerReturn.id,
            notes: `Refund ${returnNumber} for sale ${sale.invoiceNumber}`,
            createdBy: parseInt(user.id),
            businessId: parseInt(user.businessId),
            displayName: user.username,
          },
          tx
        )

        // Handle serial numbers if applicable
        if (
          refundItem.serialNumberIds &&
          Array.isArray(refundItem.serialNumberIds) &&
          refundItem.serialNumberIds.length > 0
        ) {
          for (const serialNumberId of refundItem.serialNumberIds) {
            // Restore serial number to in_stock
            await tx.productSerialNumber.update({
              where: { id: parseInt(serialNumberId) },
              data: {
                status: 'in_stock',
                saleId: null,
                soldAt: null,
                soldTo: null,
              },
            })

            // Create movement record
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: parseInt(serialNumberId),
                movementType: 'return',
                toLocationId: sale.locationId,
                referenceType: 'return',
                referenceId: customerReturn.id,
                movedBy: parseInt(user.id),
                notes: `Returned from sale ${sale.invoiceNumber}`,
              },
            })
          }
        }
      }

      return { customerReturn, returnNumber }
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: AuditAction.SALE_RETURN,
      entityType: EntityType.SALE,
      entityIds: [saleId],
      description: `Processed refund ${result.returnNumber} for sale ${sale.invoiceNumber}. Amount: ₱${refundTotal.toFixed(2)}. Authorized by: ${authorizingManager.username}`,
      metadata: {
        saleId,
        returnId: result.customerReturn.id,
        invoiceNumber: sale.invoiceNumber,
        returnNumber: result.returnNumber,
        refundAmount: refundTotal,
        refundReason,
        authorizedBy: authorizingManager.id,
        authorizedByUsername: authorizingManager.username,
        itemCount: refundItems.length,
      },
    })

    // Send refund alert notifications (async, don't wait)
    setImmediate(async () => {
      try {
        const location = await prisma.businessLocation.findUnique({
          where: { id: sale.locationId },
        })

        const alertData = {
          saleNumber: sale.invoiceNumber,
          refundAmount: refundTotal,
          cashierName: user.username || user.name || 'Unknown',
          locationName: location?.name || 'Unknown Location',
          timestamp: new Date(),
          reason: refundReason,
          itemCount: refundItems.length,
          originalSaleDate: sale.saleDate,
        }

        await Promise.all([
          sendRefundTransactionAlert(alertData),
          sendTelegramRefundTransactionAlert(alertData),
        ])
      } catch (notificationError) {
        console.error('Refund alert notification error:', notificationError)
      }
    })

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      message: 'Refund processed successfully',
      return: result.customerReturn,
      returnNumber: result.returnNumber,
      refundAmount: refundTotal,
    })
  } catch (error: any) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      { error: 'Failed to process refund', details: error.message },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
