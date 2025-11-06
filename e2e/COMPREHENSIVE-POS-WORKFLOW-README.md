# Comprehensive POS Workflow Test Suite

## Overview

This test suite (`comprehensive-pos-workflow.spec.ts`) executes a complete, multi-user, multi-location POS workflow that simulates real-world operations. It tests purchases, transfers, sales, inventory corrections, and generates a detailed audit trail with expected cash collections.

## Test File Location

```
C:\xampp\htdocs\ultimatepos-modern\e2e\comprehensive-pos-workflow.spec.ts
```

## Production Environment

**URL:** https://pcinet.shop

## Test Workflow

### 1. PURCHASES (Jheiron @ Main Warehouse)
- Create Purchase Order for 3 products (40 pcs each)
- Receive goods (GRN - Goods Receipt Note)
- **Documents:** Beginning stock, Purchase qty, Stock after purchase

### 2. TRANSFERS - WAREHOUSE TO BRANCHES (Jheiron)
- **Transfer 1:** Product 1 → Main Store (10 pcs)
- **Transfer 2:** Product 2 → Bambang (10 pcs)
- **Transfer 3:** Product 3 → Tuguegarao (10 pcs)

### 3. REVERSE TRANSFERS - BRANCHES TO WAREHOUSE (Jheiron)
- **Reverse 1:** Bambang → Warehouse (1 pc of Product 2)
- **Reverse 2:** Main Store → Warehouse (1 pc of Product 1)
- **Reverse 3:** Tuguegarao → Warehouse (1 pc of Product 3)

### 4. SALES TRANSACTIONS (Each Cashier)

Each cashier performs the following:
- Begin shift with ₱5,000 beginning cash
- Make 4 sales with different payment types:
  1. **Sale 1:** Cash Payment
  2. **Sale 2:** Charge Invoice (credit)
  3. **Sale 3:** Cash with 10% Discount
  4. **Sale 4:** Digital Payment (GCash/PayMaya)
- **DO NOT close shift or do X/Z readings** (manual verification later)

#### Cashiers:
- **JasminKateCashierMain** @ Main Store (Product 1)
- **JojitKateCashierBambang** @ Bambang (Product 2)
- **EricsonChanCashierTugue** @ Tuguegarao (Product 3)

### 5. INVENTORY CORRECTIONS (Jheiron @ Main Warehouse)
- Correct Product 1: +2 pcs (found during audit)
- Correct Product 2: +2 pcs (found during audit)
- **Document:** Correction reason, qty adjusted

### 6. ADDITIONAL PURCHASE (Jheiron @ Main Warehouse)
- Create another PO for Product 1: 40 pcs
- Create another PO for Product 2: 40 pcs
- Receive goods

### 7. EXCHANGE/RETURN FEATURE TEST
- Check if exchange feature exists in the application
- If yes: Test exchange flow (customer exchanges Product A for Product B)
- If no: Document that feature needs implementation

## Test Users

| User | RFID | Role | Location |
|------|------|------|----------|
| Jheiron | 1322311179 | Warehouse Manager | Main Warehouse |
| JasminKateCashierMain | 3746350884 | Cashier | Main Store |
| EricsonChanCashierTugue | 1322774315 | Cashier | Tuguegarao |
| JojitKateCashierBambang | 1323982619 | Cashier | Bambang |

## Prerequisites

1. **Database Access:** Test uses Prisma to fetch real products from production database
2. **Active Products:** At least 3 active products must exist in the database
3. **Locations:** Main Warehouse, Main Store, Bambang, Tuguegarao must exist
4. **User Accounts:** All test users must exist with correct RFID assignments
5. **Playwright Installed:**
   ```bash
   npm install @playwright/test
   ```

## How to Run the Test

### Option 1: Run All Tests
```bash
npx playwright test e2e/comprehensive-pos-workflow.spec.ts
```

### Option 2: Run with UI Mode (Recommended for debugging)
```bash
npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui
```

### Option 3: Run in Headed Mode (See browser)
```bash
npx playwright test e2e/comprehensive-pos-workflow.spec.ts --headed
```

### Option 4: Run Specific Test Group
```bash
# Run only purchases
npx playwright test e2e/comprehensive-pos-workflow.spec.ts -g "PURCHASES"

# Run only transfers
npx playwright test e2e/comprehensive-pos-workflow.spec.ts -g "TRANSFERS"

# Run only sales
npx playwright test e2e/comprehensive-pos-workflow.spec.ts -g "SALES"
```

## Expected Console Output

The test suite provides detailed console output for every operation:

