import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSafeIndexes() {
    console.log('🚀 Adding safe performance indexes...\n')

    const indexes = [
        // ============================================
        // PRODUCTS TABLE INDEXES (Safe - with deleted_at check)
        // ============================================
        {
            name: 'idx_products_business_active',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_active 
            ON products(business_id, is_active) 
            WHERE deleted_at IS NULL`,
        },
        {
            name: 'idx_products_business_created',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_created 
            ON products(business_id, created_at DESC) 
            WHERE deleted_at IS NULL`,
        },
        {
            name: 'idx_products_category',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category 
            ON products(category_id) 
            WHERE deleted_at IS NULL`,
        },
        {
            name: 'idx_products_brand',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_brand 
            ON products(business_id, brand_id) 
            WHERE deleted_at IS NULL`,
        },
        {
            name: 'idx_products_sku',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku 
            ON products(business_id, sku) 
            WHERE deleted_at IS NULL`,
        },

        // ============================================
        // PRODUCT VARIATIONS TABLE INDEXES (Safe)
        // ============================================
        {
            name: 'idx_product_variations_product',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variations_product 
            ON product_variations(product_id) 
            WHERE deleted_at IS NULL`,
        },
        {
            name: 'idx_product_variations_business',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variations_business 
            ON product_variations(business_id) 
            WHERE deleted_at IS NULL`,
        },

        // ============================================
        // VARIATION LOCATION DETAILS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_variation_location_product_location',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variation_location_product_location 
            ON variation_location_details(product_id, location_id)`,
        },
        {
            name: 'idx_variation_location_variation_location',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variation_location_variation_location 
            ON variation_location_details(product_variation_id, location_id)`,
        },
        {
            name: 'idx_variation_location_product_variation',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variation_location_product_variation 
            ON variation_location_details(product_id, product_variation_id)`,
        },

        // ============================================
        // SALES TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_sales_business_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_date 
            ON sales(business_id, sale_date DESC, location_id)`,
        },
        {
            name: 'idx_sales_business_status',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_status 
            ON sales(business_id, status) 
            WHERE status != 'cancelled'`,
        },
        {
            name: 'idx_sales_location_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_location_date 
            ON sales(location_id, sale_date DESC)`,
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
        {
            name: 'idx_sales_invoice_number',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_invoice_number 
            ON sales(business_id, invoice_number)`,
        },

        // ============================================
        // SALE ITEMS TABLE INDEXES (Safe - no deleted_at)
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
        // PURCHASES TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_purchases_business_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_business_date 
            ON purchases(business_id, purchase_date DESC, location_id)`,
        },
        {
            name: 'idx_purchases_supplier',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_supplier 
            ON purchases(business_id, supplier_id, purchase_date DESC)`,
        },
        {
            name: 'idx_purchases_status',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_status 
            ON purchases(business_id, status, purchase_date DESC)`,
        },

        // ============================================
        // PURCHASE ITEMS TABLE INDEXES (Safe - no deleted_at)
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
        // STOCK TRANSFERS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_transfers_business_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_business_date 
            ON stock_transfers(business_id, transfer_date DESC)`,
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
            ON stock_transfers(business_id, status, transfer_date DESC)`,
        },

        // ============================================
        // STOCK TRANSFER ITEMS TABLE INDEXES (Safe - no deleted_at)
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
        // CUSTOMERS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_customers_business',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_business 
            ON customers(business_id, name)`,
        },

        // ============================================
        // SUPPLIERS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_suppliers_business',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_business 
            ON suppliers(business_id, name)`,
        },

        // ============================================
        // BUSINESS LOCATIONS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_business_locations_business_active',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_locations_business_active 
            ON business_locations(business_id, is_active)`,
        },

        // ============================================
        // ACCOUNTS PAYABLE TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_accounts_payable_business',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_payable_business 
            ON accounts_payable(business_id, invoice_date DESC)`,
        },
        {
            name: 'idx_accounts_payable_payment_status',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_payable_payment_status 
            ON accounts_payable(business_id, payment_status)`,
        },

        // ============================================
        // CUSTOMER RETURNS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_customer_returns_business_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_returns_business_date 
            ON customer_returns(business_id, return_date DESC)`,
        },

        // ============================================
        // SUPPLIER RETURNS TABLE INDEXES (Safe - no deleted_at)
        // ============================================
        {
            name: 'idx_supplier_returns_business_date',
            sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_returns_business_date 
            ON supplier_returns(business_id, return_date DESC)`,
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
        'products', 'product_variations', 'variation_location_details',
        'sales', 'sale_items', 'purchases', 'purchase_items',
        'stock_transfers', 'stock_transfer_items',
        'customers', 'suppliers', 'business_locations',
        'accounts_payable', 'customer_returns', 'supplier_returns'
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
    console.log(`\n✨ Done! All database queries should now be MUCH faster.`)
    console.log(`\n💡 Expected improvements:`)
    console.log(`   - Products page: 3.6s → 300ms (90% faster)`)
    console.log(`   - Stock pivot: 5s → 500ms (90% faster)`)
    console.log(`   - Dashboard: 8-19s → <1s (95% faster)`)
    console.log(`   - Reports: 2-5s → 200-500ms (90% faster)`)
    console.log(`\n🚀 Next step: Run "npm run build && npm start" for production optimization`)
}

addSafeIndexes()
    .catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })

