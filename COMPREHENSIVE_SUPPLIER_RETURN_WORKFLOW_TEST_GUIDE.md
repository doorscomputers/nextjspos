# Comprehensive Supplier Return Workflow Test Guide

## Overview

This document describes the comprehensive end-to-end test that validates the complete purchase-to-sales workflow including the **CRITICAL supplier return accounting fix**.

**Test File:** `e2e/comprehensive-supplier-return-workflow.spec.ts`

## What This Test Validates

This test ensures the entire inventory and accounting workflow works correctly from purchase to sale, with special emphasis on the critical supplier return accounting fix:

1. **Purchase Entry** - Creating purchase orders with serial numbers
2. **GRN/Receipt Approval** - Receiving goods and increasing inventory
3. **Supplier Return** - **CRITICAL FIX VALIDATION**
   - Inventory reduction
   - Accounts Payable reduction
   - Payment record creation with "supplier_return_credit" method
   - Serial number status updates
4. **Stock Transfers** - Moving inventory between locations
5. **Return Transfers** - Returning inventory to main warehouse
6. **Sales Transaction** - Selling products and reducing inventory
7. **Final Verification** - Confirming all stock levels and accounting records are correct

## Test Products

The test uses two existing products from the database:

1. **"2 DOOR DRAWER WITH LOCK 4 ADJUSTABLE SHELVES"**
   - Tracked with serial numbers (IMEI/Serial)
   - Quantity in test: 10 units
   - 10 unique serial numbers generated

2. **"ADATA 512GB 2.5 SSD"**
   - Not tracked with serial numbers
   - Quantity in test: 20 units

## Test Locations

The test uses 4 locations:

1. **Main Warehouse** - Source location for purchases
2. **Main Store** - Retail location
3. **Bambang** - Branch location
4. **Tuguegarao** - Branch location

## Prerequisites

### 1. Database Setup

Ensure the database is seeded with:
- Superadmin user (`superadmin` / `password`)
- The four required locations (Main Warehouse, Main Store, Bambang, Tuguegarao)
- The two test products (2 DOOR DRAWER, ADATA SSD)
- A supplier named "GRAND TECH" (created automatically if not exists)

### 2. Application Running

The application must be running on `http://localhost:3000`:

```bash
npm run dev
```

### 3. Playwright Installed

Ensure Playwright is installed:

```bash
npm install --save-dev @playwright/test
npx playwright install
```

## Running the Test

### Run Single Test

```bash
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts
```

### Run with UI Mode (Recommended for Debugging)

```bash
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts --ui
```

### Run in Headed Mode (See Browser)

```bash
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts --headed
```

### Run with Debug Output

```bash
DEBUG=pw:api npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts
```

## Test Phases Breakdown

### Phase 1: Purchase Entry

**What Happens:**
- Creates purchase order for GRAND TECH supplier
- Adds 10 units of Drawer (with 10 serial numbers)
- Adds 20 units of SSD (no serials)
- Status: "ordered"

**Verifications:**
- Purchase created in database
- 2 purchase items created
- Status is "ordered"

**Expected Duration:** ~10 seconds

---

### Phase 2: GRN/Receipt Approval

**What Happens:**
- Creates Goods Received Note (GRN) for the purchase
- Receives all items (10 drawers, 20 SSDs)
- Approves the receipt
- **Inventory increases at Main Warehouse**

**Verifications:**
- GRN created and approved
- Main Warehouse stock increased:
  - Drawer: +10 units
  - SSD: +20 units
- Serial numbers marked as "in_stock" at Main Warehouse
- Stock transactions created

**Expected Duration:** ~15 seconds

---

### Phase 3: Supplier Return (CRITICAL TEST)

**What Happens:**
- Creates supplier return to GRAND TECH:
  - Returns 2 units of Drawer (defective, with serial numbers)
  - Returns 3 units of SSD (damaged)
- Return amount: ₱14,500.00 (2 × ₱5,000 + 3 × ₱1,500)
- Approves the supplier return
- **CRITICAL ACCOUNTING OPERATIONS:**
  - Inventory reduced at Main Warehouse
  - Accounts Payable reduced by ₱14,500
  - Payment record created with method "supplier_return_credit"

**Verifications:**
- ✓ Supplier return created with status "pending"
- ✓ Total amount calculated correctly (₱14,500)
- ✓ Supplier return approved
- ✓ **Inventory reduced:**
  - Drawer: -2 units
  - SSD: -3 units