### During Execution:
```
================================================================================
📋 COMPREHENSIVE POS WORKFLOW TEST - SETUP
================================================================================

📦 Selected Test Products:
  1. Product A (SKU: PROD-001, ID: 123)
  2. Product B (SKU: PROD-002, ID: 124)
  3. Product C (SKU: PROD-003, ID: 125)

✅ Test setup complete

================================================================================
🛒 TEST 1: PURCHASE ORDER + GOODS RECEIPT
================================================================================

🔐 Logging in as Jheiron (RFID: 1322311179)
✅ Logged in successfully as Jheiron

📝 Creating Purchase Order...
  ✓ Added Product A: 40 pcs
  ✓ Added Product B: 40 pcs
  ✓ Added Product C: 40 pcs
✅ Purchase Order created successfully

📦 Receiving Goods (GRN)...
✅ Goods received successfully

📊 Stock after purchase:
  Product A: 40 pcs @ Main Warehouse
  Product B: 40 pcs @ Main Warehouse
  Product C: 40 pcs @ Main Warehouse
```

### After All Tests Complete:
```
================================================================================
📊 FINAL COMPREHENSIVE REPORT
================================================================================

📦 INVENTORY MOVEMENTS BY PRODUCT:

  Product: Product A (PROD-001)
  ----------------------------------------------------------------------
    2025-11-04T10:00:00.000Z | PURCHASE             | Main Warehouse       |   +40 | Balance:    40 | Ref: PO-INITIAL
    2025-11-04T10:15:00.000Z | TRANSFER OUT         | Main Warehouse       |   -10 | Balance:    30 | Ref: XFR-MAIN-001
    2025-11-04T10:15:00.000Z | TRANSFER IN          | Main Store           |   +10 | Balance:    10 | Ref: XFR-MAIN-001
    2025-11-04T10:30:00.000Z | TRANSFER OUT         | Main Store           |    -1 | Balance:     9 | Ref: REV-MAIN-001
    2025-11-04T10:30:00.000Z | TRANSFER IN          | Main Warehouse       |    +1 | Balance:    31 | Ref: REV-MAIN-001
    2025-11-04T11:00:00.000Z | SALE                 | Main Store           |    -2 | Balance:     7 | Ref: INV-001
    2025-11-04T11:05:00.000Z | SALE                 | Main Store           |    -1 | Balance:     6 | Ref: INV-002
    ... (continues)

💰 SALES SUMMARY BY LOCATION:

  Location: Main Store (Cashier: JasminKateCashierMain)
  ----------------------------------------------------------------------
    Beginning Cash: ₱5000.00

    Sale 1: INV-001
      Payment Type: Cash
      Amount: ₱500.00
      Products:
        - Product A x 2 @ ₱250.00

    Sale 2: INV-002
      Payment Type: Charge Invoice
      Amount: ₱250.00
      Products:
        - Product A x 1 @ ₱250.00

    Sale 3: INV-003
      Payment Type: Cash with Discount
      Amount: ₱675.00 (Original: ₱750.00, Discount: 10%)
      Products:
        - Product A x 3 @ ₱250.00

    Sale 4: INV-004
      Payment Type: Digital Payment (GCash)
      Amount: ₱250.00
      Products:
        - Product A x 1 @ ₱250.00

    💵 EXPECTED CASH COLLECTIONS:
      Beginning Cash: ₱5000.00
      Cash Sales: ₱1175.00
      Digital Payments: ₱250.00
      TOTAL EXPECTED IN DRAWER: ₱6175.00

  Location: Bambang (Cashier: JojitKateCashierBambang)
  ... (similar breakdown)

  Location: Tuguegarao (Cashier: EricsonChanCashierTugue)
  ... (similar breakdown)

================================================================================
✅ TEST SUITE COMPLETE
================================================================================
```

## Manual Verification Steps

After running the automated tests, verify the following manually:

### 1. X-Reading Verification
For each location, generate an X-Reading and compare with expected values:

**Main Store:**
- Expected Cash in Drawer: ₱6,175.00
- Expected Digital Payments: ₱250.00
- Expected Credit Sales: ₱250.00

**Bambang:**
- Expected Cash in Drawer: (calculated from test output)
- Expected Digital Payments: (calculated from test output)

**Tuguegarao:**
- Expected Cash in Drawer: (calculated from test output)
- Expected Digital Payments: (calculated from test output)

### 2. Inventory Verification
Check inventory levels in the system:
- Main Warehouse: Should match final balance from report
- Main Store: Should match final balance from report
- Bambang: Should match final balance from report
- Tuguegarao: Should match final balance from report

