# Shift Close Variance Fix

## Problem Identified

The shift close variance calculation was counting the FULL payment amount when customers overpaid and received change, instead of only counting what remains in the cash drawer.

### Example of the Bug:
```
Sale Total: ₱430
Customer Paid: ₱500 (cash)
Change Given: ₱70

❌ OLD BEHAVIOR: System counted ₱500 in drawer
✅ NEW BEHAVIOR: System counts ₱430 in drawer (₱500 - ₱70 change)
```

## Root Cause Analysis

From diagnostic output on your recent shift:
- Sale #1: Total ₱430, Paid ₱500, Change ₱70
  - System was counting: ₱500
  - Should count: ₱430

- Sale #2: Total ₱590, Paid ₱600, Change ₱10
  - System was counting: ₱600
  - Should count: ₱590

**Total overage: ₱80** (₱70 + ₱10 in change that shouldn't be counted)

This matches your reported variance issues.

## Files Modified

### 1. `/src/app/api/shifts/[id]/close/route.ts` (Lines 122-147)

**What Changed:**
Added proportional allocation logic to handle overpayments correctly.

**How it Works:**
```typescript
// Calculate what actually stays in drawer
if (totalPayments > saleTotal) {
  // There was overpayment (change given)
  // Only count proportional amount
  const allocationRatio = saleTotal / totalPayments
  actualCashInDrawer = cashPayments * allocationRatio
}
```

**Example:**
- Sale: ₱100
- Payments: Cash ₱150 + Digital ₱50 = ₱200 total
- Overpayment: ₱100 (change given)
- Allocation ratio: 100/200 = 0.5 (keep 50%)
- Actual cash in drawer: ₱150 × 0.5 = ₱75
- Digital payment allocated: ₱50 × 0.5 = ₱25

### 2. X Reading Already Correct

The X Reading endpoint (`/src/app/api/readings/x-reading/route.ts`) already had this logic implemented correctly (lines 165-176).

## How to Verify the Fix

### 1. Run Diagnostic Script
```bash
npx tsx scripts/diagnose-shift.ts
```

This will show you:
- All sales in the shift
- Payment breakdowns
- Overpayment detection
- Expected vs actual cash calculations

### 2. Test Shift Close

**Test Case 1: Exact Payment**
1. Create sale for ₱100
2. Pay exactly ₱100 cash
3. Expected drawer: Beginning + ₱100
4. No overpayment

**Test Case 2: Overpayment (Change Given)**
1. Create sale for ₱95
2. Pay ₱100 cash (₱5 change)
3. Expected drawer: Beginning + ₱95 (not ₱100!)
4. System should account for ₱5 change

**Test Case 3: Mixed Payments with Overpayment**
1. Create sale for ₱200
2. Pay ₱150 cash + ₱100 digital = ₱250 total
3. Overpayment: ₱50 (change given)
4. Allocation ratio: 200/250 = 0.8
5. Cash in drawer: ₱150 × 0.8 = ₱120
6. Digital allocated: ₱100 × 0.8 = ₱80

## Your Specific Case

Based on your Excel calculation:
```
Beginning Cash:     ₱5,000.00
Sale 1: ₱3,960 - ₱60 digital = ₱3,900.00 cash
Sale 2: ₱490 - ₱10 discount = ₱480.00 cash
                              ─────────
Expected in Drawer:           ₱9,380.00
Actual Counted:               ₱9,370.00
                              ─────────
Variance:                       -₱10.00 (SHORT)
```

**Previously:** System was showing ₱30.00 short
**Now:** System should show ₱10.00 short (correct)

## Z Reading / Shift Close Report

After closing a shift, you can:

1. **View Z Reading**
   - Go to: `/dashboard/readings/z-reading?shiftId={shift_id}`
   - This shows the full BIR-compliant Z Reading with:
     - Sales breakdown
     - Payment methods
     - Discounts
     - Cash denominations
     - Variance details

2. **Print Z Reading**
   - The Z Reading page has a print button
   - Formatted for thermal printers and A4
   - BIR-compliant format

3. **API Endpoint for Custom Reports**
   ```
   GET /api/readings/z-reading?shiftId=123
   ```
   Returns JSON with all shift data for custom report generation

## Testing Checklist

- [ ] Create a sale with exact payment (no change)
- [ ] Create a sale with overpayment (customer gets change)
- [ ] Create a sale with mixed payment methods (cash + digital)
- [ ] Create a sale with overpayment AND mixed methods
- [ ] Close shift and verify variance is correct
- [ ] View Z Reading report
- [ ] Print Z Reading report
- [ ] Verify cash denominations are saved correctly

## Expected Behavior After Fix

### Scenario 1: Single Cash Payment (Exact)
```
Sale: ₱500
Payment: ₱500 cash
Expected drawer: +₱500
```

### Scenario 2: Single Cash Payment (Overpayment)
```
Sale: ₱500
Payment: ₱600 cash
Change: ₱100
Expected drawer: +₱500 (not ₱600!)
```

### Scenario 3: Mixed Payment (No Overpayment)
```
Sale: ₱500
Payments: ₱300 cash + ₱200 digital
Expected drawer: +₱300 cash
```

### Scenario 4: Mixed Payment (With Overpayment)
```
Sale: ₱500
Payments: ₱400 cash + ₱200 digital = ₱600 total
Overpayment: ₱100 (change given)
Ratio: 500/600 = 0.8333
Expected drawer: ₱400 × 0.8333 = ₱333.33 cash
Digital allocated: ₱200 × 0.8333 = ₱166.67
```

## Troubleshooting

### If variance is still wrong:

1. **Run diagnostic script**
   ```bash
   npx tsx scripts/diagnose-shift.ts
   ```

2. **Check for cash in/out records**
   - Petty cash withdrawals
   - Cash deposits
   - These should be included in the calculation

3. **Verify payment recording**
   - Check that payments are recorded correctly in database
   - Ensure change amount is not being recorded as a separate payment

4. **Check for voided sales**
   - Voided sales should not affect cash count
   - But payments might still be in the table

## Next Steps

1. ✅ Fix applied to shift close calculation
2. ⏳ Restart development server
3. ⏳ Test with real shift close
4. ⏳ Verify variance calculation
5. ⏳ Print Z Reading report

## Notes

- The X Reading calculation was already correct
- Only the shift close calculation needed fixing
- This fix maintains BIR compliance
- All existing closed shifts are not affected (historical data unchanged)
- Future shift closes will use the corrected calculation

---

**Ready to test!** Please close a shift and verify the variance is now correct.
