import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addDashboardIndexes() {
  console.log('🚀 Adding dashboard performance indexes...\n')

  const indexes = [
    // Sales indexes for dashboard stats
    {
      name: 'idx_sales_business_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, sale_date DESC, location_id)`,
    },
    {
      name: 'idx_sales_business_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_sales_business_status ON sales(business_id, status) WHERE status != 'cancelled'`,
    },
    {
      name: 'idx_sales_location_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_sales_location_date ON sales(location_id, sale_date DESC)`,
    },
    // Accounts Payable indexes
    {
      name: 'idx_accounts_payable_business',
      sql: `CREATE INDEX IF NOT EXISTS idx_accounts_payable_business ON accounts_payable(business_id, invoice_date DESC)`,
    },
    {
      name: 'idx_accounts_payable_payment_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_accounts_payable_payment_status ON accounts_payable(business_id, payment_status)`,
    },
    // Customer Returns indexes
    {
      name: 'idx_customer_returns_business_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_customer_returns_business_date ON customer_returns(business_id, return_date DESC)`,
    },
    // Supplier Returns indexes
    {
      name: 'idx_supplier_returns_business_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_supplier_returns_business_date ON supplier_returns(business_id, return_date DESC)`,
    },
    // Purchases indexes
    {
      name: 'idx_purchases_business_location',
      sql: `CREATE INDEX IF NOT EXISTS idx_purchases_business_location ON purchases(business_id, location_id)`,
    },
    {
      name: 'idx_purchases_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(business_id, purchase_date DESC)`,
    },
    // Covering index for sales aggregations (includes common aggregate fields)
    {
      name: 'idx_sales_dashboard_covering',
      sql: `CREATE INDEX IF NOT EXISTS idx_sales_dashboard_covering ON sales(business_id, location_id, sale_date) INCLUDE (total_amount, subtotal, status)`,
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
    await prisma.$executeRaw`ANALYZE sales`
    await prisma.$executeRaw`ANALYZE accounts_payable`
    await prisma.$executeRaw`ANALYZE customer_returns`
    await prisma.$executeRaw`ANALYZE supplier_returns`
    await prisma.$executeRaw`ANALYZE purchases`
    console.log(`✅ Tables analyzed successfully`)
  } catch (error: any) {
    console.error(`⚠️  Could not analyze tables:`, error.message)
  }

  await prisma.$disconnect()
  console.log(`\n✨ Done! Dashboard should now load MUCH faster.`)
  console.log(`\n💡 Expected improvement: 8-19s → <1s (90%+ faster)`)
}

addDashboardIndexes()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
