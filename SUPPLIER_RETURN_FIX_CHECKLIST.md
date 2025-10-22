# Supplier Return Accounting - Action Checklist

## 🚨 CRITICAL ISSUE IDENTIFIED

**Problem:** Supplier returns are deducting inventory but NOT reducing Accounts Payable
**Impact:** Balance sheet out of balance, overstating liabilities
**Affected Transaction:** SR-202510-0001 (₱1,520.00 to GRAND TECH)

---

## ✅ IMMEDIATE ACTIONS (Do Today)

### ☐ Step 1: Understand the Issue (5 minutes)

Read one of these (choose based on your role):

- **Executives/Managers:** Read `SUPPLIER_RETURN_ACCOUNTING_FIX_SUMMARY.md`
- **Accountants:** Read `SUPPLIER_RETURN_ACCOUNTING_FORENSIC_REPORT.md`
- **Developers:** Read `SUPPLIER_RETURN_ACCOUNTING_VISUAL_GUIDE.md`

### ☐ Step 2: Verify the Problem (2 minutes)

Run the investigation script:

```bash
node investigate-supplier-return-accounting.mjs
```

**Expected Output:**
- ✅ Inventory reduced (21 units remaining)
- ❌ AP still shows ₱24,520 owed (should be ₱23,000)

### ☐ Step 3: Fix Current Transaction (2 minutes)

Run the corrective script:

```bash
node fix-supplier-return-sr-202510-0001.mjs
```

**What this does:**
- Applies ₱1,520 credit to invoice PO-202510-0001
- Marks that invoice as "paid"
- Creates Payment record showing the credit
- Balances the books

**Verification:**
After running, check database:
```sql
SELECT * FROM accounts_payable WHERE supplier_id = 11;
-- PO-202510-0001 should show: balance_amount = 0, payment_status = 'paid'

SELECT * FROM payments WHERE reference_number = 'SR-202510-0001';
-- Should show 1 record with amount = 1520.00, method = 'supplier_return_credit'
```

### ☐ Step 4: Check for Other Affected Returns (5 minutes)

```bash
node find-supplier-returns.mjs
```

**Action:**
- If you find other supplier returns, create fix scripts for each
- Pattern is: `fix-supplier-return-SR-YYYYMM-NNNN.mjs`

---

## 🔧 SHORT-TERM FIXES (This Week)

### ☐ Step 5: Implement Code Fix (30 minutes)

**File:** `src/app/api/supplier-returns/[id]/approve/route.ts`

**Location:** Add after line 133 (inside transaction, after stock deduction)

**Code to Add:**

```typescript
// ========================================
// CRITICAL: Update Accounts Payable
// ========================================
const apEntries = await tx.accountsPayable.findMany({
  where: {
    supplierId: supplierReturn.supplierId,
    businessId: businessIdNumber,
    balanceAmount: { gt: 0 }
  },
  orderBy: { invoiceDate: 'asc' }
})

if (apEntries.length > 0) {
  let remainingCredit = parseFloat(supplierReturn.totalAmount.toString())

  for (const ap of apEntries) {
    if (remainingCredit <= 0) break

    const currentBalance = parseFloat(ap.balanceAmount.toString())
    const creditToApply = Math.min(remainingCredit, currentBalance)
    const newPaidAmount = parseFloat(ap.paidAmount.toString()) + creditToApply
    const newBalance = currentBalance - creditToApply
    const newStatus = newBalance === 0 ? 'paid' :
                      newBalance < parseFloat(ap.totalAmount.toString()) ? 'partial' :
                      'unpaid'

    await tx.accountsPayable.update({
      where: { id: ap.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalance,
        paymentStatus: newStatus
      }
    })

    remainingCredit -= creditToApply
  }

  // Create payment record
  await tx.payment.create({
    data: {
      businessId: businessIdNumber,
      supplierId: supplierReturn.supplierId,
      amount: parseFloat(supplierReturn.totalAmount.toString()),
      paymentDate: supplierReturn.returnDate,
      paymentMethod: 'supplier_return_credit',
      referenceNumber: supplierReturn.returnNumber,
      status: 'completed',
      notes: `Credit from supplier return ${supplierReturn.returnNumber} - ${supplierReturn.returnReason}`,
      createdBy: userIdNumber
    }
  })
} else {
  console.warn(`⚠️  No outstanding AP for supplier ${supplierReturn.supplierId}`)
  // Optional: Create credit balance for future use
}
```

