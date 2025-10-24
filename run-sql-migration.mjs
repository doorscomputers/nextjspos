import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function runMigration() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'attendances'
              AND column_name = 'total_hours_worked'
          ) THEN
              ALTER TABLE attendances
              ADD COLUMN total_hours_worked DECIMAL(5,2);

              RAISE NOTICE 'Column total_hours_worked added successfully';
          ELSE
              RAISE NOTICE 'Column total_hours_worked already exists';
          END IF;
      END $$;
    `)

    console.log('✅ Migration completed successfully!')
    console.log('The total_hours_worked column has been added to the attendances table.')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
