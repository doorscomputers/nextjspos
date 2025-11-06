# Quick Start Guide - Comprehensive POS Workflow Test

## TL;DR - Run the Test

```bash
# Run all tests with UI mode (recommended)
npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui

# Or run in headed mode to see the browser
npx playwright test e2e/comprehensive-pos-workflow.spec.ts --headed

# Or run normally (headless)
npx playwright test e2e/comprehensive-pos-workflow.spec.ts
```

## What This Test Does

Tests a complete POS workflow on **https://pcinet.shop**:

1. ✅ **Purchases** - Warehouse buys 3 products (40 pcs each)
2. ✅ **Transfers** - Warehouse sends stock to 3 branches (10 pcs each)
3. ✅ **Reverse Transfers** - Branches return 1 pc each to warehouse
4. ⚠️ **Sales** - Each cashier makes 4 sales (needs manual implementation)
5. ⚠️ **Corrections** - Warehouse adjusts inventory (needs manual implementation)
6. ✅ **More Purchases** - Buy more stock
7. ✅ **Exchange Check** - Verifies if exchange feature exists

## Test Users

| User | RFID | Location |
|------|------|----------|
| Jheiron | 1322311179 | Main Warehouse |
| JasminKateCashierMain | 3746350884 | Main Store |
| EricsonChanCashierTugue | 1322774315 | Tuguegarao |
| JojitKateCashierBambang | 1323982619 | Bambang |

## Expected Output Example

```
📦 Selected Test Products:
  1. Laptop Dell XPS (SKU: PROD-001, ID: 123)
  2. Mouse Logitech (SKU: PROD-002, ID: 124)
  3. Keyboard Mechanical (SKU: PROD-003, ID: 125)

🛒 TEST 1: PURCHASE ORDER + GOODS RECEIPT
  ✓ Added Laptop Dell XPS: 40 pcs
  ✓ Added Mouse Logitech: 40 pcs
  ✓ Added Keyboard Mechanical: 40 pcs
✅ Purchase Order created successfully
✅ Goods received successfully

📊 Stock after purchase:
  Laptop Dell XPS: 40 pcs @ Main Warehouse
  Mouse Logitech: 40 pcs @ Main Warehouse
  Keyboard Mechanical: 40 pcs @ Main Warehouse

🚚 TEST 2A: TRANSFER Laptop Dell XPS to Main Store
✅ Transferred Laptop Dell XPS: 10 pcs → Main Store
📊 Stock: 30 pcs @ Warehouse, 10 pcs @ Main Store

... (continues for all operations)

💵 EXPECTED CASH COLLECTIONS:
  Main Store: ₱6,175.00 (Beginning: ₱5,000 + Sales: ₱1,175)
  Bambang: ₱6,XXX.00
  Tuguegarao: ₱6,XXX.00
```

## Sales Workflow (Needs Implementation)

Each cashier should make these 4 sales:

**Sale 1: Cash Payment**
- Product from their location
- Quantity: 2 pcs
- Payment: Cash

**Sale 2: Charge Invoice (Credit)**
- Same product
- Quantity: 1 pc
- Payment: Charge Invoice

**Sale 3: Cash with Discount**
- Same product
- Quantity: 3 pcs
- Payment: Cash
- Discount: 10%

**Sale 4: Digital Payment**
- Same product
- Quantity: 1 pc
- Payment: GCash/PayMaya/Digital

Beginning Cash: ₱5,000 for each cashier

⚠️ **DO NOT** close shift or generate Z-reading after sales!

## After Running Tests

### 1. Check Console Output
Look for:
- ✅ All green checkmarks
- ❌ Any red errors
- 📊 Final inventory report
- 💰 Expected cash collections

### 2. Manual Verification

**Generate X-Readings** at each location and compare:
- Main Store expected cash: (see console output)
- Bambang expected cash: (see console output)
- Tuguegarao expected cash: (see console output)

**Check Inventory Levels:**
- Go to Products → Stock by Location
- Verify quantities match the final report

### 3. View Test Report

```bash
npx playwright show-report
```

## What's Working vs What Needs Work

### ✅ Fully Implemented
- Login with RFID
- Purchase Order creation
- Goods Receipt (GRN)
- Stock Transfers (forward and reverse)
- Inventory tracking and reporting
- Expected cash calculations
- Comprehensive console reporting

### ⚠️ Needs Manual Implementation
These sections have placeholders but need UI-specific code:

**Sales Transactions:**
```typescript
// TODO: Implement actual POS workflow
// Navigate to POS
// Begin shift with ₱5000
// Add products to cart
// Select payment method
// Complete sale
```

**Inventory Corrections:**
```typescript
// TODO: Implement inventory correction workflow
// Navigate to corrections
// Select products
// Enter adjustment quantities
// Submit corrections
```

**Why?** These require the exact UI selectors from the production site.

## How to Complete Implementation

1. **Open the production site** (https://pcinet.shop)
2. **Login as a test user**
3. **Go to POS page** and inspect elements:
   - Right-click → Inspect
   - Find button names, IDs, classes
4. **Update the test code** with correct selectors

Example:
```typescript
// Instead of:
console.log('⚠️ SALES TEST - Requires manual implementation')

// Write:
await page.click('a[href="/dashboard/pos"]')
await page.click('button:has-text("Begin Shift")')
await page.fill('input[name="beginningCash"]', '5000')
await page.click('button[type="submit"]')
// ... etc
```

## Troubleshooting

**Test fails to login:**
- Check RFID numbers are correct
- Try username/password fallback (already implemented)

**Can't find products:**
- Check database has active products
- Look at console output for product IDs

**Transfers fail:**
- Check transfer workflow mode (full vs simple)
- Verify locations exist

**Timeouts:**
- Increase timeout in test code
- Check internet connection to pcinet.shop

## Files

- **Test:** `e2e/comprehensive-pos-workflow.spec.ts`
- **README:** `e2e/COMPREHENSIVE-POS-WORKFLOW-README.md`
- **This Guide:** `e2e/QUICK-START-GUIDE.md`

## Summary

This test suite provides:
- ✅ Complete workflow coverage
- ✅ Multi-user, multi-location testing
- ✅ Inventory audit trail
- ✅ Expected cash calculations
- ✅ Comprehensive reporting
- ⚠️ Sales & corrections need UI-specific implementation

The framework is solid. Just need to fill in the UI interaction details for POS sales and inventory corrections!
