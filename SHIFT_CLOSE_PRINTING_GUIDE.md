# Shift Close Printing Guide

## How to Print X and Z Readings Properly

### Option 1: Browser Print (Recommended)

After closing a shift, you'll see:
- X Reading (Page 1)
- Z Reading with Cash Denominations (Page 2)
- Cash Reconciliation Summary

**To Print WITHOUT URL Bar**:

1. Click **"🖨️ Print Readings"** button
2. In the print dialog:
   - **Chrome/Edge**:
     - Click "More settings"
     - Uncheck "Headers and footers"
   - **Firefox**:
     - Uncheck "Print headers and footers"
   - **Safari**:
     - Show Details → Uncheck "Print headers and footers"

3. Click **Print** or **Save as PDF**

---

### Option 2: Use Keyboard Shortcut

1. On the Shift Close success page, press: `Ctrl+P` (Windows) or `Cmd+P` (Mac)
2. Follow step 2 above to remove headers/footers
3. Print or Save as PDF

---

### Option 3: Save as PDF First (Best Quality)

1. Click **"🖨️ Print Readings"**
2. Choose **"Save as PDF"** as destination
3. In "More settings":
   - **Uncheck**: "Headers and footers"
   - **Set margins**: Minimum or None
   - **Background graphics**: ON (to print colors)
4. Click **Save**
5. Open the PDF and print from there (no URL bar!)

---

## What Should Print

### Page 1: X Reading
- Business name and location
- Shift information
- Sales summary (Gross, Discounts, Net)
- Payment breakdown
- Cash reconciliation
- Expected cash amount
- Discount breakdown

### Page 2: Z Reading (BIR-Compliant)
- **BIR Counters**:
  - Z Counter
  - Reset Counter
  - Previous Accumulated Sales
  - Sales for the Day
  - New Accumulated Sales
- **Shift Information**
- **Sales Summary**
- **Payment Breakdown**
- **Cash Reconciliation**:
  - System Cash
  - Actual Cash
  - Over/Short
- **🔑 CASH DENOMINATION** (Your physical count):
  - ₱1000 x [count]
  - ₱500 x [count]
  - ₱200 x [count]
  - ₱100 x [count]
  - ₱50 x [count]
  - ₱20 x [count]
  - ₱10 x [count]
  - ₱5 x [count]
  - ₱1 x [count]
  - ₱0.25 x [count]
  - **TOTAL COUNTED**: ₱[amount]
- **BIR Discount Breakdown**
- **Category Sales** (if any)
- **Cash Reconciliation Summary Box** (Page 2 bottom):
  - System Cash: ₱6,020.00
  - Actual Cash: ₱6,017.00
  - Cash Short (Shortage): ₱3.00

---

## Why URL Bar Shows in Screenshots

The URL bar you see (e.g., `http://localhost:3000/dashboard/shifts/close?shiftId=2`) is NOT part of the actual printout.

**This is from**:
- Taking a screenshot while in print preview
- Browser chrome (URL bar, toolbars) is captured in screenshots

**It will NOT print if you**:
- Use "Save as PDF" → No URL bar in PDF
- Use browser print with "Headers and footers" unchecked
- Print directly to thermal/receipt printer

---

## Troubleshooting

### "Z Reading Not Showing"

**Check**:
1. Did shift close successfully?
2. Scroll down on the print preview - Z Reading is on Page 2
3. Try "Save as PDF" and check the PDF has 2 pages

### "Cash Denominations Missing"

**This means**:
- Z Reading `cashDenomination` data is null/empty
- Check if you entered cash counts during shift close
- Verify denominations were submitted in the close form

**To Fix**:
1. Cash denominations should be entered BEFORE closing shift
2. If already closed, use "Re-print Readings" feature
3. Check database: `cash_denominations` table for the shift

### "Colors Not Printing"

1. In print dialog, enable **"Background graphics"**
2. Or use "Save as PDF" which preserves all colors

### "Content Cut Off"

1. Change print margins to "Minimum" or "None"
2. Try landscape orientation for wide tables
3. Check "Scale to fit" option in print dialog

---

## Re-Printing Closed Shifts

### From Sidebar Menu:

1. Go to **Readings** → **Readings History** (sidebar)
2. Find the closed shift by:
   - Shift Number
   - Date
   - Cashier name
3. Click **"View/Print"** or **"Re-print"** button
4. Follow printing steps above

### From Dashboard:

1. Go to **Dashboard** → **Recent Shifts**
2. Click on the closed shift
3. Click **"Print Readings"**

---

## BIR Compliance Notes

✅ **Z Reading MUST include**:
- Z Counter (incremented on each Z Reading)
- Reset Counter
- Accumulated Sales (lifetime total)
- Previous accumulated + Today's sales
- Cash denomination count
- All discounts (Senior, PWD, Regular)
- Shift close timestamp

✅ **Readings MUST be generated**:
- BEFORE counting cash (X Reading for reference)
- AT shift close (Z Reading for BIR)
- Z Reading resets daily counters
- Accumulated sales NEVER reset

---

## Thermal Printer Setup (Optional)

If using a thermal receipt printer (58mm or 80mm):

1. **Install Printer Driver**
2. **Browser Settings**:
   - Select thermal printer as destination
   - Set paper size to match printer (58mm or 80mm)
   - Margins: None or Minimum
3. **Print Settings**:
   - Uncheck headers/footers
   - Check "Background graphics"
4. **Print**

**Result**: Clean thermal receipt with:
- No URL bar
- No page numbers
- Proper formatting for small paper width

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| URL bar in print | Uncheck "Headers and footers" in print dialog |
| Z Reading missing | Scroll to Page 2 of print preview |
| No denominations | Enter cash counts before closing shift |
| Can't re-print | Use Readings History in sidebar |
| Colors not showing | Enable "Background graphics" in print |
| Content cut off | Reduce margins, try landscape mode |

---

**Last Updated**: 2025-10-25
**For Support**: Contact your system administrator
