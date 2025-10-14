# Inventory Ledger Comprehensive Test Guide

## Overview

This document explains the comprehensive Inventory Ledger test suite located in `e2e/inventory-ledger-comprehensive.spec.ts`. This test suite validates that the Inventory Transaction Ledger report works correctly under **TWO critical scenarios** that represent real-world usage patterns.

---

## Critical Edge Case Tested

**Many products in real POS systems NEVER have formal inventory corrections.**

In real-world operations:
- 80% of products enter inventory through purchase receipts
- They exit through sales and transfers
- No physical count or audit is ever performed
- These are often low-value items, high-velocity items, or newly added products

**The ledger MUST handle this scenario correctly** by calculating opening balances from historical transaction data, not requiring a formal correction as a baseline.

---

## Test Scenarios

### Scenario 1: Product WITH Inventory Correction (Traditional Approach)

**Product Tested:** Logitech M185 Wireless Mouse (ID: 3)

**Transaction Flow:**
```
1. Inventory Correction: 100 units       → Opening baseline established
2. Purchase Receipt: +50 units           → 150 total
3. Sale: -20 units                       → 130 total
4. Final inventory: 130 units
```

**Expected Ledger Behavior:**
- Opening Balance: **100 units** (from correction)
- Closing Balance: **130 units**
- Variance: **0 units** (perfect reconciliation)
- All transactions tracked from correction forward

**Why This Matters:**
This is the traditional POS approach where physical counts establish baselines. The ledger uses the correction as the authoritative starting point.

---

### Scenario 2: Product WITHOUT Inventory Correction (Critical Edge Case)

**Product Tested:** Dell 24" FHD Monitor (ID: 5)

**Transaction Flow:**
```
Starting State: 0 units (NO correction exists)

1. Purchase Receipt #1: +100 units       → 100 total
2. Sale #1: -25 units                    → 75 total
3. Purchase Receipt #2: +50 units        → 125 total
4. Sale #2: -15 units                    → 110 total
5. Final inventory: 110 units
```

**Expected Ledger Behavior:**
- Opening Balance: **0 units** (calculated from historical data)
- Closing Balance: **110 units**
- Variance: **0 units** (perfect reconciliation)
- All transactions tracked from first-ever entry

**Critical Validation:**
```typescript
// Opening balance MUST be 0 when no correction exists
expect(reportData.data.summary.startingBalance).toBe(0)

// Running balances MUST be correct for each transaction
expect(transaction1.runningBalance).toBe(100)  // After first purchase
expect(transaction2.runningBalance).toBe(75)   // After first sale
expect(transaction3.runningBalance).toBe(125)  // After second purchase
expect(transaction4.runningBalance).toBe(110)  // After second sale

// Final reconciliation MUST show 0 variance
expect(reportData.data.summary.variance).toBe(0)
expect(reportData.data.summary.isReconciled).toBe(true)
```

**Why This Is Critical:**
- This is the **most common real-world scenario** for 80% of products
- If the ledger fails here, the entire inventory tracking system is unreliable
- Users cannot trust inventory reports if this doesn't work
- This scenario was likely NOT tested during initial development

---

## Date Range Filtering Tests

Both scenarios include date range validation:

### Test Case: Full Range (From Beginning)
```
Start Date: 2020-01-01 (before any transactions)
End Date: Today
Expected: All transactions shown, opening balance = 0 or correction value
```

### Test Case: Mid Range (After First Transaction)
```
Start Date: After first transaction timestamp
End Date: Today
Expected: Opening balance = inventory after first transaction
```

### Test Case: Empty Range (Before Any Transactions)
```
Start Date: 2020-01-01
End Date: 2020-01-02
Expected: 0 transactions, opening balance = 0
```

**Critical Assertion:**
```typescript
// When date range starts mid-history, opening balance must adjust
expect(reportData.data.summary.startingBalance).toBe(100) // After first purchase
expect(reportData.data.transactions.length).toBe(3) // Remaining transactions
```

---

## Running the Tests

### Prerequisites

1. **Database Setup:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Server must be running on `http://localhost:3000`

### Run Complete Test Suite

```bash
npx playwright test e2e/inventory-ledger-comprehensive.spec.ts
```

### Run Specific Test Scenario

**Test Scenario 1 Only (WITH Correction):**
```bash
npx playwright test e2e/inventory-ledger-comprehensive.spec.ts -g "Test Suite 1"
```

**Test Scenario 2 Only (WITHOUT Correction - Critical Edge Case):**
```bash
npx playwright test e2e/inventory-ledger-comprehensive.spec.ts -g "Test Suite 2"
```

**Edge Cases Only:**
```bash
npx playwright test e2e/inventory-ledger-comprehensive.spec.ts -g "Test Suite 3"
```

### Run in Debug Mode

```bash
npx playwright test e2e/inventory-ledger-comprehensive.spec.ts --debug
```

### View Test Report

```bash
npx playwright show-report
```

---

## Test Results Interpretation

### Success Output

```
✅ Test Suite 1: Product WITH Inventory Correction
  ✓ Step 1: Create Inventory Correction (100 units)
  ✓ Step 2: Purchase Receipt (+50 units) → 150 total
  ✓ Step 3: Sale (-20 units) → 130 total
  ✓ Step 4: Verify Ledger Report - Full Reconciliation

✅ Test Suite 2: Product WITHOUT Inventory Correction
  ✓ Step 1: NO Correction - Purchase Receipt #1 (+100 units) → 100 total
  ✓ Step 2: Sale #1 (-25 units) → 75 total
  ✓ Step 3: Purchase Receipt #2 (+50 units) → 125 total
  ✓ Step 4: Sale #2 (-15 units) → 110 total
  ✓ Step 5: Verify Ledger Report - NO Correction Baseline
  ✓ Step 6: Verify Date Range Filtering - Mid Range

✅ Test Suite 3: Comparison and Edge Cases
  ✓ Edge Case: Empty Date Range (Before Any Transactions)
  ✓ Summary: Test Results Comparison
```

### Expected Console Output (Scenario 2)

```
📊 Report Summary (NO Correction Scenario):
  Opening Balance: 0
  Total In: 150
  Total Out: 40
  Net Change: 110
  Closing Balance: 110
  System Inventory: 110
  Variance: 0
  Transaction Count: 4

  ✓ Transaction 1: Stock Received → Balance: 100
  ✓ Transaction 2: Stock Sold → Balance: 75
  ✓ Transaction 3: Stock Received → Balance: 125
  ✓ Transaction 4: Stock Sold → Balance: 110

✅ CRITICAL EDGE CASE PASSED: Ledger handles products WITHOUT corrections!
   - Opening balance correctly calculated from history (0)
   - All transactions tracked accurately
   - Perfect reconciliation without formal correction
```

### Failure Scenarios to Watch For

**❌ Opening Balance Incorrect (No Correction Scenario):**
```
Expected: 0
Received: undefined or null
```
**Root Cause:** Ledger API doesn't handle missing corrections properly

**❌ Variance Not Zero:**
```
Expected: 0
Received: 10 or -10
```
**Root Cause:** Running balance calculation incorrect

**❌ Missing Transactions:**
```
Expected: 4 transactions
Received: 2 or 3 transactions
```
**Root Cause:** Date range filtering excluding valid transactions

---

## Test Architecture

### Helper Functions

The test suite uses reusable helper functions:

```typescript
// Authentication
login(page, username, password)

// Data retrieval
getProductDetails(businessId, productName)
getCurrentInventory(variationId, locationId)

// Transaction creation
createPurchaseReceipt(page, productSearchTerm, quantity, locationName, supplierName)
createSale(page, productSearchTerm, quantity)
createInventoryCorrection(page, productSearchTerm, physicalCount, locationName)

// Cleanup
clearProductInventory(variationId, locationId)
```

### Test Data Isolation

Each test suite uses different products:
- **Scenario 1:** Logitech M185 Wireless Mouse (ID: 3)
- **Scenario 2:** Dell 24" FHD Monitor (ID: 5)

This prevents test interference and allows parallel execution.

---

## Verification Checklist

After running tests, manually verify:

### Database Verification

```sql
-- Check inventory levels
SELECT
  p.name,
  pv.name as variation,
  vld.qtyAvailable,
  bl.name as location
FROM variation_location_details vld
JOIN product_variations pv ON vld.productVariationId = pv.id
JOIN products p ON vld.productId = p.id
JOIN business_locations bl ON vld.locationId = bl.id
WHERE p.id IN (3, 5) AND vld.locationId = 1;

-- Check stock movements
SELECT
  sm.type,
  sm.quantityIn,
  sm.quantityOut,
  sm.createdAt,
  p.name
FROM stock_movements sm
JOIN product_variations pv ON sm.productVariationId = pv.id
JOIN products p ON pv.productId = p.id
WHERE p.id IN (3, 5)
ORDER BY sm.createdAt ASC;
```

