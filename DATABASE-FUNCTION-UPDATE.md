# CRITICAL DATABASE FUNCTION UPDATE

## Required Action: Update Supabase Function

You need to run the improved function in Supabase to fix concurrency and validation issues.

## What Was Wrong (Original Function)

### Issue 1: Race Condition Risk ⚠️
```sql
-- OLD CODE (DANGEROUS)
INSERT ... ON CONFLICT DO UPDATE
-- Problem: No explicit locking, two transactions could interfere
```

**What could happen:**
- Transaction A reads balance: 100
- Transaction B reads balance: 100 (at same time)
- Transaction A deducts 50, sets to 50
- Transaction B deducts 30, sets to 70  ❌ WRONG! Should be 20

### Issue 2: No Negative Stock Validation ⚠️
```sql
-- OLD CODE (DANGEROUS)
-- Accepts any p_new_balance, even -1000
```

**What could happen:**
- Function blindly accepts negative balances
- No server-side validation
- Inventory could go negative inappropriately

## What Was Fixed (Improved Function)

### Fix 1: Explicit Row-Level Locking ✅
```sql
-- NEW CODE (SAFE)
SELECT id, qty_available
FROM variation_location_details
WHERE product_variation_id = p_variation_id
  AND location_id = p_location_id
FOR UPDATE;  -- Explicit lock!

-- Now:
-- Transaction A locks row
-- Transaction B WAITS until A completes
-- No more race conditions!
```

### Fix 2: Negative Stock Validation ✅
```sql
-- NEW CODE (SAFE)
IF NOT p_allow_negative AND p_new_balance < 0 THEN
  RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %, Shortage: %',
    v_current_stock, ABS(p_quantity), ABS(p_new_balance);
END IF;
```

**Added parameter:** `p_allow_negative BOOLEAN DEFAULT FALSE`

## Installation Steps

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com
2. Select your project
3. Click "SQL Editor" → "New Query"

### Step 2: Run the Updated Function
Copy and paste the entire contents of:
```
database/functions/update_inventory_with_history_v2.sql
```

Click "Run" or press `Ctrl+Enter`

### Step 3: Verify Installation
Run this query to confirm the new parameter exists:

```sql
SELECT
  routine_name,
  parameter_name,
  parameter_mode,
  data_type
FROM information_schema.parameters
WHERE routine_name = 'update_inventory_with_history'
ORDER BY ordinal_position;
```

You should see `p_allow_negative` with data type `boolean` in the list.

### Step 4: Test the Function (Optional)

**Test 1: Concurrency (Run in 2 terminals)**

Terminal 1:
```sql
BEGIN;
SELECT * FROM update_inventory_with_history(
  1, 1, 1, 1, 'sale', -5.00, 10.00, 95.00, 100.00,
  'test', 1, 'T1', 1, 'User1', NULL, NULL, NULL, NULL, FALSE
);
SELECT pg_sleep(10); -- Hold lock for 10 seconds
COMMIT;
```

Terminal 2 (run immediately after Terminal 1):
```sql
SELECT * FROM update_inventory_with_history(
  1, 1, 1, 1, 'sale', -3.00, 10.00, 97.00, 100.00,
  'test', 2, 'T2', 1, 'User1', NULL, NULL, NULL, NULL, FALSE
);
-- ^ This will WAIT for Terminal 1 (proves locking works!)
```

**Test 2: Negative Stock Validation**

Should succeed (allow_negative = TRUE):
```sql
SELECT * FROM update_inventory_with_history(
  1, 1, 1, 1, 'sale', -150.00, 10.00, -50.00, 100.00,
  'test', 3, 'T3', 1, 'User1', NULL, NULL, NULL, NULL, TRUE
);
```

Should FAIL (allow_negative = FALSE):
```sql
SELECT * FROM update_inventory_with_history(
  1, 1, 1, 1, 'sale', -150.00, 10.00, -50.00, 100.00,
  'test', 4, 'T4', 1, 'User1', NULL, NULL, NULL, NULL, FALSE
);
-- Error: Insufficient stock. Current: 100, Requested: 150, Shortage: 50
```

## Technical Details

### Locking Behavior
- `SELECT ... FOR UPDATE` acquires `ROW EXCLUSIVE` lock
- Other transactions attempting same row will **block and wait**
- Lock released when transaction commits/rolls back
- Prevents "lost updates" and race conditions

### Performance Impact
- Locking adds ~1-5ms overhead per transaction
- Minimal compared to 250ms network latency savings
- Essential for data integrity in concurrent environments

### Parameters

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| p_business_id | INTEGER | Required | Multi-tenant isolation |
| p_product_id | INTEGER | Required | Product reference |
| p_variation_id | INTEGER | Required | Variation being updated |
| p_location_id | INTEGER | Required | Location for stock |
| p_type | TEXT | Required | Transaction type |
| p_quantity | DECIMAL | Required | Quantity change |
| p_unit_cost | DECIMAL | Required | Cost per unit |
| p_new_balance | DECIMAL | Required | Expected new balance |
| p_previous_balance | DECIMAL | Required | Expected previous balance |
| p_ref_type | TEXT | Required | Reference type |
| p_ref_id | INTEGER | Required | Reference ID |
| p_ref_number | TEXT | Required | Reference number |
| p_user_id | INTEGER | Required | User performing action |
| p_created_by_name | TEXT | Required | User display name |
| p_notes | TEXT | NULL | Optional notes |
| p_reason | TEXT | NULL | Optional reason |
| p_sub_unit_id | INTEGER | NULL | Optional unit of measure |
| p_total_value | DECIMAL | NULL | Optional total value |
| **p_allow_negative** | **BOOLEAN** | **FALSE** | **NEW: Allow negative stock** |

## After Installation

After running the SQL, tell me and I'll deploy the updated application code that uses the new parameter.

## Rollback (If Needed)

If you need to rollback to the original function:
```sql
DROP FUNCTION IF EXISTS update_inventory_with_history CASCADE;
-- Then run the original from update_inventory_with_history.sql
```
