/**
 * Migration: Add cashTendered field to Sale model
 * This field stores the actual cash amount tendered by customer,
 * allowing correct display of "Amount Tendered" and "Change" on invoice
 */

import { prisma } from '../src/lib/prisma.simple'

async function main() {
  console.log('Adding cashTendered field to Sale table...')

  try {
    // Add column using raw SQL (works for both MySQL and PostgreSQL)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS cash_tendered DECIMAL(22, 4) NULL
    `)

    console.log('✅ Successfully added cash_tendered column')

    // Verify the column was added
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'cash_tendered'
    `

    console.log('Verification result:', result)
    console.log('✅ Migration complete!')
  } catch (error: any) {
    if (error.message.includes('Duplicate column')) {
      console.log('⚠️  Column already exists, skipping...')
    } else {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
