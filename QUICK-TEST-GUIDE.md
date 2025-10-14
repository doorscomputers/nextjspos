# Quick Test Guide - POS Critical Features

## How to Test Each Feature (5 Minutes)

---

## 1. TEST X READING (30 seconds)

1. Open POS: `http://localhost:3001/dashboard/pos-v2`
2. Look for **indigo button with 📊 icon** labeled "X Read"
3. Click it
4. **New tab should open** showing X Reading report
5. Report should show:
   - Your current shift details
   - Sales summary
   - Payment breakdown
   - Cash drawer status

**✅ PASS**: Report opens and shows data
**❌ FAIL**: Button doesn't work or no data shown

---

## 2. TEST CHEQUE PAYMENT (2 minutes)

### Setup:
1. Open POS
2. Add any product to cart (scan or click)
3. Scroll down to payment section

### Test:
1. Find **🏦 Cheque Payment** section
2. Enter cheque amount (e.g., 1000)
3. Notice fields appear:
   - Cheque Number (should appear)
   - Bank Name (should appear)
   - Cheque Date (should appear)
4. Fill in:
   - Cheque Number: `12345`
   - Bank Name: `BDO`
   - Leave date empty (optional)
5. Click **"COMPLETE SALE"**

**✅ PASS**: Sale completes, cart clears
**❌ FAIL**: Error message or sale doesn't complete

### Test Mixed Payment:
1. Add product (₱5000)
2. Enter:
   - Cash: ₱2000
   - Cheque: ₱3000 (with number and bank)
3. Should show:
   - Total Paid: ₱5000
   - Change: ₱0
4. Click Complete Sale

**✅ PASS**: Sale completes with multiple payment methods
**❌ FAIL**: Error or won't complete

---

## 3. TEST CREDIT SALE (30 seconds)

1. Add product to cart
2. Check the box: **📝 Credit / Charge Invoice**
3. Payment fields should **hide**
4. Select a customer from dropdown (required)
5. Click Complete Sale

**✅ PASS**: Sale completes without payment
**❌ FAIL**: Asks for payment or error

---

## 4. TEST QUOTATION DELETE (30 seconds)

### Setup (if no quotations):
1. Add product to cart
2. Click **Save (F2)** button
3. Enter customer name
4. Click "Save Quotation"

### Test Delete:
1. Click **Load (F3)** button
2. Dialog opens with saved quotations
3. Find **🗑️ Delete** button (red button)
4. Click it
5. Confirm deletion

**✅ PASS**: Quotation deleted, doesn't load when clicking delete
**❌ FAIL**: Quotation loads instead of deleting

---

## 5. TEST REFUND API (Optional - Advanced)

### This requires API testing tool (Postman/Thunder Client)

**Endpoint**: `POST /api/sales/[saleId]/refund`

**Body**:
```json
{
  "refundItems": [
    {
      "saleItemId": 123,
      "quantity": 1
    }
  ],
  "refundReason": "Test refund",
  "managerPassword": "password"
}
```

**✅ PASS**: Returns success with return number
**❌ FAIL**: Returns error

*Note: UI for refunds not built yet - API only*

---

## QUICK TROUBLESHOOTING

### Problem: "Insufficient payment" error
**Solution**: Make sure total payments equal or exceed total due

### Problem: Delete button loads quotation
**Solution**: Hard refresh browser (Ctrl+F5)

### Problem: X Reading shows no data
**Solution**: Make sure you have completed at least one sale

### Problem: Cheque validation error
**Solution**: Fill in both Cheque Number AND Bank Name

---

## ALL FEATURES WORKING?

If all tests pass:
- ✅ X Reading working
- ✅ Cheque payment working
- ✅ Credit sales working
- ✅ Mixed payments working
- ✅ Quotation delete working

**You're ready to use the system!**

---

## Need Help?

Check the detailed documentation:
- `POS-CRITICAL-FIXES-COMPLETE.md` - Full implementation details
- Browser Console (F12) - Check for errors
- Network Tab (F12) - Check API responses

---

**Testing Time**: 5 minutes
**Expected Result**: All features working ✅