### UI Verification (Manual Testing)

1. **Navigate to:** `/dashboard/reports/inventory-ledger`

2. **Select Product:** Dell 24" FHD Monitor

3. **Select Location:** Main Store

4. **Generate Report** (full date range)

5. **Verify Display:**
   - Opening Balance: 0 units
   - All 4 transactions displayed
   - Running balances: 100 → 75 → 125 → 110
   - Closing Balance: 110 units
   - Variance: 0 units
   - Status: Reconciled

6. **Test Date Range Filter:**
   - Set start date after first transaction
   - Opening balance should update to 100 units
   - Only 3 transactions should display

---

## Common Issues and Solutions

### Issue 1: Tests Fail Due to Existing Data

**Symptom:** Tests fail because product already has inventory

**Solution:**
```sql
-- Clear test product inventory
UPDATE variation_location_details
SET qtyAvailable = 0
WHERE productId = 5 AND locationId = 1;

-- Or re-seed database
npm run db:push
npm run db:seed
```

### Issue 2: Transactions Not Creating Properly

**Symptom:** Purchase receipts or sales fail to create

**Solution:**
- Check if suppliers exist in database
- Verify user has permissions
- Check console for API errors
- Increase timeout values in test

### Issue 3: Ledger API Returns 500 Error

**Symptom:** API call fails with server error

**Solution:**
- Check API route: `src/app/api/reports/inventory-ledger/route.ts`
- Verify Prisma queries handle missing corrections
- Check error logs in terminal

### Issue 4: Date Range Filtering Incorrect

**Symptom:** Opening balance wrong for mid-range queries

**Solution:**
- Verify API calculates opening balance from transactions before start date
- Check timezone handling in date comparisons
- Ensure transactions have correct timestamps

---

## Test Maintenance

### When to Update Tests

Update these tests when:
1. **Inventory Ledger API changes** (calculation logic)
2. **Database schema changes** (StockMovement, InventoryCorrection tables)
3. **UI changes** (report page selectors need updating)
4. **New transaction types added** (returns, adjustments, etc.)

### Adding New Test Cases

To add new test scenarios:

```typescript
test.describe('Test Suite 4: Your New Scenario', () => {
  let productDetails: any

  test.beforeAll(async () => {
    // Setup
    productDetails = await getProductDetails(1, 'Your Product')
  })

  test('Your Test Case', async ({ page }) => {
    await login(page)
    // Your test logic
  })
})
```

---

## Test Matrix

| Scenario | Product | Opening Method | Expected Opening | Expected Closing | Variance | Transactions |
|----------|---------|----------------|------------------|------------------|----------|--------------|
| 1A | Mouse | Correction | 100 | 130 | 0 | 3 |
| 1B | Mouse | Correction + Range | Varies | 130 | 0 | Varies |
| 2A | Monitor | Purchase Only | 0 | 110 | 0 | 4 |
| 2B | Monitor | Purchase + Range | 100 | 110 | 0 | 3 |
| 3A | Monitor | Empty Range | 0 | 0 | 0 | 0 |

---

## Success Criteria

All tests must pass with:
- ✅ 0 variance in both scenarios
- ✅ Correct opening balance calculation (0 when no correction exists)
- ✅ All transactions tracked accurately
- ✅ Running balances match expected values
- ✅ Date range filtering adjusts opening balance correctly
- ✅ No database errors or API failures

---

## Conclusion

This test suite ensures the Inventory Ledger is **production-ready** for all real-world scenarios:

1. **Traditional Workflow:** Products with formal corrections
2. **Common Reality:** Products without corrections (80% of cases)
3. **Date Filtering:** Flexible report generation for any time period

**Critical Validation:** Scenario 2 (NO correction) is the most important test. If this passes, the ledger can be trusted for accurate inventory tracking across the entire system.

---

## Contact

For questions about these tests:
- Review: `e2e/inventory-ledger-comprehensive.spec.ts`
- Check API: `src/app/api/reports/inventory-ledger/route.ts`
- Database Schema: `prisma/schema.prisma` (StockMovement, InventoryCorrection models)
