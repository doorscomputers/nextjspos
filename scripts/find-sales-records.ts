/**
 * Find sales records for this product
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const productId = 321
  const variationId = 321
  const locationId = 4

  console.log('=== Searching for Sales ===\n')

  // Check SaleItems for this product at Tuguegarao
  const sales = await prisma.$queryRaw<any[]>`
    SELECT si.id, si.quantity, si.sale_id, s.invoice_number, s.sale_date, s.created_at, s.status
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId}
      AND si.product_variation_id = ${variationId}
      AND s.location_id = ${locationId}
    ORDER BY s.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${sales.length} sale items:`)
  for (const s of sales) {
    console.log(`  Sale ${s.sale_id} | ${s.invoice_number} | qty: ${s.quantity} | date: ${s.sale_date} | status: ${s.status}`)
  }

  // Check if there are ANY InventoryCorrections in the entire database today
  console.log('\n=== ALL InventoryCorrections from Jan 22 2026 ===')
  const allCorrections = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.product_id, ic.location_id, ic.difference, ic.reason, ic.created_at, ic.deleted_at,
           p.name as product_name, bl.name as location_name
    FROM inventory_corrections ic
    JOIN products p ON p.id = ic.product_id
    JOIN business_locations bl ON bl.id = ic.location_id
    WHERE DATE(ic.created_at) = '2026-01-22'
    ORDER BY ic.created_at DESC
  `
  console.log(`Found ${allCorrections.length} total corrections today`)
  for (const c of allCorrections) {
    console.log(`  ${c.id} | ${c.product_name} | ${c.location_name} | diff: ${c.difference} | deleted: ${c.deleted_at ? 'YES' : 'NO'}`)
  }

  // Check stock_transactions with type 'adjustment' from today
  console.log('\n=== ALL adjustment StockTransactions from Jan 22 2026 ===')
  const adjTxns = await prisma.$queryRaw<any[]>`
    SELECT st.id, st.product_id, st.location_id, st.type, st.reference_type, st.quantity, st.balance_qty, st.created_at,
           p.name as product_name, bl.name as location_name
    FROM stock_transactions st
    JOIN products p ON p.id = st.product_id
    JOIN business_locations bl ON bl.id = st.location_id
    WHERE st.type = 'adjustment' AND DATE(st.created_at) = '2026-01-22'
    ORDER BY st.created_at DESC
  `
  console.log(`Found ${adjTxns.length} adjustment transactions today`)
  for (const t of adjTxns) {
    console.log(`  ${t.id} | ${t.product_name} | ${t.location_name} | qty: ${t.quantity} | bal: ${t.balance_qty}`)
  }

  // Check ALL ProductHistory from Jan 22
  console.log('\n=== ALL ProductHistory from Jan 22 2026 ===')
  const allHistory = await prisma.$queryRaw<any[]>`
    SELECT ph.id, ph.product_id, ph.location_id, ph.transaction_type, ph.quantity_change, ph.balance_quantity, ph.created_at,
           p.name as product_name, bl.name as location_name
    FROM product_history ph
    JOIN products p ON p.id = ph.product_id
    JOIN business_locations bl ON bl.id = ph.location_id
    WHERE DATE(ph.created_at) = '2026-01-22'
    ORDER BY ph.created_at DESC
    LIMIT 50
  `
  console.log(`Found ${allHistory.length} history records today`)
  for (const h of allHistory) {
    console.log(`  ${h.id} | ${h.product_name} | ${h.location_name} | ${h.transaction_type} | qty: ${h.quantity_change}`)
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
