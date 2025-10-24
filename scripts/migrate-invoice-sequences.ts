/**
 * Migration script to add location_id to invoice_sequences table
 * Run with: npx ts-node scripts/migrate-invoice-sequences.ts
 */

import { prisma } from '../src/lib/prisma.js'

async function migrate() {
  try {
    console.log('Starting migration: Adding location_id to invoice_sequences...')

    // Step 1: Add location_id as nullable first
    console.log('Step 1: Adding location_id column...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "invoice_sequences" ADD COLUMN IF NOT EXISTS "location_id" INTEGER
    `)

    // Step 2: Set default location_id for existing records
    console.log('Step 2: Populating location_id for existing records...')
    await prisma.$executeRawUnsafe(`
      UPDATE "invoice_sequences" AS seq
      SET "location_id" = (
        SELECT id
        FROM "business_locations" AS loc
        WHERE loc.business_id = seq.business_id
        ORDER BY id ASC
        LIMIT 1
      )
      WHERE "location_id" IS NULL
    `)

    // Step 3: Make location_id NOT NULL
    console.log('Step 3: Making location_id NOT NULL...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "invoice_sequences" ALTER COLUMN "location_id" SET NOT NULL
    `)

    // Step 4: Drop the old unique constraint
    console.log('Step 4: Dropping old unique constraint...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "invoice_sequences_business_id_year_month_key"
    `)

    // Step 5: Create new unique constraint with location_id
    console.log('Step 5: Creating new unique constraint...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "invoice_sequences"
      ADD CONSTRAINT "invoice_sequences_business_id_location_id_year_month_key"
      UNIQUE ("business_id", "location_id", "year", "month")
    `)

    // Step 6: Create index on location_id
    console.log('Step 6: Creating index on location_id...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "invoice_sequences_location_id_idx" ON "invoice_sequences"("location_id")
    `)

    console.log('\n✅ Migration completed successfully!')
    console.log('\nNow running: npx prisma generate')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
