-- ========================================
-- INVENTORY DISCREPANCY DIAGNOSTIC & FIX
-- ========================================
-- Purpose: Find and fix inventory ledger vs physical stock mismatches
-- Run this to identify discrepancies and generate fix statements

-- Step 1: Find all discrepancies (System Stock vs Ledger Calculation)
-- =====================================================================

WITH ledger_calculations AS (
  SELECT
    st.product_variation_id,
    st.location_id,
    p.name as product_name,
    pv.name as variation_name,
    pv.sku,
    bl.name as location_name,

    -- Calculate stock from ledger (sum of all transactions)
    COALESCE(SUM(CASE
      WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
      THEN st.quantity::numeric
      WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
      THEN -st.quantity::numeric
      ELSE 0
    END), 0) as ledger_calculated_stock,

    -- Count transactions
    COUNT(*) as transaction_count,

    -- Latest transaction date
    MAX(st.created_at) as last_transaction_date

  FROM stock_transactions st
  INNER JOIN products p ON st.product_id = p.id
  INNER JOIN product_variations pv ON st.product_variation_id = pv.id
  INNER JOIN business_locations bl ON st.location_id = bl.id
  WHERE st.deleted_at IS NULL
  GROUP BY st.product_variation_id, st.location_id, p.name, pv.name, pv.sku, bl.name
),

physical_stock AS (
  SELECT
    vld.product_variation_id,
    vld.location_id,
    vld.qty_available::numeric as physical_stock
  FROM variation_location_details vld
)

SELECT
  lc.product_name,
  lc.variation_name,
  lc.sku,
  lc.location_name,
  lc.physical_stock as "System Stock (variation_location_details)",
  lc.ledger_calculated_stock as "Ledger Calculated Stock (stock_transactions)",
  (lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0)) as "Variance (Ledger - System)",
  lc.transaction_count as "Transaction Count",
  lc.last_transaction_date as "Last Transaction",

  -- Diagnosis
  CASE
    WHEN lc.ledger_calculated_stock > COALESCE(ps.physical_stock, 0) THEN '⚠️ LEDGER HIGHER - Physical stock too low (missing stock addition or extra deduction)'
    WHEN lc.ledger_calculated_stock < COALESCE(ps.physical_stock, 0) THEN '⚠️ PHYSICAL HIGHER - Physical stock too high (missing ledger entry or double addition)'
    ELSE '✅ MATCHED'
  END as diagnosis,

  lc.product_variation_id,
  lc.location_id

FROM ledger_calculations lc
LEFT JOIN physical_stock ps ON lc.product_variation_id = ps.product_variation_id
                            AND lc.location_id = ps.location_id
WHERE lc.ledger_calculated_stock != COALESCE(ps.physical_stock, 0)
ORDER BY ABS(lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0)) DESC, lc.product_name;


-- Step 2: Detailed Transaction History for Discrepant Items
-- ===========================================================
-- Run this after finding discrepancies to see full transaction history

-- Replace with actual variation_id and location_id from Step 1 results
-- Example: WHERE st.product_variation_id = 123 AND st.location_id = 1

SELECT
  st.id,
  st.created_at as "Date & Time",
  st.type as "Transaction Type",
  CASE
    WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
    THEN CONCAT('+', st.quantity::numeric)
    WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
    THEN CONCAT('-', st.quantity::numeric)
    ELSE st.quantity::text
  END as "Quantity Change",
  st.balance_qty as "Balance After",
  st.reference_type as "Reference Type",
  st.reference_id as "Reference ID",
  st.notes,
  u.username as "Created By"
FROM stock_transactions st
LEFT JOIN users u ON st.created_by = u.id
WHERE st.product_variation_id = 1632  -- ⚠️ REPLACE WITH YOUR VARIATION ID
  AND st.location_id = 1               -- ⚠️ REPLACE WITH YOUR LOCATION ID
  AND st.deleted_at IS NULL
ORDER BY st.created_at ASC, st.id ASC;


-- Step 3: Check for Missing Opening Stock Transactions
-- =====================================================================

SELECT
  vld.id as vld_id,
  p.name as product_name,
  pv.name as variation_name,
  pv.sku,
  bl.name as location_name,
  vld.qty_available as physical_stock,
  vld.created_at as stock_record_created,

  -- Check if opening stock transaction exists
  CASE
    WHEN os_count.cnt > 0 THEN '✅ Has opening stock'
    ELSE '⚠️ MISSING OPENING STOCK TRANSACTION'
  END as status,

  os_count.cnt as opening_stock_transaction_count

