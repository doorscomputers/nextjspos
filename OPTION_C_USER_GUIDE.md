# Option C: Integrated Shift Close - User Guide

## Quick Start Guide

### For Cashiers: How to Close Your Shift

**Step 1: Navigate to Close Shift**
- Click on your username in the top right
- Select "Close Shift" from the dropdown
- Or go to: `/dashboard/shifts/close`

**Step 2: Count Your Cash**
- Count each denomination of bills and coins
- Enter the count for each:
  - ₱1000 bills
  - ₱500 bills
  - ₱200 bills
  - ₱100 bills
  - ₱50 bills
  - ₱20 bills
  - ₱10 coins
  - ₱5 coins
  - ₱1 coins
  - ₱0.25 coins (25 centavos)
- The system will automatically calculate the total

**Step 3: Add Closing Notes (Optional)**
- Enter any notes about your shift
- Example: "Busy lunch rush, ran low on change"

**Step 4: Request Manager Authorization**
- Click "Close Shift" button
- Authorization dialog will appear

**Step 5: Get Manager Password**
- Ask your Branch Manager or Admin to enter their password
- They will verify your cash count is correct
- They will enter their password to authorize

**Step 6: View Your Readings**
- X Reading and Z Reading will automatically appear
- These are BIR-compliant reports of your shift
- Review the cash variance:
  - **Green = Balanced** (system cash matches your count)
  - **Red = Short** (you counted less than expected)
  - **Yellow = Over** (you counted more than expected)

**Step 7: Print Readings (Optional)**
- Click "Print X Reading" for mid-shift summary
- Click "Print Z Reading" for end-of-day BIR report
- Click "Print Both" to print both at once

**Step 8: Return to Dashboard**
- Click "Return to Dashboard" to continue working
- Or click "Start New Shift" to open a new shift

---

## For Managers: How to Authorize Shift Close

### Your Responsibilities

When a cashier requests to close their shift, you must:

1. **Verify Cash Count**
   - Check that the cashier counted correctly
   - Review the denomination breakdown
   - Ensure all cash is accounted for

2. **Enter Your Password**
   - Enter your manager/admin password
   - This authorizes the shift closure
   - Your username will be logged in the audit trail

3. **Review Variance**
   - Check if cash is balanced
   - If there's a shortage or overage, investigate
   - Document any discrepancies in closing notes

### Authorization Roles

Only these roles can authorize shift closure:
- ✅ Super Admin
- ✅ All Branch Admin
- ✅ Branch Admin
- ✅ Main Branch Manager
- ✅ Branch Manager

---

## Understanding Your Readings

### X Reading (Mid-Shift Summary)

