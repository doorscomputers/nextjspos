/**
 * Manually Apply UOM Schema Changes
 * Adds all missing columns to fix the login error
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Applying UOM schema changes...\n')

  try {
    // 1. Add UOM hierarchy to units table
    console.log('1. Adding columns to units table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE units
      ADD COLUMN IF NOT EXISTS base_unit_id INTEGER,
      ADD COLUMN IF NOT EXISTS base_unit_multiplier DECIMAL(20,4)
    `)
    console.log('   ✓ Units table updated\n')

    // 2. Add index
    console.log('2. Adding index on units.base_unit_id...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_units_base_unit_id ON units(base_unit_id)
    `)
    console.log('   ✓ Index created\n')

    // 3. Add foreign key (skip if exists)
    console.log('3. Adding foreign key constraint...')
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE units
        ADD CONSTRAINT units_base_unit_id_fkey
        FOREIGN KEY (base_unit_id) REFERENCES units(id) ON DELETE RESTRICT
      `)
      console.log('   ✓ Foreign key added\n')
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ⏭️  Foreign key already exists - skipping\n')
      } else {
        throw error
      }
    }

    // 4. Add sub_unit_ids to products
    console.log('4. Adding sub_unit_ids to products table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS sub_unit_ids TEXT
    `)
    console.log('   ✓ Products table updated\n')

    // 5. Add enable_sub_units to business
    console.log('5. Adding enable_sub_units to business table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE business
      ADD COLUMN IF NOT EXISTS enable_sub_units BOOLEAN DEFAULT true
    `)
    console.log('   ✓ Business table updated\n')

    // 6. Add sub_unit_id to purchase_items
    console.log('6. Adding sub_unit_id to purchase_items table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE purchase_items
      ADD COLUMN IF NOT EXISTS sub_unit_id INTEGER
    `)
    console.log('   ✓ Purchase items table updated\n')

    // 7. Add sub_unit_id and sub_unit_price to sale_items
    console.log('7. Adding sub_unit_id and sub_unit_price to sale_items table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sale_items
      ADD COLUMN IF NOT EXISTS sub_unit_id INTEGER,
      ADD COLUMN IF NOT EXISTS sub_unit_price DECIMAL(22,4)
    `)
    console.log('   ✓ Sale items table updated\n')

    // 8. Add sub_unit_id to stock_transactions
    console.log('8. Adding sub_unit_id to stock_transactions table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE stock_transactions
      ADD COLUMN IF NOT EXISTS sub_unit_id INTEGER
    `)
    console.log('   ✓ Stock transactions table updated\n')

    // 9. Add sub_unit_id to stock_transfer_items
    console.log('9. Adding sub_unit_id to stock_transfer_items table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE stock_transfer_items
      ADD COLUMN IF NOT EXISTS sub_unit_id INTEGER
    `)
    console.log('   ✓ Stock transfer items table updated\n')

    console.log('✅ All UOM schema changes applied successfully!\n')
    console.log('🎉 You can now login to the application.')
  } catch (error) {
    console.error('❌ Error applying schema changes:', error)
    throw error
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
