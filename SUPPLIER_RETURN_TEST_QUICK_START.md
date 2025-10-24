# Supplier Return Test - Quick Start Guide

## Run the Test NOW

```bash
# 1. Ensure app is running
npm run dev

# 2. Run the comprehensive supplier return test
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts

# 3. View results
npx playwright show-report
```

## What Gets Tested

This comprehensive test validates the **CRITICAL SUPPLIER RETURN ACCOUNTING FIX**:

### The Complete Workflow

1. **Purchase Order** - Order 10 Drawers + 20 SSDs from GRAND TECH
2. **GRN Approval** - Receive goods, inventory increases
3. **Supplier Return** - Return 2 Drawers + 3 SSDs (defective/damaged)
   - **✓ CRITICAL: Accounts Payable REDUCED by ₱14,500**
   - **✓ CRITICAL: Payment record CREATED with "supplier_return_credit"**
   - ✓ Inventory reduced
   - ✓ Serial numbers updated
4. **Stock Transfers** - Move stock to 3 locations
5. **Return Transfers** - Return stock to warehouse
6. **Sales Transaction** - Sell products at Main Store
7. **Final Verification** - Check all stock levels and accounting

### Expected Duration: 2-3 minutes

## Prerequisites

**Required Products in Database:**
- "2 DOOR DRAWER WITH LOCK 4 ADJUSTABLE SHELVES" (with serial tracking)
- "ADATA 512GB 2.5 SSD" (without serial tracking)

**Required Locations:**
- Main Warehouse
- Main Store
- Bambang
- Tuguegarao

**User:**
- Superadmin (`superadmin` / `password`)

## Quick Troubleshooting

### Test fails with "Products not found"
```bash
# Ensure products exist in database
# Check product names match exactly
```

### Test fails at supplier return approval
```bash
# Check API route: /api/supplier-returns/[id]/approve
# Verify accounting logic is implemented
# Review console for error messages
```

### Want to see what's happening?
```bash
# Run in headed mode (shows browser)
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts --headed

# Run in debug mode (step through)
npx playwright test e2e/comprehensive-supplier-return-workflow.spec.ts --debug
```

## Success Indicators

When the test passes, you'll see:

```
✓✓✓ SUPPLIER RETURN CRITICAL FIX VALIDATED ✓✓✓
   - Inventory reduced correctly
   - Accounts Payable reduced correctly
   - Payment record created with supplier_return_credit
   - Serial numbers updated correctly
   - Balance sheet remains balanced

✓✓✓ COMPREHENSIVE WORKFLOW TEST COMPLETED ✓✓✓
```

## Critical Validation

The most important verification is **Phase 3: Supplier Return**

It confirms:
- ✓ Inventory: Drawer -2, SSD -3
- ✓ **Accounts Payable: -₱14,500**
- ✓ **Payment Created: ₱14,500 (supplier_return_credit)**
- ✓ Serials: 2 marked as "supplier_return"

**This ensures the balance sheet stays balanced!**

## View Results

Screenshots: `test-results/supplier-return-workflow-*.png`

HTML Report: `npx playwright show-report`

Console Output: Detailed logs of each phase

## Need Help?

See full guide: `COMPREHENSIVE_SUPPLIER_RETURN_WORKFLOW_TEST_GUIDE.md`

---

**TL;DR:** This test ensures supplier returns correctly reduce inventory AND Accounts Payable, with proper payment records created. It's the proof that the accounting fix works!
