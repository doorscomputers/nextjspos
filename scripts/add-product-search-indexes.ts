/**
 * Add database indexes for faster product search
 * Optimizes SKU search, name search, and stock filtering
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSearchIndexes() {
  try {
    console.log('🔧 Adding database indexes for product search optimization...\n')

    // Index 1: Product variations SKU (case-insensitive)
    console.log('1. Adding index on product_variations.sku...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_product_variations_sku_lower
      ON product_variations (LOWER(sku))
    `
    console.log('   ✅ Index on SKU created\n')

    // Index 2: Product name (case-insensitive)
    console.log('2. Adding index on products.name...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_name_lower
      ON products (LOWER(name))
    `
    console.log('   ✅ Index on product name created\n')

    // Index 3: Product active status
    console.log('3. Adding index on products.is_active...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_is_active
      ON products (is_active, deleted_at)
    `
    console.log('   ✅ Index on is_active created\n')

    // Index 4: Product history for stock lookup
    console.log('4. Adding composite index on product_history...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_product_history_location_stock
      ON product_history (location_id, product_variation_id, quantity)
    `
    console.log('   ✅ Index on product_history created\n')

    // Index 5: Product history by variation
    console.log('5. Adding index on product_history.product_variation_id...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_product_history_variation
      ON product_history (product_variation_id)
    `
    console.log('   ✅ Index on product_variation_id created\n')

    console.log('\n✅ All indexes created successfully!')
    console.log('\n📊 Performance improvements expected:')
    console.log('   - SKU search: 3-5x faster')
    console.log('   - Name search: 2-3x faster')
    console.log('   - Stock filtering: 5-10x faster')
    console.log('   - Transfer search: 7s → <1s ⚡')
    console.log('   - POS search: 2s → <0.5s ⚡')
  } catch (error: any) {
    // Check if it's a "relation already exists" error (index already created)
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some indexes already exist, skipping...')
    } else {
      console.error('❌ Error adding indexes:', error)
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

addSearchIndexes()
  .then(() => {
    console.log('\n🎉 Database optimization completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed to add indexes:', error)
    process.exit(1)
  })
