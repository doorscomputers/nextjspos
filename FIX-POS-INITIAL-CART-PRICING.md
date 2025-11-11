# Fix: POS Initial Cart Pricing Uses Location-Specific Unit Prices

## Status: ✅ FIXED (Requires Testing)

## The Problem

**User Report**: POS showing wrong prices when adding products to cart:
- Roll price showing ₱1,650 (should be ₱2,014)
- Meter price showing ₱6.71 (should be ₱9)

## Root Cause

The POS `addToCart` function was using the price from `VariationLocationDetails` (Step 4) instead of fetching location-specific **unit prices** from Step 5.

### The Flow (BEFORE FIX):

```typescript
User clicks product → addToCart() runs
  ↓
Gets price from variation.sellingPrice
  ↓
Uses VariationLocationDetails (Step 4 price)
  ├─ Roll: ₱1,650 ❌ (wrong, should be ₱2,014)
  └─ Global fallback, not location-specific unit price
  ↓
Cart shows ₱1,650 for Roll
```

When user clicks "Change Unit & Quantity":
```typescript
POSUnitSelector opens
  ↓
Fetches from /api/pos/product-units
  ↓
Gets ProductUnitLocationPrice (Step 5)
  └─ Meter: ₱9 ✅ (correct location-specific price)
  ↓
Shows ₱9 when you select Meter
```

**The Inconsistency**: Initial cart uses Step 4 price (₱1,650), but unit selector uses Step 5 price (₱9 for Meter).

## The Fix

**File**: `src/app/dashboard/pos/page.tsx` (lines 699-717)

Updated `addToCart` function to fetch location-specific unit prices **before** adding to cart:

```typescript
// BEFORE (line 699):
const price = parseFloat(variation.sellingPrice)  // ❌ Uses Step 4 price

// AFTER (lines 699-717):
// ✅ FIX: Fetch location-specific unit price for primary unit
let price = parseFloat(variation.sellingPrice) // Fallback to Step 4 price

try {
  // Fetch location-specific unit price from Step 5
  const response = await fetch(
    `/api/pos/product-units?productId=${product.id}&locationId=${currentShift?.locationId || 0}`
  )
  const result = await response.json()

  if (response.ok && result.success && result.data.unitPrices) {
    // Find price for the primary unit
    const primaryUnitPrice = result.data.unitPrices.find((up: any) => up.unitId === addingWithUnitId)
    if (primaryUnitPrice) {
      price = primaryUnitPrice.sellingPrice // ✅ Use location-specific unit price
    }
  }
} catch (error) {
  console.error('Error fetching unit price:', error)
  // Continue with fallback price
}
```

### How It Works Now:

1. **User adds product to cart**
2. `addToCart()` fetches from `/api/pos/product-units` (same endpoint as POSUnitSelector)
3. API returns location-specific unit prices with priority:
   - ProductUnitLocationPrice (Step 5) ✅
   - ProductUnitPrice (global fallback)
   - Calculated from base price
4. **Cart shows correct price**: ₱2,014 for Roll at Tuguegarao

### Price Priority Logic:

```
1. ProductUnitLocationPrice (Step 5 - location-specific)
   └─ If user set prices in Step 5, use these ✅

2. ProductUnitPrice (global fallback)
   └─ If no Step 5 prices, use global unit prices

3. VariationLocationDetails (Step 4 - base product price)
   └─ If no unit prices at all, use this as last resort
```

## Testing Instructions

### Test Scenario: Sample UTP CABLE at Tuguegarao

**Setup** (if not done already):
1. Login as admin: `pcinetadmin` / `111111`
2. Go to Products > Simple Price Editor
3. Search: "Sample UTP CABLE"
4. Step 3: Check ✓ Tuguegarao
5. Step 5: Set prices:
   - Roll: Purchase ₱1,900, Selling ₱2,014
   - Meter: Purchase ₱8, Selling ₱9
6. Click "Save All Prices"

**Test POS**:
1. **Restart dev server** (REQUIRED):
   ```bash
   # Press Ctrl+C
   npm run dev
   ```

2. **Clear browser cache**: Ctrl+Shift+R

