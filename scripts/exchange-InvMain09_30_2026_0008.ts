/**
 * One-off data correction — 2026-10-16
 *
 * Back-encodes a missed exchange at Main Store for sale InvMain09_30_2026_0008
 * (customer JONELIX GACAD, paper SI 91688).
 *
 * Background: cashier swapped HP OMNIBOOK 5 16-BC1015AU (SN CND5360V3J, 64,990)
 * for HP OMNIBOOK 5 16-AF1062TU (SN CND528007B, 63,990) and handed back 1,000
 * cash, but only recorded a Cash Out (cash_in_out 2519 "JONELIX GACAD REFUND")
 * on shift 960. No exchange was posted, so stock and the invoice link were
 * missing. Shift 960 was then closed balanced (86,072, cash out included).
 *
 * Mirrors src/app/api/sales/[id]/exchange/route.ts minus session auth.
 * Differences on purpose (shift 960 is closed - frozen Z-reading history):
 *  - no refund row is created; the 1,000 is already on shift 960 as Cash Out
 *    row 2519, which stays untouched;
 *  - shift running totals are not changed (same as the void route for closed
 *    shifts), and the exchange invoice is NOT linked to shift 960 (shiftId null):
 *    X/Z readings re-query sales by shift_id, so a link would alter the closed
 *    reading. Shift 960 is named in the notes for tracing.
 *
 * Dry run (no writes): npx tsx scripts/exchange-InvMain09_30_2026_0008.ts
 * Write:               npx tsx scripts/exchange-InvMain09_30_2026_0008.ts --commit
 */

import { PrismaClient } from '@prisma/client'
import { addStock, bulkUpdateStock, StockTransactionType } from '../src/lib/stockOperations'
import { getNextExchangeNumber } from '../src/lib/atomicNumbers'
import { createAuditLog, AuditAction, EntityType } from '../src/lib/auditLog'
import { getManilaDate } from '../src/lib/timezone'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

const INVOICE = 'InvMain09_30_2026_0008'
const RETURN_SALE_ITEM_ID = 30629 // HP OMNIBOOK 5 16-BC1015AU, SN CND5360V3J
const NEW_VARIATION_ID = 1862 // HP OMNIBOOK 5 16-AF1062TU
const NEW_PRICE = 63990
const SHIFT_ID = 960 // Main Store, cashier JOJIT, 2026-10-16 (closed)
const CASH_ROW_ID = 2519 // "JONELIX GACAD REFUND" cash_out 1,000
const CASHIER_ID = 9
const RETURN_SERIALS = ['CND5360V3J']
const NEW_SERIALS = ['CND528007B', '91688', 'JONELIX GACAD', '09778300576']
const REASON = 'Just swap to other unit - changed by Admin'
const NOTE = `${REASON}. Encoded by admin (cashier recorded only a Cash Out). Paper SI 91688.`