### ☐ Step 6: Add Validation (10 minutes)

**Add after the AP update code:**

```typescript
// Validation: Ensure balance sheet balances
const inventoryReduction = parseFloat(supplierReturn.totalAmount.toString())

if (apEntries.length > 0) {
  let totalApReduction = 0
  for (const ap of apEntries) {
    const originalBalance = parseFloat(ap.balanceAmount.toString()) + parseFloat(ap.paidAmount.toString())
    const newBalance = parseFloat(ap.balanceAmount.toString())
    totalApReduction += (originalBalance - newBalance)
  }

  if (Math.abs(inventoryReduction - totalApReduction) > 0.01) {
    throw new Error(
      `Balance sheet validation failed: ` +
      `Inventory reduced by ₱${inventoryReduction} but AP only reduced by ₱${totalApReduction}`
    )
  }
}
```

### ☐ Step 7: Test Thoroughly (1 hour)

**Test Scenarios:**

#### Test 1: Full Return
```
1. Create purchase order for ₱1,000
2. Receive items
3. Return all items
4. Verify:
   ☐ Inventory reduced
   ☐ AP balance = ₱0
   ☐ Payment record created
   ☐ Invoice status = 'paid'
```

#### Test 2: Partial Return
```
1. Create purchase order for ₱2,000
2. Return items worth ₱500
3. Verify:
   ☐ Inventory reduced by ₱500
   ☐ AP balance = ₱1,500
   ☐ Invoice status = 'partial'
```

#### Test 3: Multiple Invoices
```
1. Create 2 POs to same supplier (₱1,000 and ₱2,000)
2. Return ₱1,500 worth of items
3. Verify:
   ☐ First invoice (₱1,000) fully paid
   ☐ Second invoice (₱2,000) partially paid (₱1,500 balance)
   ☐ Total balance = ₱1,500
```

#### Test 4: Return with No AP
```
1. Create supplier with no outstanding invoices
2. Try to return items
3. Verify:
   ☐ System handles gracefully
   ☐ Either creates credit or warns user
```

### ☐ Step 8: Deploy to Production (After Testing)

**Pre-Deployment Checklist:**
- ☐ All tests pass
- ☐ Code reviewed by senior developer
- ☐ Backup database
- ☐ Plan rollback strategy
- ☐ Inform accounting team of changes

**Deployment Steps:**
1. ☐ Deploy code changes
2. ☐ Run fix scripts for existing returns
3. ☐ Verify all AP balances correct
4. ☐ Monitor for errors

---

## 📊 ONGOING MONITORING (Weekly)

### ☐ Step 9: Create Reconciliation Report (30 minutes)

**Create script:** `reconcile-supplier-returns.mjs`

**Should check:**
- All approved supplier returns have corresponding AP adjustments
- All supplier return credits have Payment records
- Inventory reductions match AP reductions

**Run weekly:**
```bash
node reconcile-supplier-returns.mjs
```

### ☐ Step 10: Add to Monthly Close Procedures

**Add to month-end checklist:**
1. ☐ Run supplier return reconciliation
2. ☐ Verify all returns have AP adjustments
3. ☐ Review Payment records for supplier_return_credit
4. ☐ Confirm supplier statements match AP balances

---

## 🎯 FUTURE ENHANCEMENTS (Optional)

### ☐ Enhancement 1: Add General Ledger Module

**Benefit:** Proper double-entry bookkeeping
**Effort:** High (2-3 months)
**Priority:** Medium

**What it adds:**
- Chart of Accounts
- Journal Entries
- Trial Balance
- Financial Statements

### ☐ Enhancement 2: Supplier Return Credits Table

**Benefit:** Explicit tracking of credits
**Effort:** Medium (1 week)
**Priority:** Low

**Schema:**
```prisma
model SupplierReturnCredit {
  id                Int @id @default(autoincrement())
  businessId        Int
  supplierReturnId  Int
  accountsPayableId Int?
  creditAmount      Decimal
  appliedAmount     Decimal
  balanceAmount     Decimal
  status            String // available, applied, expired
}
```

### ☐ Enhancement 3: Automated Debit Memos

**Benefit:** BIR compliance
**Effort:** Low (2 days)
**Priority:** Medium (for Philippines)

**What it generates:**
- Formal debit memo document
- Properly formatted for supplier
- Numbered sequentially
- Stored as PDF

