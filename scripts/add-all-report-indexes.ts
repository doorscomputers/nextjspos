import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addAllReportIndexes() {
  console.log('🚀 Adding comprehensive indexes for ALL reports...\n')

  const indexes = [
    // ============================================
    // SALES REPORTS INDEXES
    // ============================================
    {
      name: 'idx_sales_business_date_location',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_date_location
            ON sales(business_id, sale_date DESC, location_id)
            INCLUDE (total_amount, subtotal, status, payment_status)`,
    },
    {
      name: 'idx_sales_date_range',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_date_range
            ON sales(sale_date DESC, business_id)
            WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_sales_customer',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_customer
            ON sales(business_id, customer_id, sale_date DESC)`,
    },
    {
      name: 'idx_sales_cashier',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_cashier
            ON sales(business_id, created_by, sale_date DESC)`,
    },
    {
      name: 'idx_sales_payment_status',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_payment_status
            ON sales(business_id, payment_status, sale_date DESC)`,
    },

    // ============================================
    // SALE ITEMS (for item-level reports)
    // ============================================
    {
      name: 'idx_sale_items_sale',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_sale
            ON sale_items(sale_id, product_id, product_variation_id)`,
    },
    {
      name: 'idx_sale_items_product',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_product
            ON sale_items(product_id, product_variation_id)`,
    },

    // ============================================
    // PURCHASES REPORTS INDEXES
    // ============================================
    {
      name: 'idx_purchases_business_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_business_date
            ON purchases(business_id, purchase_date DESC, location_id)
            INCLUDE (status, total_amount)`,
    },
    {
      name: 'idx_purchases_supplier',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_supplier
            ON purchases(business_id, supplier_id, purchase_date DESC)`,
    },
    {
      name: 'idx_purchases_status',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_status
            ON purchases(business_id, status, purchase_date DESC)
            WHERE deleted_at IS NULL`,
    },

    // ============================================
    // PURCHASE ITEMS
    // ============================================
    {
      name: 'idx_purchase_items_purchase',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_purchase
            ON purchase_items(purchase_id, product_id, product_variation_id)`,
    },
    {
      name: 'idx_purchase_items_product',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_product
            ON purchase_items(product_id, product_variation_id)`,
    },

    // ============================================
    // TRANSFER REPORTS INDEXES
    // ============================================
    {
      name: 'idx_transfers_business_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_business_date
            ON stock_transfers(business_id, transfer_date DESC)
            INCLUDE (status, from_location_id, to_location_id)`,
    },
    {
      name: 'idx_transfers_from_location',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_from_location
            ON stock_transfers(business_id, from_location_id, transfer_date DESC)`,
    },
    {
      name: 'idx_transfers_to_location',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_to_location
            ON stock_transfers(business_id, to_location_id, transfer_date DESC)`,
    },
    {
      name: 'idx_transfers_status',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_status
            ON stock_transfers(business_id, status, transfer_date DESC)
            WHERE deleted_at IS NULL`,
    },

    // ============================================
    // TRANSFER ITEMS
    // ============================================
    {
      name: 'idx_transfer_items_transfer',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfer_items_transfer
            ON stock_transfer_items(stock_transfer_id, product_id, product_variation_id)`,
    },
    {
      name: 'idx_transfer_items_product',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfer_items_product
            ON stock_transfer_items(product_id, product_variation_id)`,
    },

    // ============================================
    // GENERAL TRANSACTION TABLES
    // ============================================
    {
      name: 'idx_customers_business',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_business
            ON customers(business_id, name)
            WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_suppliers_business',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_business
            ON suppliers(business_id, name)
            WHERE deleted_at IS NULL`,
    },
  ]

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (const index of indexes) {
    try {
      console.log(`Creating: ${index.name}...`)
      await prisma.$executeRawUnsafe(index.sql)
      console.log(`✅ Created: ${index.name}`)
      successCount++
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`⚠️  Already exists: ${index.name}`)
        skippedCount++
      } else if (error.message?.includes('CONCURRENTLY cannot run inside a transaction block')) {
        // Retry without CONCURRENTLY
        try {
          const sqlWithoutConcurrently = index.sql.replace('CONCURRENTLY ', '')
          await prisma.$executeRawUnsafe(sqlWithoutConcurrently)
          console.log(`✅ Created (non-concurrent): ${index.name}`)
          successCount++
        } catch (retryError: any) {
          console.error(`❌ Error creating ${index.name}:`, retryError.message)
          errorCount++
        }
      } else {
        console.error(`❌ Error creating ${index.name}:`, error.message)
        errorCount++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Successfully created: ${successCount}`)
  console.log(`   ⚠️  Already existed: ${skippedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)

  // Analyze all tables
  console.log(`\n🔍 Analyzing tables for query optimization...`)
  const tables = [
    'sales', 'sale_items',
    'purchases', 'purchase_items',
    'stock_transfers', 'stock_transfer_items',
    'customers', 'suppliers'
  ]

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ANALYZE ${table}`)
      console.log(`✅ Analyzed: ${table}`)
    } catch (error: any) {
      console.error(`⚠️  Could not analyze ${table}:`, error.message)
    }
  }

  await prisma.$disconnect()
  console.log(`\n✨ Done! All report queries should now be MUCH faster.`)
  console.log(`\n💡 CRITICAL: Run "npm run build && npm start" for MAXIMUM speed (3-5x faster than dev mode)`)
}

addAllReportIndexes()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