- ✓ **Accounts Payable reduced by ₱14,500**
- ✓ **Payment record created:**
  - Amount: ₱14,500
  - Method: "supplier_return_credit"
  - Status: "completed"
  - Reference: Return number (e.g., SR-202510-0001)
- ✓ Serial numbers marked as "supplier_return" status
- ✓ Serial numbers removed from location (currentLocationId = null)
- ✓ Stock transactions created

**Expected Duration:** ~20 seconds

**CRITICAL IMPORTANCE:**
This phase validates the fix for the supplier return accounting bug where Accounts Payable was not being reduced and payment records were not being created.

---

### Phase 4: Stock Transfers to 3 Locations

**What Happens:**
- Transfers from Main Warehouse to Main Store:
  - 2 units Drawer (with serials)
  - 5 units SSD
- Transfers from Main Warehouse to Bambang:
  - 2 units Drawer (with serials)
  - 5 units SSD
- Transfers from Main Warehouse to Tuguegarao:
  - 2 units Drawer (with serials)
  - 5 units SSD

**Verifications:**
- 3 transfer records created
- Stock reduced at Main Warehouse
- Stock increased at destination locations
- Serial numbers moved to destination locations

**Expected Duration:** ~30 seconds

---

### Phase 5: Return Transfers from Locations

**What Happens:**
- Each location returns stock back to Main Warehouse:
  - Main Store: 1 Drawer + 1 SSD
  - Bambang: 1 Drawer + 1 SSD
  - Tuguegarao: 1 Drawer + 1 SSD

**Verifications:**
- 3 return transfer records created
- Stock increased at Main Warehouse (+3 Drawer, +3 SSD)
- Stock reduced at each location

**Expected Duration:** ~30 seconds

---

### Phase 6: Sales Transaction

**What Happens:**
- Creates sale at Main Store:
  - Sells 1 unit of Drawer (with serial)
  - Sells 2 units of SSD
- Payment: Cash, fully paid

**Verifications:**
- Sale created
- Inventory reduced at Main Store
- Serial number marked as "sold"
- Stock transactions created

**Expected Duration:** ~15 seconds

---

### Final Verification: Stock Levels and Accounting

**What Happens:**
- Queries all stock levels across all locations
- Verifies Accounts Payable balance
- Verifies payment records
- Verifies serial number status distribution

**Expected Final Stock Levels:**

**Main Warehouse:**
- Drawer: ~5 units (Started 10, returned 2 to supplier = 8, transferred out 6 = 2, received back 3 = 5)
- SSD: ~5 units (Started 20, returned 3 to supplier = 17, transferred out 15 = 2, received back 3 = 5)

**Main Store:**
- Drawer: ~0 units (Received 2, returned 1 = 1, sold 1 = 0)
- SSD: ~2 units (Received 5, returned 1 = 4, sold 2 = 2)

**Bambang:**
- Drawer: ~1 unit (Received 2, returned 1 = 1)
- SSD: ~4 units (Received 5, returned 1 = 4)

**Tuguegarao:**
- Drawer: ~1 unit (Received 2, returned 1 = 1)
- SSD: ~4 units (Received 5, returned 1 = 4)

**Accounting Verification:**
- Payment record exists for supplier return credit
- Accounts Payable reduced appropriately

**Serial Number Status:**
- 2 marked as "supplier_return"
- 1 marked as "sold"
- Remaining marked as "in_stock"

**Expected Duration:** ~10 seconds

---

## Total Test Duration

**Approximate Total Time:** 2-3 minutes

## Test Output

### Console Output

The test provides detailed console output for each phase:

```
=== INITIALIZING TEST ENVIRONMENT ===
Business ID: 1, User ID: 1
Locations: { mainWarehouse: 1, mainStore: 2, bambang: 3, tuguegarao: 4 }
Products: { drawer: { id: 123, variationId: 456 }, ssd: { id: 789, variationId: 101 } }
Supplier ID: 5
=== TEST ENVIRONMENT READY ===

=== PHASE 1: PURCHASE ENTRY ===
Generated serial numbers: [ 'DRAWER-TEST-1729587234-1', ... ]
✓ Purchase created: ID 1001

=== PHASE 2: GRN/RECEIPT APPROVAL ===
Stock before GRN: [ ... ]
✓ GRN created: ID 2001
✓ GRN approved
✓ Inventory increased: { drawer: 10, ssd: 20 }
✓ 10 serial numbers in stock

=== PHASE 3: SUPPLIER RETURN (CRITICAL ACCOUNTING FIX) ===
Stock before supplier return: { drawer: 10, ssd: 20 }
Accounts Payable before return: { entries: 1, totalBalance: 80000 }
Serials to return: [ 'DRAWER-TEST-1729587234-1', 'DRAWER-TEST-1729587234-2' ]
✓ Supplier return created: ID 3001, Number SR-202510-0001
Return amount: ₱14500.00
✓ Supplier return approved
Accounting details: { inventoryReduced: true, accountsPayableReduced: true, amountCredited: '14500.00' }
Stock after supplier return: { drawer: 8, ssd: 17 }
✓ VERIFIED: Inventory reduced correctly
Accounts Payable after return: { entries: 1, totalBalance: 65500 }
AP Reduction: ₱14500.00
✓ VERIFIED: Accounts Payable reduced
Payment record: { id: 4001, number: 'PAY-202510-0001', amount: 14500, method: 'supplier_return_credit', reference: 'SR-202510-0001' }
✓ VERIFIED: Payment record created with supplier_return_credit method
✓ VERIFIED: Serial numbers marked as supplier_return
✓ VERIFIED: 2 stock transactions created

✓✓✓ SUPPLIER RETURN CRITICAL FIX VALIDATED ✓✓✓
   - Inventory reduced correctly
   - Accounts Payable reduced correctly
   - Payment record created with supplier_return_credit
   - Serial numbers updated correctly
   - Balance sheet remains balanced

=== PHASE 4: STOCK TRANSFERS TO LOCATIONS ===
Main Warehouse stock before transfers: { drawer: 8, ssd: 17 }
Available serials for transfer: 6

Transferring to Main Store...
✓ Transfer created: ID 5001
✓ Transfer to Main Store completed
...

=== PHASE 5: RETURN TRANSFERS TO MAIN WAREHOUSE ===
...

=== PHASE 6: SALES TRANSACTION ===
Main Store stock before sale: [ ... ]
✓ Sale created: ID 6001
✓ Serial DRAWER-TEST-1729587234-3 marked as sold

=== FINAL VERIFICATION ===

=== FINAL STOCK LEVELS ===
2 DOOR DRAWER - Main Warehouse: 5
2 DOOR DRAWER - Main Store: 0
2 DOOR DRAWER - Bambang: 1
2 DOOR DRAWER - Tuguegarao: 1
ADATA 512GB SSD - Main Warehouse: 5
ADATA 512GB SSD - Main Store: 2
ADATA 512GB SSD - Bambang: 4
ADATA 512GB SSD - Tuguegarao: 4

=== ACCOUNTS PAYABLE (FINAL) ===
Total AP Balance: ₱65500.00

=== SUPPLIER RETURN CREDIT PAYMENTS ===
Payment PAY-202510-0001: ₱14500.00 (SR-202510-0001)

=== SERIAL NUMBER STATUS ===
supplier_return: 2
sold: 1
in_stock: 7

✓✓✓ COMPREHENSIVE WORKFLOW TEST COMPLETED ✓✓✓
All phases executed successfully:
  ✓ Purchase Entry
  ✓ GRN/Receipt Approval
  ✓ Supplier Return (with AP reduction and payment creation)
  ✓ Stock Transfers to 3 Locations
  ✓ Return Transfers to Main Warehouse
  ✓ Sales Transaction
  ✓ Final Stock and Accounting Verification
```

### Screenshots

Screenshots are automatically saved to `test-results/` directory:
- `supplier-return-workflow-01-logged-in.png`
- etc.

### HTML Report

After test completion, view the HTML report:

```bash
npx playwright show-report
```

## Cleanup

The test automatically cleans up all created data in the `afterAll` hook:
- Sales records and items
- Stock transfers and items
- Supplier returns and items
- Purchase receipts and items
- Purchases and items
- Serial numbers and movements
- Payment records
- Stock transactions

## Troubleshooting

### Test Fails at Phase 1 (Purchase Entry)

**Possible Causes:**
- Products not found in database
- Supplier not accessible
- API route errors

**Solutions:**
- Verify products exist: `2 DOOR DRAWER WITH LOCK 4 ADJUSTABLE SHELVES` and `ADATA 512GB 2.5 SSD`
- Check API logs for errors
- Ensure `enableProductInfo = true` for Drawer product (serial tracking)

