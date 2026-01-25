/**
 * Full debug of stock history data for A4TECH KRS8372 KBM COMBO
 */

import { PrismaClient } from '@prisma/client'

// Production Supabase connection string
const PRODUCTION_DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DATABASE_URL
    }
  }
})

async function main() {
  console.log('=== CONNECTING TO PRODUCTION SUPABASE ===\n')

  const productId = 321
  const variationId = 321
  const locationId = 4 // Tuguegarao

  // Check current stock
  console.log('=== Current Stock ===')
  const currentStock = await prisma.$queryRaw<any[]>`
    SELECT qty_available FROM variation_location_details
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
  `
  console.log('Current stock:', currentStock[0]?.qty_available)

  // Check ALL InventoryCorrections (including deleted)
  console.log('\n=== ALL Inventory Corrections (including deleted) ===')
  const allCorrections = await prisma.$queryRaw<any[]>`
    SELECT id, system_count, physical_count, difference, reason, status, deleted_at, created_at
    FROM inventory_corrections
    WHERE product_id = ${productId}
    AND location_id = ${locationId}
    ORDER BY created_at DESC
  `
  console.log(`Found ${allCorrections.length} correction(s):`)
  for (const c of allCorrections) {
    console.log(`  ID ${c.id}: diff=${c.difference}, deleted=${c.deleted_at ? 'YES' : 'NO'}, status=${c.status}`)
  }

  // Check ALL ProductHistory records
  console.log('\n=== ALL Product History ===')
  const allHistory = await prisma.$queryRaw<any[]>`
    SELECT id, transaction_type, reference_type, reference_id, quantity_change, balance_quantity, transaction_date
    FROM product_history
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
    ORDER BY transaction_date DESC, created_at DESC
  `
  console.log(`Found ${allHistory.length} history record(s):`)
  for (const h of allHistory) {
    console.log(`  ID ${h.id}: ${h.transaction_type}, refType=${h.reference_type}, refId=${h.reference_id}, change=${h.quantity_change}, balance=${h.balance_quantity}`)
  }

  // Check ALL StockTransactions
  console.log('\n=== ALL Stock Transactions ===')
  const allStockTx = await prisma.$queryRaw<any[]>`
    SELECT id, type, quantity, reference_type, reference_id, created_at
    FROM stock_transactions
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
    ORDER BY created_at DESC
  `
  console.log(`Found ${allStockTx.length} stock transaction(s):`)
  for (const tx of allStockTx) {
    console.log(`  ID ${tx.id}: ${tx.type}, qty=${tx.quantity}, refType=${tx.reference_type}, refId=${tx.reference_id}`)
  }

  // Check ALL Sales for this product at this location
  console.log('\n=== ALL Sales ===')
  const allSales = await prisma.$queryRaw<any[]>`
    SELECT si.id as sale_item_id, si.quantity, s.id as sale_id, s.invoice_number, s.sale_date, s.status
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId}
    AND si.product_variation_id = ${variationId}
    AND s.location_id = ${locationId}
    ORDER BY s.sale_date DESC
  `
  console.log(`Found ${allSales.length} sale(s):`)
  for (const sale of allSales) {
    console.log(`  SaleItem ${sale.sale_item_id}: Sale ${sale.sale_id}, Invoice ${sale.invoice_number}, qty=${sale.quantity}, status=${sale.status}, date=${sale.sale_date}`)
  }

  // Now let's simulate what the stock-history API would return
  console.log('\n\n=== SIMULATING STOCK HISTORY API RESPONSE ===')

  // The stock-history.ts queries:
  // 1. inventoryCorrections (with deletedAt: null and status: 'approved')
  // 2. productHistory (excluding 'sale' type)
  // 3. saleItems

  console.log('\n--- Query 1: Inventory Corrections (not deleted, approved) ---')
  const apiCorrections = await prisma.$queryRaw<any[]>`
    SELECT id, system_count, physical_count, difference, reason, status, approved_at
    FROM inventory_corrections
    WHERE product_id = ${productId}
    AND location_id = ${locationId}
    AND deleted_at IS NULL
    AND status = 'approved'
    ORDER BY approved_at DESC
  `
  console.log(`Would return ${apiCorrections.length} correction(s)`)
  for (const c of apiCorrections) {
    console.log(`  ID ${c.id}: diff=${c.difference}, reason=${c.reason}`)
  }

  console.log('\n--- Query 2: Product History (excluding sales) ---')
  const apiHistory = await prisma.$queryRaw<any[]>`
    SELECT id, transaction_type, reference_type, reference_id, quantity_change, balance_quantity
    FROM product_history
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
    AND transaction_type != 'sale'
    ORDER BY transaction_date DESC
  `
  console.log(`Would return ${apiHistory.length} history record(s)`)
  for (const h of apiHistory) {
    console.log(`  ID ${h.id}: ${h.transaction_type}, refType=${h.reference_type}, refId=${h.reference_id}, change=${h.quantity_change}`)
  }

  console.log('\n--- Query 3: Sale Items ---')
  const apiSales = await prisma.$queryRaw<any[]>`
    SELECT si.id, si.quantity, s.invoice_number, s.sale_date
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId}
    AND si.product_variation_id = ${variationId}
    AND s.location_id = ${locationId}
    ORDER BY s.sale_date DESC
  `
  console.log(`Would return ${apiSales.length} sale(s)`)
  for (const s of apiSales) {
    console.log(`  SaleItem ${s.id}: qty=${s.quantity}, invoice=${s.invoice_number}`)
  }

  console.log('\n=== ANALYSIS ===')
  console.log('If InventoryCorrection is soft deleted (deleted_at IS NOT NULL), it should NOT appear in Query 1')
  console.log('ProductHistory ID 12665 will still appear in Query 2 with refType=admin_physical_inventory')
  console.log('The skip logic in stock-history.ts should skip this if refType=inventory_correction, but it is admin_physical_inventory')
  console.log('')
  console.log('PROBLEM: The ProductHistory has refType="admin_physical_inventory" not "inventory_correction"')
  console.log('So the skip logic does NOT apply, and it shows as a separate "Adjustment" entry')
  console.log('')
  console.log('SOLUTION OPTIONS:')
  console.log('1. Update ProductHistory ID 12665 to have refType="inventory_correction"')
  console.log('2. OR delete ProductHistory ID 12665')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
