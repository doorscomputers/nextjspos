-- =====================================================
-- INVENTORY TESTING QUERIES
-- Replace YOUR_PRODUCT_ID, YOUR_VARIATION_ID, YOUR_LOCATION_ID
-- with actual values from your test product
-- =====================================================

-- SET YOUR TEST PRODUCT HERE:
-- Product ID:
-- Variation ID:
-- Location ID:

-- =====================================================
-- QUERY 1: Count Total Transactions
-- Run after EACH operation to verify it created a record
-- =====================================================
SELECT COUNT(*) as transaction_count
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID;

-- Expected after:
-- Opening stock: 1
-- + Purchase: 2
-- + Sale: 3
-- + Transfer out: 4
-- + Transfer in: (check other location)
-- + Return: (count increases)


-- =====================================================
-- QUERY 2: View Latest Transaction
-- Run after EACH operation to see what was created
-- =====================================================
SELECT
  type,
  quantity,
  balance_qty,
  reference_type,
  reference_id,
  notes,
  created_at
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
ORDER BY created_at DESC
LIMIT 1;


-- =====================================================
-- QUERY 3: View Complete Transaction History
-- Run at the end to see all transactions
-- =====================================================
SELECT
  id,
  type,
  quantity,
  balance_qty,
  reference_type,
  reference_id,
  notes,
  created_at
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
ORDER BY created_at ASC;


-- =====================================================
-- QUERY 4: Check for Duplicates
-- Should return 0 rows (no duplicates)
-- =====================================================
SELECT
  reference_type,
  reference_id,
  COUNT(*) as duplicate_count
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
  AND reference_type IS NOT NULL
  AND reference_id IS NOT NULL
GROUP BY reference_type, reference_id
HAVING COUNT(*) > 1;

-- If this returns ANY rows → YOU HAVE DUPLICATES! ⚠️


-- =====================================================
-- QUERY 5: Verify Current Stock Balance
-- Final balance should match actual inventory
-- =====================================================
SELECT
  st.balance_qty as stock_transaction_balance,
  vld.qty_available as variation_location_balance,
  (st.balance_qty - vld.qty_available) as variance
FROM (
  SELECT balance_qty
  FROM stock_transactions
  WHERE product_id = YOUR_PRODUCT_ID
    AND product_variation_id = YOUR_VARIATION_ID
    AND location_id = YOUR_LOCATION_ID
  ORDER BY created_at DESC
  LIMIT 1
) st
CROSS JOIN (
  SELECT qty_available
  FROM variation_location_details
  WHERE product_variation_id = YOUR_VARIATION_ID
    AND location_id = YOUR_LOCATION_ID
) vld;

-- Variance should be 0.00 ✅


-- =====================================================
-- QUERY 6: Compare with ProductHistory (Check for Duplicates)
-- Count should be EQUAL or ProductHistory should be MORE
-- (ProductHistory includes more audit data, but core transactions should match)
-- =====================================================
SELECT
  'StockTransaction' as source,
  COUNT(*) as count
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID

UNION ALL

SELECT
  'ProductHistory' as source,
  COUNT(*) as count
FROM product_history
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID;

-- ProductHistory might be equal or slightly higher (includes corrections, etc.)
-- Both should be > 0 after operations
