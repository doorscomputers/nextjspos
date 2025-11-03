-- Performance Indexes for Dashboard and Core Queries
-- Run this in Supabase SQL Editor to add indexes

-- ============================================
-- SALES TABLE INDEXES
-- ============================================

-- Index for dashboard sales queries (business + location + date filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_location_date
  ON sales(business_id, location_id, sale_date DESC)
  WHERE deleted_at IS NULL;

-- Index for sales with status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_status
  ON sales(business_id, status, sale_date DESC)
  WHERE deleted_at IS NULL;

-- Index for payment due calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_payment_status
  ON sales(business_id, location_id, sale_date DESC)
  WHERE status NOT IN ('voided', 'cancelled') AND deleted_at IS NULL;

-- ============================================
-- PRODUCTS TABLE INDEXES
-- ============================================

-- Index for product lookups by SKU (used in imports and searches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_sku
  ON products(business_id, sku)
  WHERE deleted_at IS NULL;

-- Index for product alert queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_alert
  ON products(business_id, alert_quantity)
  WHERE alert_quantity IS NOT NULL AND deleted_at IS NULL;

-- Index for active products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_active
  ON products(business_id, is_active)
  WHERE deleted_at IS NULL;

-- ============================================
-- VARIATION LOCATION DETAILS INDEXES
-- ============================================

-- Index for stock queries by location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vld_location_product
  ON variation_location_details(location_id, product_id, product_variation_id);

-- Index for stock alerts with product join
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vld_product_qty
  ON variation_location_details(product_id, qty_available);

-- ============================================
-- ACCOUNTS PAYABLE INDEXES
-- ============================================

-- Index for purchase due queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ap_business_status
  ON accounts_payable(business_id, payment_status, due_date)
  WHERE deleted_at IS NULL;

-- ============================================
-- STOCK TRANSFERS INDEXES
-- ============================================

-- Index for pending shipments (from location)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_from_status
  ON stock_transfers(business_id, from_location_id, status, created_at DESC)
  WHERE received_at IS NULL AND completed_at IS NULL;

-- Index for pending shipments (to location)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_to_status
  ON stock_transfers(business_id, to_location_id, status, created_at DESC)
  WHERE received_at IS NULL AND completed_at IS NULL;

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- Index for supplier payment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_business_status_date
  ON payments(business_id, status, payment_date DESC)
  WHERE deleted_at IS NULL;

-- ============================================
-- CUSTOMER RETURNS INDEXES
-- ============================================

-- Index for customer return aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_returns_business
  ON customer_returns(business_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================
-- SUPPLIER RETURNS INDEXES
-- ============================================

-- Index for supplier return aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_returns_business
  ON supplier_returns(business_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================
-- PRODUCT HISTORY INDEXES (for audit trail)
-- ============================================

-- Index for product history queries by product
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_history_product
  ON product_history(business_id, product_id, transaction_date DESC);

-- Index for product history by location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_history_location
  ON product_history(business_id, location_id, transaction_date DESC);

-- ============================================
-- BUSINESS LOCATION INDEXES
-- ============================================

-- Index for active locations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_business_active
  ON business_locations(business_id, is_active)
  WHERE deleted_at IS NULL;

-- ============================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- ============================================

-- Update statistics for query planner
ANALYZE sales;
ANALYZE products;
ANALYZE variation_location_details;
ANALYZE accounts_payable;
ANALYZE stock_transfers;
ANALYZE payments;
ANALYZE customer_returns;
ANALYZE supplier_returns;
ANALYZE product_history;
ANALYZE business_locations;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if indexes were created successfully
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
