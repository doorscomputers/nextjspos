# Inventory Ledger Test - Quick Start

## Current Status

✅ **All files created and ready:**
- `cleanup-all-transactions.js` - Data cleanup script
- `e2e/inventory-ledger-full-flow.spec.ts` - Comprehensive Playwright test
- `INVENTORY-LEDGER-TEST-GUIDE.md` - Detailed documentation
- `run-ledger-test.ps1` - Windows automation script
- `run-ledger-test.sh` - Linux/Mac automation script

✅ **Database Status:**
- Connection: Working
- Current transactions: 18 (8 sales, 5 purchases, 2 transfers, 3 corrections)
- These will be cleaned before testing

## Option 1: Automated (Recommended)

### Windows (PowerShell)
```powershell
.\run-ledger-test.ps1
```

### Linux/Mac (Bash)
```bash
chmod +x run-ledger-test.sh
./run-ledger-test.sh
```

The script will:
1. Check prerequisites
2. Run cleanup (with confirmation)
3. Execute Playwright test
4. Display results

## Option 2: Manual Step-by-Step

### Step 1: Ensure Dev Server is Running
```bash
npm run dev
```
Keep this running in a separate terminal.

### Step 2: Run Cleanup Script
```bash
node cleanup-all-transactions.js
```

**Interactive Prompts:**
- Type `yes` to confirm
- Type `DELETE ALL TRANSACTIONS` to proceed
- Choose whether to delete audit logs

**Expected Output:**
```
✓ Deleted all transactional data
✓ Master data preserved
✓ Total Transactions Remaining: 0
```

### Step 3: Verify Clean State
```bash
node check-db.js
```

Should show:
```
✓ Database connection: OK
Current transaction counts:
  Sales: 0
  Purchases: 0
  Transfers: 0
  Corrections: 0
  Total: 0
```

### Step 4: Run Playwright Test

**Headed Mode (See Browser):**
```bash
npx playwright test e2e/inventory-ledger-full-flow.spec.ts --headed --reporter=list
```

**Headless Mode (Faster):**
```bash
npx playwright test e2e/inventory-ledger-full-flow.spec.ts --reporter=list
```

**Expected Duration:** 3-5 minutes

### Step 5: Verify Results

**Test Output Should Show:**
```
=== STEP 1: Creating Opening Inventory ===
✓ Opening inventory created
✓ Database inventory verified: 100 units

=== STEP 2: Creating Purchase Receipt ===
✓ Purchase Receipt created
✓ Database inventory verified: 150 units

=== STEP 3: Creating Sale ===
✓ Sale completed
✓ Database inventory verified: 130 units

=== STEP 4: Creating Transfer Out ===
✓ Transfer completed
✓ Database inventory verified: 100 units

=== STEP 5: Creating Transfer In ===
✓ Transfer In completed
✓ Database inventory verified: 115 units

=== STEP 6: Creating Inventory Correction ===
✓ Inventory correction created
✓ Database inventory verified: 110 units

=== STEP 7: Verifying Inventory Ledger Report ===
📊 Report Summary:
  Opening Balance: 100
  Total Stock In: 65
  Total Stock Out: 55
  Net Change: 10
  Calculated Final: 110
  System Inventory: 110
  Variance: 0  ⬅️ CRITICAL: Must be 0!
  Status: Matched
  Transaction Count: 5+

✅ All assertions passed! Ledger is accurate with 0 discrepancy.
```

**Screenshots Created:**
- `test-results/ledger-step1-opening-inventory.png`
- `test-results/ledger-step2-purchase-receipt.png`
- `test-results/ledger-step3-sale.png`
- `test-results/ledger-step4-transfer-out.png`
- `test-results/ledger-step5-transfer-in.png`
- `test-results/ledger-step6-correction.png`
- `test-results/ledger-step7-full-report.png` ⭐ **MOST IMPORTANT**

## Success Criteria

✅ **All 8 test cases pass:**
- 6 transaction creation tests
- 1 report verification test
- 2 edge case tests

✅ **Key Metrics:**
- Opening Balance: 100 units
- Closing Balance: 110 units
- System Inventory: 110 units
- **Variance: 0 units** ⭐
- Reconciliation Status: "Matched"

✅ **Visual Evidence:**
- Screenshot `ledger-step7-full-report.png` shows 0 discrepancy

## Troubleshooting

### Problem: "Database connection failed"
**Solution:**
- Check if MySQL/PostgreSQL is running
- Verify `.env` file has correct `DATABASE_URL`

### Problem: "Product not found"
**Solution:**
```bash
npm run db:seed
```

### Problem: "Dev server not running"
**Solution:**
```bash
npm run dev
```
Keep this running during tests.

### Problem: "Timeout errors"
**Solution:**
- Check internet connection (for npm packages)
- Increase timeout in test file if needed
- Ensure system has enough resources

### Problem: "Tests still show discrepancy"
**Solution:**
1. Run cleanup again: `node cleanup-all-transactions.js`
2. Verify clean state: `node check-db.js`
3. Check for background jobs creating transactions
4. Review console errors during test execution

## What This Test Proves

✅ **Inventory Ledger Accuracy:**
- All transactions are tracked correctly
- Running balances calculate properly
- Opening balance logic works for custom date ranges
- Final balance matches system inventory exactly
- **Zero discrepancy = 100% accuracy**

✅ **Transaction Types Covered:**
- Purchase Receipts (Stock In)
- Sales (Stock Out)
- Transfers Out (Stock Out)
- Transfers In (Stock In)
- Inventory Corrections (Adjustment)

✅ **Edge Cases Handled:**
- Empty date ranges
- Partial date ranges
- Multiple transactions in sequence
- Running balance recalculation

## Next Steps After Successful Test

1. **Review Screenshots:** Check `test-results/` folder
2. **Manual Verification:** Login and view report in UI
3. **Document Results:** Save screenshots for evidence
4. **Regression Testing:** Run this test after any inventory changes
5. **Production Readiness:** Feature is proven accurate for deployment

## Files Reference

| File | Purpose |
|------|---------|
| `cleanup-all-transactions.js` | Deletes all transactional data |
| `e2e/inventory-ledger-full-flow.spec.ts` | Comprehensive Playwright test |
| `INVENTORY-LEDGER-TEST-GUIDE.md` | Detailed documentation |
| `LEDGER-TEST-QUICKSTART.md` | This file (quick reference) |
| `run-ledger-test.ps1` | Windows automation script |
| `run-ledger-test.sh` | Linux/Mac automation script |
| `check-db.js` | Quick database status check |

## Important Notes

⚠️ **Cleanup Warning:**
- Cleanup deletes ALL transactions (sales, purchases, transfers, etc.)
- Master data is preserved (users, products, locations, customers, suppliers)
- Cannot be undone - make sure you have backups if running on production data

⚠️ **Test Environment:**
- Tests use demo account: `superadmin` / `password`
- Tests use real database (not mocks)
- Tests create real transactions
- Tests take 3-5 minutes to complete

✅ **Safe to Run:**
- On development environment: Always safe
- On test environment: Safe after cleanup
- On production: NOT RECOMMENDED (use separate test instance)

## Questions?

Read the full guide: `INVENTORY-LEDGER-TEST-GUIDE.md`

Key sections:
- Troubleshooting (page 4)
- Expected Output (page 3)
- Manual Verification (page 5)
- Success Criteria (page 6)

---

**Last Updated:** 2025-01-14
**Test Version:** 1.0.0
**Status:** ✅ Ready for Execution
