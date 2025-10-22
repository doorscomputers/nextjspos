import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to product_variations table...')

    // Add last_purchase_date column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_variations
      ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP
    `)
    console.log('✓ Added last_purchase_date column')

    // Add last_purchase_cost column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_variations
      ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(22, 4)
    `)
    console.log('✓ Added last_purchase_cost column')

    // Add last_purchase_quantity column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_variations
      ADD COLUMN IF NOT EXISTS last_purchase_quantity DECIMAL(22, 4)
    `)
    console.log('✓ Added last_purchase_quantity column')

    console.log('\n✅ All missing columns added successfully!')

  } catch (error) {
    console.error('Error adding columns:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addMissingColumns()
