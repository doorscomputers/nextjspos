# 🤖 Automated Multi-Location Transfer Test

## 📄 File Created
`e2e/automated-multi-transfer-workflow.spec.ts`

---

## 🎯 What This Test Does

This Playwright test **automatically** performs a complete transfer workflow using browser automation:

### ✅ Automated Actions:

1. **Login as `warehouse_clerk`**
   - Creates Transfer 1: Main Warehouse → Main Store (Product 1, 5 units)
   - Creates Transfer 2: Main Warehouse → Bambang (Product 2, 3 units)

2. **Login as `warehouse_supervisor`**
   - Approves Transfer 1
   - Approves Transfer 2

3. **Login as `warehouse_manager`**
   - Sends Transfer 1 (Stock -5 from Main Warehouse)
   - Sends Transfer 2 (Stock -3 from Main Warehouse)
   - **Verifies stock was deducted**

4. **Login as `mainstore_receiver`**
   - Receives Transfer 1 at Main Store
   - **Verifies stock was added (+5)**

5. **Login as `bambang_receiver`**
   - Receives Transfer 2 at Bambang
   - **Verifies stock was added (+3)**

6. **Final Verification**
   - Checks all inventory movements are correct
   - Displays summary report

---

## 🚀 How to Run

### Option 1: Run in Headed Mode (See the Browser)
```bash
npx playwright test automated-multi-transfer-workflow --headed
```

### Option 2: Run in Headless Mode (Background)
```bash
npx playwright test automated-multi-transfer-workflow
```

### Option 3: Run with UI Mode (Interactive)
```bash
npx playwright test automated-multi-transfer-workflow --ui
```

### Option 4: Debug Mode (Step by Step)
```bash
npx playwright test automated-multi-transfer-workflow --debug
```

---

## ✅ Prerequisites

**Before running, make sure:**
1. ✅ Development server is running: `npm run dev`
2. ✅ Database is seeded with users: `npm run db:seed`
3. ✅ You have the following users in database:
   - `warehouse_clerk`
   - `warehouse_supervisor`
   - `warehouse_manager`
   - `mainstore_receiver`
   - `bambang_receiver`
4. ✅ You have at least 3 locations:
   - Main Warehouse
   - Main Store
   - Bambang
5. ✅ You have at least 2 products with stock at Main Warehouse

---

## 📊 Expected Output

When the test runs successfully, you'll see:

```
🚀 STARTING AUTOMATED TRANSFER WORKFLOW TEST
================================================================================

📝 STEP 1: CREATE TRANSFERS
--------------------------------------------------------------------------------
🔑 Logging in as: warehouse_clerk
✅ Logged in as warehouse_clerk
📋 Creating Transfer 1: Main Warehouse → Main Store
  ✓ Selected destination: Main Store
  ✓ Added product: 5 units
✅ Transfer 1 created: ID 123
📋 Creating Transfer 2: Main Warehouse → Bambang
  ✓ Selected destination: Bambang
  ✓ Added product: 3 units
✅ Transfer 2 created: ID 124
🚪 Logging out...

✅ STEP 2: APPROVE TRANSFERS
--------------------------------------------------------------------------------
🔑 Logging in as: warehouse_supervisor
✅ Logged in as warehouse_supervisor
🔍 Approving Transfer 1 (ID: 123)
✅ Transfer 1 approved
🔍 Approving Transfer 2 (ID: 124)
✅ Transfer 2 approved
🚪 Logging out...

🚚 STEP 3: SEND TRANSFERS (Stock Deducted)
--------------------------------------------------------------------------------
🔑 Logging in as: warehouse_manager
📊 Main Warehouse stock BEFORE sending:
   Product 1: 100 units
   Product 2: 50 units
📤 Sending Transfer 1 (ID: 123)
✅ Transfer 1 sent - Stock deducted from Main Warehouse
📤 Sending Transfer 2 (ID: 124)
✅ Transfer 2 sent - Stock deducted from Main Warehouse
📊 Main Warehouse stock AFTER sending:
   Product 1: 95 units (expected: 95)
   Product 2: 47 units (expected: 47)
🚪 Logging out...

📥 STEP 4: RECEIVE TRANSFER AT MAIN STORE
--------------------------------------------------------------------------------
🔑 Logging in as: mainstore_receiver
📊 Main Store stock BEFORE receiving: 20 units
📦 Receiving Transfer 1 at Main Store (ID: 123)
✅ Transfer 1 received at Main Store
📊 Main Store stock AFTER receiving: 25 units (expected: 25)
🚪 Logging out...

📥 STEP 5: RECEIVE TRANSFER AT BAMBANG
--------------------------------------------------------------------------------
🔑 Logging in as: bambang_receiver
📊 Bambang stock BEFORE receiving: 10 units
📦 Receiving Transfer 2 at Bambang (ID: 124)
✅ Transfer 2 received at Bambang
📊 Bambang stock AFTER receiving: 13 units (expected: 13)
🚪 Logging out...

================================================================================
✅ AUTOMATED TRANSFER WORKFLOW TEST COMPLETE!
================================================================================

📊 FINAL INVENTORY SUMMARY:
   Main Warehouse Product 1: 100 → 95 (-5) ✅
   Main Warehouse Product 2: 50 → 47 (-3) ✅
   Main Store Product 1: 20 → 25 (+5) ✅
   Bambang Product 2: 10 → 13 (+3) ✅

✨ All transfers completed successfully!
✨ All inventory movements verified!
✨ Multi-user workflow tested!
================================================================================
```

