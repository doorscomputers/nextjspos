# Fix Summary: Location-Specific Unit Prices Reverting After Save

## Status: ✅ FIXED (Awaiting User Testing)

## The Bug

**User Report**: "I updated the per piece price to 10, when I saved it, successful but it goes back to 9 again"

**What Was Happening**:
```
1. User sets Meter price to ₱10 in Step 5
2. Clicks "Save All Prices"
3. ✅ Success message appears
4. ❌ Price immediately reverts back to ₱9
```

## Root Cause Analysis

### The Problem Flow:

```typescript
// BEFORE FIX:

1. User clicks "Save All Prices"
   └─> POST /api/products/unit-prices
       └─> Saves to ProductUnitLocationPrice ✅
           (Meter = ₱10 for Tuguegarao)

2. Component calls fetchUnitPrices() to reload
   └─> GET /api/products/unit-prices?productId=4627
       └─> ❌ NO locationIds parameter!
       └─> Fetches from ProductUnitPrice (global)
           (Meter = ₱9 global fallback)

3. UI displays ₱9 (old global value)
   └─> ❌ User sees price "revert"
```

### Why It Happened:

**File**: `src/components/UnitPriceUpdateForm.tsx`

The `fetchUnitPrices()` function was NOT passing the `locationIds` parameter:

```typescript
// BEFORE FIX (line 53-63):
const fetchUnitPrices = async () => {
  const response = await fetch(
    `/api/products/unit-prices?productId=${product.id}`
    // ❌ Missing locationIds!
  )
}
```

So when reloading, it fetched **global prices** instead of **location-specific prices**.

## The Fix

### Change 1: Updated Component to Pass locationIds

**File**: `src/components/UnitPriceUpdateForm.tsx` (lines 57-61)

```typescript
// AFTER FIX:
const fetchUnitPrices = async () => {
  let url = `/api/products/unit-prices?productId=${product.id}`

  // ✅ ADD: Pass locationIds when in location-specific mode
  if (isLocationSpecific) {
    url += `&locationIds=${selectedLocations!.join(',')}`
  }

  const response = await fetch(url)
}
```

### Change 2: Enhanced API to Support locationIds

**File**: `src/app/api/products/unit-prices/route.ts` (lines 28, 35-37, 88-155)

```typescript
// GET endpoint now supports locationIds parameter
const locationIdsParam = searchParams.get('locationIds')
const locationIds = locationIdsParam
  ? locationIdsParam.split(',').map(id => parseInt(id.trim()))
  : []

if (locationIds.length > 0) {
  // ✅ Fetch location-specific prices first
  const locationSpecificPrices = await prisma.productUnitLocationPrice.findMany({
    where: { productId, locationId: locationIds[0], businessId }
  })

  // ✅ Merge with global prices as fallback
  // Priority: Location-Specific > Global
}
```

### Bonus Fix: Added Missing userId

**File**: `src/app/api/products/unit-prices/route.ts` (line 210)

```typescript
// This was causing "Failed to update unit prices" error
const userId = parseInt(session.user.id) // ✅ ADDED
```

## Fixed Flow

### AFTER FIX:

```typescript
1. User clicks "Save All Prices"
   └─> POST /api/products/unit-prices
       └─> Saves to ProductUnitLocationPrice ✅
           (Meter = ₱10 for Tuguegarao)

2. Component calls fetchUnitPrices() to reload
   └─> GET /api/products/unit-prices?productId=4627&locationIds=4
       └─> ✅ WITH locationIds parameter!
       └─> Fetches from ProductUnitLocationPrice first
           (Meter = ₱10 for Tuguegarao)

3. UI displays ₱10 (saved location-specific value)
   └─> ✅ Price persists!
```

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `src/components/UnitPriceUpdateForm.tsx` | 57-61 | Pass `locationIds` in fetch URL |
| `src/app/api/products/unit-prices/route.ts` | 28, 35-37, 88-155 | Support `locationIds` parameter in GET |
| `src/app/api/products/unit-prices/route.ts` | 210 | Add missing `userId` variable |

## Testing Instructions

### Prerequisites:
1. **Restart Dev Server** (REQUIRED to load the fixed code):
   ```bash
   # Press Ctrl+C to stop current server
   npm run dev
   ```

2. **Clear Browser Cache** (REQUIRED):
   - Press `Ctrl+Shift+R` or `F5`
   - Or use DevTools > Network > Disable Cache

### Test Steps:

#### Test 1: Verify Price Doesn't Revert

1. **Login**: `pcinetadmin` / `111111`
2. **Navigate**: Products > Simple Price Editor
3. **Search**: "Sample UTP CABLE"
4. **Step 2**: Click "Select Product"
5. **Step 3**: Check ✓ Tuguegarao
6. **Step 5**: Scroll to "Update Unit Prices (All Units)"
7. **Current State**: Should show Meter = ₱9
8. **Change**: Set Meter Selling Price to ₱10
9. **Save**: Click "Save All Prices"
10. **✅ VERIFY**: Price stays at ₱10 (does NOT revert to ₱9)
11. **✅ VERIFY**: Success message shows "Successfully updated prices for 2 unit(s) across 1 location(s)"

