/**
 * READ-ONLY audit of voided exchange sales.
 *
 * Before the void-route fix (2026-07), voiding an exchange sale restored the
 * ISSUED items' stock but never reversed the RETURN leg, leaving:
 *   - the returned items' stock inflated (+qty that shouldn't be there if the
 *     void meant "exchange never happened"), or
 *   - the issued items' stock inflated (if the swap physically happened and
 *     nobody re-entered the exchange — the Bambang HIKSEMI case)
 *   - a dangling customer_returns row stuck in status 'exchanged'
 *
 * This script prints, for every voided exchange sale: both legs, the void
 * record, all related product_history rows, and current stock — so a human
 * can recount the affected products and apply Inventory Corrections.
 *
 * Usage: npx tsx scripts/audit-voided-exchanges.ts
 */
import { prisma } from '../src/lib/prisma'

async function main() {
  const voidedExchanges = await prisma.sale.findMany({
    where: { saleType: 'exchange', status: 'voided' },
    include: {
      items: true,
      location: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${voidedExchanges.length} voided exchange sale(s)\n`)

  for (const sale of voidedExchanges) {
    console.log('='.repeat(80))
    console.log(
      `Exchange ${sale.invoiceNumber} (sale ${sale.id}) @ ${sale.location?.name} ` +
        `[location ${sale.locationId}] — voided`
    )
    console.log(`  Notes: ${sale.notes}`)

    const voidRecord = await prisma.voidTransaction.findFirst({
      where: { saleId: sale.id },
    })
    console.log(
      `  Void: id ${voidRecord?.id}, reason "${voidRecord?.voidReason}", at ${voidRecord?.createdAt?.toISOString()}`
    )

    const linkedReturn = await prisma.customerReturn.findFirst({
      where: { businessId: sale.businessId, returnNumber: `RTN-${sale.invoiceNumber}` },
      include: { items: true },
    })
    console.log(
      `  Linked return: ${linkedReturn ? `${linkedReturn.returnNumber} (id ${linkedReturn.id}) status='${linkedReturn.status}'` : 'NOT FOUND'}`
    )

    // Collect all involved product variations (issue leg + return leg)
    const involved: { productId: number; productVariationId: number; leg: string; qty: string }[] = []
    for (const item of sale.items) {
      involved.push({
        productId: item.productId,
        productVariationId: item.productVariationId,
        leg: 'ISSUED (given to customer)',
        qty: item.quantity.toString(),
      })
    }
    for (const item of linkedReturn?.items ?? []) {
      involved.push({
        productId: item.productId,
        productVariationId: item.productVariationId,
        leg: 'RETURNED (taken from customer)',
        qty: item.quantity.toString(),
      })
    }

    // Was the return leg ever reversed? (new void logic writes a sale_void
    // deduction referencing the void record)
    const returnLegReversed = voidRecord
      ? (await prisma.productHistory.count({
          where: {
            referenceType: 'sale_void',
            referenceId: voidRecord.id,
            quantityChange: { lt: 0 },
          },
        })) > 0
      : false
    console.log(`  Return leg reversed by void: ${returnLegReversed ? 'YES' : 'NO  <-- inspect'}`)

    for (const inv of involved) {
      const product = await prisma.product.findUnique({
        where: { id: inv.productId },
        select: { name: true, sku: true },
      })
      const vld = await prisma.variationLocationDetails.findFirst({
        where: {
          productVariationId: inv.productVariationId,
          locationId: linkedReturn?.locationId ?? sale.locationId,
        },
        select: { qtyAvailable: true },
      })
      console.log(
        `\n  [${inv.leg}] ${product?.name} (SKU ${product?.sku}) qty ${inv.qty}` +
          ` — current stock at location: ${vld?.qtyAvailable ?? 'n/a'}`
      )

      const history = await prisma.productHistory.findMany({
        where: {
          productId: inv.productId,
          locationId: linkedReturn?.locationId ?? sale.locationId,
          transactionDate: { gte: new Date(sale.createdAt.getTime() - 24 * 3600 * 1000) },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          transactionDate: true,
          transactionType: true,
          referenceType: true,
          referenceNumber: true,
          quantityChange: true,
          balanceQuantity: true,
          reason: true,
        },
      })
      for (const h of history) {
        console.log(
          `    ${h.transactionDate.toISOString().slice(0, 16)} ${h.transactionType}/${h.referenceType ?? '-'} ` +
            `${Number(h.quantityChange) >= 0 ? '+' : ''}${h.quantityChange} => ${h.balanceQuantity}  ${h.reason ?? ''}`
        )
      }
    }
    console.log()
  }

  console.log('='.repeat(80))
  console.log(
    'ACTION: for each product above, physically recount at the listed location.\n' +
      'If system stock differs from the shelf count, apply an Inventory Correction\n' +
      'in the dashboard referencing the exchange number.'
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
