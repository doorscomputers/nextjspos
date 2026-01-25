/**
 * Script to delete erroneous Inventory Correction record
 * Connects to production Supabase database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Delete Erroneous Inventory Correction ===\n')
  console.log('Connected to production database\n')

  // Step 1: Find the A4TECH KRS8372 record at Tuguegarao
  console.log('Step 1: Searching for A4TECH KRS8372 at Tuguegarao...\n')

  const records = await prisma.$queryRaw<any[]>`
    SELECT ic.id, ic.product_id, ic.location_id, ic.difference, ic.reason, ic.created_at,
           p.name as product_name, bl.name as location_name
    FROM inventory_corrections ic
    JOIN products p ON p.id = ic.product_id
    JOIN business_locations bl ON bl.id = ic.location_id
    WHERE ic.deleted_at IS NULL
      AND p.name LIKE '%A4TECH KRS8372%'
      AND bl.name LIKE '%Tuguegarao%'
    ORDER BY ic.created_at DESC
  `

  if (records.length === 0) {
    console.log('No matching records found.')

    // Let's also check recent corrections to see what's there
    console.log('\nChecking all recent inventory corrections...\n')
    const recent = await prisma.$queryRaw<any[]>`
      SELECT ic.id, ic.product_id, ic.difference, ic.reason, ic.created_at,
             p.name as product_name, bl.name as location_name
      FROM inventory_corrections ic
      JOIN products p ON p.id = ic.product_id
      JOIN business_locations bl ON bl.id = ic.location_id
      WHERE ic.deleted_at IS NULL
        AND ic.created_at >= '2026-01-20'
      ORDER BY ic.created_at DESC
      LIMIT 20
    `

    if (recent.length > 0) {
      console.log('Recent corrections found:')
      for (const r of recent) {
        console.log(`  ID: ${r.id} | ${r.product_name} | ${r.location_name} | ${r.reason}`)
      }
    } else {
      console.log('No recent corrections found in database.')
    }
    return
  }

  console.log(`Found ${records.length} matching record(s):\n`)
  for (const record of records) {
    console.log(`  ID: ${record.id}`)
    console.log(`  Product: ${record.product_name}`)
    console.log(`  Location: ${record.location_name}`)
    console.log(`  Difference: ${record.difference}`)
    console.log(`  Reason: ${record.reason}`)
    console.log(`  Created: ${record.created_at}`)
    console.log('  ---')
  }

  // Step 2: Soft delete the record(s)
  console.log('\nStep 2: Soft-deleting the record(s)...\n')

  const recordIds = records.map((r: any) => r.id)

  const result = await prisma.inventoryCorrection.updateMany({
    where: {
      id: { in: recordIds }
    },
    data: {
      deletedAt: new Date()
    }
  })

  console.log(`✅ Successfully soft-deleted ${result.count} record(s).`)
  console.log('\nThe duplicate "Inventory Correction" entry will no longer appear in the stock history.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
