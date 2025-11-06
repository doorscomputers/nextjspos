/**
 * Check Existing Database Indexes
 *
 * This script queries your database to list all existing indexes
 * and compares them with the indexes we want to create
 *
 * Usage:
 *   node scripts/check-existing-indexes.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Detect database type from DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || ''
const isPostgreSQL = DATABASE_URL.includes('postgresql') || DATABASE_URL.includes('postgres')
const isMySQL = DATABASE_URL.includes('mysql')

console.log(`\n🔍 Database Type: ${isPostgreSQL ? 'PostgreSQL/Supabase' : isMySQL ? 'MySQL' : 'Unknown'}\n`)

// Tables we're interested in
const targetTables = [
  'sales',
  'sale_items',
  'sale_payments',
  'products',
  'product_variations',
  'variation_location_details',
  'accounts_payable',
  'payments',
  'stock_transfers',
  'expenses',
  'customer_returns',
  'supplier_returns',
  'customers',
  'categories',
  'brands',
  'business_locations'
]

// Indexes we want to create (from our script)
const desiredIndexes = [
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

  // Sale Payments
  { table: 'sale_payments', name: 'idx_sale_payments_sale', columns: ['sale_id'] },
  { table: 'sale_payments', name: 'idx_sale_payments_method', columns: ['payment_method'] },
  { table: 'sale_payments', name: 'idx_sale_payments_paid_at', columns: ['paid_at'] },

  // Supplier Payments
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

  // Returns
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

  // Categories & Brands
  { table: 'categories', name: 'idx_categories_business', columns: ['business_id'] },
  { table: 'brands', name: 'idx_brands_business', columns: ['business_id'] },
]

async function getExistingIndexes() {
  console.log('📊 Fetching existing indexes from database...\n')

  try {
    if (isPostgreSQL) {
      // PostgreSQL query
      const indexes = await prisma.$queryRawUnsafe(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[])
        ORDER BY tablename, indexname
      `, targetTables)

      return indexes.map(idx => ({
        schema: idx.schemaname,
        table: idx.tablename,
        name: idx.indexname,
        definition: idx.indexdef
      }))

    } else if (isMySQL) {
      // MySQL query
      const allIndexes = []

      for (const table of targetTables) {
        try {
          const indexes = await prisma.$queryRawUnsafe(`
            SELECT
              TABLE_SCHEMA as schema_name,
              TABLE_NAME as table_name,
              INDEX_NAME as index_name,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '${table}'
            GROUP BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME
            ORDER BY TABLE_NAME, INDEX_NAME
          `)
          allIndexes.push(...indexes)
        } catch (err) {
          // Table might not exist, skip it
        }
      }

      return allIndexes.map(idx => ({
        schema: idx.schema_name,
        table: idx.table_name,
        name: idx.index_name,
        columns: idx.columns
      }))

    } else {
      console.log('❌ Unknown database type')
      return []
    }
  } catch (error) {
    console.error('❌ Error fetching indexes:', error.message)
    return []
  }
}

function analyzeIndexes(existingIndexes) {
  console.log('=' .repeat(80))
  console.log('📊 INDEX ANALYSIS REPORT')
  console.log('='.repeat(80))

  // Group existing indexes by table
  const existingByTable = {}
  existingIndexes.forEach(idx => {
    if (!existingByTable[idx.table]) {
      existingByTable[idx.table] = []
    }
    existingByTable[idx.table].push(idx)
  })

  // Check each desired index
  const results = {
    alreadyExists: [],
    needsCreation: [],
    duplicateDifferentName: []
  }

  desiredIndexes.forEach(desired => {
    const tableIndexes = existingByTable[desired.table] || []

    // Check if exact name exists
    const exactMatch = tableIndexes.find(existing => existing.name === desired.name)

    if (exactMatch) {
      results.alreadyExists.push({ desired, existing: exactMatch })
      return
    }

    // Check if same columns exist with different name
    const columnsMatch = tableIndexes.find(existing => {
      if (isPostgreSQL) {
        // Parse columns from PostgreSQL indexdef
        const defLower = existing.definition?.toLowerCase() || ''
        return desired.columns.every(col => defLower.includes(col.toLowerCase()))
      } else {
        // MySQL has columns field
        const existingCols = (existing.columns || '').toLowerCase().split(',').map(c => c.trim())
        const desiredCols = desired.columns.map(c => c.toLowerCase())
        return desiredCols.every(col => existingCols.includes(col))
      }
    })

    if (columnsMatch) {
      results.duplicateDifferentName.push({
        desired,
        existing: columnsMatch
      })
    } else {
      results.needsCreation.push(desired)
    }
  })

  return results
}

function printResults(results, existingIndexes) {
  console.log('\n📋 SUMMARY:')
  console.log('─'.repeat(80))
  console.log(`Total existing indexes: ${existingIndexes.length}`)
  console.log(`Desired indexes: ${desiredIndexes.length}`)
  console.log(`Already exist (same name): ${results.alreadyExists.length}`)
  console.log(`Duplicate (different name): ${results.duplicateDifferentName.length}`)
  console.log(`Need to create: ${results.needsCreation.length}`)
  console.log('─'.repeat(80))

  if (results.alreadyExists.length > 0) {
    console.log('\n✅ ALREADY EXISTS (Same Name):')
    console.log('─'.repeat(80))
    results.alreadyExists.forEach(({ desired }) => {
      console.log(`  ✓ ${desired.table}.${desired.name}`)
    })
  }

  if (results.duplicateDifferentName.length > 0) {
    console.log('\n⚠️  DUPLICATE (Different Name):')
    console.log('─'.repeat(80))
    console.log('These indexes cover the same columns but have different names.')
    console.log('You may want to skip creating these to avoid redundancy.\n')
    results.duplicateDifferentName.forEach(({ desired, existing }) => {
      console.log(`  ⚠️  ${desired.table}`)
      console.log(`     Want to create: ${desired.name} on [${desired.columns.join(', ')}]`)
      console.log(`     Already exists: ${existing.name}`)
      console.log('')
    })
  }

  if (results.needsCreation.length > 0) {
    console.log('\n🆕 NEED TO CREATE:')
    console.log('─'.repeat(80))
    results.needsCreation.forEach(desired => {
      console.log(`  + ${desired.table}.${desired.name} on [${desired.columns.join(', ')}]`)
    })
  }

  // Show existing indexes by table
  console.log('\n📊 ALL EXISTING INDEXES BY TABLE:')
  console.log('─'.repeat(80))

  const byTable = {}
  existingIndexes.forEach(idx => {
    if (!byTable[idx.table]) byTable[idx.table] = []
    byTable[idx.table].push(idx)
  })

  Object.keys(byTable).sort().forEach(table => {
    console.log(`\n${table} (${byTable[table].length} indexes):`)
    byTable[table].forEach(idx => {
      console.log(`  - ${idx.name}`)
      if (isPostgreSQL && idx.definition) {
        // Show columns from definition
        const match = idx.definition.match(/\((.*?)\)/)
        if (match) {
          console.log(`    Columns: ${match[1]}`)
        }
      } else if (isMySQL && idx.columns) {
        console.log(`    Columns: ${idx.columns}`)
      }
    })
  })

  // Recommendations
  console.log('\n')
  console.log('='.repeat(80))
  console.log('💡 RECOMMENDATIONS:')
  console.log('='.repeat(80))

  if (results.needsCreation.length === 0 && results.duplicateDifferentName.length === 0) {
    console.log('✅ All desired indexes already exist!')
    console.log('   No action needed. Your database is already optimized.')
  } else if (results.needsCreation.length > 0 && results.duplicateDifferentName.length === 0) {
    console.log(`✅ ${results.needsCreation.length} indexes need to be created.`)
    console.log('   Run: node scripts/apply-dashboard-indexes.js')
  } else {
    console.log(`⚠️  Found ${results.duplicateDifferentName.length} duplicate indexes with different names.`)
    console.log(`✅ ${results.needsCreation.length} new indexes need to be created.`)
    console.log('')
    console.log('Options:')
    console.log('1. Skip duplicates and create only new indexes')
    console.log('2. Drop old indexes and create with new standardized names')
    console.log('3. Keep old indexes (they still work, just different names)')
  }

  console.log('='.repeat(80))
  console.log('')
}

// Main execution
async function main() {
  try {
    const existingIndexes = await getExistingIndexes()

    if (existingIndexes.length === 0) {
      console.log('⚠️  No indexes found or could not connect to database.')
      console.log('   Check your DATABASE_URL in .env file.\n')
      return
    }

    const results = analyzeIndexes(existingIndexes)
    printResults(results, existingIndexes)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('Stack:', error.stack)
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
