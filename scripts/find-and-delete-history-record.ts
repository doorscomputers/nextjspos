/**
 * Script to find and delete erroneous ProductHistory record
 * The duplicate might be in product_history table, not inventory_corrections
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Find Erroneous Record ===\n')

  // Search in ProductHistory for A4TECH KRS8372 at Tuguegarao
  console.log('Searching ProductHistory for A4TECH KRS8372 at Tuguegarao...\n')

  const historyRecords = await prisma.$queryRaw<any[]>`
    SELECT ph.id, ph.product_id, ph.location_id, ph.transaction_type, ph.reference_type,
           ph.quantity_change, ph.balance_quantity, ph.created_at, ph.created_by_name,
           p.name as product_name, bl.name as location_name
    FROM product_history ph
    JOIN products p ON p.id = ph.product_id
    JOIN business_locations bl ON bl.id = ph.location_id
    WHERE p.name LIKE '%A4TECH KRS8372%'
      AND bl.name LIKE '%Tuguegarao%'
    ORDER BY ph.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${historyRecords.length} ProductHistory records:\n`)
  for (const r of historyRecords) {
    console.log(`  ID: ${r.id}`)
    console.log(`  Product: ${r.product_name}`)
    console.log(`  Location: ${r.location_name}`)
    console.log(`  Type: ${r.transaction_type}`)
    console.log(`  Ref Type: ${r.reference_type}`)
    console.log(`  Qty Change: ${r.quantity_change}`)
    console.log(`  Balance: ${r.balance_quantity}`)
    console.log(`  Created: ${r.created_at}`)
    console.log(`  By: ${r.created_by_name}`)
    console.log('  ---')
  }

  // Also check inventory_corrections
  console.log('\n\nSearching inventory_corrections for A4TECH...\n')

  const corrections = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.product_id, ic.difference, ic.reason, ic.created_at, ic.deleted_at,
           p.name as product_name, bl.name as location_name
    FROM inventory_corrections ic
    JOIN products p ON p.id = ic.product_id
    JOIN business_locations bl ON bl.id = ic.location_id
    WHERE p.name LIKE '%A4TECH%'
    ORDER BY ic.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${corrections.length} InventoryCorrection records:\n`)
  for (const r of corrections) {
    console.log(`  ID: ${r.id} | ${r.product_name} | ${r.location_name} | ${r.reason} | deleted: ${r.deleted_at}`)
  }

  // Check what's showing the "Inventory Correction" label
  console.log('\n\nSearching for adjustment transactions at Tuguegarao...\n')

  const adjustments = await prisma.$queryRaw<any[]>`
    SELECT ph.id, ph.product_id, ph.transaction_type, ph.reference_type, ph.reference_id,
           ph.quantity_change, ph.balance_quantity, ph.created_at,
           p.name as product_name, bl.name as location_name
    FROM product_history ph
    JOIN products p ON p.id = ph.product_id
    JOIN business_locations bl ON bl.id = ph.location_id
    WHERE ph.transaction_type = 'adjustment'
      AND bl.name LIKE '%Tuguegarao%'
      AND ph.created_at >= '2026-01-20'
    ORDER BY ph.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${adjustments.length} adjustment records at Tuguegarao:\n`)
  for (const r of adjustments) {
    console.log(`  ID: ${r.id} | ${r.product_name} | ref: ${r.reference_type}#${r.reference_id} | qty: ${r.quantity_change} | bal: ${r.balance_quantity}`)
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