### Test Fails at Phase 2 (GRN Approval)

**Possible Causes:**
- Purchase not created correctly
- Stock operation errors

**Solutions:**
- Check purchase exists in database
- Review GRN approval API logs
- Verify stock operation implementation

### Test Fails at Phase 3 (Supplier Return) - CRITICAL

**Possible Causes:**
- Accounts Payable not reducing
- Payment record not created
- Stock not reducing

**Solutions:**
- Verify `/api/supplier-returns/[id]/approve` route contains accounting logic
- Check for transaction errors in logs
- Ensure `processSupplierReturn` function is working
- Verify Payment model and creation logic

### Test Fails at Phase 4/5 (Transfers)

**Possible Causes:**
- Transfer workflow mode issues
- Serial numbers not available
- Location permissions

**Solutions:**
- Check `transferWorkflowMode` setting in Business table
- Verify serials are in_stock at source location
- Review transfer API logs

### Test Fails at Phase 6 (Sales)

**Possible Causes:**
- Insufficient stock at Main Store
- Serial not available
- Sales API errors

**Solutions:**
- Verify previous transfers completed successfully
- Check serial availability at Main Store
- Review sales API logs

### General Debugging

1. **Run in headed mode** to see browser actions:
   ```bash
   npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts --headed --debug
   ```

2. **Check database state** during test:
   - Pause test at specific point
   - Use Prisma Studio: `npm run db:studio`
   - Query database directly

3. **Enable verbose logging**:
   ```bash
   DEBUG=pw:api,pw:browser npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts
   ```

4. **Check screenshots** in `test-results/` directory

5. **Review API responses** in console output

## Success Criteria

The test is successful when:

1. ✓ All 7 test phases pass
2. ✓ No assertion failures
3. ✓ Final stock levels match expected values (±1 unit tolerance for transfers)
4. ✓ **Accounts Payable reduced by ₱14,500**
5. ✓ **Payment record created with supplier_return_credit method**
6. ✓ Serial numbers correctly distributed across statuses
7. ✓ All created data cleaned up

## Critical Validation Points

### Supplier Return Accounting Fix

The most critical validation in this test is Phase 3, which ensures:

1. **Inventory Reduction:** Stock decreases when supplier return is approved
2. **Accounts Payable Reduction:** AP balance decreases by return amount
3. **Payment Record Creation:** Payment record created with:
   - Method: `supplier_return_credit`
   - Status: `completed`
   - Amount: Equal to return total
   - Reference: Return number
4. **Balance Sheet Integrity:** Total amount matches item sum
5. **Serial Number Updates:** Serials marked as `supplier_return` status

**Why This Matters:**

Before the fix, supplier returns would reduce inventory but NOT reduce Accounts Payable or create payment records. This caused:
- Inflated AP balances
- Missing audit trail
- Accounting imbalance
- Incorrect financial reporting

This test ensures the fix is working correctly and prevents regression.

## Integration with CI/CD

To run this test in CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run db:push
      - run: npm run db:seed
      - run: npm run dev &
      - run: npx wait-on http://localhost:3000
      - run: npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Maintenance

### When to Update This Test

Update this test when:
- Adding new supplier return features
- Changing accounting logic for AP reduction
- Modifying stock transfer workflows
- Updating serial number tracking
- Changing payment record creation

### Test Data Dependencies

This test depends on:
- Existing products in database
- Seeded locations
- Superadmin user
- Active supplier (GRAND TECH)

If database schema changes, update the test accordingly.

## Related Documentation

- [PURCHASE_RETURNS_WORKFLOW_GUIDE.md](./PURCHASE_RETURNS_WORKFLOW_GUIDE.md)
- [SUPPLIER_RETURN_PERMISSIONS_FIX_SUMMARY.md](./SUPPLIER_RETURN_PERMISSIONS_FIX_SUMMARY.md)
- [Playwright Documentation](https://playwright.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)

## Support

If you encounter issues with this test:

1. Check this guide's troubleshooting section
2. Review console output and screenshots
3. Verify database state with Prisma Studio
4. Check API logs for errors
5. Run test in debug mode

---

**Last Updated:** 2025-10-22

**Test Version:** 1.0

**Critical Fix Validated:** Supplier Return Accounting (AP Reduction + Payment Creation)