### ☐ Enhancement 4: Dashboard Alerts

**Benefit:** Proactive monitoring
**Effort:** Low (1 day)
**Priority:** Low

**Alerts for:**
- Unbalanced supplier returns
- Returns with no AP adjustment
- Excess credits available

---

## 📋 TRACKING & ACCOUNTABILITY

### Issue Log

| Date | Issue | Status | Owner | Notes |
|------|-------|--------|-------|-------|
| 2025-10-22 | SR-202510-0001 not reducing AP | ☐ Open | [Name] | Amount: ₱1,520 |
| | | | | |

### Implementation Log

| Step | Description | Completed | Date | By |
|------|-------------|-----------|------|-----|
| 1 | Read documentation | ☐ | | |
| 2 | Run investigation | ☐ | | |
| 3 | Fix SR-202510-0001 | ☐ | | |
| 4 | Find other returns | ☐ | | |
| 5 | Implement code fix | ☐ | | |
| 6 | Add validation | ☐ | | |
| 7 | Test scenarios | ☐ | | |
| 8 | Deploy to production | ☐ | | |
| 9 | Create reconciliation | ☐ | | |
| 10 | Update procedures | ☐ | | |

---

## 🆘 TROUBLESHOOTING

### Problem: Fix script fails with "No AP entries found"

**Cause:** Purchases were never posted to Accounts Payable

**Solution:**
1. Investigate why purchases don't create AP entries
2. Fix purchase workflow first
3. Then fix supplier returns

### Problem: Code change causes transaction to fail

**Cause:** Likely data type mismatch or missing field

**Debug:**
1. Check console logs for exact error
2. Verify all fields exist in schema
3. Test with simple data first
4. Add try/catch with detailed logging

### Problem: Tests pass but production fails

**Cause:** Different data or permissions

**Fix:**
1. Compare test data vs production data
2. Check user permissions
3. Verify database constraints
4. Test with production data copy

### Problem: Balance sheet still doesn't balance

**Cause:** Multiple issues or missing transactions

**Investigate:**
1. Run full reconciliation report
2. Check ALL supplier returns, not just one
3. Verify inventory calculations
4. Audit all AP entries

---

## 📞 CONTACTS & RESOURCES

**Technical Support:**
- Developer: [Name]
- Database Admin: [Name]

**Accounting Support:**
- Accountant: [Name]
- Finance Manager: [Name]

**Documentation:**
- Full Report: `SUPPLIER_RETURN_ACCOUNTING_FORENSIC_REPORT.md`
- Quick Summary: `SUPPLIER_RETURN_ACCOUNTING_FIX_SUMMARY.md`
- Visual Guide: `SUPPLIER_RETURN_ACCOUNTING_VISUAL_GUIDE.md`
- This Checklist: `SUPPLIER_RETURN_FIX_CHECKLIST.md`

**Scripts:**
- Investigation: `investigate-supplier-return-accounting.mjs`
- Find Returns: `find-supplier-returns.mjs`
- Fix Specific: `fix-supplier-return-sr-202510-0001.mjs`

---

## ✅ COMPLETION CRITERIA

You're done when:

1. ☐ All existing supplier returns have correct AP adjustments
2. ☐ New supplier returns automatically update AP
3. ☐ Payment records are created for all returns
4. ☐ Balance sheet balances (Assets = Liabilities + Equity)
5. ☐ Reconciliation report runs clean
6. ☐ Accounting team confirms accuracy
7. ☐ All tests pass
8. ☐ Documentation updated
9. ☐ Team trained on new workflow
10. ☐ Monitoring in place

---

**Checklist Created:** October 22, 2025
**Priority:** CRITICAL
**Estimated Total Time:** 3-4 hours (immediate fixes) + ongoing monitoring
**Status:** Awaiting action

---

## 🎯 SUCCESS METRICS

**Before Fix:**
- Supplier returns: Manual AP adjustment required
- Error rate: 100% (all returns missing AP update)
- Balance sheet: Out of balance
- Audit readiness: Fail

**After Fix:**
- Supplier returns: Automatic AP adjustment
- Error rate: 0% (validated in code)
- Balance sheet: Balanced
- Audit readiness: Pass

**Track these metrics weekly:**
1. Number of supplier returns processed
2. Number with correct AP updates (target: 100%)
3. Number requiring manual intervention (target: 0)
4. Balance sheet variance (target: ₱0.00)
