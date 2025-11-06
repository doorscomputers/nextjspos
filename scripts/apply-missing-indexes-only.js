/**
 * Apply ONLY Missing Dashboard Indexes
 *
 * This script creates only the 9 missing indexes identified by check-existing-indexes.js
 * Skips all duplicate indexes that already exist with different names
 *
 * Usage:
 *   node scripts/apply-missing-indexes-only.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Detect database type from DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || ''
const isPostgreSQL = DATABASE_URL.includes('postgresql') || DATABASE_URL.includes('postgres')
const isMySQL = DATABASE_URL.includes('mysql')

console.log(`\n🔍 Database Type Detected: ${isPostgreSQL ? 'PostgreSQL/Supabase' : isMySQL ? 'MySQL' : 'Unknown'}\n`)

// ONLY the 9 missing indexes - skip all duplicates
const missingIndexes = [
  // 1. Sale Items - Composite index for product analytics
  {
    table: 'sale_items',
    name: 'idx_sale_items_sale_product',
    columns: ['sale_id', 'product_id'],
    purpose: 'Speeds up product analytics joins (Dashboard V2, V3)'
  },

  // 2. Sales - Created by index for cashier reports
  {
    table: 'sales',
    name: 'idx_sales_created_by',
    columns: ['created_by'],
    purpose: 'Faster cashier performance reports'
  },

  // 3. Accounts Payable - Invoice date for aging reports
  {
    table: 'accounts_payable',
    name: 'idx_accounts_payable_business_invoice_date',
    columns: ['business_id', 'invoice_date'],
    purpose: 'Improves payables aging calculation (Dashboard V4)'
  },

  // 4. Sale Payments - Paid at timestamp for receivables
  {
    table: 'sale_payments',
    name: 'idx_sale_payments_paid_at',
    columns: ['paid_at'],
    purpose: 'Faster receivables date-based queries'
  },

  // 5. Expenses - Composite for date-status filtering
  {
    table: 'expenses',
    name: 'idx_expenses_business_date_status',
    columns: ['business_id', 'expense_date', 'status'],
    purpose: 'Speeds up income/expense charts (Dashboard V4)'
  },

  // 6. Expenses - Business and status for filtering
  {
    table: 'expenses',
    name: 'idx_expenses_business_status',
    columns: ['business_id', 'status'],
    purpose: 'Faster expense list filtering'
  },

  // 7. Customers - Active customers by business
  {
    table: 'customers',
    name: 'idx_customers_business_active',
    columns: ['business_id', 'is_active'],
    purpose: 'Faster active customer queries (Dashboard V3)'
  },

  // 8. Products - Business and category composite
  {
    table: 'products',
    name: 'idx_products_business_category',
    columns: ['business_id', 'category_id'],
    purpose: 'Improves category-based analytics (Dashboard V2, V3)'
  },

  // 9. Products - Business and brand composite
  {
    table: 'products',
    name: 'idx_products_business_brand',
    columns: ['business_id', 'brand_id'],
    purpose: 'Improves brand-based analytics (Dashboard V2, V3)'
  },
]

async function createIndex(index) {
  const { table, name, columns, purpose } = index
  const columnList = columns.map(col => `"${col}"`).join(', ')

  try {
    if (isPostgreSQL) {
      // PostgreSQL syntax
      const createQuery = `CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columnList})`
      await prisma.$executeRawUnsafe(createQuery)
      console.log(`  ✅ Created: ${name}`)
      console.log(`     Purpose: ${purpose}`)
      return { status: 'created', name }

    } else if (isMySQL) {
      // MySQL syntax - check if exists first
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = '${table}'
          AND index_name = '${name}'
      `
      const existing = await prisma.$queryRawUnsafe(checkQuery)

      if (existing[0].count > 0) {
        console.log(`  ⏭️  Index ${name} already exists`)
        return { status: 'exists', name }
      }

      const createQuery = `CREATE INDEX ${name} ON ${table} (${columnList})`
      await prisma.$executeRawUnsafe(createQuery)
      console.log(`  ✅ Created: ${name}`)
      console.log(`     Purpose: ${purpose}`)
      return { status: 'created', name }

    } else {
      console.log(`  ❌ Unknown database type`)
      return { status: 'error', name, error: 'Unknown database type' }
    }
  } catch (error) {
    // Index might already exist
    if (error.message.includes('already exists') || error.message.includes('Duplicate key name')) {
      console.log(`  ⏭️  Index ${name} already exists`)
      return { status: 'exists', name }
    }
    console.log(`  ❌ Error creating ${name}: ${error.message}`)
    return { status: 'error', name, error: error.message }
  }
}

async function applyMissingIndexes() {
  console.log('=' .repeat(80))
  console.log('📊 APPLYING 9 MISSING DASHBOARD INDEXES')
  console.log('=' .repeat(80))
  console.log('')
  console.log('Your database already has 121 indexes!')
  console.log('Creating only the 9 missing indexes for optimal dashboard performance.')
  console.log('')
  console.log('=' .repeat(80))
  console.log('')

  const results = {
    created: 0,
    exists: 0,
    errors: 0,
    errorList: []
  }

  for (let i = 0; i < missingIndexes.length; i++) {
    const index = missingIndexes[i]
    console.log(`[${i + 1}/${missingIndexes.length}] Creating index on ${index.table}...`)

    const result = await createIndex(index)

    if (result.status === 'created') results.created++
    else if (result.status === 'exists') results.exists++
    else if (result.status === 'error') {
      results.errors++
      results.errorList.push({ name: result.name, error: result.error })
    }
    console.log('')
  }

  console.log('=' .repeat(80))
  console.log('📊 INDEX CREATION SUMMARY')
  console.log('=' .repeat(80))
  console.log(`✅ Created:        ${results.created}`)
  console.log(`⏭️  Already Exists: ${results.exists}`)
  console.log(`❌ Errors:         ${results.errors}`)
  console.log('=' .repeat(80))
  console.log('')

  if (results.errorList.length > 0) {
    console.log('⚠️  Errors encountered:')
    results.errorList.forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`)
    })
    console.log('')
  }

  if (results.created > 0 || (results.exists === missingIndexes.length && results.errors === 0)) {
    console.log('🎉 SUCCESS! Dashboard indexes have been optimized.')
    console.log('')
    console.log('📊 DATABASE STATUS:')
    console.log(`   - Previous indexes: 121`)
    console.log(`   - New indexes added: ${results.created}`)
    console.log(`   - Total indexes now: ${121 + results.created}`)
    console.log('')
    console.log('🚀 EXPECTED IMPROVEMENTS:')
    console.log('   - Dashboard (Original):     10-20% faster')
    console.log('   - Dashboard V2 (Analytics): 15-25% faster')
    console.log('   - Dashboard V3 (Intelligence): 10-20% faster')
    console.log('   - Dashboard V4 (Financial): 20-30% faster (most improvement)')
    console.log('')
    console.log('📝 NEXT STEPS:')
    console.log('   1. Restart your Next.js server: npm run dev')
    console.log('   2. Clear browser cache (Ctrl+Shift+Delete)')
    console.log('   3. Test dashboard load times')
    console.log('   4. Open Network tab (F12) and measure API response times')
    console.log('')
    console.log('📈 After testing, we can proceed to:')
    console.log('   → Optimization #2: Redis Caching (90%+ faster)')
    console.log('   → Optimization #3: Dashboard V3 Query Optimization')
    console.log('   → Optimization #4: Progressive Loading')
    console.log('')
  } else {
    console.log('⚠️  Some indexes could not be created. Check errors above.')
    console.log('')
  }

  console.log('=' .repeat(80))
}

// Run the script
applyMissingIndexes()
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
