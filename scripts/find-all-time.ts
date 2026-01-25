/**
 * Find ALL records for this product - no date filter
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const productId = 321
  const variationId = 321
  const locationId = 4

  console.log('=== ALL-TIME Records for Product 321 at Tuguegarao ===\n')
  console.log('Current server time:', new Date().toISOString())

  // Check ALL SaleItems ever
  const allSales = await prisma.$queryRaw<any[]>`
    SELECT si.id, si.quantity, s.invoice_number, s.sale_date, s.status, s.location_id
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId}
      AND si.product_variation_id = ${variationId}
    ORDER BY s.sale_date DESC
    LIMIT 20
  `
  console.log(`\n=== ALL Sales for this product (any location) ===`)
  console.log(`Found ${allSales.length} sales:`)
  for (const s of allSales) {
    console.log(`  ${s.invoice_number} | qty: ${s.quantity} | date: ${s.sale_date} | loc: ${s.location_id} | status: ${s.status}`)
  }

  // Check ALL ProductHistory ever
  const allHistory = await prisma.$queryRaw<any[]>`
    SELECT ph.id, ph.transaction_type, ph.reference_type, ph.quantity_change, ph.balance_quantity, ph.transaction_date, ph.location_id
    FROM product_history ph
    WHERE ph.product_id = ${productId}
      AND ph.product_variation_id = ${variationId}
    ORDER BY ph.transaction_date DESC
  `
  console.log(`\n=== ALL ProductHistory (any location) ===`)
  console.log(`Found ${allHistory.length} records:`)
  for (const h of allHistory) {
    console.log(`  ${h.id} | ${h.transaction_type} | ${h.reference_type} | qty: ${h.quantity_change} | bal: ${h.balance_quantity} | loc: ${h.location_id} | ${h.transaction_date}`)
  }

  // Check ALL StockTransactions ever
  const allTxns = await prisma.$queryRaw<any[]>`
    SELECT st.id, st.type, st.reference_type, st.quantity, st.balance_qty, st.created_at, st.location_id
    FROM stock_transactions st
    WHERE st.product_id = ${productId}
      AND st.product_variation_id = ${variationId}
    ORDER BY st.created_at DESC
  `
  console.log(`\n=== ALL StockTransactions (any location) ===`)
  console.log(`Found ${allTxns.length} records:`)
  for (const t of allTxns) {
    console.log(`  ${t.id} | ${t.type} | ${t.reference_type} | qty: ${t.quantity} | bal: ${t.balance_qty} | loc: ${t.location_id} | ${t.created_at}`)
  }

  // Check ALL InventoryCorrections ever
  const allCorrections = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.difference, ic.reason, ic.status, ic.deleted_at, ic.created_at, ic.location_id
    FROM inventory_corrections ic
    WHERE ic.product_id = ${productId}
      AND ic.product_variation_id = ${variationId}
    ORDER BY ic.created_at DESC
  `
  console.log(`\n=== ALL InventoryCorrections (any location) ===`)
  console.log(`Found ${allCorrections.length} records:`)
  for (const c of allCorrections) {
    console.log(`  ${c.id} | diff: ${c.difference} | ${c.reason} | ${c.status} | del: ${c.deleted_at ? 'YES' : 'NO'} | loc: ${c.location_id}`)
  }

  // Current stock at ALL locations
  const stock = await prisma.$queryRaw<any[]>`
    SELECT vld.qty_available, bl.id as loc_id, bl.name
    FROM variation_location_details vld
    JOIN business_locations bl ON bl.id = vld.location_id
    WHERE vld.product_variation_id = ${variationId}
  `
  console.log(`\n=== Current Stock at ALL Locations ===`)
  for (const s of stock) {
    console.log(`  ${s.name} (${s.loc_id}): ${s.qty_available} units`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
