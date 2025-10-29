import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addIndexes() {
  console.log('🚀 Adding performance indexes...\n')

  const indexes = [
    {
      name: 'idx_products_business_active',
      sql: `CREATE INDEX IF NOT EXISTS idx_products_business_active ON products(business_id, is_active) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_products_business_created',
      sql: `CREATE INDEX IF NOT EXISTS idx_products_business_created ON products(business_id, created_at DESC) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_products_category',
      sql: `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_products_brand',
      sql: `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(business_id, brand_id) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_products_sku',
      sql: `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_product_variations_product',
      sql: `CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_product_variations_business',
      sql: `CREATE INDEX IF NOT EXISTS idx_product_variations_business ON product_variations(business_id) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_variation_location_product_location',
      sql: `CREATE INDEX IF NOT EXISTS idx_variation_location_product_location ON variation_location_details(product_id, location_id)`,
    },
    {
      name: 'idx_variation_location_variation_location',
      sql: `CREATE INDEX IF NOT EXISTS idx_variation_location_variation_location ON variation_location_details(product_variation_id, location_id)`,
    },
    {
      name: 'idx_variation_location_product_variation',
      sql: `CREATE INDEX IF NOT EXISTS idx_variation_location_product_variation ON variation_location_details(product_id, product_variation_id)`,
    },
    {
      name: 'idx_business_locations_business_active',
      sql: `CREATE INDEX IF NOT EXISTS idx_business_locations_business_active ON business_locations(business_id, is_active) WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_variations_purchase_info',
      sql: `CREATE INDEX IF NOT EXISTS idx_variations_purchase_info ON product_variations(product_id, last_purchase_date DESC) WHERE deleted_at IS NULL`,
    },
  ]

  let successCount = 0
  let errorCount = 0

  for (const index of indexes) {
    try {
      await prisma.$executeRawUnsafe(index.sql)
      console.log(`✅ Created: ${index.name}`)
      successCount++
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`⚠️  Already exists: ${index.name}`)
      } else {
        console.error(`❌ Error creating ${index.name}:`, error.message)
        errorCount++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Successfully created: ${successCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)

  // Analyze tables
  console.log(`\n🔍 Analyzing tables for query optimization...`)
  try {
    await prisma.$executeRaw`ANALYZE products`
    await prisma.$executeRaw`ANALYZE product_variations`
    await prisma.$executeRaw`ANALYZE variation_location_details`
    await prisma.$executeRaw`ANALYZE business_locations`
    console.log(`✅ Tables analyzed successfully`)
  } catch (error: any) {
    console.error(`⚠️  Could not analyze tables:`, error.message)
  }

  await prisma.$disconnect()
  console.log(`\n✨ Done! Your database queries should now be MUCH faster.`)
  console.log(`\n💡 Next step: Run "npm run build" for production optimization`)
}

addIndexes()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
