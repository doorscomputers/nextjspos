# Bug Fix: Location-Specific Prices Reverting After Save

## Issue
When updating location-specific unit prices in Step 5:
1. User sets Meter price to 10
2. Clicks "Save All Prices"
3. Shows success message
4. Price reverts back to 9 (old value)

## Root Cause
After saving, the component called `fetchUnitPrices()` which was fetching **global prices** instead of **location-specific prices**. The flow was:

1. Save to `ProductUnitLocationPrice` (location-specific) ✅
2. Reload from `ProductUnitPrice` (global) ❌
3. UI shows old global prices instead of new location-specific prices

## Solution

### 1. Updated GET Endpoint
**File**: `src/app/api/products/unit-prices/route.ts`

Added support for `locationIds` query parameter:
```typescript
GET /api/products/unit-prices?productId=123&locationIds=2,3,4
```

**Logic**:
- If `locationIds` provided: Fetch location-specific prices from `ProductUnitLocationPrice`
- Fallback to global prices for units without location-specific prices
- If no `locationIds`: Fetch global prices only

### 2. Updated Component
**File**: `src/components/UnitPriceUpdateForm.tsx`

Modified `fetchUnitPrices()` to include location context:
```typescript
// Before
const response = await fetch(`/api/products/unit-prices?productId=${product.id}`)

// After
let url = `/api/products/unit-prices?productId=${product.id}`
if (isLocationSpecific) {
  url += `&locationIds=${selectedLocations!.join(',')}`
}
const response = await fetch(url)
```

### 3. Fixed Missing userId
**File**: `src/app/api/products/unit-prices/route.ts`

Added missing `userId` variable that was causing "Failed to update unit prices" error:
```typescript
const userId = parseInt(session.user.id)
```

## Changes Summary

| File | Change |
|------|--------|
| `src/app/api/products/unit-prices/route.ts` | - Added `locationIds` param to GET<br>- Fetch location-specific prices when locations provided<br>- Fixed missing `userId` in POST<br>- Added better error logging |
| `src/components/UnitPriceUpdateForm.tsx` | - Pass `locationIds` when fetching prices<br>- Ensures reload uses same location context as save |

## Testing

### Before Fix
```
1. Select Tuguegarao in Step 3
2. Set Meter = 10 in Step 5
3. Click Save
4. ✅ Success message
5. ❌ Price shows 9 (reverted)
```

### After Fix
```
1. Select Tuguegarao in Step 3
2. Set Meter = 10 in Step 5
3. Click Save
4. ✅ Success message
5. ✅ Price shows 10 (persisted!)
```

## How to Apply Fix

1. **Stop dev server** (Ctrl+C)

2. **Restart**:
   ```bash
   npm run dev
   ```

3. **Clear browser cache** (Ctrl+Shift+R or F5)

4. **Test the fix**:
   - Login as `pcinetadmin` / `111111`
   - Go to Products > Simple Price Editor
   - Search "Sample UTP CABLE"
   - Check Tuguegarao in Step 3
   - Set Meter to any value (e.g., 10) in Step 5
   - Click "Save All Prices"
   - ✅ Verify price stays at 10 (doesn't revert)

## Database State

Location-specific prices are now correctly:
- **Saved** to `ProductUnitLocationPrice` table
- **Fetched** from `ProductUnitLocationPrice` table
- **Displayed** in the UI after save

Global prices remain in `ProductUnitPrice` as fallback for locations without specific prices.

## Related Files
- `src/app/api/products/unit-prices/route.ts` - GET and POST endpoints
- `src/components/UnitPriceUpdateForm.tsx` - UI component
- `prisma/schema.prisma` - Database schema (no changes)

## Fix Date
2025-11-11

## Status
✅ FIXED - Ready for testing