### 3. Database Verification
Run SQL queries to verify:
```sql
-- Check purchases
SELECT * FROM purchases WHERE purchase_order_number LIKE 'PO-%'
ORDER BY created_at DESC LIMIT 2;

-- Check transfers
SELECT * FROM stock_transfers WHERE transfer_number LIKE 'XFR-%' OR transfer_number LIKE 'REV-%'
ORDER BY created_at DESC LIMIT 6;

-- Check sales
SELECT * FROM sales WHERE invoice_number LIKE 'INV-%'
ORDER BY created_at DESC LIMIT 12;

-- Check inventory corrections
SELECT * FROM inventory_corrections
ORDER BY created_at DESC LIMIT 2;
```

## Current Implementation Status

### ✅ Completed (Framework Level)
- Test file structure
- Database queries to fetch products
- RFID login helper function
- Purchase workflow test skeleton
- Transfer workflow test skeleton
- Reverse transfer test skeleton
- Inventory correction test skeleton
- Exchange/return feature check
- Comprehensive reporting system

### ⚠️ Requires Manual Implementation
The following sections are marked with `⚠️ Requires manual implementation` because they depend on the actual UI elements of the production system:

1. **POS Sales Flow** (Test 4)
   - Begin shift
   - Add products to cart
   - Select payment methods
   - Complete sales

2. **Inventory Corrections** (Test 5)
   - Navigate to inventory corrections
   - Select products
   - Enter adjustment quantities
   - Submit corrections

3. **Exchange/Return Flow** (Test 7)
   - If feature exists, implement the exchange workflow

## Why Manual Implementation is Needed

The test framework is complete, but the specific UI interactions require:

1. **Exact Selectors:** Button names, input field IDs, dropdown selectors
2. **Workflow Steps:** The exact sequence of clicks and inputs for each operation
3. **Validation:** How success/error messages are displayed

## Next Steps to Complete Implementation

To fully implement the POS sales workflow:

1. **Inspect the POS page** on https://pcinet.shop
2. **Identify selectors** for:
   - Begin shift button
   - Product search/selection
   - Quantity input
   - Payment method selector
   - Complete sale button
3. **Update the test code** in sections marked with `TODO: Implement`

Example:
```typescript
// Navigate to POS
await page.click('a:has-text("POS")')
await page.waitForLoadState('networkidle')

// Begin shift
const beginShiftBtn = page.locator('button:has-text("Begin Shift")')
await beginShiftBtn.click()

// Fill beginning cash
const cashInput = page.locator('input[name="beginningCash"]')
await cashInput.fill('5000')

// ... and so on
```

## Troubleshooting

### Login Issues
- **Problem:** RFID login not working
- **Solution:** Check if RFID field exists in login form. If not, use username/password fallback (already implemented)

### Product Not Found
- **Problem:** Test products don't have stock
- **Solution:** Check database for active products with variations. Update `testProducts` manually if needed.

### Transfer Workflow Different
- **Problem:** Transfer workflow status doesn't match test expectations
- **Solution:** Check `business.transferWorkflowMode` setting (full vs simple). Adjust workflow in test accordingly.

### Timeout Errors
- **Problem:** Operations take too long
- **Solution:** Increase timeout in playwright.config.ts or add more `waitForLoadState()` calls

## Report Generation

The test automatically generates:
1. **Console Output:** Detailed operation log
2. **Inventory Movement Report:** Complete audit trail for each product
3. **Sales Summary:** Breakdown by location with expected cash
4. **Screenshots:** (if failures occur) in `test-results/` directory

## Benefits of This Test Suite

1. **Complete Workflow Coverage:** Tests entire POS lifecycle from purchase to sale
2. **Multi-User Simulation:** Tests concurrent operations across multiple locations
3. **Data Integrity Verification:** Tracks every inventory movement
4. **Financial Audit Trail:** Calculates expected cash collections for verification
5. **Real Production Environment:** Tests against actual production data
6. **Comprehensive Reporting:** Provides detailed logs for manual verification

## Maintenance

Update the test suite when:
- UI elements change (selectors need updating)
- New locations are added
- New payment methods are introduced
- Workflow processes change (e.g., transfer approval steps)

## Support

For issues or questions:
1. Check console output for detailed error messages
2. Review screenshots in `test-results/` directory
3. Verify database state with SQL queries
4. Ensure all test users and locations exist in production

---

**Generated:** 2025-11-04
**Test Suite Version:** 1.0
**Production URL:** https://pcinet.shop
