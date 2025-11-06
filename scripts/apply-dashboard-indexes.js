/**
 * Apply Dashboard Performance Indexes
 *
 * This script applies all dashboard performance indexes to your database
 * Works with both PostgreSQL (Supabase) and MySQL (XAMPP)
 *
 * Usage:
 *   node scripts/apply-dashboard-indexes.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Detect database type from DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || ''
const isPostgreSQL = DATABASE_URL.includes('postgresql') || DATABASE_URL.includes('postgres')
const isMySQL = DATABASE_URL.includes('mysql')

console.log(`\n🔍 Database Type Detected: ${isPostgreSQL ? 'PostgreSQL' : isMySQL ? 'MySQL' : 'Unknown'}\n`)

// Index definitions (works for both PostgreSQL and MySQL)
const indexes = [
  // Sale Items
  { table: 'sale_items', name: 'idx_sale_items_sale_product', columns: ['sale_id', 'product_id'] },
  { table: 'sale_items', name: 'idx_sale_items_product', columns: ['product_id'] },
  { table: 'sale_items', name: 'idx_sale_items_variation', columns: ['product_variation_id'] },

  // Sales
  { table: 'sales', name: 'idx_sales_location_date', columns: ['location_id', 'sale_date'] },
  { table: 'sales', name: 'idx_sales_business_location_date', columns: ['business_id', 'location_id', 'sale_date'] },
  { table: 'sales', name: 'idx_sales_business_date_status', columns: ['business_id', 'sale_date', 'status'] },
  { table: 'sales', name: 'idx_sales_created_by', columns: ['created_by'] },

  // Accounts Payable
  { table: 'accounts_payable', name: 'idx_accounts_payable_business_payment_status', columns: ['business_id', 'payment_status'] },
  { table: 'accounts_payable', name: 'idx_accounts_payable_business_invoice_date', columns: ['business_id', 'invoice_date'] },
  { table: 'accounts_payable', name: 'idx_accounts_payable_due_date', columns: ['due_date'] },
  { table: 'accounts_payable', name: 'idx_accounts_payable_purchase', columns: ['purchase_id'] },

  // Sale Payments (Receivables)
  { table: 'sale_payments', name: 'idx_sale_payments_sale', columns: ['sale_id'] },
  { table: 'sale_payments', name: 'idx_sale_payments_method', columns: ['payment_method'] },
  { table: 'sale_payments', name: 'idx_sale_payments_paid_at', columns: ['paid_at'] },

  // Supplier Payments (Payables)
  { table: 'payments', name: 'idx_payments_supplier', columns: ['supplier_id'] },
  { table: 'payments', name: 'idx_payments_business_date', columns: ['business_id', 'payment_date'] },
  { table: 'payments', name: 'idx_payments_status', columns: ['status'] },
  { table: 'payments', name: 'idx_payments_method', columns: ['payment_method'] },

  // Variation Location Details
  { table: 'variation_location_details', name: 'idx_variation_location_location', columns: ['location_id'] },
  { table: 'variation_location_details', name: 'idx_variation_location_variation_location', columns: ['product_variation_id', 'location_id'] },
  { table: 'variation_location_details', name: 'idx_variation_location_product', columns: ['product_id'] },
  { table: 'variation_location_details', name: 'idx_variation_location_qty', columns: ['qty_available'] },

  // Stock Transfers
  { table: 'stock_transfers', name: 'idx_stock_transfers_business_status', columns: ['business_id', 'status'] },
  { table: 'stock_transfers', name: 'idx_stock_transfers_from_location', columns: ['from_location_id'] },
  { table: 'stock_transfers', name: 'idx_stock_transfers_to_location', columns: ['to_location_id'] },

  // Expenses
  { table: 'expenses', name: 'idx_expenses_business_date_status', columns: ['business_id', 'expense_date', 'status'] },
  { table: 'expenses', name: 'idx_expenses_business_status', columns: ['business_id', 'status'] },

  // Customer/Supplier Returns
  { table: 'customer_returns', name: 'idx_customer_returns_business', columns: ['business_id'] },
  { table: 'supplier_returns', name: 'idx_supplier_returns_business', columns: ['business_id'] },

  // Customers
  { table: 'customers', name: 'idx_customers_business', columns: ['business_id'] },
  { table: 'customers', name: 'idx_customers_business_active', columns: ['business_id', 'is_active'] },

  // Products
  { table: 'products', name: 'idx_products_category', columns: ['category_id'] },
  { table: 'products', name: 'idx_products_brand', columns: ['brand_id'] },
  { table: 'products', name: 'idx_products_business_category', columns: ['business_id', 'category_id'] },
  { table: 'products', name: 'idx_products_business_brand', columns: ['business_id', 'brand_id'] },

  // Product Variations
  { table: 'product_variations', name: 'idx_product_variations_product', columns: ['product_id'] },
  { table: 'product_variations', name: 'idx_product_variations_business', columns: ['business_id'] },

  // Business Locations
  { table: 'business_locations', name: 'idx_business_locations_business', columns: ['business_id'] },
  { table: 'business_locations', name: 'idx_business_locations_business_active', columns: ['business_id', 'is_active'] },

  // Categories and Brands
  { table: 'categories', name: 'idx_categories_business', columns: ['business_id'] },
  { table: 'brands', name: 'idx_brands_business', columns: ['business_id'] },
]

async function createIndex(index) {
  const { table, name, columns } = index
  const columnList = columns.map(col => `\`${col}\``).join(', ')

  try {
    if (isMySQL) {
      // MySQL syntax
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
      console.log(`  ✅ Created index: ${name}`)
      return { status: 'created', name }

    } else if (isPostgreSQL) {
      // PostgreSQL syntax
      const createQuery = `CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columnList})`
      await prisma.$executeRawUnsafe(createQuery)
      console.log(`  ✅ Created index: ${name}`)
      return { status: 'created', name }

    } else {
      console.log(`  ❌ Unknown database type`)
      return { status: 'error', name, error: 'Unknown database type' }
    }
  } catch (error) {
    // Index might already exist (MySQL doesn't support IF NOT EXISTS)
    if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
      console.log(`  ⏭️  Index ${name} already exists`)
      return { status: 'exists', name }
    }
    console.log(`  ❌ Error creating ${name}: ${error.message}`)
    return { status: 'error', name, error: error.message }
  }
}

async function applyIndexes() {
  console.log('📊 Starting Dashboard Performance Index Creation...\n')
  console.log(`Total indexes to create: ${indexes.length}\n`)

  const results = {
    created: 0,
    exists: 0,
    errors: 0,
    errorList: []
  }

  for (let i = 0; i < indexes.length; i++) {
    const index = indexes[i]
    console.log(`[${i + 1}/${indexes.length}] Creating index on ${index.table}...`)

    const result = await createIndex(index)

    if (result.status === 'created') results.created++
    else if (result.status === 'exists') results.exists++
    else if (result.status === 'error') {
      results.errors++
      results.errorList.push({ name: result.name, error: result.error })
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 INDEX CREATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Created:        ${results.created}`)
  console.log(`⏭️  Already Exists: ${results.exists}`)
  console.log(`❌ Errors:         ${results.errors}`)
  console.log('='.repeat(60))

  if (results.errorList.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    results.errorList.forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`)
    })
  }

  if (results.created > 0 || results.exists === indexes.length) {
    console.log('\n🎉 Success! Dashboard indexes have been applied.')
    console.log('\n📝 Next steps:')
    console.log('   1. Restart your Next.js server (npm run dev)')
    console.log('   2. Clear browser cache')
    console.log('   3. Test dashboard performance')
    console.log('   4. Compare with DASHBOARD-PERFORMANCE-TEST.md\n')
  } else {
    console.log('\n⚠️  Some indexes could not be created. Check errors above.')
    console.log('   You may need to apply DASHBOARD-PERFORMANCE-INDEXES.sql manually.\n')
  }
}

// Run the script
applyIndexes()
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