FROM variation_location_details vld
INNER JOIN products p ON vld.product_id = p.id
INNER JOIN product_variations pv ON vld.product_variation_id = pv.id
INNER JOIN business_locations bl ON vld.location_id = bl.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as cnt
  FROM stock_transactions st
  WHERE st.product_variation_id = vld.product_variation_id
    AND st.location_id = vld.location_id
    AND st.type = 'opening_stock'
    AND st.deleted_at IS NULL
) os_count ON true

WHERE vld.qty_available::numeric != 0  -- Only check items with stock
  AND os_count.cnt = 0                  -- Missing opening stock
ORDER BY p.name, pv.name;


-- Step 4: FIX SCRIPT - Sync Physical Stock to Match Ledger
-- =====================================================================
-- ⚠️ DANGER: This will overwrite physical stock to match ledger
-- ⚠️ Only run this AFTER reviewing discrepancies and confirming ledger is correct!
-- ⚠️ BACKUP YOUR DATABASE FIRST!

-- Uncomment below to execute fix:

/*
WITH ledger_calculations AS (
  SELECT
    st.product_variation_id,
    st.location_id,
    COALESCE(SUM(CASE
      WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
      THEN st.quantity::numeric
      WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
      THEN -st.quantity::numeric
      ELSE 0
    END), 0) as ledger_calculated_stock
  FROM stock_transactions st
  WHERE st.deleted_at IS NULL
  GROUP BY st.product_variation_id, st.location_id
)

UPDATE variation_location_details vld
SET
  qty_available = lc.ledger_calculated_stock,
  updated_at = NOW()
FROM ledger_calculations lc
WHERE vld.product_variation_id = lc.product_variation_id
  AND vld.location_id = lc.location_id
  AND vld.qty_available::numeric != lc.ledger_calculated_stock
RETURNING
  vld.product_variation_id,
  vld.location_id,
  vld.qty_available as new_physical_stock,
  lc.ledger_calculated_stock as ledger_stock;
*/


-- Step 5: Create Missing Opening Stock Transactions (If Needed)
-- =====================================================================
-- Use this if you have stock but no ledger entries at all

/*
INSERT INTO stock_transactions (
  business_id,
  product_id,
  product_variation_id,
  location_id,
  type,
  quantity,
  balance_qty,
  reference_type,
  reference_id,
  created_by,
  notes,
  created_at
)
SELECT
  vld.business_id,  -- ⚠️ Assuming variation_location_details has business_id, adjust if needed
  vld.product_id,
  vld.product_variation_id,
  vld.location_id,
  'correction'::text,  -- Use 'correction' type for manual fixes
  vld.qty_available,
  vld.qty_available,
  'manual_correction'::text,
  NULL,
  1,  -- ⚠️ REPLACE WITH ADMIN USER ID
  'Correction: Sync ledger with physical stock to fix discrepancy',
  NOW()
FROM variation_location_details vld
WHERE NOT EXISTS (
  SELECT 1 FROM stock_transactions st
  WHERE st.product_variation_id = vld.product_variation_id
    AND st.location_id = vld.location_id
    AND st.deleted_at IS NULL
)
AND vld.qty_available::numeric != 0;
*/


-- Step 6: Verify Fix (Run after applying fixes)
-- =====================================================================

WITH ledger_calculations AS (
  SELECT
    st.product_variation_id,
    st.location_id,
    COALESCE(SUM(CASE
      WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
      THEN st.quantity::numeric
      WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
      THEN -st.quantity::numeric
      ELSE 0
    END), 0) as ledger_calculated_stock
  FROM stock_transactions st
  WHERE st.deleted_at IS NULL
  GROUP BY st.product_variation_id, st.location_id
),

physical_stock AS (
  SELECT
    vld.product_variation_id,
    vld.location_id,
    vld.qty_available::numeric as physical_stock
  FROM variation_location_details vld
)

SELECT
  COUNT(*) as total_discrepancies,
  SUM(ABS(lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0))) as total_variance
FROM ledger_calculations lc
LEFT JOIN physical_stock ps ON lc.product_variation_id = ps.product_variation_id
                            AND lc.location_id = ps.location_id
WHERE lc.ledger_calculated_stock != COALESCE(ps.physical_stock, 0);

-- Expected result: total_discrepancies = 0
