# 🎭 Playwright UI Implementation Plan

## ⚠️ STATUS: AWAITING APPROVAL

**This document outlines the UI interactions that will be implemented in Playwright E2E tests.**

**NO CODE HAS BEEN MODIFIED YET** - Waiting for your approval before proceeding.

---

## 📋 Overview

Currently, the Playwright tests only:
- ✅ Connect to database
- ✅ Query data
- ❌ **DO NOT** interact with the UI
- ❌ **DO NOT** create actual transactions

**This plan will implement:**
- 🎯 Full UI interactions using Playwright
- 🎯 Real transaction workflows
- 🎯 Actual data manipulation
- 🎯 End-to-end business flows

---

## 🎯 Test Products

The tests will use 3 products created by `scripts/create-test-products.ts`:

| Product | SKU | Cost | Price | Initial Stock |
|---------|-----|------|-------|---------------|
| Test Product A - Computer Mouse | TEST-PROD-A-001 | ₱150 | ₱250 | 40 @ Warehouse |
| Test Product B - USB Cable | TEST-PROD-B-002 | ₱50 | ₱100 | 40 @ Warehouse |
| Test Product C - HDMI Adapter | TEST-PROD-C-003 | ₱200 | ₱350 | 40 @ Warehouse |

---

## 📊 Complete Test Flow

### Test Execution Order:

```
1. Setup (Login as Jheiron @ Warehouse)
   ↓
2. Purchase Order Creation (3 products, 40 units each)
   ↓
3. Goods Receipt (Receive the PO)
   ↓
4. Inventory Corrections (Adjust 2 products)
   ↓
5. Stock Transfers (Warehouse → Branches)
   ↓
6. Sales at Multiple Locations
   ↓
7. Customer Returns
   ↓
8. Supplier Returns
   ↓
9. Reverse Transfers (Branches → Warehouse)
   ↓
10. Cash Reconciliation & Reports
```

---

## 🔐 Test 1: Login & Authentication

### Jheiron (Warehouse Manager)

```typescript
test('Login as Jheiron at Main Warehouse', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3000/login')

  // Fill username
  await page.locator('input[name="username"]').fill('Jheiron')

  // Fill password
  await page.locator('input[name="password"]').fill('password')

  // Fill RFID (Main Warehouse)
  await page.locator('input[placeholder*="RFID"]').fill('1322311179')

  // Click login button
  await page.locator('button:has-text("LOGIN")').click()

  // Wait for dashboard
  await page.waitForURL('**/dashboard')

  // Verify logged in
  await expect(page.locator('text=Main Warehouse')).toBeVisible()
})
```

### JasminKateCashierMain (Main Store)

```typescript
// RFID: 3746350884
// Location: Main Store
```

### JojitKateCashierBambang (Bambang)

```typescript
// RFID: 1323982619
// Location: Bambang
```

### EricsonChanCashierTugue (Tuguegarao)

```typescript
// RFID: 1322774315
// Location: Tuguegarao
```

---

## 💰 Test 2: Purchase Order Creation

### Step-by-Step UI Flow

```typescript
test('Create Purchase Order for 3 Test Products', async ({ page }) => {
  // 1. Navigate to Purchases → Purchase Orders
  await page.goto('http://localhost:3000/dashboard/purchases')
  await page.locator('button:has-text("New Purchase")').click()

  // 2. Select Supplier
  await page.locator('input[placeholder*="supplier"]').click()
  await page.locator('text=Test Supplier').click() // Or first supplier

  // 3. Set Purchase Date
  await page.locator('input[type="date"]').fill('2025-11-04')

  // 4. Add Product A
  await page.locator('button:has-text("Add Product")').click()
  await page.locator('input[placeholder*="Search product"]').fill('Test Product A')
  await page.locator('text=Test Product A - Computer Mouse').click()

  // Set quantity
  await page.locator('input[name="quantity"]').fill('40')

  // Set unit cost
  await page.locator('input[name="unitCost"]').fill('150')

  // Click Add
  await page.locator('button:has-text("Add")').click()

  // 5. Add Product B (repeat process)
  // Quantity: 40, Cost: 50

  // 6. Add Product C (repeat process)
  // Quantity: 40, Cost: 200

  // 7. Verify Totals
  await expect(page.locator('text=Total Amount')).toContainText('₱16,000')
  // (40*150) + (40*50) + (40*200) = 6,000 + 2,000 + 8,000 = 16,000

  // 8. Save Purchase Order
  await page.locator('button:has-text("Save")').click()

  // 9. Wait for success message
  await expect(page.locator('text=Purchase order created successfully')).toBeVisible()

  // 10. Capture PO Reference Number
  const poNumber = await page.locator('[data-testid="po-reference"]').textContent()

  return poNumber // Use for goods receipt
})
```

