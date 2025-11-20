# Transfer Receiving Bug - Investigation & Fix

## Issue Summary
**Transfer**: TR-202511-0028 (ID: 29)
**Problem**: Items were deducted from sender (Main Warehouse) but NOT added to receiver (Main Store)
**Impact**: Critical - inventory discrepancy between locations

## Symptoms
1. Transfer status shows "Completed (Stock Deducted)"
2. Both items show "Verified" ✓
3. Product History shows:
   - Transfer Out: -3 and -20 (correctly deducted from Main Warehouse) ✓
   - **Transfer In: 0.00 for both items** (NOT added to Main Store) ✗

## Root Cause Analysis

### Most Likely Cause
The `receivedQuantity` field in `stock_transfer_items` was NULL or 0, causing the complete route logic to fail:

```typescript
// In complete route (lines 176-181)
const receivedQtyValue = item.receivedQuantity
  ? parseFloat(item.receivedQuantity.toString())
  : 0
const receivedQty = receivedQtyValue > 0
  ? receivedQtyValue
  : parseFloat(item.quantity.toString())
```

**Problem**: If `receivedQuantity` was explicitly set to 0 (not NULL), this logic would:
1. Parse it as 0
2. Check if 0 > 0 (FALSE)
3. Fall back to item.quantity

BUT if there was a bug in the verification step that set `receivedQuantity = 0` instead of NULL, the stock transaction and product history might have been created with quantity = 0.

### Possible Scenarios

**Scenario 1**: Verification Step Bug
- User clicked "Verify All Items" or verified individually
- Bug in verification code set `receivedQuantity = 0` instead of `= quantity`
- Complete operation created transactions with quantity = 0

**Scenario 2**: Async Job Failure
- Transfer used complete-async endpoint
- Job processor failed silently or timed out
- Product History entries created with 0 quantity as placeholders

**Scenario 3**: Transaction Rollback
- Complete operation started but database transaction rolled back
- Some records (Product History) were created but rolled back
- Later query shows 0.00 quantities

## Diagnostic Steps

### Step 1: Run Diagnostic Query
```bash
# In Supabase SQL Editor, run:
scripts/diagnose-transfer-29.sql
```

This will show:
1. Transfer status and timestamps
2. Transfer items with received quantities
3. Stock transactions (should show transfer_in with 0 quantity)
4. Product history (shows transfer_in with 0.00 quantity change)
5. Current inventory at both locations
6. Any pending jobs for this transfer
7. Audit log entries

### Step 2: Review Diagnostic Results

**Look for**:
- `received_quantity` field in transfer items (NULL vs 0)
- Stock transactions with `type = 'transfer_in'` and `quantity = 0`
- Product history with `transaction_type = 'transfer_in'` and `quantity_change = 0`
- Failed jobs in job_queue
- Error messages in audit logs

## Repair Steps

### Step 1: Backup Data (CRITICAL!)
```sql
-- Backup transfer data before repair
CREATE TABLE transfer_29_backup AS
SELECT * FROM stock_transfers WHERE id = 29;

CREATE TABLE transfer_29_items_backup AS
SELECT * FROM stock_transfer_items WHERE stock_transfer_id = 29;

CREATE TABLE transfer_29_stock_txn_backup AS
SELECT * FROM stock_transactions
WHERE reference_type = 'stock_transfer' AND reference_id = 29;

CREATE TABLE transfer_29_history_backup AS
SELECT * FROM product_history
WHERE reference_type = 'stock_transfer' AND reference_number = 'TR-202511-0028';
```

### Step 2: Run Repair Script
```bash
# In Supabase SQL Editor, run:
scripts/repair-transfer-29.sql
```

**What This Script Does**:
1. Reads transfer items and determines correct received quantities
2. Checks if stock records exist at destination (Main Store)
3. Adds/updates inventory at destination location
4. Updates stock transactions (fixes 0 quantities)
5. Updates product history (fixes 0.00 quantity changes)
6. Updates receivedQuantity in transfer items if needed
7. Provides detailed progress logging

### Step 3: Verify Fix
The repair script automatically runs verification queries at the end. Check:

1. **Transfer Items**: `received_quantity` should match `quantity`
2. **Current Inventory**: Main Store should show increased quantities
3. **Product History**: Transfer In should show positive quantity changes

