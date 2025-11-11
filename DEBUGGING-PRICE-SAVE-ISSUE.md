# Debugging: Price Save Issue - Step 5 Editor

## Problem Statement

**User Report**: When setting new prices in Step 5 (Product → Select Location Prices), entering Roll=₱2025 and Meter=₱12 for Bambang location, the form shows success message but the database still has old values (Roll=₱2014, Meter=₱9).

## Investigation Summary

### What We Tested

#### ✅ API Save Logic - WORKING
Created test script `scripts/test-bambang-price-update.ts` that directly calls the same Prisma upsert logic used by the API.

**Result**: ✅ **SUCCESS** - Prices updated from ₱2014/₱9 to ₱2025/₱12 correctly.

**Conclusion**: The database save logic in `src/app/api/products/unit-prices/route.ts` works perfectly. The bug is NOT in the API.

### Where the Bug Likely Is

Since the API logic works when tested directly, the problem is in one of these areas:

1. **React Component Form State** (`src/components/UnitPriceUpdateForm.tsx`)
   - The `changes` object might not be tracking user input correctly
   - Changes might get cleared before the API call
   - Input validation might be rejecting the values

2. **API Request from Component**
   - Component might be sending empty or wrong data
   - Request might be failing but showing cached success
   - Wrong location IDs being sent

3. **Production vs Development Environment**
   - Different database state in production
   - Different businessId causing permission issues
   - Caching at Vercel/browser level

4. **User Session/Context**
   - User's businessId doesn't match product's businessId
   - User doesn't have PRODUCT_PRICE_EDIT permission
   - Wrong location selected

## Debugging Tools Deployed

### Enhanced Console Logging

Deployed comprehensive debugging in commits:
- `0bb2e07` - Initial debug logs
- `054c6fd` - Enhanced upsert logging

### Component-Side Logs (🔵 Blue Circle)

In `src/components/UnitPriceUpdateForm.tsx`, line 153:
```typescript
console.log('🔵 Saving location-specific prices:', {
  product: product.name,
  locations: selectedLocations,
  updates: updates
})
```

**What to Check**:
- Is `updates` array populated with new values (2025, 12)?
- Is `selectedLocations` the correct array with Bambang's location ID?
- Does the array have the correct structure?

### API-Side Logs (🔵 Blue Circle)

In `src/app/api/products/unit-prices/route.ts`:

#### Line 234 - Request Received
```typescript
console.log('🔵 POST /api/products/unit-prices received:', {
  productId,
  unitPrices,
  locationIds,
  userId
})
```

**What to Check**:
- Does `unitPrices` contain the new values?
- Is `locationIds` the correct array?
- Is `userId` valid?

#### Line 251 - Location-Specific Detection
```typescript
console.log('🔵 Is location-specific?', isLocationSpecific, 'Locations:', locationIds)
```

**What to Check**:
- Does `isLocationSpecific` = true?
- If false, the code will use global prices path (wrong!)

#### Line 274 - Upsert Parameters
```typescript
console.log('🔵 Upserting:', {
  where: { productId, locationId, unitId },
  purchasePrice: parseFloat(purchasePrice),
  sellingPrice: parseFloat(sellingPrice),
  userId,
  businessId
})
```

**What to Check**:
- Are the WHERE clause values correct (productId, locationId, unitId)?
- Are purchasePrice and sellingPrice the NEW values (2025, 12)?
- Does businessId match the product's business?

#### Line 308 - Upsert Result
```typescript
console.log('🔵 Upsert result:', {
  id: result.id,
  purchasePrice: result.purchasePrice.toString(),
  sellingPrice: result.sellingPrice.toString(),
  updatedAt: result.updatedAt
})
```

**What to Check**:
- Does `sellingPrice` show the NEW value (2025, 12)?
- Did `updatedAt` timestamp change?
- If values are OLD, the upsert didn't work (database constraint issue)

## How to Debug in Production

### Step 1: Open Browser Console
1. Go to the Price Editor (Step 5)
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Clear any existing logs

### Step 2: Trigger the Save
1. Select "Sample UTP CABLE" product
2. Select "Bambang" location
3. Change Roll to ₱2025
4. Change Meter to ₱12
5. Click "Save All Prices"

### Step 3: Examine Console Logs
Look for logs marked with 🔵 (blue circle) and check each section as documented above.

### Step 4: Check Server Logs (Vercel)
If no browser console logs appear:
1. Go to Vercel dashboard
2. Select the deployment
3. View "Functions" logs
4. Look for POST /api/products/unit-prices
5. Check 🔵 logs in server logs

## Expected vs Actual Behavior