async function main() {
  const sale = await prisma.sale.findFirst({
    where: { invoiceNumber: INVOICE },
    include: { items: true },
  })
  if (!sale) throw new Error(`Sale ${INVOICE} not found`)
  if (sale.status !== 'completed') throw new Error(`Sale status is "${sale.status}", expected "completed"`)

  const saleItem = sale.items.find((i) => i.id === RETURN_SALE_ITEM_ID)
  if (!saleItem) throw new Error(`Sale item ${RETURN_SALE_ITEM_ID} not on ${INVOICE}`)

  const existingReturns = await prisma.customerReturn.count({ where: { saleId: sale.id } })
  if (existingReturns > 0) throw new Error(`Sale already has ${existingReturns} return/exchange record(s) - already done?`)

  const shift = await prisma.cashierShift.findUnique({ where: { id: SHIFT_ID } })
  if (!shift || shift.locationId !== sale.locationId || shift.userId !== CASHIER_ID) {
    throw new Error(`Shift ${SHIFT_ID} is not the Main Store shift of cashier ${CASHIER_ID}`)
  }

  const cashRow = await prisma.cashInOut.findUnique({ where: { id: CASH_ROW_ID } })
  if (!cashRow || cashRow.type !== 'cash_out' || Number(cashRow.amount) !== 1000 || cashRow.shiftId !== SHIFT_ID) {
    throw new Error(`Cash row ${CASH_ROW_ID} is not the expected 1,000 cash_out on shift ${SHIFT_ID}`)
  }

  const newVar = await prisma.productVariation.findUnique({
    where: { id: NEW_VARIATION_ID },
    select: { id: true, productId: true, purchasePrice: true },
  })
  if (!newVar) throw new Error(`Variation ${NEW_VARIATION_ID} not found`)
  const newStock = await prisma.variationLocationDetails.findFirst({
    where: { productVariationId: NEW_VARIATION_ID, locationId: sale.locationId },
  })
  if (!newStock || Number(newStock.qtyAvailable) < 1) throw new Error('New unit not in stock at Main Store')

  const cashier = await prisma.user.findUnique({ where: { id: CASHIER_ID }, select: { username: true } })
  const superAdmin = await prisma.user.findFirst({
    where: { businessId: sale.businessId, roles: { some: { role: { name: 'Super Admin' } } } },
    select: { id: true, username: true },
  })
  if (!cashier || !superAdmin) throw new Error('Cashier or Super Admin user not found')

  // Same math as the route (line discount spread per unit)
  const returnQty = 1
  const itemQty = Number(saleItem.quantity)
  const returnTotal = returnQty * (Number(saleItem.unitPrice) - Number(saleItem.discountAmount || 0) / itemQty)
  const exchangeTotal = NEW_PRICE
  const priceDifference = exchangeTotal - returnTotal
  if (priceDifference !== -1000) throw new Error(`Price difference is ${priceDifference}, expected -1000`)
  const newUnitCost = Number(newVar.purchasePrice || 0)

  const stockQuery = () =>
    prisma.variationLocationDetails.findMany({
      where: { locationId: sale.locationId, productVariationId: { in: [saleItem.productVariationId, NEW_VARIATION_ID] } },
      select: { productVariationId: true, qtyAvailable: true },
    })

  console.log('Checks passed.')
  console.log(`  Sale ${INVOICE} id=${sale.id} location=${sale.locationId}`)
  console.log(`  Return: var ${saleItem.productVariationId} x1 @ ${returnTotal} (unit cost ${saleItem.unitCost}) SN ${RETURN_SERIALS}`)
  console.log(`  Issue:  var ${NEW_VARIATION_ID} x1 @ ${exchangeTotal} (unit cost ${newUnitCost}) SN ${NEW_SERIALS.join(', ')}`)
  console.log(`  Difference: ${priceDifference} (already paid out as Cash Out row ${CASH_ROW_ID}, left as is)`)
  console.log(`  Shift ${SHIFT_ID}: status=${shift.status} (not modified)`)
  console.log('  Stock BEFORE:', JSON.stringify(await stockQuery()))

  if (!COMMIT) {
    console.log('\nDRY RUN - nothing written. Re-run with --commit to apply.')
    return
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const exchangeNumber = await getNextExchangeNumber(sale.businessId, tx)
      const now = getManilaDate()

      const customerReturn = await tx.customerReturn.create({
        data: {
          businessId: sale.businessId,
          saleId: sale.id,
          customerId: sale.customerId,
          locationId: sale.locationId,
          returnNumber: `RTN-${exchangeNumber}`,
          returnDate: now,
          notes: NOTE,
          totalRefundAmount: returnTotal,
          status: 'exchanged',
          createdBy: CASHIER_ID,
        },
      })

      await tx.customerReturnItem.create({
        data: {
          customerReturnId: customerReturn.id,
          productId: saleItem.productId,
          productVariationId: saleItem.productVariationId,
          quantity: returnQty,
          unitPrice: Number(saleItem.unitPrice),
          serialNumbers: RETURN_SERIALS.map((s) => ({ serialNumber: s })),
          condition: 'resellable',
          returnType: 'replacement',
        },
      })

      await addStock({
        productId: saleItem.productId,
        productVariationId: saleItem.productVariationId,
        locationId: sale.locationId,
        quantity: returnQty,
        type: StockTransactionType.CUSTOMER_RETURN,
        referenceType: 'exchange_return',
        referenceId: customerReturn.id,
        notes: `Exchange ${exchangeNumber} - Returned from sale ${sale.invoiceNumber} (admin back-encode)`,
        userId: CASHIER_ID,
        businessId: sale.businessId,
        userDisplayName: cashier.username,
        unitCost: Number(saleItem.unitCost || 0),
        tx,
      })

      const exchangeSale = await tx.sale.create({
        data: {
          businessId: sale.businessId,
          locationId: sale.locationId,
          customerId: sale.customerId,
          invoiceNumber: exchangeNumber,
          saleDate: now,
          saleType: 'exchange',
          status: 'completed',
          subtotal: exchangeTotal,
          taxAmount: 0,
          discountAmount: returnTotal,
          totalAmount: 0,
          paidAmount: 0,
          createdBy: CASHIER_ID,
          shiftId: null, // closed shift 960 - see header
          notes: `Exchange for original sale ${sale.invoiceNumber}. Reason: ${REASON}. Paper SI 91688. Encoded by admin; done on shift ${SHIFT_ID} (refund = Cash Out row ${CASH_ROW_ID}).`,
        },
      })

      await tx.customerReturn.update({
        where: { id: customerReturn.id },
        data: { replacementSaleId: exchangeSale.id },
      })

      await tx.saleItem.create({
        data: {
          saleId: exchangeSale.id,
          productId: newVar.productId,
          productVariationId: NEW_VARIATION_ID,
          quantity: 1,
          unitPrice: exchangeTotal,
          unitCost: newUnitCost,
          serialNumbers: NEW_SERIALS.map((s) => ({ serialNumber: s })),
        },
      })

      await bulkUpdateStock([
        {
          businessId: sale.businessId,
          productId: newVar.productId,
          productVariationId: NEW_VARIATION_ID,
          locationId: sale.locationId,
          quantity: -1,
          type: StockTransactionType.SALE,
          referenceType: 'exchange_issue',
          referenceId: exchangeSale.id,
          userId: CASHIER_ID,
          userDisplayName: cashier.username,
          notes: `Exchange ${exchangeNumber} - Replacement for sale ${sale.invoiceNumber} (admin back-encode)`,
          unitCost: newUnitCost,
          tx,
        },
      ])

      return { exchangeNumber, customerReturn, exchangeSale }
    },
    { timeout: 120000, maxWait: 10000 }
  )

  console.log(`\nDone: ${result.exchangeNumber} sale id=${result.exchangeSale.id}, return id=${result.customerReturn.id}`)

  await createAuditLog({
    businessId: sale.businessId,
    userId: superAdmin.id,
    username: superAdmin.username,
    action: AuditAction.SALE_EXCHANGE,
    entityType: EntityType.SALE,
    entityIds: [sale.id, result.exchangeSale.id],
    description:
      `Processed exchange ${result.exchangeNumber} for sale ${sale.invoiceNumber} via data-correction script. ` +
      `Returned: ₱${returnTotal.toFixed(2)}, Exchanged: ₱${exchangeTotal.toFixed(2)}, ` +
      `Cash refunded to customer ₱1000.00 (already recorded as Cash Out row ${CASH_ROW_ID} on closed shift ${SHIFT_ID})`,
    metadata: {
      script: 'scripts/exchange-InvMain09_30_2026_0008.ts',
      originalSaleId: sale.id,
      exchangeSaleId: result.exchangeSale.id,
      returnId: result.customerReturn.id,
      originalInvoiceNumber: sale.invoiceNumber,
      exchangeNumber: result.exchangeNumber,
      returnTotal,
      exchangeTotal,
      priceDifference,
      cashRefundAmount: 1000,
      cashRowId: CASH_ROW_ID,
      shiftId: SHIFT_ID,
      exchangeReason: REASON,
      paperSI: '91688',
    },
  })
  console.log('Audit log written.')

  console.log('  Stock AFTER:', JSON.stringify(await stockQuery()))
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