**UI Selectors Needed:**
- `button:has-text("New Purchase")`
- `input[placeholder*="supplier"]`
- `input[type="date"]`
- `button:has-text("Add Product")`
- `input[placeholder*="Search product"]`
- `input[name="quantity"]`
- `input[name="unitCost"]`
- `button:has-text("Save")`

**Expected Outcome:**
- ✅ PO created with status "Pending"
- ✅ Total: ₱16,000
- ✅ 3 line items (120 units total)
- ❌ Inventory NOT updated yet (pending receipt)

---

## 📦 Test 3: Goods Receipt

### UI Flow

```typescript
test('Receive Goods from Purchase Order', async ({ page, poNumber }) => {
  // 1. Navigate to Purchases → Goods Receipt
  await page.goto('http://localhost:3000/dashboard/purchases/receipts')

  // 2. Find the PO
  await page.locator(`text=${poNumber}`).click()

  // 3. Click "Receive Goods"
  await page.locator('button:has-text("Receive")').click()

  // 4. Verify all items listed
  await expect(page.locator('text=Test Product A')).toBeVisible()
  await expect(page.locator('text=Test Product B')).toBeVisible()
  await expect(page.locator('text=Test Product C')).toBeVisible()

  // 5. Confirm quantities are correct (auto-filled)
  // Product A: 40
  // Product B: 40
  // Product C: 40

  // 6. Click "Confirm Receipt"
  await page.locator('button:has-text("Confirm Receipt")').click()

  // 7. Wait for success
  await expect(page.locator('text=Goods received successfully')).toBeVisible()
})
```

**Expected Outcome:**
- ✅ PO status changed to "Received"
- ✅ Inventory updated:
  - Main Warehouse: Test Product A = 40 units
  - Main Warehouse: Test Product B = 40 units
  - Main Warehouse: Test Product C = 40 units
- ✅ Accounts Payable created: ₱16,000
- ✅ Product History entries created

---

## 📝 Test 4: Inventory Corrections

### UI Flow

```typescript
test('Apply Inventory Corrections', async ({ page }) => {
  // 1. Navigate to Inventory → Corrections
  await page.goto('http://localhost:3000/dashboard/inventory/corrections')

  // 2. Click "New Correction"
  await page.locator('button:has-text("New Correction")').click()

  // 3. Add Test Product A correction (+5 units)
  await page.locator('input[placeholder*="Search product"]').fill('Test Product A')
  await page.locator('text=Test Product A').click()

  await page.locator('select[name="adjustmentType"]').selectOption('increase')
  await page.locator('input[name="quantity"]').fill('5')
  await page.locator('textarea[name="reason"]').fill('Physical count adjustment - found in storage')

  await page.locator('button:has-text("Add")').click()

  // 4. Add Test Product B correction (-2 units)
  await page.locator('input[placeholder*="Search product"]').fill('Test Product B')
  await page.locator('text=Test Product B').click()

  await page.locator('select[name="adjustmentType"]').selectOption('decrease')
  await page.locator('input[name="quantity"]').fill('2')
  await page.locator('textarea[name="reason"]').fill('Damaged items - removed from inventory')

  await page.locator('button:has-text("Add")').click()

  // 5. Save corrections
  await page.locator('button:has-text("Save Corrections")').click()

  // 6. Confirm
  await page.locator('button:has-text("Confirm")').click()

  // 7. Verify success
  await expect(page.locator('text=Inventory corrected successfully')).toBeVisible()
})
```

**Expected Outcome:**
- ✅ Test Product A: 40 + 5 = **45 units** @ Warehouse
- ✅ Test Product B: 40 - 2 = **38 units** @ Warehouse
- ✅ Test Product C: **40 units** @ Warehouse (unchanged)
- ✅ Product History entries with reasons

---

## 🔄 Test 5: Stock Transfers (Warehouse → Branches)

### Transfer A: Warehouse → Main Store (10 units each)

```typescript
test('Transfer stock to Main Store', async ({ page }) => {
  // 1. Navigate to Inventory → Transfers
  await page.goto('http://localhost:3000/dashboard/inventory/transfers')

  // 2. Click "New Transfer"
  await page.locator('button:has-text("New Transfer")').click()

  // 3. Select From Location (should be auto-selected: Main Warehouse)
  await expect(page.locator('text=From: Main Warehouse')).toBeVisible()

  // 4. Select To Location
  await page.locator('select[name="toLocation"]').selectOption('Main Store')

  // 5. Add Test Product A (10 units)
  await page.locator('button:has-text("Add Product")').click()
  await page.locator('input[placeholder*="Search"]').fill('Test Product A')
  await page.locator('text=Test Product A').click()
  await page.locator('input[name="quantity"]').fill('10')
  await page.locator('button:has-text("Add")').click()

  // 6. Add Test Product B (10 units)
  // Repeat

  // 7. Add Test Product C (10 units)
  // Repeat

  // 8. Submit Transfer
  await page.locator('button:has-text("Submit Transfer")').click()

  // 9. Approve Transfer (if required)
  await page.locator('button:has-text("Approve")').click()

  // 10. Complete Transfer
  await page.locator('button:has-text("Send Transfer")').click()

  // 11. Verify success
  await expect(page.locator('text=Transfer completed')).toBeVisible()
})
```