---

## 🔧 Troubleshooting

### Error: "Need at least 3 locations"
**Solution:** Run `npm run db:seed` to seed the database

### Error: "Need at least 2 products"
**Solution:** Run `npm run db:seed` to seed the database

### Error: "Login failed" or "Button not found"
**Possible causes:**
- Dev server not running (`npm run dev`)
- UI elements changed (selectors need updating)
- Timeouts too short (slow computer)

**Solutions:**
- Make sure dev server is running on port 3009 or update `BASE_URL` in the test file
- Increase timeouts if needed
- Run in `--headed` mode to see what's happening

### Error: Stock verification failed
**Possible causes:**
- Database has unexpected stock levels
- Transfers were not completed properly
- Race condition (pages loading too fast)

**Solutions:**
- Reset database: `npm run db:seed`
- Check test output to see which step failed
- Add more wait time if needed

---

## 🎯 Benefits of This Test

✅ **Saves Time:** Automates 20+ minutes of manual testing
✅ **Reliable:** Tests the exact same workflow every time
✅ **Comprehensive:** Tests all 5 user roles in one run
✅ **Verifies Data:** Checks inventory accuracy at each step
✅ **Catches Bugs:** Finds issues before users do
✅ **Repeatable:** Run anytime after code changes
✅ **Documentation:** Shows exactly how the workflow should work

---

## 📝 Customization

### Change Products or Quantities
Edit these lines in the test:
```typescript
await quantityInput1.fill('5')  // Change to any quantity
await quantityInput2.fill('3')  // Change to any quantity
```

### Add More Transfers
Copy the transfer creation block and add more:
```typescript
// Transfer 3
await page.goto(`${BASE_URL}/dashboard/transfers/create`)
// ... create transfer 3
```

### Test Different Locations
Change the location IDs:
```typescript
await toLocationSelect1.selectOption({ value: bambangId.toString() })
```

---

## 🔍 What Gets Tested

✅ **User Authentication:** 5 different users login successfully
✅ **RBAC Permissions:** Each user can only do their assigned actions
✅ **Transfer Creation:** UI correctly creates transfers
✅ **Transfer Approval:** Approval workflow works
✅ **Stock Deduction:** Stock deducted at send
✅ **Stock Addition:** Stock added at receive
✅ **Multi-Location:** Transfers to different locations
✅ **Data Integrity:** Inventory numbers match expectations
✅ **Audit Trail:** All actions recorded (implicit)

---

## 🎉 Success Criteria

Test passes if:
- ✅ All 5 users can login
- ✅ Both transfers are created
- ✅ Both transfers are approved
- ✅ Both transfers are sent
- ✅ Stock is deducted from Main Warehouse (-5, -3)
- ✅ Transfer 1 is received at Main Store (+5)
- ✅ Transfer 2 is received at Bambang (+3)
- ✅ Final inventory matches expectations
- ✅ No errors or exceptions

---

## 💡 Tips

**Run in UI Mode for debugging:**
```bash
npx playwright test automated-multi-transfer-workflow --ui
```
This gives you a nice visual interface to see each step!

**Generate HTML Report:**
```bash
npx playwright test automated-multi-transfer-workflow
npx playwright show-report
```

**Take Screenshots on Failure:**
The test automatically takes screenshots if it fails!

**Video Recording:**
Playwright can record video - check `playwright.config.ts` to enable.

---

## 🚀 Next Steps

1. **Run the test** to see it in action
2. **Review the output** to understand the workflow
3. **Modify as needed** for your specific requirements
4. **Integrate into CI/CD** to run automatically
5. **Add more scenarios** (e.g., rejection, discrepancies)

---

**Status:** ✅ Ready to use!
**Created:** October 20, 2025
**Test File:** `e2e/automated-multi-transfer-workflow.spec.ts`
**Password for all users:** `password`
