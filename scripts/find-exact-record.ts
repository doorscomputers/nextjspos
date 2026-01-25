/**
 * Find the exact erroneous record using SKU 4711421857765
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Searching by SKU 4711421857765 ===\n')

  // Find by SKU
  const products = await prisma.$queryRaw<any[]>`
    SELECT p.id as product_id, p.name, pv.id as variation_id, pv.sku
    FROM products p
    JOIN product_variations pv ON pv.product_id = p.id
    WHERE pv.sku = '4711421857765' OR p.sku = '4711421857765'
  `

  if (products.length === 0) {
    console.log('Product not found by SKU!')
    return
  }

  const productId = products[0].product_id
  const variationId = products[0].variation_id
  console.log('Product:', products[0].name)
  console.log('Product ID:', productId, '| Variation ID:', variationId)

  // Get Tuguegarao location
  const locations = await prisma.$queryRaw<any[]>`
    SELECT id, name FROM business_locations WHERE name LIKE '%Tuguegarao%'
  `
  const locationId = locations[0]?.id
  console.log('Tuguegarao Location ID:', locationId)

  // Get current stock
  const stock = await prisma.$queryRaw<any[]>`
    SELECT vld.qty_available, bl.name
    FROM variation_location_details vld
    JOIN business_locations bl ON bl.id = vld.location_id
    WHERE vld.product_variation_id = ${variationId} AND vld.location_id = ${locationId}
  `
  console.log('\nCurrent Stock at Tuguegarao:', stock[0]?.qty_available)

  // Get ALL ProductHistory for Tuguegarao
  console.log('\n=== ALL ProductHistory at Tuguegarao ===')
  const history = await prisma.$queryRaw<any[]>`
    SELECT ph.id, ph.transaction_type, ph.reference_type, ph.reference_id, ph.reference_number,
           ph.quantity_change, ph.balance_quantity, ph.transaction_date, ph.created_at
    FROM product_history ph
    WHERE ph.product_id = ${productId}
      AND ph.location_id = ${locationId}
      AND ph.product_variation_id = ${variationId}
    ORDER BY ph.transaction_date DESC
  `
  console.log(`Found ${history.length} records:`)
  for (const h of history) {
    console.log(`  ${h.id} | ${h.transaction_type} | ref: ${h.reference_number || h.reference_type + '#' + h.reference_id} | qty: ${h.quantity_change} | bal: ${h.balance_quantity} | ${h.transaction_date}`)
  }

  // Get ALL InventoryCorrections for Tuguegarao
  console.log('\n=== ALL InventoryCorrections at Tuguegarao ===')
  const corrections = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.difference, ic.reason, ic.status, ic.stock_transaction_id, ic.created_at, ic.deleted_at
    FROM inventory_corrections ic
    WHERE ic.product_id = ${productId}
      AND ic.location_id = ${locationId}
      AND ic.product_variation_id = ${variationId}
    ORDER BY ic.created_at DESC
  `
  console.log(`Found ${corrections.length} records:`)
  for (const c of corrections) {
    console.log(`  ${c.id} | diff: ${c.difference} | reason: ${c.reason} | status: ${c.status} | txn: ${c.stock_transaction_id} | deleted: ${c.deleted_at ? 'YES' : 'NO'}`)
  }

  // Search for ADJUSTMENT-12665
  console.log('\n=== Stock Transaction ID 12665 ===')
  const txn = await prisma.$queryRaw<any[]>`
    SELECT st.*, p.name as product_name, bl.name as location_name
    FROM stock_transactions st
    JOIN products p ON p.id = st.product_id
    JOIN business_locations bl ON bl.id = st.location_id
    WHERE st.id = 12665
  `
  if (txn.length > 0) {
    console.log('Found:', txn[0].product_name, '|', txn[0].location_name, '|', txn[0].type, '| qty:', txn[0].quantity)
  } else {
    console.log('Not found')
  }

  // Check ALL stock transactions for this product at Tuguegarao
  console.log('\n=== ALL StockTransactions at Tuguegarao ===')
  const allTxns = await prisma.$queryRaw<any[]>`
    SELECT st.id, st.type, st.reference_type, st.reference_id, st.quantity, st.balance_qty, st.created_at
    FROM stock_transactions st
    WHERE st.product_id = ${productId}
      AND st.location_id = ${locationId}
      AND st.product_variation_id = ${variationId}
    ORDER BY st.created_at DESC
  `
  console.log(`Found ${allTxns.length} records:`)
  for (const t of allTxns) {
    console.log(`  ${t.id} | ${t.type} | ref: ${t.reference_type}#${t.reference_id} | qty: ${t.quantity} | bal: ${t.balance_qty} | ${t.created_at}`)
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