### Expected (Working) Flow:
```
1. User enters: Roll=2025, Meter=12
2. Component logs: updates=[{unitId: 3, sellingPrice: 2025}, {unitId: 4, sellingPrice: 12}]
3. API receives: unitPrices=[...same...], locationIds=[3]
4. Upsert called with: sellingPrice=2025, sellingPrice=12
5. Upsert returns: sellingPrice='2025', sellingPrice='12', updatedAt=<new timestamp>
6. Database query shows: Roll ₱2025, Meter ₱12
```

### If Component Issue:
```
1. User enters: Roll=2025, Meter=12
2. Component logs: updates=[] (EMPTY!)  <-- BUG HERE
   OR
   Component logs: updates=[{unitId: 3, sellingPrice: 2014}, {unitId: 4, sellingPrice: 9}]  <-- OLD VALUES
```

### If API Issue:
```
1. User enters: Roll=2025, Meter=12
2. Component logs: updates=[{unitId: 3, sellingPrice: 2025}, {unitId: 4, sellingPrice: 12}]  ✅
3. API receives: unitPrices=[] (EMPTY!)  <-- BUG HERE
   OR
4. API receives but isLocationSpecific=false  <-- BUG HERE
```

### If Database Issue:
```
1-4. All logs show correct values ✅
5. Upsert returns: sellingPrice='2014', sellingPrice='9' (OLD!)  <-- BUG HERE
6. This means upsert WHERE clause didn't match, or database constraint blocked update
```

## Possible Root Causes

### 1. Form Changes Not Tracked
**File**: `src/components/UnitPriceUpdateForm.tsx`, lines 86-98

The `handlePriceChange` function might not be called when user types. Check:
- Are onChange handlers attached to input fields?
- Is `handlePriceChange` being called?
- Is `setChanges` updating state correctly?

### 2. Changes Object Cleared Before Save
**File**: `src/components/UnitPriceUpdateForm.tsx`, line 172

After success, the component calls `setChanges({})` which clears the changes. If success is shown but save didn't complete, this could cause confusion.

### 3. Wrong Location Context
**File**: Component might be passing wrong `selectedLocations` array.

Check:
- Is Bambang location ID = 3?
- Is `selectedLocations` = [3]?
- Or is it selecting ALL locations?

### 4. Validation Preventing Save
**File**: `src/components/UnitPriceUpdateForm.tsx`, lines 128-136

Validation might reject the values:
- `sellingPrice <= 0` → error
- `purchasePrice < 0` → error

But user would see error notification, not success.

### 5. Business ID Mismatch (Unlikely)
The API checks `businessId` matches. If user's business doesn't match product's business, the update would fail. But this would return 404 error, not success.

## Quick Fix Tests

### Test 1: Bypass Form Component
Create a simple API test in browser console:
```javascript
fetch('/api/products/unit-prices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 4627, // Sample UTP CABLE
    locationIds: [3], // Bambang
    unitPrices: [
      { unitId: 3, purchasePrice: 1900, sellingPrice: 2025 },
      { unitId: 4, purchasePrice: 8, sellingPrice: 12 }
    ]
  })
})
.then(r => r.json())
.then(console.log)
```

**Expected**: Success response + database updated to ₱2025/₱12
**If this works**: Bug is in the React component
**If this fails**: Bug is in API (unlikely based on local test)

### Test 2: Log Changes Object Before Save
Add temporary debugging in component:
```typescript
const handleSave = async () => {
  console.log('🔍 DEBUG changes object:', changes)
  console.log('🔍 DEBUG hasChanges():', hasChanges())
  console.log('🔍 DEBUG updates will be:', Object.entries(changes))
  // ... rest of function
}
```

## Verification After Fix

Once the bug is identified and fixed:

1. Clear browser cache
2. Open Step 5 editor
3. Select "Sample UTP CABLE" + "Bambang"
4. Enter Roll=₱2999, Meter=₱15 (different values to confirm)
5. Click Save
6. Verify success message
7. Refresh page / reopen editor
8. Confirm new values (₱2999/₱15) are displayed
9. Run diagnostic script:
```bash
npx tsx scripts/show-product-pricing.ts
```
10. Confirm database shows ₱2999/₱15 for Bambang

## Files to Review

1. `src/components/UnitPriceUpdateForm.tsx` - React form component
2. `src/app/api/products/unit-prices/route.ts` - API endpoint
3. `scripts/test-bambang-price-update.ts` - Direct database test (PASSED ✅)
4. `scripts/show-product-pricing.ts` - Database verification

## Next Steps

1. Wait for user to test in production with browser console open
2. Analyze the 🔵 debug logs to pinpoint where the bug occurs
3. Apply targeted fix based on findings
4. Verify fix works in production
5. Remove debug logging after confirmation