### Transfer B: Warehouse → Bambang (10 units each)

**Same flow as above, change To Location to "Bambang"**

### Transfer C: Warehouse → Tuguegarao (10 units each)

**Same flow as above, change To Location to "Tuguegarao"**

**Expected Outcome After All Transfers:**

| Location | Product A | Product B | Product C |
|----------|-----------|-----------|-----------|
| Main Warehouse | 45-30=15 | 38-30=8 | 40-30=10 |
| Main Store | 10 | 10 | 10 |
| Bambang | 10 | 10 | 10 |
| Tuguegarao | 10 | 10 | 10 |

---

## 🛒 Test 6: Sales Transactions (Multi-Location)

### Sales at Main Store (JasminKateCashierMain)

```typescript
test('Process sales at Main Store', async ({ page }) => {
  // 1. Logout Jheiron, Login as JasminKateCashierMain
  await page.goto('http://localhost:3000/logout')
  await page.goto('http://localhost:3000/login')
  await page.locator('input[name="username"]').fill('JasminKateCashierMain')
  await page.locator('input[name="password"]').fill('password')
  await page.locator('input[placeholder*="RFID"]').fill('3746350884') // Main Store RFID
  await page.locator('button:has-text("LOGIN")').click()

  // 2. Open Cash Register (Beginning Cash: ₱5,000)
  await page.goto('http://localhost:3000/dashboard/pos')
  await page.locator('button:has-text("Open Register")').click()
  await page.locator('input[name="beginningCash"]').fill('5000')
  await page.locator('button:has-text("Open")').click()

  // 3. Sale 1: Test Product A (2 units) - Cash Payment
  await page.locator('input[placeholder*="Search product"]').fill('Test Product A')
  await page.locator('text=Test Product A').click()
  await page.locator('input[name="quantity"]').fill('2')
  await page.locator('button:has-text("Add to Cart")').click()

  // Verify cart
  await expect(page.locator('text=Test Product A')).toBeVisible()
  await expect(page.locator('text=₱500')).toBeVisible() // 2 * 250

  // Click Checkout
  await page.locator('button:has-text("Checkout")').click()

  // Enter payment (Cash)
  await page.locator('input[name="cashReceived"]').fill('500')
  await page.locator('button:has-text("Complete Sale")').click()

  // Verify success
  await expect(page.locator('text=Sale completed')).toBeVisible()

  // 4. Sale 2: Test Product B (3 units) - Cash with Discount
  // Process: Add to cart, apply 10% discount, cash payment
  // Total: 3 * 100 = 300, Discount: 30, Final: 270

  // 5. Sale 3: Test Product C (1 unit) - Charge Invoice (Credit)
  // Process: Add to cart, select payment method: Credit
  // Need to implement customer selection
})
```

**Sales Summary at Main Store:**
| Product | Qty Sold | Unit Price | Total |
|---------|----------|------------|-------|
| Test Product A | 2 | ₱250 | ₱500 |
| Test Product B | 3 | ₱100 | ₱300 (before discount) |
| Test Product C | 1 | ₱350 | ₱350 |

**Expected Cash Collections:**
- Cash Sale 1: ₱500
- Cash Sale 2: ₱270 (after 10% discount)
- Total Cash: ₱770
- Credit Sale: ₱350 (AR created)

---

### Sales at Bambang (JojitKateCashierBambang)

**Same flow, different cashier:**
- RFID: 1323982619
- Beginning Cash: ₱5,000
- Similar sales pattern

---

### Sales at Tuguegarao (EricsonChanCashierTugue)

**Same flow:**
- RFID: 1322774315
- Beginning Cash: ₱5,000
- Similar sales pattern

---

## 💵 Test 7: Cash Reconciliation (Z Reading)

### UI Flow

