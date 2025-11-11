# Quick Test Steps - Location Pricing Fix

## 🚀 Start Here

### 1. Restart Your Dev Server (REQUIRED!)

```bash
# In your terminal, press Ctrl+C to stop
# Then run:
npm run dev
```

**Why?** The fix is in the code, but you need to restart the server to load it.

### 2. Clear Browser Cache (REQUIRED!)

Press `Ctrl+Shift+R` or `F5` to hard refresh

**Why?** Your browser might be using old cached JavaScript.

---

## 🧪 Test the Fixes (3 minutes)

### Test 1: Price Editor (Step 5) - No Revert Bug

1. **Login**: `pcinetadmin` / `111111`

2. **Go to**: Products > Simple Price Editor

3. **Search**: `Sample UTP CABLE`

4. **Step 3**: Check ✓ Tuguegarao

5. **Step 5**: Set prices:
   - Roll: Selling Price ₱2,014
   - Meter: Selling Price ₱9

6. **Click**: "Save All Prices"

7. **✅ SUCCESS IF**:
   - Success message appears
   - Prices **STAY** at values you entered (don't revert)

8. **❌ BUG STILL EXISTS IF**:
   - Prices revert to old values
   - (Take screenshot of browser console - F12)

### Test 2: POS Initial Cart Pricing

1. **Login**: Any Tuguegarao cashier (or `EricsonChanCashierTugue` / `111111`)

2. **Go to**: Dashboard > POS

3. **Add Product**: Search "Sample UTP CABLE" → Add to cart

4. **✅ VERIFY Roll Price**:
   - Should show: **₱2,014.00 × 1 Roll**
   - NOT ₱1,650 (old Step 4 price)

5. **Change to Meter**:
   - Click "Selling in: Roll - Click to Change Unit & Quantity"
   - Select "Meter (m)"
   - Enter quantity: 1

6. **✅ VERIFY Meter Price**:
   - Unit Price: **₱9.00 / Meter**
   - NOT ₱6.71 (old global price)

7. **Click**: "Apply Unit & Quantity"

8. **✅ VERIFY Cart**:
   - Should show: **₱9.00 × 1 Meter**

---

## 📊 Verification Script

Want to check database state?

```bash
npx tsx scripts/verify-location-pricing-fix.ts
```

This shows:
- Current prices in database
- Whether the API will return correct prices
- If the bug is fixed or still exists

---

## ✅ What Should Work Now

### Fix 1: Price Editor (Step 5)
Before fix:
```
Set to ₱10 → Save → ❌ Reverts to ₱9
```

After fix:
```
Set to ₱10 → Save → ✅ Stays at ₱10
```

### Fix 2: POS Initial Cart Pricing
Before fix:
```
Add to cart → Shows ₱1,650 (Roll) ❌ Wrong (Step 4 price)
Change to Meter → Shows ₱9 ✅ Correct
```

After fix:
```
Add to cart → Shows ₱2,014 (Roll) ✅ Correct (Step 5 price)
Change to Meter → Shows ₱9 ✅ Correct
```

---

## 🐛 If Still Broken

1. **Check browser console** (F12 > Console tab)
   - Look for red errors
   - Take screenshot

2. **Check Network tab** (F12 > Network tab)
   - Find the `unit-prices` request
   - Check if URL includes `locationIds=4`
   - Take screenshot

3. **Verify restart**:
   ```bash
   # Stop server
   Ctrl+C

   # Wait 5 seconds

   # Start again
   npm run dev
   ```

4. **Clear cache again**: `Ctrl+Shift+R`

---

## 📖 More Info

- **Price Editor Fix**: See `FIX-SUMMARY-LOCATION-PRICING-REVERT.md`
- **POS Pricing Fix**: See `FIX-POS-INITIAL-CART-PRICING.md`
- **Original Bug Report**: See `BUGFIX-LOCATION-PRICING-RELOAD.md`
- **How to Use Step 4 vs Step 5**: See `STEP-4-VS-STEP-5-GUIDE.md`

---

## 🎯 Expected Behavior

### In Price Editor (Step 5):
- Set Roll to ₱2,014, Meter to ₱9
- Click "Save All Prices"
- Prices **persist** (don't revert)
- Success message shows: "Successfully updated prices for 2 unit(s) across 1 location(s)"

### In POS - Initial Add:
- Add "Sample UTP CABLE" to cart
- Shows: **₱2,014.00 × 1 Roll** (Step 5 price, not Step 4)

### In POS - Unit Change:
- Click "Change Unit & Quantity"
- Select "Meter"
- Shows: **₱9.00 / Meter** (Step 5 price, not global)
- Apply changes
- Cart shows: **₱9.00 × 1 Meter**

---

**That's it!** Just restart server, clear cache, and test. Should take 2 minutes total.
