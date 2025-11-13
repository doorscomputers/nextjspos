/**
 * Migration script to add DAY column to invoice_sequences table
 * This enables daily sequence resets per location
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function runMigration() {
  console.log('🚀 Starting invoice sequences daily migration...')

  try {
    // Execute migration steps one by one
    console.log('⏳ Step 1: Dropping old primary key constraint...')
    await prisma.$executeRaw`ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_pkey`

    console.log('⏳ Step 2: Adding DAY column...')
    await prisma.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoice_sequences' AND column_name = 'day') THEN
          ALTER TABLE invoice_sequences ADD COLUMN day INTEGER;
        END IF;
      END $$;
    `

    console.log('⏳ Step 3: Updating existing rows with day = 1...')
    await prisma.$executeRaw`UPDATE invoice_sequences SET day = 1 WHERE day IS NULL`

    console.log('⏳ Step 4: Making day column NOT NULL...')
    await prisma.$executeRaw`ALTER TABLE invoice_sequences ALTER COLUMN day SET NOT NULL`

    console.log('⏳ Step 5: Creating new primary key...')
    await prisma.$executeRaw`
      ALTER TABLE invoice_sequences
        ADD CONSTRAINT invoice_sequences_pkey
        PRIMARY KEY (business_id, location_id, year, month, day)
    `

    console.log('⏳ Step 6: Dropping old indexes...')
    await prisma.$executeRaw`DROP INDEX IF EXISTS idx_invoice_sequences_business`
    await prisma.$executeRaw`DROP INDEX IF EXISTS idx_invoice_sequences_location`

    console.log('⏳ Step 7: Creating new optimized indexes...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_invoice_sequences_business_location
        ON invoice_sequences(business_id, location_id)
    `
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_invoice_sequences_date
        ON invoice_sequences(year, month, day)
    `

    console.log('✅ Migration completed successfully!')

    // Verify the migration
    console.log('\n🔍 Verifying migration...')
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invoice_sequences'
      ORDER BY ordinal_position
    `

    console.log('📊 Invoice Sequences Table Columns:')
    result.forEach((col) => {
      console.log(`  - ${col.column_name}`)
    })

    // Test sequence generation
    console.log('\n🧪 Testing sequence generation...')
    const testResult = await prisma.$queryRaw<Array<{ sequence: number }>>`
      INSERT INTO invoice_sequences (business_id, location_id, year, month, day, sequence)
      VALUES (1, 1, 2025, 11, 13, 1)
      ON CONFLICT (business_id, location_id, year, month, day)
      DO UPDATE SET sequence = invoice_sequences.sequence + 1
      RETURNING sequence
    `

    console.log(`✅ Test sequence generation successful: ${testResult[0]?.sequence}`)

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