```typescript
test('Cash reconciliation at Main Store', async ({ page }) => {
  // 1. Navigate to POS → Z Reading
  await page.goto('http://localhost:3000/dashboard/pos/z-reading')

  // 2. Enter cash denominations
  await page.locator('input[name="bills1000"]').fill('5') // ₱5,000
  await page.locator('input[name="bills500"]').fill('2')  // ₱1,000
  await page.locator('input[name="bills200"]').fill('0')
  await page.locator('input[name="bills100"]').fill('5')  // ₱500
  await page.locator('input[name="bills50"]').fill('4')   // ₱200
  await page.locator('input[name="bills20"]').fill('7')   // ₱140
  // ... remaining denominations

  // 3. Verify calculations
  const physicalCash = await page.locator('[data-testid="physical-cash-total"]').textContent()
  const expectedCash = await page.locator('[data-testid="expected-cash-total"]').textContent()
  const variance = await page.locator('[data-testid="cash-variance"]').textContent()

  // 4. Generate Z Reading
  await page.locator('button:has-text("Generate Z Reading")').click()

  // 5. Print/Export
  await page.locator('button:has-text("Print")').click()

  // 6. Close Register
  await page.locator('button:has-text("Close Register")').click()
})
```

**Expected Z Reading:**
- Beginning Cash: ₱5,000
- Cash Sales: ₱770
- Cash In: ₱0
- Cash Out: ₱0
- Expected Ending Cash: ₱5,770
- Actual Cash: (from denominations)
- Variance: Actual - Expected

---

## 📋 UI Selectors Summary

### Login Page
```typescript
'input[name="username"]'
'input[name="password"]'
'input[placeholder*="RFID"]'
'button:has-text("LOGIN")'
```

### Purchase Orders
```typescript
'button:has-text("New Purchase")'
'input[placeholder*="supplier"]'
'button:has-text("Add Product")'
'input[name="quantity"]'
'input[name="unitCost"]'
'button:has-text("Save")'
```

### Goods Receipt
```typescript
'button:has-text("Receive")'
'button:has-text("Confirm Receipt")'
```

### Inventory Corrections
```typescript
'button:has-text("New Correction")'
'select[name="adjustmentType"]'
'textarea[name="reason"]'
'button:has-text("Save Corrections")'
```

### Stock Transfers
```typescript
'button:has-text("New Transfer")'
'select[name="toLocation"]'
'button:has-text("Submit Transfer")'
'button:has-text("Approve")'
'button:has-text("Send Transfer")'
```

### POS/Sales
```typescript
'button:has-text("Open Register")'
'input[name="beginningCash"]'
'input[placeholder*="Search product"]'
'button:has-text("Add to Cart")'
'button:has-text("Checkout")'
'input[name="cashReceived"]'
'button:has-text("Complete Sale")'
```

### Z Reading
```typescript
'input[name="bills1000"]'
'input[name="bills500"]'
// ... other denominations
'button:has-text("Generate Z Reading")'
'button:has-text("Close Register")'
```

---

## ✅ Implementation Checklist

Before implementing, verify:

- [ ] Test database is set up and seeded
- [ ] Test products are created (3 products, 40 units each)
- [ ] All test users exist with correct RFIDs
- [ ] All locations exist (Warehouse, Main Store, Bambang, Tuguegarao)
- [ ] Dev server is running (`npm run dev`)
- [ ] Playwright is installed (`npx playwright install`)

---

## 🚀 Implementation Plan

### Phase 1: Basic UI Interactions (1-2 hours)
- Login flows for all users
- Navigation verification
- Basic element interactions

### Phase 2: Purchase Workflow (2-3 hours)
- Purchase order creation
- Goods receipt
- Inventory verification

### Phase 3: Inventory Management (2 hours)
- Inventory corrections
- Stock transfers
- Multi-location stock tracking

### Phase 4: Sales Transactions (3-4 hours)
- POS interface interactions
- Multiple payment types
- Multi-location sales
- Cart management

### Phase 5: Financial Tracking (2-3 hours)
- Accounts Payable
- Accounts Receivable
- Cash reconciliation
- Z Reading generation

### Phase 6: Reports & Verification (1-2 hours)
- Generate financial reports
- Verify calculations
- Export test results

**Total Estimated Time: 10-15 hours**

---

## 🎯 Success Criteria

Tests will be considered successful if:

- ✅ All UI interactions work without errors
- ✅ Data is correctly saved to database
- ✅ Stock levels match expected calculations
- ✅ Financial calculations are accurate (AP, AR, cash)
- ✅ Multi-location isolation is maintained
- ✅ Test reports show zero failures
- ✅ No manual intervention required during test run

---

## ⚠️ APPROVAL REQUIRED

**Before proceeding with implementation, please confirm:**

1. ✅ Test database setup is acceptable
2. ✅ Test products (3 products, 40 units each) are sufficient
3. ✅ UI selector strategy looks correct
4. ✅ Test flow sequence makes sense
5. ✅ Estimated time (10-15 hours) is acceptable

**Reply with "Proceed with implementation" when ready!**

---

**Next Steps After Approval:**
1. Set up test database
2. Create test products
3. Implement UI interactions in Playwright tests
4. Run tests and generate reports
5. Document results

