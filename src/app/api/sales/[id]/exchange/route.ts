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
import bcrypt from 'bcryptjs'

/**
 * POST /api/sales/[id]/exchange - Process an exchange for a sale
 * Customer returns defective/damaged items and receives replacement items
 * Handles price differences:
 *   - customer pays more  → sale_payment on the exchange sale (current shift)
 *   - customer owed money → cash_in_out row of type 'refund' on the current open shift
 * Exchange window is Business.exchangeWindowDays (default 30). Older sales can
 * still be exchanged with a manager/admin password (recorded on the return).
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
        notes,            // Additional notes
        managerPassword   // Required only when sale is older than the exchange window
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

      // Validate exchange window (configurable per business). Past the window the
      // exchange is still allowed, but a manager/admin password is required.
      const business = await prisma.business.findUnique({
        where: { id: parseInt(user.businessId) },
        select: { exchangeWindowDays: true },
      })
      const exchangeWindowDays = business?.exchangeWindowDays ?? 30
      const saleDate = new Date(sale.saleDate)
      const today = new Date()
      const daysDifference = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))
      const isPastWindow = daysDifference > exchangeWindowDays

      let authorizingManager: { id: number; username: string } | null = null

      if (isPastWindow) {
        if (!managerPassword) {
          return NextResponse.json(
            {
              error: `Exchange period expired. This sale is ${daysDifference} days old (limit: ${exchangeWindowDays} days). Manager authorization is required.`,
              requiresManagerAuth: true,
              daysDifference,
              exchangeWindowDays,
            },
            { status: 400 }
          )
        }

        // Verify manager/admin password (same rule as refund/void)
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
          select: { id: true, username: true, password: true },
        })

        for (const manager of managerUsers) {
          const isMatch = await bcrypt.compare(managerPassword, manager.password)
          if (isMatch) {
            authorizingManager = { id: manager.id, username: manager.username }
            break
          }
        }

        if (!authorizingManager) {
          return NextResponse.json(
            { error: 'Invalid manager password. Only managers or admins can authorize exchanges past the exchange window.' },
            { status: 403 }
          )
        }
      }

      // ========== 5-MINUTE DUPLICATE DETECTION ==========
      // Prevent duplicate exchange operations during network issues
      // This is the same pattern used in POS sales, GRN, transfers, etc.
      const DUPLICATE_WINDOW_MS = 300 * 1000 // 5 minutes
      const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)

      // Check for recent exchanges on same sale by same user
      const recentExchanges = await prisma.sale.findMany({
        where: {
          businessId: parseInt(user.businessId),
          saleType: 'exchange',
          createdBy: parseInt(user.id),
          createdAt: { gte: duplicateCheckTime },
          notes: { contains: sale.invoiceNumber }, // Links to original sale
        },
        select: { id: true, invoiceNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (recentExchanges.length > 0) {
        const latestExchange = recentExchanges[0]
        const secondsAgo = Math.round((Date.now() - latestExchange.createdAt.getTime()) / 1000)

        console.warn(`[EXCHANGE] DUPLICATE BLOCKED: Exchange for ${sale.invoiceNumber} already processed ${secondsAgo}s ago`)
        return NextResponse.json(
          {
            error: 'Duplicate exchange detected',
            message: `An exchange for this sale was processed ${secondsAgo} seconds ago. This appears to be a duplicate caused by network issues.`,
            existingExchangeNumber: latestExchange.invoiceNumber,
            existingExchangeId: latestExchange.id,
          },
          { status: 409 }
        )
      }
      // ========== END DUPLICATE DETECTION ==========

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
        // saleItem.discountAmount is the LINE discount (POS: pct of line total / fixed × qty), so spread it per unit
        const itemDiscount = parseFloat(saleItem.discountAmount?.toString() || '0') / itemQty
        const effectivePrice = parseFloat(saleItem.unitPrice.toString()) - itemDiscount
        returnTotal += returnQty * effectivePrice
      }

      // Block returning more than was sold on this invoice, counting earlier
      // returns/exchanges (CustomerReturnItem has no saleItemId, so compare per variation)
      const soldByVariation = new Map<number, number>()
      for (const item of sale.items) {
        soldByVariation.set(item.productVariationId, (soldByVariation.get(item.productVariationId) || 0) + parseFloat(item.quantity.toString()))
      }
      const priorReturnItems = await prisma.customerReturnItem.findMany({
        where: { customerReturn: { saleId: sale.id, status: { notIn: ['rejected', 'voided'] } } },
        select: { productVariationId: true, quantity: true },
      })
      const returnedByVariation = new Map<number, number>()
      for (const item of priorReturnItems) {
        returnedByVariation.set(item.productVariationId, (returnedByVariation.get(item.productVariationId) || 0) + parseFloat(item.quantity.toString()))
      }
      for (const returnItem of returnItems) {
        const saleItem = sale.items.find((item) => item.id === returnItem.saleItemId)!
        returnedByVariation.set(saleItem.productVariationId, (returnedByVariation.get(saleItem.productVariationId) || 0) + parseFloat(returnItem.quantity))
      }
      for (const [variationId, returnedQty] of returnedByVariation) {
        const soldQty = soldByVariation.get(variationId) || 0
        if (returnedQty > soldQty + 0.0001) {
          const alreadyReturned = (priorReturnItems.filter((i) => i.productVariationId === variationId)
            .reduce((sum, i) => sum + parseFloat(i.quantity.toString()), 0))
          return NextResponse.json(
            {
              error: `This item was already returned/exchanged on this invoice. Sold: ${soldQty}, already returned: ${alreadyReturned}, remaining: ${Math.max(soldQty - alreadyReturned, 0)}.`,
            },
            { status: 400 }
          )
        }
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

      // Detect if original sale is a credit/charge sale (unpaid or partially paid)
      const isOriginalCreditSale = sale.status === 'pending'

      // Validate payment amount matches price difference
      // Credit sale exchange-up: difference goes to AR, no cash required at exchange time
      const expectedPayment = customerPaysMore
        ? (isOriginalCreditSale ? 0 : priceDifference)
        : 0
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

      // Get user's current location from session (where exchange is being processed)
      const currentLocationId = parseInt(user.currentLocationId) || sale.locationId

      // Get the CURRENT cashier's open shift (not the original sale's shift)
      // This ensures the exchange appears in the current Z Reading
      const currentShift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(user.id),
          status: 'open',
          businessId: parseInt(user.businessId),
          locationId: currentLocationId,
        },
        select: { id: true },
      })

      // Exchange-down on a paid sale = cash leaves the drawer. That must land on
      // an OPEN shift so the X/Z reading expected cash is reduced.
      const cashRefundAmount = customerGetsCredit && !isOriginalCreditSale ? Math.abs(priceDifference) : 0
      if (cashRefundAmount > 0 && !currentShift) {
        return NextResponse.json(
          { error: `This exchange refunds ₱${cashRefundAmount.toFixed(2)} to the customer. You must have an open shift at this location to record the cash refund.` },
          { status: 400 }
        )
      }

      // Cost of the items being issued (for COGS on the exchange sale + stock ledger valuation)
      const exchangeVariations = await prisma.productVariation.findMany({
        where: { id: { in: exchangeItems.map((ei: any) => Number(ei.productVariationId)) } },
        select: { id: true, purchasePrice: true },
      })
      const exchangeCostMap = new Map<number, number>(
        exchangeVariations.map((v) => [v.id, parseFloat(v.purchasePrice?.toString() || '0')])
      )

      // Process exchange in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Generate exchange number atomically
        const exchangeNumber = await getNextExchangeNumber(parseInt(user.businessId), tx)

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
            notes: authorizingManager
              ? `${exchangeReason} [Past exchange window: ${daysDifference} days old, limit ${exchangeWindowDays}. Authorized by ${authorizingManager.username}]`
              : exchangeReason, // Reason for exchange stored in notes field
            totalRefundAmount: returnTotal, // Total refund value for the exchange
            status: 'exchanged', // Mark as exchanged, not refunded
            createdBy: parseInt(user.id), // User who processed the exchange
            // Manager who authorized a past-window exchange (null when within window)
            approvedBy: authorizingManager?.id ?? null,
            approvedAt: authorizingManager ? getManilaDate() : null,
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
            unitCost: parseFloat(saleItem.unitCost?.toString() || '0'), // value stock coming back at original cost
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
            // Credit sale exchanges: charge goes to original sale's AR, not this exchange record
            totalAmount: (isOriginalCreditSale && priceDifference !== 0) ? 0 : Math.max(priceDifference, 0),
            paidAmount: (isOriginalCreditSale || !customerPaysMore) ? 0 : actualPayment,
            createdBy: parseInt(user.id),
            shiftId: shiftIdForExchange, // Link to CURRENT shift for Z Reading
            // Link to original sale
            notes: notes || `Exchange for original sale ${sale.invoiceNumber}. Reason: ${exchangeReason}`,
          },
        })

        // Link the return record to the exchange sale (original sale <- return -> exchange sale)
        await tx.customerReturn.update({
          where: { id: customerReturn.id },
          data: { replacementSaleId: exchangeSale.id },
        })

        // 4. Create sale items for exchange items
        const exchangeStockUpdates = []
        for (const exchangeItem of exchangeItems) {
          const exchangeUnitCost = exchangeCostMap.get(Number(exchangeItem.productVariationId)) ?? 0

          // Create sale item
          await tx.saleItem.create({
            data: {
              saleId: exchangeSale.id,
              productId: exchangeItem.productId,
              productVariationId: exchangeItem.productVariationId,
              quantity: parseFloat(exchangeItem.quantity),
              unitPrice: parseFloat(exchangeItem.unitPrice),
              unitCost: exchangeUnitCost, // COGS for profit reports
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
            unitCost: exchangeUnitCost,
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

        // 6b. Record cash refund if customer is owed money (exchange-down on a paid sale).
        // Stored as cash_in_out type 'refund' on the CURRENT open shift so every
        // expected-cash formula (X/Z reading, shift close) subtracts it, while
        // expense reports (which filter type = 'cash_out') ignore it.
        if (cashRefundAmount > 0 && currentShift) {
          await tx.cashInOut.create({
            data: {
              businessId: parseInt(user.businessId),
              shiftId: currentShift.id,
              locationId: currentLocationId,
              type: 'refund',
              amount: cashRefundAmount,
              reason: `Exchange refund ${exchangeNumber} (original sale ${sale.invoiceNumber})`,
              referenceNumber: exchangeNumber, // used by void to reverse this row
              createdBy: parseInt(user.id),
            },
          })
        }

        // 7. Adjust original credit sale's totalAmount for any price difference
        // Credit sale customers haven't paid yet, so adjust what they owe
        if (isOriginalCreditSale && priceDifference !== 0) {
          if (customerGetsCredit) {
            // Exchange-down: customer owes less
            await tx.sale.update({
              where: { id: saleId },
              data: { totalAmount: { decrement: Math.abs(priceDifference) } },
            })
          } else if (customerPaysMore) {
            // Exchange-up: customer owes more
            await tx.sale.update({
              where: { id: saleId },
              data: { totalAmount: { increment: priceDifference } },
            })
          }
        }

        // 8. Update shift running totals for exchange
        // IMPORTANT: Use CURRENT shift so exchange appears in current Z Reading
        if (shiftIdForExchange) {
          // Exchange-down (customerGetsCredit): NO automatic cash debit.
          // The exchange transaction itself records no cash payment (paidAmount=0,
          // no sale_payment row). Customers typically take store credit or apply
          // the credit to a same-visit purchase via discount — both involve zero
          // cash movement at exchange time. If the cashier physically refunded
          // cash, they must record an explicit Cash Out for audit trail.
          // Exchange-up: cashImpact is the payment the customer just made.
          const cashImpact = customerGetsCredit ? 0 : actualPayment
          await incrementShiftTotalsForExchange(
            shiftIdForExchange, // CURRENT shift, not original sale's shift
            exchangeTotal,      // Total of new items issued
            returnTotal,        // Total of items returned
            cashImpact,         // Positive = payment in, Negative = cash out (refund to customer)
            tx,
            customerPaysMore ? (paymentMethod || 'cash') : 'cash' // Use actual payment method when customer pays more; refunds are always cash from drawer
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
             cashRefundAmount > 0 ? `Cash refunded to customer ₱${cashRefundAmount.toFixed(2)}` :
             result.customerGetsCredit ? `Customer credit ₱${Math.abs(result.priceDifference).toFixed(2)} applied to credit sale` :
             'Even exchange'}` +
          (authorizingManager ? `. Past window (${daysDifference} days, limit ${exchangeWindowDays}) authorized by ${authorizingManager.username}` : ''),
        metadata: {
          cashRefundAmount,
          daysDifference,
          exchangeWindowDays,
          pastWindow: isPastWindow,
          authorizedBy: authorizingManager?.id ?? null,
          authorizedByUsername: authorizingManager?.username ?? null,
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
        cashRefundAmount, // > 0 when cash was handed back to the customer (recorded on the shift)
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
