import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  try {
    console.log('🔄 Adding warranty_id field to product_variations...')

    // Add warranty_id column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_variations
      ADD COLUMN IF NOT EXISTS warranty_id INTEGER;
    `)

    console.log('✅ warranty_id column added')

    // Add foreign key constraint
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'product_variations_warranty_id_fkey'
          ) THEN
              ALTER TABLE product_variations
              ADD CONSTRAINT product_variations_warranty_id_fkey
              FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE SET NULL;
          END IF;
      END $$;
    `)

    console.log('✅ Foreign key constraint added')

    // Add index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS product_variations_warranty_id_idx
      ON product_variations(warranty_id);
    `)

    console.log('✅ Index added')

    // Verify
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_variations'
      AND column_name = 'warranty_id';
    `)

    console.log('✅ Migration completed successfully!')
    console.log('Verification:', result)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
