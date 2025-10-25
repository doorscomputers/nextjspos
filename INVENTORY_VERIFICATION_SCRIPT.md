# 🧪 INVENTORY BULLETPROOF VERIFICATION SCRIPT

This script allows you to verify that your inventory system is working correctly and creating proper StockTransaction records for all operations.

---

## 📋 PRE-REQUISITES

Before running these tests:
1. ✅ Database is seeded with test data
2. ✅ At least one business location exists
3. ✅ At least one test product exists
4. ✅ You have admin/superadmin access

---

## 🔍 VERIFICATION TESTS

### Test 1: Check Stock Transaction Logging Infrastructure

**Purpose**: Verify that the stockOperations library is properly configured

**SQL Query**:
```sql
-- Check if stock_transactions table has recent entries
SELECT
  type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM stock_transactions
WHERE business_id = YOUR_BUSINESS_ID
GROUP BY type
ORDER BY latest DESC;
```

**Expected Result**:
- Should see entries for: 'opening_stock', 'purchase', 'sale', 'transfer_in', 'transfer_out', etc.
- Latest timestamps should be recent (if you've been using the system)

---

### Test 2: Verify Beginning Inventory Import

**Purpose**: Confirm beginning inventory creates StockTransaction entries

**Steps**:
1. Import a product with beginning inventory via CSV
2. Run this SQL query:

```sql
-- Check beginning inventory transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.reference_type,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.type = 'opening_stock'
ORDER BY st.created_at DESC
LIMIT 10;
```

**Expected Result**:
- ✅ Should see `opening_stock` type transactions
- ✅ `quantity` = beginning inventory amount
- ✅ `balance_qty` = same as quantity (it's the first transaction)
- ✅ `reference_type` = 'product_import'

---

### Test 3: Verify Purchase Receipt Creates StockTransaction

**Purpose**: Confirm purchases update ledger

**Steps**:
1. Create and approve a purchase receipt
2. Note the receipt ID (e.g., GRN-001, ID: 123)
3. Run this SQL query:

```sql
-- Check purchase transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.unit_cost,
  st.reference_type,
  st.reference_id,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'purchase'
  AND st.reference_id = YOUR_RECEIPT_ID
ORDER BY st.created_at DESC;
```

**Expected Result**:
- ✅ `type` = 'purchase'
- ✅ `quantity` > 0 (positive, adding stock)
- ✅ `balance_qty` = previous balance + quantity
- ✅ `reference_type` = 'purchase'
- ✅ `reference_id` = your receipt ID
- ✅ `unit_cost` = purchase cost

---

### Test 4: Verify Sale Creates StockTransaction

**Purpose**: Confirm sales update ledger

**Steps**:
1. Create and complete a sale (any product)
2. Note the sale ID
3. Run this SQL query:

```sql
-- Check sale transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.unit_cost,
  st.reference_type,
  st.reference_id,
  p.name as product_name,
  vld.qty_available as system_stock,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
JOIN variation_location_details vld ON
  st.product_variation_id = vld.product_variation_id
  AND st.location_id = vld.location_id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'sale'
  AND st.reference_id = YOUR_SALE_ID;
```

**Expected Result**:
- ✅ `type` = 'sale'
- ✅ `quantity` < 0 (negative, deducting stock)
- ✅ `balance_qty` = previous balance - abs(quantity)
- ✅ `system_stock` = `balance_qty` (MUST match!)
- ✅ `reference_type` = 'sale'
- ✅ `reference_id` = your sale ID

**❌ FAILURE if**: `system_stock` ≠ `balance_qty` (indicates ledger mismatch)

---

### Test 5: Verify Stock Transfer Creates TWO Transactions

**Purpose**: Confirm transfers create both OUT and IN transactions

**Steps**:
1. Create a stock transfer from Location A to Location B
2. Send the transfer (creates transfer_out)
3. Receive the transfer (creates transfer_in)
4. Note the transfer ID
5. Run this SQL query:

```sql
-- Check transfer transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.location_id,
  bl.name as location_name,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
JOIN business_locations bl ON st.location_id = bl.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'transfer'
  AND st.reference_id = YOUR_TRANSFER_ID
ORDER BY st.created_at ASC;
```

**Expected Result**:
- ✅ Should see TWO transactions
- ✅ First: `type` = 'transfer_out', `quantity` < 0, `location_id` = source
- ✅ Second: `type` = 'transfer_in', `quantity` > 0, `location_id` = destination
- ✅ Both reference same transfer ID

**❌ FAILURE if**: Only ONE transaction exists (indicates incomplete transfer logging)

---

### Test 6: Verify Inventory Correction Creates StockTransaction

**Purpose**: Confirm corrections update ledger

**Steps**:
1. Create and approve an inventory correction (adjust quantity up or down)
2. Note the correction ID
3. Run this SQL query:

```sql
-- Check correction transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.reference_type,
  st.reference_id,
  st.notes,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'inventory_correction'
  AND st.reference_id = YOUR_CORRECTION_ID;
```

**Expected Result**:
- ✅ `type` = 'adjustment'
- ✅ `quantity` = correction difference (can be positive or negative)
- ✅ `balance_qty` = new corrected balance
- ✅ `reference_type` = 'inventory_correction'

---

### Test 7: Verify Customer Return Creates StockTransaction

**Purpose**: Confirm customer returns update ledger

**Steps**:
1. Create and approve a customer return
2. Note the return ID
3. Run this SQL query:

```sql
-- Check customer return transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.reference_type,
  st.reference_id,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'customer_return'
  AND st.reference_id = YOUR_RETURN_ID;
```

**Expected Result**:
- ✅ `type` = 'customer_return'
- ✅ `quantity` > 0 (positive, adding stock back)
- ✅ `balance_qty` = previous balance + quantity

---

### Test 8: Verify Supplier Return Creates StockTransaction

**Purpose**: Confirm supplier returns update ledger

**Steps**:
1. Create and approve a supplier return
2. Note the return ID
3. Run this SQL query:

```sql
-- Check supplier return transactions
SELECT
  st.id,
  st.type,
  st.quantity,
  st.balance_qty,
  st.reference_type,
  st.reference_id,
  st.notes,
  p.name as product_name,
  st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
WHERE st.business_id = YOUR_BUSINESS_ID
  AND st.reference_type = 'supplier_return'
  AND st.reference_id = YOUR_RETURN_ID;
```

**Expected Result**:
- ✅ `type` = 'supplier_return'
- ✅ `quantity` < 0 (negative, deducting stock)
- ✅ `balance_qty` = previous balance - abs(quantity)

---

### Test 9: Verify Ledger vs System Reconciliation

**Purpose**: Ensure ledger balance matches system stock

**SQL Query** (Run for ALL products):
```sql
-- Compare ledger balance vs system stock
SELECT
  p.id as product_id,
  p.name as product_name,
  pv.name as variation_name,
  bl.name as location_name,

  -- Ledger Balance (from StockTransaction)
  COALESCE(
    (SELECT balance_qty
     FROM stock_transactions
     WHERE product_variation_id = vld.product_variation_id
       AND location_id = vld.location_id
       AND business_id = YOUR_BUSINESS_ID
     ORDER BY created_at DESC
     LIMIT 1),
    0
  ) as ledger_balance,

  -- System Stock (from VariationLocationDetails)
  vld.qty_available as system_stock,

  -- Variance
  vld.qty_available - COALESCE(
    (SELECT balance_qty
     FROM stock_transactions
     WHERE product_variation_id = vld.product_variation_id
       AND location_id = vld.location_id
       AND business_id = YOUR_BUSINESS_ID
     ORDER BY created_at DESC
     LIMIT 1),
    0
  ) as variance

FROM variation_location_details vld
JOIN products p ON vld.product_id = p.id
JOIN product_variations pv ON vld.product_variation_id = pv.id
JOIN business_locations bl ON vld.location_id = bl.id
WHERE p.business_id = YOUR_BUSINESS_ID
  AND p.deleted_at IS NULL
HAVING variance != 0
ORDER BY ABS(variance) DESC;
```

**Expected Result**:
- ✅ **ZERO rows** (ideal - no variances)
- ⚠️ If variances exist, they should be flagged for investigation

**❌ CRITICAL FAILURE if**: Large variances exist (indicates transaction logging failure)

---

### Test 10: Run Stock Reconciliation Detective

**Purpose**: Use the built-in reconciliation tool

**Steps**:
1. Navigate to: `/dashboard/reports/reconciliation`
2. Select location (or "All Locations")
3. Click "Refresh"
4. Review summary cards:
   - Total Variances
   - Requires Investigation
   - Auto-Fixable
   - Total Variance Value

**Expected Result**:
- ✅ **Total Variances = 0** (ideal)
- ✅ All products have ledger balance = system balance

**If variances exist**:
1. Review the variance details
2. Check "Suspicious Activity" flag
3. Investigate large variances manually
4. Use "Auto-Fix" only for small variances (<5%, <10 units)

---

### Test 11: Verify Report Accuracy

**Purpose**: Ensure reports read from correct sources

**Test 11A: Inventory Ledger Report**

**Steps**:
1. Navigate to: `/dashboard/reports/inventory-ledger`
2. Select a product and location
3. Note the closing balance

**Verification SQL**:
```sql
-- Compare report balance vs ledger balance
SELECT
  p.name,
  (SELECT balance_qty
   FROM stock_transactions
   WHERE product_variation_id = YOUR_VARIATION_ID
     AND location_id = YOUR_LOCATION_ID
     AND business_id = YOUR_BUSINESS_ID
   ORDER BY created_at DESC
   LIMIT 1) as ledger_balance;
```

**Expected**: Report closing balance = SQL ledger balance

---

**Test 11B: Inventory Valuation Report**

**Steps**:
1. Navigate to: `/dashboard/reports/inventory-valuation`
2. Note the total inventory value
3. Check individual product valuations

**Verification**:
- Values should be calculated using FIFO/LIFO/AVCO based on StockTransaction costs
- Total should match sum of individual valuations

---

### Test 12: Test Concurrent Updates (Advanced)

**Purpose**: Verify row-level locking prevents race conditions

**Steps**:
1. Open TWO browser windows/tabs side by side
2. Navigate to POS/Sales in BOTH
3. Select the SAME product in BOTH
4. Try to sell 5 units in Window 1
5. **Immediately** try to sell 5 units in Window 2 (before Window 1 completes)

**Expected Result**:
- ✅ One sale completes successfully
- ✅ Other sale waits (due to row lock)
- ✅ Stock is deducted correctly (only once)
- ✅ No negative stock (unless allowed)

**❌ FAILURE if**: Both sales succeed and stock is double-deducted

---

## 📊 COMPREHENSIVE HEALTH CHECK

Run this SQL query to get an overall health report:

```sql
-- Inventory System Health Check
WITH ledger_balances AS (
  SELECT
    product_variation_id,
    location_id,
    balance_qty as ledger_balance
  FROM stock_transactions st1
  WHERE (product_variation_id, location_id, created_at) IN (
    SELECT product_variation_id, location_id, MAX(created_at)
    FROM stock_transactions
    WHERE business_id = YOUR_BUSINESS_ID
    GROUP BY product_variation_id, location_id
  )
),
system_stock AS (
  SELECT
    product_variation_id,
    location_id,
    qty_available as system_stock
  FROM variation_location_details
  WHERE product_id IN (SELECT id FROM products WHERE business_id = YOUR_BUSINESS_ID)
)
SELECT
  'Transaction Types' as check_type,
  type as detail,
  COUNT(*) as count
FROM stock_transactions
WHERE business_id = YOUR_BUSINESS_ID
GROUP BY type

UNION ALL

SELECT
  'Variances' as check_type,
  CASE
    WHEN ABS(lb.ledger_balance - ss.system_stock) = 0 THEN 'Perfect Match'
    WHEN ABS(lb.ledger_balance - ss.system_stock) <= 5 THEN 'Small Variance'
    ELSE 'Large Variance'
  END as detail,
  COUNT(*) as count
FROM ledger_balances lb
JOIN system_stock ss ON
  lb.product_variation_id = ss.product_variation_id
  AND lb.location_id = ss.location_id
GROUP BY detail

UNION ALL

SELECT
  'Product History Sync' as check_type,
  'Records' as detail,
  COUNT(*) as count
FROM product_history
WHERE business_id = YOUR_BUSINESS_ID

UNION ALL

SELECT
  'Negative Stock' as check_type,
  'Products' as detail,
  COUNT(*) as count
FROM variation_location_details vld
JOIN products p ON vld.product_id = p.id
WHERE p.business_id = YOUR_BUSINESS_ID
  AND vld.qty_available < 0

ORDER BY check_type, detail;
```

**Expected Output**:
```
check_type              | detail              | count
------------------------|---------------------|-------
Transaction Types       | opening_stock       | 150
Transaction Types       | purchase            | 75
Transaction Types       | sale                | 200
Transaction Types       | transfer_in         | 30
Transaction Types       | transfer_out        | 30
Transaction Types       | adjustment          | 10
Transaction Types       | customer_return     | 5
Transaction Types       | supplier_return     | 3
Variances               | Perfect Match       | 145
Variances               | Small Variance      | 3
Variances               | Large Variance      | 0    ← Should be ZERO!
Product History Sync    | Records             | 503  ← Should match transaction count
Negative Stock          | Products            | 0    ← Should be ZERO (unless allowed)
```

---

## ✅ SUCCESS CRITERIA

Your system is **BULLETPROOF** if:

1. ✅ Every operation type has StockTransaction entries
2. ✅ Ledger balance = System stock for ALL products
3. ✅ Transfers create TWO transactions (OUT + IN)
4. ✅ ProductHistory count ≈ StockTransaction count
5. ✅ NO large variances detected
6. ✅ NO negative stock (unless explicitly allowed)
7. ✅ Reports show same balances as SQL queries
8. ✅ Concurrent updates handled correctly

---

## ❌ FAILURE INDICATORS

**CRITICAL ISSUES** (must fix immediately):
- ❌ Large variances between ledger and system (>10%)
- ❌ Missing StockTransaction for any operation type
- ❌ Transfers only create ONE transaction instead of TWO
- ❌ Negative stock without explicit permission
- ❌ Report balances don't match SQL queries
- ❌ Concurrent updates cause race conditions

**MINOR ISSUES** (should fix soon):
- ⚠️ Small variances (1-5%) - investigate and fix
- ⚠️ ProductHistory count doesn't match StockTransaction count
- ⚠️ Old legacy reports still in use

---

## 🔧 TROUBLESHOOTING

### Issue: Variances Detected

**Diagnosis SQL**:
```sql
-- Find products with variances
SELECT
  p.name,
  pv.name as variation,
  (SELECT balance_qty FROM stock_transactions
   WHERE product_variation_id = vld.product_variation_id
     AND location_id = vld.location_id
   ORDER BY created_at DESC LIMIT 1) as ledger,
  vld.qty_available as system,
  vld.qty_available - (SELECT balance_qty FROM stock_transactions
   WHERE product_variation_id = vld.product_variation_id
     AND location_id = vld.location_id
   ORDER BY created_at DESC LIMIT 1) as variance,
  (SELECT created_at FROM stock_transactions
   WHERE product_variation_id = vld.product_variation_id
     AND location_id = vld.location_id
   ORDER BY created_at DESC LIMIT 1) as last_transaction
FROM variation_location_details vld
JOIN products p ON vld.product_id = p.id
JOIN product_variations pv ON vld.product_variation_id = pv.id
WHERE p.business_id = YOUR_BUSINESS_ID
  AND vld.qty_available != (SELECT COALESCE(balance_qty, 0) FROM stock_transactions
     WHERE product_variation_id = vld.product_variation_id
       AND location_id = vld.location_id
     ORDER BY created_at DESC LIMIT 1)
ORDER BY ABS(variance) DESC;
```

**Fix Options**:
1. Use Stock Reconciliation Detective to auto-fix small variances
2. Investigate transaction history for large variances
3. Create manual inventory correction if needed

---

### Issue: Missing Transactions

**Diagnosis**: Check if operation completed successfully

```sql
-- Find recent operations without transactions
SELECT
  'Purchase Receipts' as type,
  pr.id,
  pr.receipt_number,
  pr.status,
  pr.approved_at
FROM purchase_receipts pr
WHERE pr.business_id = YOUR_BUSINESS_ID
  AND pr.status = 'approved'
  AND pr.approved_at > NOW() - INTERVAL 7 DAY
  AND NOT EXISTS (
    SELECT 1 FROM stock_transactions st
    WHERE st.reference_type = 'purchase'
      AND st.reference_id = pr.id
  );
```

**Fix**: If operations are missing transactions, there's a bug in the code. Contact support.

---

## 📝 VERIFICATION CHECKLIST

Print this checklist and check off each test:

- [ ] Test 1: Stock transaction infrastructure exists
- [ ] Test 2: Beginning inventory creates transactions
- [ ] Test 3: Purchases create transactions
- [ ] Test 4: Sales create transactions
- [ ] Test 5: Transfers create TWO transactions
- [ ] Test 6: Corrections create transactions
- [ ] Test 7: Customer returns create transactions
- [ ] Test 8: Supplier returns create transactions
- [ ] Test 9: Zero variances detected
- [ ] Test 10: Reconciliation report shows clean data
- [ ] Test 11: Reports match SQL queries
- [ ] Test 12: Concurrent updates handled correctly
- [ ] Health check shows perfect match
- [ ] No critical issues found

---

## 🎯 CONCLUSION

If ALL tests pass, your inventory system is **100% BULLETPROOF** and you can trust:
- ✅ All inventory counts
- ✅ All inventory reports
- ✅ All financial valuations
- ✅ All audit trails

---

*Last Updated: January 25, 2025*