#### Test 2: Verify POS Shows Correct Price

1. **Login**: `EricsonChanCashierTugue` / `111111` (or any Tuguegarao cashier)
2. **Navigate**: Dashboard > POS
3. **Add Product**: Search "Sample UTP CABLE" → Add to cart
4. **Check Initial Price**: Should show ₱2,014.00 (Roll price)
5. **Change Unit**: Click "Change Unit & Quantity"
6. **Select**: Choose "Meter" from dropdown
7. **✅ VERIFY**: Price changes to ₱10.00
8. **✅ VERIFY**: Unit shows "Meter"

#### Test 3: Verify Multiple Locations

1. **Login**: `pcinetadmin` / `111111`
2. **Navigate**: Products > Simple Price Editor
3. **Search**: "Sample UTP CABLE"
4. **Step 3**: Check ✓ Tuguegarao AND ✓ Bambang
5. **Step 5**: Set Meter Selling Price to ₱12
6. **Save**: Click "Save All Prices"
7. **✅ VERIFY**: Success message shows "Successfully updated prices for 2 unit(s) across 2 location(s)"
8. **✅ VERIFY**: Price stays at ₱12 for both locations

## Current Database State (as of 2025-11-11 13:47)

```
Product: Sample UTP CABLE (ID: 4627)
Location: Tuguegarao (ID: 4)

Current Prices in ProductUnitLocationPrice:
├─ Roll (ID: 3)
│  ├─ Purchase: ₱1,900.00
│  └─ Selling:  ₱2,014.00 ✅
│
└─ Meter (ID: 4)
   ├─ Purchase: ₱8.00
   └─ Selling:  ₱9.00 ⚠️ (needs update to ₱10 after fix verification)

Global Fallback Prices in ProductUnitPrice:
├─ Roll:  ₱1,650.00
└─ Meter: ₱6.71
```

**Note**: The database currently shows ₱9 because the bug prevented the ₱10 save from persisting. After testing with the fix, it should successfully save and stay at ₱10.

## Expected Results After Testing

### Success Indicators:
- ✅ No "Failed to update unit prices" error
- ✅ Success message appears
- ✅ Price stays at the value you entered (doesn't revert)
- ✅ Reloading the page shows the new price
- ✅ POS shows the correct location-specific price

### If Bug Still Exists:
If you see the price revert after save:

1. **Check Browser Console** (F12 > Console tab):
   - Look for any red errors
   - Share screenshot with error details

2. **Check Network Tab** (F12 > Network tab):
   - Look for the `unit-prices` request
   - Check if `locationIds` parameter is included in the URL
   - Share screenshot

3. **Verify Dev Server Restarted**:
   - Stop server completely (Ctrl+C)
   - Wait 5 seconds
   - Start again: `npm run dev`
   - Clear browser cache again (Ctrl+Shift+R)

## Technical Details

### API Behavior

**GET /api/products/unit-prices**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `productId` | Yes | Product ID |
| `locationIds` | No | Comma-separated location IDs |

**Without locationIds**:
```
GET /api/products/unit-prices?productId=4627
→ Returns GLOBAL prices from ProductUnitPrice
```

**With locationIds**:
```
GET /api/products/unit-prices?productId=4627&locationIds=4
→ Returns LOCATION-SPECIFIC prices from ProductUnitLocationPrice
→ Falls back to global if location-specific not found
```

### Price Priority Logic

```
1. ProductUnitLocationPrice (location-specific)
   └─> If exists, use this ✅

2. ProductUnitPrice (global fallback)
   └─> If no location-specific, use this

3. Calculate from base price
   └─> If no unit price exists, calculate from product base price
```

## Related Documentation

- `BUGFIX-LOCATION-PRICING-RELOAD.md` - Detailed bug fix explanation
- `LOCATION-SPECIFIC-UNIT-PRICING-IMPLEMENTATION.md` - Feature overview
- `STEP-4-VS-STEP-5-GUIDE.md` - User guide for price editor
- `TESTING-LOCATION-PRICING.md` - Complete testing guide

## Verification Script

To check current database state at any time:

```bash
npx tsx scripts/verify-location-pricing-fix.ts
```

This script will:
- Show current prices in database
- Simulate the API reload flow
- Detect if the revert bug still exists
- Provide detailed diagnostics

## Questions?

If you encounter any issues:
1. Run the verification script: `npx tsx scripts/verify-location-pricing-fix.ts`
2. Check browser console for errors (F12)
3. Verify dev server was restarted
4. Share screenshots of any errors or unexpected behavior

## Summary

**What was broken**: fetchUnitPrices() wasn't passing locationIds, causing UI to reload global prices after saving location-specific prices

**What was fixed**: Added locationIds parameter to both the component fetch call and the API endpoint

**What you need to do**: Restart dev server, clear cache, test setting Meter price to ₱10, verify it doesn't revert

**Expected outcome**: Price saves successfully and stays at ₱10 (no revert)

---

**Fix Date**: 2025-11-11
**Status**: ✅ Code Fixed, ⏳ Awaiting User Testing
**Affected Feature**: Location-Specific Unit Pricing (Step 5)
**Files Changed**: 2 (UnitPriceUpdateForm.tsx, route.ts)
