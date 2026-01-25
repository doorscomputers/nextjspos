/**
 * Debug script - Find ALL records for A4TECH KRS8372 product
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Debug A4TECH KRS8372 Records ===\n')

  // Get product details using raw query
  const products = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.name, pv.id as variation_id, pv.name as variation_name,
           vld.qty_available, bl.id as location_id, bl.name as location_name
    FROM products p
    JOIN product_variations pv ON pv.product_id = p.id
    LEFT JOIN variation_location_details vld ON vld.product_variation_id = pv.id
    LEFT JOIN business_locations bl ON bl.id = vld.location_id
    WHERE p.name LIKE '%A4TECH KRS8372%'
    ORDER BY bl.name
  `

  if (products.length === 0) {
    console.log('Product not found!')
    return
  }

  console.log('Product:', products[0].id, '-', products[0].name)
  console.log('\nStock by location:')
  for (const p of products) {
    console.log(`  ${p.location_name || 'No location'}: ${p.qty_available || 0} units`)
  }

  const productId = products[0].id
  const variationId = products[0].variation_id

  // Get Tuguegarao location
  const tuguegarao = products.find(p => p.location_name && p.location_name.includes('Tuguegarao'))
  if (!tuguegarao) {
    console.log('\nTuguegarao location not found for this product!')
    return
  }

  const locationId = tuguegarao.location_id
  console.log('\nTuguegarao Location ID:', locationId)
  console.log('Current Stock at Tuguegarao:', tuguegarao.qty_available, 'units')

  // Check ALL ProductHistory for this product at Tuguegarao
  console.log('\n=== ALL ProductHistory records ===')
  const allHistory = await prisma.$queryRaw<any[]>`
    SELECT * FROM product_history
    WHERE product_id = ${productId} AND location_id = ${locationId}
    ORDER BY transaction_date ASC
  `

  console.log(`Found ${allHistory.length} ProductHistory records:`)
  for (const h of allHistory) {
    console.log(`  ${h.id} | ${h.transaction_type} | ${h.reference_type}#${h.reference_id} | qty: ${h.quantity_change} | bal: ${h.balance_quantity} | ${h.transaction_date}`)
  }

  // Check ALL StockTransactions for this product at Tuguegarao
  console.log('\n=== ALL StockTransaction records ===')
  const allTxns = await prisma.$queryRaw<any[]>`
    SELECT * FROM stock_transactions
    WHERE product_id = ${productId} AND location_id = ${locationId}
    ORDER BY created_at ASC
  `

  console.log(`Found ${allTxns.length} StockTransaction records:`)
  for (const t of allTxns) {
    console.log(`  ${t.id} | ${t.type} | ${t.reference_type}#${t.reference_id} | qty: ${t.quantity} | bal: ${t.balance_qty} | ${t.created_at}`)
  }

  // Check ALL InventoryCorrections for this product
  console.log('\n=== ALL InventoryCorrection records (including deleted) ===')
  const allCorrections = await prisma.$queryRaw<any[]>`
    SELECT * FROM inventory_corrections
    WHERE product_id = ${productId} AND location_id = ${locationId}
    ORDER BY created_at ASC
  `

  console.log(`Found ${allCorrections.length} InventoryCorrection records:`)
  for (const c of allCorrections) {
    console.log(`  ${c.id} | diff: ${c.difference} | reason: ${c.reason} | status: ${c.status} | deleted: ${c.deleted_at ? 'YES' : 'NO'} | ${c.created_at}`)
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