**What it shows:**
- Current shift totals
- Non-resetting (doesn't reset counters)
- Can be generated multiple times during a shift

**When to use:**
- Shift changes (one cashier taking over from another)
- Mid-day reconciliation
- Manager review during shift
- Before closing to preview totals

**Key Information:**
- Shift number and cashier name
- Opened time and reading time
- Transaction count
- Gross sales (before discounts)
- Discounts applied (Senior, PWD, Regular)
- Net sales (after discounts)
- Payment breakdown (Cash, Card, etc.)
- Expected cash in drawer

### Z Reading (End-of-Day BIR Report)

**What it shows:**
- Complete shift summary
- BIR-compliant format
- Increments Z-Counter (never resets)
- Updates accumulated sales

**When to use:**
- End of business day
- Shift closure
- BIR audit requirements
- Daily sales reporting

**Key Information:**
- Z-Counter number (increments with each Z Reading)
- Reset Counter (for machine resets)
- Accumulated sales (running total since business started)
- Complete sales breakdown
- Discount breakdown with transaction counts
- Cash denomination breakdown
- Category sales
- Cash over/short

**BIR Compliance:**
- TIN displayed
- Sequential numbering
- Date/time stamped
- Cannot be deleted or modified
- Preserved for 5 years (as per BIR requirements)

---

## Cash Reconciliation Explained

### System Cash vs Actual Cash

**System Cash (Expected):**
```
Beginning Cash
+ Cash Sales
+ Cash In (deposits, change fund)
- Cash Out (expenses, withdrawals)
= Expected Cash in Drawer
```

**Actual Cash (Counted):**
```
Sum of all denominations you counted
= Total Cash in Drawer
```

**Variance:**
```
Actual Cash - System Cash = Variance

Positive = Cash Over (you have more than expected)
Negative = Cash Short (you have less than expected)
Zero = Balanced (perfect match)
```

### Common Reasons for Variance

**Cash Over:**
- Forgot to record a cash-out
- Counted change given back incorrectly
- Found money in drawer from previous shift
- Tip or donation placed in drawer

**Cash Short:**
- Gave incorrect change
- Recorded incorrect sale amount
- Theft or loss
- Forgot to record cash-in

### What to Do About Variance

**Small variance (₱1-₱10):**
- Usually rounding or counting errors
- Document in closing notes
- Manager can approve

**Large variance (₱50+):**
- Investigate thoroughly
- Check all transactions
- Review CCTV if available
- May require incident report

**Repeated variance:**
- Retraining may be needed
- More frequent X Readings
- Enhanced supervision

---

## Best Practices

### For Cashiers

1. **Count Carefully**
   - Count twice to be sure
   - Use denomination sorter if available
   - Ask colleague to verify large amounts

2. **Keep Drawer Organized**
   - Separate denominations clearly
   - Face bills in same direction
   - Don't mix personal money

3. **Record Everything**
   - Cash in/out immediately
   - Don't delay recording
   - Use proper categories

4. **Secure Your Cash**
   - Never leave drawer open
   - Lock drawer when stepping away
   - Don't share access

5. **Print Readings**
   - Keep printed copies
   - File for your records
   - Use for tips/commissions calculation

### For Managers

1. **Regular Checks**
   - Random X Readings during day
   - Verify cash levels
   - Review transaction patterns

2. **Clear Policies**
   - Maximum drawer amount
   - When to do cash drops
   - Variance tolerance levels

3. **Training**
   - Train on proper cash handling
   - Practice closing procedures
   - Review variance reports

4. **Audit Trail**
   - Keep all Z Readings
   - File for BIR inspection
   - Monthly reconciliation

---

## Troubleshooting

### "No open shift found"

**Problem:** You don't have an active shift to close.

**Solution:**
- Start a shift first from POS page
- Or check if shift was already closed

### "Invalid manager password"

**Problem:** Password entered is incorrect.

**Solution:**
- Verify typing password correctly
- Ensure manager account exists
- Contact admin if forgotten

### "Shift already closed"

**Problem:** This shift was already closed.

**Solution:**
- Cannot close same shift twice
- Start new shift if needed
- View readings from history

### Readings not displaying

**Problem:** X/Z readings don't show after close.

**Solution:**
- Check browser console for errors
- Refresh page and try again
- Contact IT support

### Print dialog doesn't open

**Problem:** Browser blocks print dialog.

**Solution:**
- Allow pop-ups for this site
- Check browser settings
- Try different browser

---

## Keyboard Shortcuts

- `Tab` - Move between denomination fields
- `Enter` - Submit count (after all filled)
- `Ctrl+P` - Print current page
- `Esc` - Cancel password dialog

---

## Mobile Device Notes

**Closing shifts on mobile/tablet:**
- Use landscape orientation for best view
- Denomination inputs may be smaller
- Print may require desktop computer
- Save readings as PDF for mobile sharing

---

## Frequently Asked Questions

### Q: Can I close someone else's shift?

**A:** No, unless you have `SHIFT_VIEW_ALL` permission (typically managers only). Cashiers can only close their own shifts.

### Q: Can I reopen a closed shift?

**A:** No. Once closed, shifts cannot be reopened. This is for BIR compliance and audit trail integrity.

### Q: What happens if I enter wrong cash count?

**A:** It will show as over/short in the variance. Document the error in closing notes. Future shifts can correct the beginning cash.

### Q: How many X Readings can I generate?

**A:** Unlimited. X Readings don't reset anything, they just provide a snapshot. The counter increments each time.

### Q: Does Z Reading reset my shift?

**A:** No, the Z Reading is generated before closing the shift. The shift close process marks it as closed.

### Q: Where is my Z-Counter stored?

**A:** At the Business level in the database. It's global across all locations for your business.

### Q: Can I delete old readings?

**A:** No. BIR requires all readings to be preserved for audit purposes (minimum 5 years).

### Q: What if power goes out during close?

**A:** The close is atomic - either everything saves or nothing saves. If power loss occurs, the shift will still be open and you can retry.

### Q: Can I close shift without counting cash?

**A:** No. Cash denomination count is required for BIR compliance and audit trail.

### Q: What's the difference between X and Z reading?

**A:**
- **X Reading:** Mid-shift snapshot, non-resetting, can run multiple times
- **Z Reading:** End-of-day report, increments BIR counter, run once per shift

---

## Emergency Procedures

### System Down During Close

1. Write down all denomination counts on paper
2. Note the time
3. Wait for system to come back online
4. Enter counts and close normally
5. Keep paper record for reconciliation

### Manager Not Available

1. Call/text manager for remote authorization
2. Manager can authorize from their phone if they have access
3. Never share manager passwords
4. Document in closing notes: "Authorized via phone by [Manager Name] at [Time]"

### Large Cash Shortage Discovered

1. Stop the close process
2. Recount cash multiple times
3. Call manager immediately
4. Review all transactions
5. Check for missing receipts
6. File incident report
7. Complete close with documented shortage

### Printer Not Working

1. Complete shift close first (don't delay)
2. Save readings to PDF via browser print
3. Email PDF to yourself
4. Print later from another device
5. Can reprint from readings history

---

## Support Contacts

**Technical Issues:**
- IT Help Desk: [Contact Info]
- Email: support@example.com

**BIR Compliance Questions:**
- Accounting Department: [Contact Info]
- BIR Accredited IT Provider: [Contact Info]

**Manager On Duty:**
- Check schedule or call main office

---

**Last Updated:** October 25, 2025
**Version:** 1.0 (Option C Implementation)
