# Manual Inventory Testing Guide

## After Database Cleanup - Follow These Steps

### Setup: Pick ONE Product to Test
- Product ID: ________
- Variation ID: ________
- Location ID: ________

---

## Test 1: Opening Stock / CSV Import

### Steps:
1. Import product with opening stock (e.g., 10 units)
2. Run this query:

```sql
SELECT COUNT(*) as transaction_count
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID;
```

### Expected Result:
- **Count should be: 1** ✅
- If 0 → ❌ CSV import NOT creating StockTransaction

### Check Balance:
```sql
SELECT type, quantity, balance_qty, created_at
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
ORDER BY created_at DESC;
```

**Expected:**
- Type: `opening_stock`
- Quantity: `10.00`
- Balance: `10.00`

---

## Test 2: Purchase Receipt

### Steps:
1. Create purchase order
2. Receive inventory (e.g., add 5 units)
3. Approve purchase receipt
4. Run the COUNT query again

### Expected Result:
- **Count should now be: 2** ✅ (opening + purchase)
- If still 1 → ❌ Purchases NOT creating StockTransaction

### Check Balance:
```sql
SELECT type, quantity, balance_qty, created_at
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- Type: `purchase`
- Quantity: `5.00`
- Balance: `15.00` ✅ (10 + 5)

---

## Test 3: Sale

### Steps:
1. Create a sale (sell 3 units)
2. Run the COUNT query

### Expected Result:
- **Count should now be: 3** ✅
- If still 2 → ❌ Sales NOT creating StockTransaction

### Check Balance:
```sql
SELECT type, quantity, balance_qty, created_at
FROM stock_transactions
WHERE product_id = YOUR_PRODUCT_ID
  AND product_variation_id = YOUR_VARIATION_ID
  AND location_id = YOUR_LOCATION_ID
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- Type: `sale`
- Quantity: `-3.00` (negative!)
- Balance: `12.00` ✅ (15 - 3)

---

## Test 4: Transfer Out

### Steps:
1. Create transfer from Location A to Location B
2. Send the transfer (deduct from Location A)
3. Run COUNT query for **Location A** (source)

### Expected Result:
- **Count should increase by 1** ✅
- Type: `transfer_out`
- Quantity: negative (e.g., `-4.00`)
- Balance: reduced (e.g., `8.00`)

---

## Test 5: Transfer In

### Steps:
1. Receive the transfer at Location B
2. Run COUNT query for **Location B** (destination)

### Expected Result:
- **Count should increase by 1** ✅
- Type: `transfer_in`
- Quantity: positive (e.g., `4.00`)
- Balance: increased

---

## Test 6: Customer Return (Refund)

### Steps:
1. Create a customer return (return 2 units from a sale)
2. Approve the return
3. Run COUNT query

### Expected Result:
- **Count should increase by 1** ✅
- Type: `customer_return`
- Quantity: positive (e.g., `2.00`)
- Balance: increased (e.g., `10.00`)

---

## Test 7: Supplier Return

### Steps:
1. Create a supplier return (return 1 unit to supplier)
2. Approve the return
3. Run COUNT query

### Expected Result:
- **Count should increase by 1** ✅
- Type: `supplier_return` or `purchase_return`
- Quantity: negative (e.g., `-1.00`)
- Balance: reduced (e.g., `9.00`)

---

## Test 8: Check Inventory Ledger Report

### Steps:
1. Go to Inventory Ledger report in the UI
2. Select your test product
3. Look at the transaction list

### Expected Results:
✅ **Should show ALL transactions** from tests above
✅ **NO DUPLICATES**
✅ **Running balance matches your last SQL query**
✅ **Reconciliation Status: Matched**

---

## Final Verification Query

Run this to see the complete transaction history:

```sql
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
```

### What to Look For:
1. ✅ Every operation has a record
2. ✅ Balance increases/decreases correctly
3. ✅ No gaps in the sequence
4. ✅ No duplicate entries with same reference_id

---

## If ANY Test Fails:

**STOP and report to Claude:**

1. Which test failed (Test #)
2. Expected count vs actual count
3. Screenshot of the SQL query result
4. What operation you just performed

**DO NOT CONTINUE** if a test fails - the system is broken and needs to be fixed.

---

## Success Criteria

✅ All 8 tests pass
✅ No duplicates in ledger
✅ Balance matches at every step
✅ You can trust the system

**If all pass → Your inventory system is bulletproof! 🎯**