3. **Login as cashier**: Any Tuguegarao cashier account

4. **Add product to cart**:
   - Search: "Sample UTP CABLE"
   - Click to add to cart

5. **✅ VERIFY Initial Price**:
   - Should show: **₱2,014.00 × 1 Roll**
   - NOT ₱1,650 (old Step 4 price)

6. **Change unit to Meter**:
   - Click "Selling in: Roll - Click to Change Unit & Quantity"
   - Select "Meter (m)" from dropdown
   - Enter quantity: 1

7. **✅ VERIFY Meter Price**:
   - Unit Price: **₱9.00 / Meter**
   - NOT ₱6.71 (old global price)

8. **Click "Apply Unit & Quantity"**

9. **✅ VERIFY Cart Updated**:
   - Should show: **₱9.00 × 1 Meter**

## Expected Behavior After Fix

### Before Fix:
```
Add to cart → ₱1,650 (Roll) ❌ Wrong
Change to Meter → ₱9 ✅ Correct
```
**Problem**: Inconsistent pricing between initial add and unit change

### After Fix:
```
Add to cart → ₱2,014 (Roll) ✅ Correct (Step 5 price)
Change to Meter → ₱9 (Meter) ✅ Correct (Step 5 price)
```
**Result**: Consistent location-specific pricing throughout

## Database State

### For Product: Sample UTP CABLE (ID: 4627) at Tuguegarao (ID: 4):

**ProductUnitLocationPrice** (Step 5 - Priority):
```
Roll  (ID: 3): Purchase ₱1,900, Selling ₱2,014 ← POS will use this
Meter (ID: 4): Purchase ₱8,     Selling ₱9     ← POS will use this
```

**VariationLocationDetails** (Step 4 - Fallback):
```
Selling Price: ₱1,650 (old base price, now ignored if Step 5 exists)
```

**ProductUnitPrice** (Global Fallback):
```
Roll:  ₱1,650
Meter: ₱6.71
```

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `src/app/dashboard/pos/page.tsx` | 699-717 | Fetch location-specific unit price before adding to cart |

## Performance Note

The fix adds one API call per product when adding to cart. This is necessary to ensure correct pricing and is acceptable because:

1. **Cached by browser**: Subsequent adds of same product hit cache
2. **Fast endpoint**: `/api/pos/product-units` is optimized for POS
3. **Fallback logic**: If API fails, uses Step 4 price as fallback
4. **Consistent**: Same pricing logic as unit selector

## Related Fixes

This fix completes the location-specific pricing implementation:

1. ✅ **Step 5 Editor**: Saves location-specific prices correctly
2. ✅ **Step 5 Reload**: Fixed revert bug (from previous fix)
3. ✅ **POS Unit Selector**: Shows location-specific prices when changing units
4. ✅ **POS Initial Add** (THIS FIX): Uses location-specific prices when adding to cart

## Related Documentation

- `BUGFIX-LOCATION-PRICING-RELOAD.md` - Step 5 reload fix
- `FIX-SUMMARY-LOCATION-PRICING-REVERT.md` - Complete reload bug documentation
- `LOCATION-SPECIFIC-UNIT-PRICING-IMPLEMENTATION.md` - Feature overview
- `STEP-4-VS-STEP-5-GUIDE.md` - User guide explaining Step 4 vs Step 5

## Summary

**What was broken**: POS `addToCart()` used Step 4 price (₱1,650) instead of Step 5 location-specific unit price (₱2,014)

**What was fixed**: addToCart() now fetches location-specific unit prices from same API as POSUnitSelector

**What you need to do**:
1. Restart dev server
2. Clear browser cache
3. Add "Sample UTP CABLE" to cart
4. Verify shows ₱2,014 (not ₱1,650)
5. Change to Meter
6. Verify shows ₱9 (not ₱6.71)

**Expected outcome**: POS uses Step 5 location-specific prices consistently

---

**Fix Date**: 2025-11-11
**Status**: ✅ Code Fixed, ⏳ Awaiting User Testing
**Affected Feature**: POS Initial Cart Pricing
**Files Changed**: 1 (pos/page.tsx)
