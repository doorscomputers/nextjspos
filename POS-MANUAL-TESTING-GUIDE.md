# POS System Manual Testing Guide

## ✅ System Setup Complete!

### What's Been Done:
1. ✅ Database schema synced (`npm run db:push`)
2. ✅ 14 POS permissions added to database
3. ✅ Permissions assigned to roles:
   - **Regular Cashier**: shift.open, shift.close, shift.view, cash.in_out, cash.count, reading.x_reading, void.create
   - **Branch Admin & Super Admin**: All POS permissions
4. ✅ Development server running at http://localhost:3000

---

## 🧪 Manual Testing Steps (15 minutes)

### Test 1: Login & Access Check (2 min)

1. Open browser: `http://localhost:3000`
2. Login with:
   - **Username**: `cashier`
   - **Password**: `password`
3. ✅ **Verify**: Sidebar shows "POS & Sales" menu with:
   - Point of Sale
   - Begin Shift
   - Close Shift
   - X Reading
   - Sales List

---

### Test 2: Begin Shift (3 min)

1. Click **"Begin Shift"** from sidebar
2. Fill in:
   - **Location**: Select any location (e.g., "Main Branch")
   - **Beginning Cash**: `5000`
   - **Opening Notes**: "Morning shift test"
3. Click **"Begin Shift"** button
4. ✅ **Verify**:
   - Redirected to POS page
   - Shift number displayed at top (e.g., "SHIFT-20251012-0001")
   - Beginning cash shown: ₱5,000.00

---

### Test 3: Make a Sale (4 min)

1. On POS page, **search for a product** in the search box
2. **Click a product** to add to cart
3. ✅ **Verify**: Product appears in cart on right side
4. **Adjust quantity** using +/- buttons if needed
5. **Select payment method**: Cash (default)
6. Click **"Complete Sale"** button
7. ✅ **Verify**:
   - Success message with invoice number
   - Cart clears
   - Can make another sale

---

### Test 4: X Reading (2 min)

1. On POS page, click **"X Reading"** button (bottom right)
   - OR: Click "X Reading" from sidebar
2. ✅ **Verify X Reading shows**:
   - Shift Number
   - X Reading Number
   - Gross Sales (should match your sale)
   - Net Sales
   - Payment Breakdown (Cash amount)
   - Expected Cash in Drawer
   - Discount Breakdown (if any)

---

### Test 5: Close Shift (4 min)

1. On POS page, click **"Close Shift"** button
   - OR: Click "Close Shift" from sidebar
2. **Count cash denominations**:
   - `1000`: 5 pieces (₱5,000)
   - `500`: 0
   - `200`: 1 piece (₱200)
   - Leave others as 0
3. **Total should auto-calculate**: ₱5,200
4. **Closing Notes**: "End of shift test"
5. Click **"Close Shift"** button
6. ✅ **Verify**:
   - Success message
   - Shows cash variance (Over/Short)
   - System Cash vs Ending Cash comparison
   - Redirected away from POS

---

## 🎯 Expected Test Results

### ✅ PASS Criteria:
- [x] Can login as cashier
- [x] Sidebar shows POS menu items
- [x] Can begin shift without errors
- [x] Can make a sale and see it in cart
- [x] Sale processes successfully
- [x] X Reading generates with correct data
- [x] Can close shift with cash count
- [x] Cash variance calculates correctly

### ❌ FAIL If:
- Login fails
- "No open shift" error on POS page
- Sale creation fails
- X Reading shows errors
- Close shift fails
- Permissions errors appear

---

## 🔧 Troubleshooting

### Issue: "No open shift found"
**Solution**: Navigate to Begin Shift and start a new shift

### Issue: "Permission denied"
**Solution**:
```bash
node scripts/seed-pos-permissions.js
```
Then logout and login again

### Issue: Products not showing
**Solution**: Make sure products exist in database
```bash
npm run db:seed
```

### Issue: Sale fails with inventory error
**Solution**: Check product has stock at selected location

---

## 📊 Test Accounts

### For Testing Different Roles:

| Username | Password | Role | Can Do |
|----------|----------|------|--------|
| `cashier` | `password` | Regular Cashier | Begin shift, sales, X reading |
| `branchmanager` | `password` | Branch Manager | All cashier + Z reading, approvals |
| `superadmin` | `password` | Super Admin | Everything |
| `Gemski` | `password` | All Branch Admin | Everything across branches |

---

## 🎉 Success Checklist

After completing all tests:
- [ ] All 5 tests passed
- [ ] No errors in browser console (F12)
- [ ] Mobile view looks good (test on phone or resize browser)
- [ ] Cash calculations are accurate
- [ ] Data saves correctly to database

---

## 📱 Mobile Responsiveness Test

1. **Resize browser** to mobile size (375px width)
   - OR press F12, click mobile icon
2. ✅ **Verify**:
   - POS interface is usable on small screen
   - Cart is accessible
   - Buttons are tappable
   - Text is readable
   - No horizontal scrolling

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
1. **Update documentation** with any findings
2. **Train cashiers** on the system
3. **Set up receipt printer** (if needed)
4. **Configure BIR settings** (OR numbers, etc.)
5. **Go live!** 🎊

### If Tests Fail:
1. **Note the error message**
2. **Check browser console** (F12 → Console tab)
3. **Check terminal logs** (where `npm run dev` is running)
4. **Report issues** with screenshots

---

## 📞 Need Help?

1. Check browser console for errors (F12)
2. Check server logs in terminal
3. Review API endpoint responses in Network tab (F12)
4. Check database for data inconsistencies

---

**Testing Time**: ~15 minutes
**Status**: ✅ Ready for Testing
**Date**: October 12, 2025
