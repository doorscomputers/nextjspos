/**
 * Script to fix database constraints for location-based invoice numbering
 *
 * This script:
 * 1. Drops the old invoice_sequences constraint (business_id, year, month)
 * 2. Allows Prisma to recreate with the correct constraint (business_id, location_id, year, month)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing invoice_sequences constraint...')

  try {
    // Find and drop the old unique constraint
    const result = await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
          constraint_name TEXT;
      BEGIN
          -- Find constraints on invoice_sequences that don't include location_id
          SELECT conname INTO constraint_name
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'invoice_sequences'
            AND c.contype = 'u'
            AND array_length(c.conkey, 1) = 3
            AND NOT EXISTS (
                SELECT 1
                FROM unnest(c.conkey) WITH ORDINALITY AS col(attnum, ord)
                JOIN pg_attribute a ON a.attnum = col.attnum AND a.attrelid = c.conrelid
                WHERE a.attname = 'location_id'
            );

          IF constraint_name IS NOT NULL THEN
              EXECUTE format('ALTER TABLE invoice_sequences DROP CONSTRAINT %I', constraint_name);
              RAISE NOTICE 'Dropped old constraint: %', constraint_name;
          ELSE
              RAISE NOTICE 'Old constraint not found - may already be updated';
          END IF;
      END $$;
    `)

    console.log('✅ Constraint check completed')
    console.log('\n📝 Next steps:')
    console.log('   1. Run: npx prisma db push')
    console.log('   2. Run: npx prisma generate')
    console.log('   3. Restart your dev server')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
