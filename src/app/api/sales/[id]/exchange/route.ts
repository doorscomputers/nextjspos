import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { addStock, bulkUpdateStock, StockTransactionType } from '@/lib/stockOperations'
import { withIdempotency } from '@/lib/idempotency'
import { getNextExchangeNumber } from '@/lib/atomicNumbers'
import { incrementShiftTotalsForExchange } from '@/lib/shift-running-totals'
import { getManilaDate } from '@/lib/timezone'

/**
 * POST /api/sales/[id]/exchange - Process an exchange for a sale
 * Customer returns defective/damaged items and receives replacement items
 * Handles price differences (customer pays more or receives credit)
 * Cashier-only authorization (no manager password required)
 * 7-day return window from original sale date
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withIdempotency(request, `/api/sales/${id}/exchange`, async () => {
    try {
      const session = await getServerSession(authOptions)
      if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = session.user as any

      // Check permission (cashier-level permission)
      if (!hasPermission(user, PERMISSIONS.SELL_CREATE)) {
        return NextResponse.json(
          { error: 'Forbidden - Missing sell.create permission' },
          { status: 403 }
        )
      }

      const saleId = parseInt(id)
      const body = await request.json()
      const {
        returnItems,      // Items being returned by customer
        exchangeItems,    // Items being given to customer
        exchangeReason,   // Reason for exchange
        paymentMethod,    // How customer pays difference (if any)
        paymentAmount,    // Amount customer pays/receives
        notes             // Additional notes
      } = body

      // Validate required fields
      if (!returnItems || returnItems.length === 0) {
        return NextResponse.json(
          { error: 'Return items are required' },
          { status: 400 }
        )
      }

      if (!exchangeItems || exchangeItems.length === 0) {
        return NextResponse.json(
          { error: 'Exchange items are required' },
          { status: 400 }
        )
      }

      if (!exchangeReason) {
        return NextResponse.json(
          { error: 'Exchange reason is required' },
          { status: 400 }
        )
      }

      // Fetch the original sale
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: true,
          payments: true,
          customer: true,
          location: true,
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

      // Cannot exchange voided or cancelled sales
      if (sale.status === 'voided' || sale.status === 'cancelled') {
        return NextResponse.json(
          { error: `Cannot exchange a ${sale.status} sale` },
          { status: 400 }
        )
      }

      // Validate 7-day return window
      const saleDate = new Date(sale.saleDate)
      const today = new Date()
      const daysDifference = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDifference > 7) {
        return NextResponse.json(
          { error: `Exchange period expired. Only items purchased within 7 days can be exchanged. This sale is ${daysDifference} days old.` },
          { status: 400 }
        )
      }

      // Validate return items exist in original sale
      let returnTotal = 0
      for (const returnItem of returnItems) {
        const saleItem = sale.items.find((item) => item.id === returnItem.saleItemId)

        if (!saleItem) {
          return NextResponse.json(
            { error: `Sale item ${returnItem.saleItemId} not found in this sale` },
            { status: 400 }
          )
        }

        const returnQty = parseFloat(returnItem.quantity)
        const itemQty = parseFloat(saleItem.quantity.toString())

        if (returnQty <= 0 || returnQty > itemQty) {
          return NextResponse.json(
            {
              error: `Invalid return quantity for item ${returnItem.saleItemId}. Max: ${itemQty}`,
            },
            { status: 400 }
          )
        }

        // Account for discounts on return items (e.g., freebies at ₱0.00)
        const itemDiscount = parseFloat(saleItem.discountAmount?.toString() || '0')
        const effectivePrice = parseFloat(saleItem.unitPrice.toString()) - itemDiscount
        returnTotal += returnQty * effectivePrice
      }

      // Calculate exchange items total
      let exchangeTotal = 0
      for (const exchangeItem of exchangeItems) {
        exchangeTotal += parseFloat(exchangeItem.quantity) * parseFloat(exchangeItem.unitPrice)
      }

      // Calculate price difference
      const priceDifference = exchangeTotal - returnTotal
      const customerPaysMore = priceDifference > 0
      const customerGetsCredit = priceDifference < 0

      // Validate payment amount matches price difference
      const expectedPayment = customerPaysMore ? priceDifference : 0
      const actualPayment = parseFloat(paymentAmount || 0)

      if (customerPaysMore && Math.abs(actualPayment - expectedPayment) > 0.01) {
        return NextResponse.json(
          {
            error: `Payment amount mismatch. Customer must pay ₱${expectedPayment.toFixed(2)} for the price difference.`,
            expectedPayment: expectedPayment.toFixed(2),
            receivedPayment: actualPayment.toFixed(2)
          },
          { status: 400 }
        )
      }

      // Process exchange in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Generate exchange number atomically
        const exchangeNumber = await getNextExchangeNumber(parseInt(user.businessId), tx)

        // Get user's current location from session (where exchange is being processed)
        const currentLocationId = parseInt(user.currentLocationId) || sale.locationId

        // Get the CURRENT cashier's open shift (not the original sale's shift)
        // This ensures the exchange appears in the current Z Reading
        const currentShift = await tx.cashierShift.findFirst({
          where: {
            userId: parseInt(user.id),
            status: 'open',
            businessId: parseInt(user.businessId),
            locationId: currentLocationId,
          },
        })

        // Use current shift if available, otherwise fall back to original sale's shift
        const shiftIdForExchange = currentShift?.id || sale.shiftId

        // 1. Create customer return record for returned items
        const customerReturn = await tx.customerReturn.create({
          data: {
            businessId: parseInt(user.businessId),
            saleId: saleId,
            customerId: sale.customerId,
            locationId: currentLocationId, // Use current location, not original sale location
            returnNumber: `RTN-${exchangeNumber}`,
            returnDate: getManilaDate(),
            notes: exchangeReason, // Reason for exchange stored in notes field
            totalRefundAmount: returnTotal, // Total refund value for the exchange
            status: 'exchanged', // Mark as exchanged, not refunded
            createdBy: parseInt(user.id), // User who processed the exchange
          },
        })

        // 2. Process return items - restore inventory
        for (const returnItem of returnItems) {
          const saleItem = sale.items.find((item) => item.id === returnItem.saleItemId)
          if (!saleItem) continue

          const returnQty = parseFloat(returnItem.quantity)

          // Create return item record
          await tx.customerReturnItem.create({
            data: {
              customerReturnId: customerReturn.id,
              productId: saleItem.productId,
              productVariationId: saleItem.productVariationId,
              quantity: returnQty,
              unitPrice: parseFloat(saleItem.unitPrice.toString()),
              condition: 'resellable', // Default condition for exchange items
              returnType: 'replacement', // Exchange = replacement, not refund
            },
          })

          // Restore inventory for returned items (at current location)
          await addStock({
            productId: saleItem.productId,
            productVariationId: saleItem.productVariationId,
            locationId: currentLocationId, // Add to current location, not original sale location
            quantity: returnQty,
            type: StockTransactionType.CUSTOMER_RETURN,
            referenceType: 'exchange_return',
            referenceId: customerReturn.id,
            notes: `Exchange ${exchangeNumber} - Returned from sale ${sale.invoiceNumber} at current location`,
            userId: parseInt(user.id),
            businessId: parseInt(user.businessId),
            userDisplayName: user.username,
            tx,
          })

          // Handle serial numbers if applicable
          if (
            returnItem.serialNumberIds &&
            Array.isArray(returnItem.serialNumberIds) &&
            returnItem.serialNumberIds.length > 0
          ) {
            for (const serialNumberId of returnItem.serialNumberIds) {
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
                  referenceType: 'exchange_return',
                  referenceId: customerReturn.id,
                  movedBy: parseInt(user.id),
                  notes: `Returned via exchange ${exchangeNumber}`,
                },
              })
            }
          }
        }

        // 3. Create new sale for exchange items (at current location)
        // IMPORTANT: For exchanges, the accounting should reflect:
        // - subtotal = value of new items issued
        // - discountAmount = value of returned items (credit applied)
        // - totalAmount = price difference (what customer owes/receives)
        // - paidAmount = actual payment (only if customer pays more)
        // This ensures Balance = 0 for completed exchanges
        const exchangeSale = await tx.sale.create({
          data: {
            businessId: parseInt(user.businessId),
            locationId: currentLocationId, // Exchange processed at current location, not original sale location
            customerId: sale.customerId,
            invoiceNumber: exchangeNumber,
            saleDate: getManilaDate(),
            saleType: 'exchange', // Mark as exchange transaction
            status: 'completed',
            subtotal: exchangeTotal, // Value of new items issued
            taxAmount: 0,
            discountAmount: returnTotal, // Credit from returned items
            totalAmount: Math.max(priceDifference, 0), // Only positive difference (what customer owes)
            paidAmount: customerPaysMore ? actualPayment : 0, // Amount actually paid
            createdBy: parseInt(user.id),
            shiftId: shiftIdForExchange, // Link to CURRENT shift for Z Reading
            // Link to original sale
            notes: notes || `Exchange for original sale ${sale.invoiceNumber}. Reason: ${exchangeReason}`,
          },
        })

        // 4. Create sale items for exchange items
        const exchangeStockUpdates = []
        for (const exchangeItem of exchangeItems) {
          // Create sale item
          await tx.saleItem.create({
            data: {
              saleId: exchangeSale.id,
              productId: exchangeItem.productId,
              productVariationId: exchangeItem.productVariationId,
              quantity: parseFloat(exchangeItem.quantity),
              unitPrice: parseFloat(exchangeItem.unitPrice),
              unitCost: 0,
            },
          })

          // Prepare stock deduction with all required fields (from current location)
          exchangeStockUpdates.push({
            businessId: parseInt(user.businessId),
            productId: exchangeItem.productId,
            productVariationId: exchangeItem.productVariationId,
            locationId: currentLocationId, // Deduct from current location, not original sale location
            quantity: -parseFloat(exchangeItem.quantity), // Negative for deduction
            type: StockTransactionType.SALE,
            referenceType: 'exchange_issue',
            referenceId: exchangeSale.id,
            userId: parseInt(user.id),
            userDisplayName: user.username,
            notes: `Exchange ${exchangeNumber} - Replacement for sale ${sale.invoiceNumber} at current location`,
            tx,
          })

          // Handle serial numbers for exchange items if applicable
          if (
            exchangeItem.serialNumberIds &&
            Array.isArray(exchangeItem.serialNumberIds) &&
            exchangeItem.serialNumberIds.length > 0
          ) {
            for (const serialNumberId of exchangeItem.serialNumberIds) {
              // Mark serial number as sold
              await tx.productSerialNumber.update({
                where: { id: parseInt(serialNumberId) },
                data: {
                  status: 'sold',
                  saleId: exchangeSale.id,
                  soldAt: getManilaDate(),
                  soldTo: sale.customer?.name || 'Walk-in Customer',
                },
              })

              // Create movement record
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: parseInt(serialNumberId),
                  movementType: 'sale',
                  fromLocationId: sale.locationId,
                  referenceType: 'exchange_issue',
                  referenceId: exchangeSale.id,
                  movedBy: parseInt(user.id),
                  notes: `Issued via exchange ${exchangeNumber}`,
                },
              })
            }
          }
        }

        // 5. Deduct inventory for exchange items
        await bulkUpdateStock(exchangeStockUpdates)

        // 6. Record payment if customer pays more
        if (customerPaysMore && actualPayment > 0) {
          await tx.salePayment.create({
            data: {
              saleId: exchangeSale.id,
              paymentMethod: paymentMethod || 'cash',
              amount: actualPayment,
              paidAt: getManilaDate(),
              shiftId: shiftIdForExchange, // Link to CURRENT shift for Z Reading
              collectedBy: parseInt(user.id), // User who processed exchange
              referenceNumber: `EX-${exchangeNumber}`, // Exchange reference
            },
          })
        }

        // 7. Update shift running totals for exchange
        // IMPORTANT: Use CURRENT shift so exchange appears in current Z Reading
        if (shiftIdForExchange) {
          await incrementShiftTotalsForExchange(
            shiftIdForExchange, // CURRENT shift, not original sale's shift
            exchangeTotal,      // Total of new items issued
            returnTotal,        // Total of items returned
            actualPayment,      // Actual cash collected from customer
            tx
          )
        }

        return {
          customerReturn,
          exchangeSale,
          exchangeNumber,
          priceDifference,
          customerPaysMore,
          customerGetsCredit
        }
      }, {
        timeout: 600000, // 600 seconds (10 minutes) timeout for exchange transactions
      })

      // Create audit log
      await createAuditLog({
        businessId: parseInt(user.businessId),
        userId: parseInt(user.id),
        username: user.username,
        action: AuditAction.SALE_EXCHANGE,
        entityType: EntityType.SALE,
        entityIds: [saleId, result.exchangeSale.id],
        description: `Processed exchange ${result.exchangeNumber} for sale ${sale.invoiceNumber}. ` +
          `Returned: ₱${returnTotal.toFixed(2)}, Exchanged: ₱${exchangeTotal.toFixed(2)}, ` +
          `${result.customerPaysMore ? `Customer paid ₱${result.priceDifference.toFixed(2)}` :
             result.customerGetsCredit ? `Customer credit ₱${Math.abs(result.priceDifference).toFixed(2)}` :
             'Even exchange'}`,
        metadata: {
          originalSaleId: saleId,
          exchangeSaleId: result.exchangeSale.id,
          returnId: result.customerReturn.id,
          originalInvoiceNumber: sale.invoiceNumber,
          exchangeNumber: result.exchangeNumber,
          returnTotal,
          exchangeTotal,
          priceDifference: result.priceDifference,
          customerPaysMore: result.customerPaysMore,
          customerGetsCredit: result.customerGetsCredit,
          paymentAmount: actualPayment,
          exchangeReason,
          returnItemCount: returnItems.length,
          exchangeItemCount: exchangeItems.length,
        },
      })

      // Build return items with product details for receipt printing
      const returnItemsForReceipt = await Promise.all(
        returnItems.map(async (returnItem: any) => {
          const saleItem = sale.items.find((item) => item.id === returnItem.saleItemId)
          if (!saleItem) return null

          // Fetch product and variation names
          const product = await prisma.product.findUnique({
            where: { id: saleItem.productId },
            select: { name: true, sku: true }
          })
          const variation = await prisma.productVariation.findUnique({
            where: { id: saleItem.productVariationId },
            select: { name: true, sku: true }
          })

          // Build display name - use product name, add variation if not "Default"
          const variationName = variation?.name && variation.name.toLowerCase() !== 'default' ? variation.name : null
          const productName = variationName
            ? `${product?.name || ''} - ${variationName}`
            : (product?.name || `Product #${saleItem.productId}`)

          return {
            productName,
            sku: variation?.sku || product?.sku || '',
            quantity: returnItem.quantity,
            unitPrice: parseFloat(saleItem.unitPrice.toString()),
          }
        })
      ).then(items => items.filter(Boolean))

      // Build exchange items with product details for receipt printing
      const exchangeItemsForReceipt = await Promise.all(
        exchangeItems.map(async (exchangeItem: any) => {
          // Fetch product and variation names
          const product = await prisma.product.findUnique({
            where: { id: exchangeItem.productId },
            select: { name: true, sku: true }
          })
          const variation = await prisma.productVariation.findUnique({
            where: { id: exchangeItem.productVariationId },
            select: { name: true, sku: true }
          })

          // Build display name - use product name, add variation if not "Default"
          const variationName = variation?.name && variation.name.toLowerCase() !== 'default' ? variation.name : null
          const productName = variationName
            ? `${product?.name || ''} - ${variationName}`
            : (product?.name || `Product #${exchangeItem.productId}`)

          return {
            productName,
            sku: variation?.sku || product?.sku || '',
            quantity: exchangeItem.quantity,
            unitPrice: parseFloat(exchangeItem.unitPrice),
          }
        })
      )

      return NextResponse.json({
        success: true,
        message: 'Exchange processed successfully',
        exchangeSale: result.exchangeSale,
        exchangeNumber: result.exchangeNumber,
        originalInvoiceNumber: sale.invoiceNumber,
        returnTotal,
        exchangeTotal,
        priceDifference: result.priceDifference,
        customerPaysMore: result.customerPaysMore,
        customerGetsCredit: result.customerGetsCredit,
        paymentAmount: actualPayment,
        paymentMethod: paymentMethod || 'cash',
        reason: exchangeReason,
        // Include item details for receipt printing
        returnItems: returnItemsForReceipt,
        exchangeItems: exchangeItemsForReceipt,
        createdAt: new Date().toISOString(),
        locationId: sale.locationId,
      })
    } catch (error: any) {
      console.error('Error processing exchange:', error)
      return NextResponse.json(
        { error: 'Failed to process exchange', details: error.message },
        { status: 500 }
      )
    }
  }) // Close idempotency wrapper
}
