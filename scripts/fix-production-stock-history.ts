/**
 * Fix production stock history - connect directly to Supabase
 * This script connects to the PRODUCTION Supabase database
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

  // Verify connection
  const dbCheck = await prisma.$queryRaw<any[]>`SELECT NOW() as now, current_database() as db`
  console.log('Connected to database:', dbCheck[0]?.db)
  console.log('Server time:', dbCheck[0]?.now)

  // Product details
  const sku = '4711421857765'
  const productName = 'A4TECH KRS8372 KBM COMBO'
  const locationName = 'Tuguegarao'

  console.log(`\n=== Finding product: ${productName} (SKU: ${sku}) ===`)

  // Find the product
  const product = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.name, p.sku, pv.id as variation_id
    FROM products p
    LEFT JOIN product_variations pv ON pv.product_id = p.id
    WHERE p.sku = ${sku} OR pv.sub_sku = ${sku}
    LIMIT 1
  `

  if (product.length === 0) {
    console.log('Product not found!')
    return
  }

  const productId = product[0].id
  const variationId = product[0].variation_id
  console.log(`Product ID: ${productId}, Variation ID: ${variationId}`)

  // Find Tuguegarao location
  const location = await prisma.$queryRaw<any[]>`
    SELECT id, name FROM business_locations WHERE name ILIKE ${'%' + locationName + '%'} LIMIT 1
  `

  if (location.length === 0) {
    console.log('Location not found!')
    return
  }

  const locationId = location[0].id
  console.log(`Location: ${location[0].name} (ID: ${locationId})`)

  // Check current stock
  console.log('\n=== Current Stock ===')
  const currentStock = await prisma.$queryRaw<any[]>`
    SELECT qty_available FROM variation_location_details
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
  `
  console.log('Current stock in database:', currentStock[0]?.qty_available)

  // Find all InventoryCorrection records (including deleted)
  console.log('\n=== ALL Inventory Corrections for this product at Tuguegarao ===')
  const corrections = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.product_id, ic.location_id, ic.system_count, ic.physical_count,
           ic.difference, ic.reason, ic.status, ic.created_at, ic.deleted_at,
           ic.approved_at, ic.stock_transaction_id
    FROM inventory_corrections ic
    WHERE ic.product_id = ${productId}
    AND ic.location_id = ${locationId}
    ORDER BY ic.created_at DESC
  `

  console.log(`Found ${corrections.length} inventory correction(s):`)
  for (const c of corrections) {
    console.log(`  ID: ${c.id}`)
    console.log(`    System: ${c.system_count}, Physical: ${c.physical_count}, Diff: ${c.difference}`)
    console.log(`    Reason: ${c.reason}`)
    console.log(`    Status: ${c.status}, Deleted: ${c.deleted_at ? 'YES' : 'NO'}`)
    console.log(`    Created: ${c.created_at}`)
    console.log(`    StockTransaction ID: ${c.stock_transaction_id}`)
    console.log('')
  }

  // Find all ProductHistory records
  console.log('\n=== Product History for this product at Tuguegarao ===')
  const history = await prisma.$queryRaw<any[]>`
    SELECT id, transaction_type, reference_type, reference_id,
           quantity_change, balance_quantity, transaction_date, created_at, reason
    FROM product_history
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 20
  `

  console.log(`Found ${history.length} product history record(s):`)
  for (const h of history) {
    console.log(`  ID: ${h.id}`)
    console.log(`    Type: ${h.transaction_type}, RefType: ${h.reference_type}, RefID: ${h.reference_id}`)
    console.log(`    Change: ${h.quantity_change}, Balance: ${h.balance_quantity}`)
    console.log(`    Date: ${h.transaction_date}`)
    console.log(`    Reason: ${h.reason?.substring(0, 80)}...`)
    console.log('')
  }

  // Find all StockTransactions
  console.log('\n=== Stock Transactions for this product at Tuguegarao ===')
  const stockTx = await prisma.$queryRaw<any[]>`
    SELECT id, transaction_type, quantity, reference_type, reference_id, created_at
    FROM stock_transactions
    WHERE product_id = ${productId}
    AND product_variation_id = ${variationId}
    AND location_id = ${locationId}
    ORDER BY created_at DESC
    LIMIT 20
  `

  console.log(`Found ${stockTx.length} stock transaction(s):`)
  for (const tx of stockTx) {
    console.log(`  ID: ${tx.id}, Type: ${tx.transaction_type}, Qty: ${tx.quantity}`)
    console.log(`    RefType: ${tx.reference_type}, RefID: ${tx.reference_id}`)
    console.log(`    Created: ${tx.created_at}`)
    console.log('')
  }

  // Find any sales for this product at this location in Jan 2026
  console.log('\n=== Sales for this product at Tuguegarao (Jan 2026) ===')
  const sales = await prisma.$queryRaw<any[]>`
    SELECT si.id, si.quantity, s.invoice_number, s.sale_date, s.status
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId}
    AND si.product_variation_id = ${variationId}
    AND s.location_id = ${locationId}
    AND s.sale_date >= '2026-01-01'
    ORDER BY s.sale_date DESC
  `

  console.log(`Found ${sales.length} sale(s):`)
  for (const sale of sales) {
    console.log(`  Invoice: ${sale.invoice_number}, Qty: ${sale.quantity}, Status: ${sale.status}, Date: ${sale.sale_date}`)
  }

  // ===== NOW DELETE THE ERRONEOUS INVENTORY CORRECTION =====
  console.log('\n\n========================================')
  console.log('DELETING ERRONEOUS INVENTORY CORRECTION')
  console.log('========================================\n')

  // Find the specific correction to delete (ID 305)
  const toDelete = corrections.find(c => c.id === 305 && c.reason === 'Admin Physical Inventory Upload')

  if (toDelete) {
    console.log(`Found correction to delete: ID ${toDelete.id}`)
    console.log(`  Reason: ${toDelete.reason}`)
    console.log(`  Diff: ${toDelete.difference}`)
    console.log(`  StockTransaction ID: ${toDelete.stock_transaction_id}`)

    // Soft delete the inventory correction
    console.log('\n--- Soft deleting InventoryCorrection ID 305 ---')
    await prisma.$executeRaw`
      UPDATE inventory_corrections
      SET deleted_at = NOW()
      WHERE id = 305
    `
    console.log('InventoryCorrection soft deleted!')

    // Verify deletion
    const verifyIC = await prisma.$queryRaw<any[]>`
      SELECT id, deleted_at FROM inventory_corrections WHERE id = 305
    `
    console.log('Verification:', verifyIC[0])
  } else {
    console.log('Correction ID 305 not found or already deleted')
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