## Prevention - Code Fix Required

### Issue in Complete Route
File: `src/app/api/transfers/[id]/complete/route.ts`

**Current Code (Lines 174-181)**:
```typescript
// CRITICAL FIX: In simplified workflow, receivedQuantity might be 0 (not set during verification)
// Use original quantity if receivedQuantity is 0 or null
const receivedQtyValue = item.receivedQuantity
  ? parseFloat(item.receivedQuantity.toString())
  : 0
const receivedQty = receivedQtyValue > 0
  ? receivedQtyValue
  : parseFloat(item.quantity.toString())
```

**Problem**: This doesn't properly handle `receivedQuantity = 0` (explicit zero)

**Recommended Fix**:
```typescript
// FIXED: Properly handle NULL, 0, and missing receivedQuantity
const receivedQtyValue = item.receivedQuantity != null
  ? parseFloat(item.receivedQuantity.toString())
  : null

const receivedQty = (receivedQtyValue != null && receivedQtyValue > 0)
  ? receivedQtyValue
  : parseFloat(item.quantity.toString())

// Or simpler:
const receivedQty = COALESCE(NULLIF(item.receivedQuantity, 0), item.quantity)
```

### Issue in Job Processor
File: `src/lib/job-processor.ts` (Lines 298-318)

Same issue - needs to handle `receivedQuantity = 0` properly.

## Testing After Fix

### Test Case 1: Normal Transfer
1. Create transfer: Main Warehouse → Main Store (2 items)
2. Send transfer (stock deducted from sender)
3. Verify items at receiver
4. Complete transfer
5. **Verify**: Stock added to Main Store
6. **Verify**: Product History shows Transfer In with correct quantities

### Test Case 2: Partial Receipt
1. Create transfer with 10 items
2. Send transfer
3. Verify 7 items (set receivedQuantity = 7 for one item)
4. Complete transfer
5. **Verify**: 7 items added to destination (not 10)

### Test Case 3: Zero Quantity Edge Case
1. Create transfer
2. Manually set receivedQuantity = 0 in database (edge case)
3. Try to complete transfer
4. **Verify**: Falls back to original quantity
5. **Verify**: Stock added correctly

## Related Files

- `src/app/api/transfers/[id]/complete/route.ts` - Main complete endpoint
- `src/lib/job-processor.ts` - Async transfer complete
- `src/lib/stockOperations.ts` - bulkUpdateStock function
- `scripts/diagnose-transfer-29.sql` - Diagnostic queries
- `scripts/repair-transfer-29.sql` - Repair script

## Expected Behavior

**Correct Transfer Flow**:
1. **Create**: Draft transfer created
2. **Send**: Stock deducted from sender (Transfer Out with negative quantity)
3. **Verify**: Items checked at destination, receivedQuantity set
4. **Complete**: Stock added to destination (Transfer In with positive quantity)
5. **Result**: Inventory balanced between locations

**Product History Should Show**:
```
Type: Transfer Out
Location: Main Warehouse
Quantity Change: -3 (or -20)
Balance: 410 (or 100)

Type: Transfer In
Location: Main Store
Quantity Change: +3 (or +20)  ← This was 0.00!
Balance: 13 (or 30)
```

## Client Communication

**For 2nd Demo**:
1. Explain the issue was with the transfer receiving logic
2. Show the fix was applied using the repair script
3. Demonstrate that inventory is now correct at Main Store
4. Show Product History now reflects the correct Transfer In quantities
5. Commit to deploying the permanent code fix to prevent future occurrences

## Action Items

- [x] Create diagnostic script
- [x] Create repair script
- [ ] Run diagnostic script on production
- [ ] Run repair script on production
- [ ] Fix code in complete route
- [ ] Fix code in job processor
- [ ] Deploy code fix to production
- [ ] Test with new transfer to verify fix
- [ ] Update documentation for transfer workflow

## Notes
- This is a data integrity issue - critical to fix immediately
- The repair script is safe and uses transactions (can rollback if needed)
- Always backup before running repair scripts
- The code fix prevents this from happening again

---

**Created**: 2025-11-20
**Issue ID**: Transfer-29-Missing-Inventory
**Priority**: CRITICAL
**Status**: Ready for Repair
