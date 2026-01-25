/**
 * Delete InventoryCorrection ID 305 from production Supabase
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
  console.log('Connected to:', dbCheck[0]?.db)
  console.log('Server time:', dbCheck[0]?.now)

  // Check current state of InventoryCorrection 305
  console.log('\n=== Before deletion ===')
  const before = await prisma.$queryRaw<any[]>`
    SELECT id, product_id, location_id, difference, reason, status, deleted_at
    FROM inventory_corrections
    WHERE id = 305
  `
  console.log('InventoryCorrection 305:', before[0])

  if (before.length === 0) {
    console.log('Record not found!')
    return
  }

  if (before[0].deleted_at) {
    console.log('Record already soft deleted!')
    return
  }

  // Soft delete the inventory correction
  console.log('\n=== Soft deleting InventoryCorrection ID 305 ===')
  const result = await prisma.$executeRaw`
    UPDATE inventory_corrections
    SET deleted_at = NOW()
    WHERE id = 305
  `
  console.log('Rows affected:', result)

  // Verify deletion
  console.log('\n=== After deletion ===')
  const after = await prisma.$queryRaw<any[]>`
    SELECT id, deleted_at FROM inventory_corrections WHERE id = 305
  `
  console.log('InventoryCorrection 305:', after[0])

  console.log('\n=== DONE ===')
  console.log('The duplicate "Inventory Correction" entry should no longer appear on the stock history page.')
  console.log('Please refresh the page to verify.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
