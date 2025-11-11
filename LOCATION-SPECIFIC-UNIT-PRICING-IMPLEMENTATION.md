# Location-Specific Unit Pricing Integration

## Overview
This document describes the implementation of location-specific unit pricing functionality integrated into the simple Price Editor and POS system.

## Implementation Date
2025-11-11

## Feature Description
Each business location can now have different unit prices for the same product. For example:
- **Bambang**: Meter = ₱9, Roll = ₱2,014
- **Main Store**: Meter = ₱7, Roll = ₱1,800
- **Tuguegarao**: Uses global prices (fallback)

## Changes Made

### 1. POS API Update
**File**: `src/app/api/pos/product-units/route.ts`

- Added `locationId` as required parameter
- Fetches location-specific prices from `ProductUnitLocationPrice` table
- Falls back to global prices from `ProductUnitPrice` if no location-specific price exists
- Merges location-specific and global prices with location prices taking priority

**API Endpoint**: `GET /api/pos/product-units?productId=123&locationId=2`

### 2. POSUnitSelector Component Update
**File**: `src/components/POSUnitSelector.tsx`

- Added `locationId` prop
- Passes `locationId` to API when fetching unit prices
- Re-fetches prices when `locationId` changes

**Usage**:
```tsx
<POSUnitSelector
  productId={item.productId}
  locationId={currentShift?.locationId || 0}
  // ... other props
/>
```

### 3. POS Page Update
**File**: `src/app/dashboard/pos/page.tsx`

- Passes `currentShift?.locationId` to `POSUnitSelector`
- POS now uses location-specific unit prices based on the cashier's location

### 4. UnitPriceUpdateForm Component Update
**File**: `src/components/UnitPriceUpdateForm.tsx`

- Added `selectedLocations` prop (optional)
- Detects location-specific mode when `selectedLocations` has values
- Sends `locationIds` to API when saving location-specific prices
- Shows different notification messages for global vs location-specific updates

**Usage**:
```tsx
// Global pricing (no location context)
<UnitPriceUpdateForm product={product} />

// Location-specific pricing
<UnitPriceUpdateForm
  product={product}
  selectedLocations={[2, 3, 4]} // Bambang, Main Store, Tuguegarao
/>
```

### 5. Simple Price Editor Update
**File**: `src/app/dashboard/products/simple-price-editor/page.tsx`

- Step 5 now receives `selectedLocations` from Step 3
- Shows informational message when in location-specific mode
- Indicates how many locations the prices will be applied to

**User Flow**:
1. Select product (Step 1-2)
2. Select locations (Step 3) - e.g., check Bambang and Main Store
3. Update location price for primary unit (Step 4) - optional
4. Update unit prices (Step 5) - **NOW LOCATION-SPECIFIC!**
   - If locations selected: Saves to `ProductUnitLocationPrice`
   - If no locations: Saves to `ProductUnitPrice` (global)

### 6. Unit Prices API Update
**File**: `src/app/api/products/unit-prices/route.ts`

- Added `locationIds` parameter (optional)
- Detects location-specific mode when `locationIds` is provided
- Saves to `ProductUnitLocationPrice` table for each location/unit combination
- Falls back to `ProductUnitPrice` (global) when no `locationIds` provided

**API Request**:
```json
{
  "productId": 4627,
  "unitPrices": [
    { "unitId": 3, "purchasePrice": 1900, "sellingPrice": 2014 },
    { "unitId": 4, "purchasePrice": 8, "sellingPrice": 9 }
  ],
  "locationIds": [2, 3] // Optional: Bambang and Main Store
}
```

## Database Tables

### ProductUnitPrice (Global)
Stores unit prices at the **product level** (applies to all locations).
```
productId | unitId | purchasePrice | sellingPrice
----------|--------|---------------|-------------
4627      | 3      | 1500          | 1650
4627      | 4      | 6.33          | 6.71
```

### ProductUnitLocationPrice (Location-Specific)
Stores unit prices at the **product-location level** (overrides global).
```
productId | locationId | unitId | purchasePrice | sellingPrice | lastUpdatedBy
----------|------------|--------|---------------|--------------|---------------
4627      | 2          | 3      | 1900          | 2014         | 1
4627      | 2          | 4      | 8             | 9            | 1
4627      | 3          | 3      | 1800          | 1950         | 1
4627      | 3          | 4      | 7             | 8            | 1
```

## Priority Logic

When POS retrieves unit prices:
1. **First**: Check `ProductUnitLocationPrice` for the current location
2. **If not found**: Fall back to `ProductUnitPrice` (global)
3. **If still not found**: Calculate proportionally from base price

## Benefits

✅ **Flexibility**: Each location can have different pricing strategies
✅ **Fallback**: Automatically uses global prices if location-specific not set
✅ **Audit Trail**: Tracks who last updated location prices and when
✅ **Backward Compatible**: Existing global pricing continues to work
✅ **Simple UI**: Integrated into existing Price Editor workflow

## Testing Workflow

### Test Scenario 1: Set Location-Specific Prices

1. Navigate to **Products > Simple Price Editor**
2. Search for "Sample UTP CABLE"
3. In **Step 3**: Check "Bambang" and "Main Store"
4. In **Step 5**: Set prices:
   - Roll: Purchase ₱1,900, Selling ₱2,014
   - Meter: Purchase ₱8, Selling ₱9
5. Click "Save All Prices"
6. ✅ Verify success message shows "Updated 4 location-specific unit price(s)"

### Test Scenario 2: POS Uses Location-Specific Prices

1. Login as cashier at Bambang location
2. Start shift
3. Add "Sample UTP CABLE" to cart
4. Click "Change Unit & Quantity"
5. Select "Meter" unit
6. ✅ Verify price shows **₱9.00 per Meter** (not ₱6.71)

### Test Scenario 3: Global Pricing Still Works

1. Navigate to **Products > Simple Price Editor**
2. Search for "Sample UTP CABLE"
3. In **Step 3**: Do NOT check any locations
4. In **Step 5**: Set prices:
   - Roll: Purchase ₱1,500, Selling ₱1,650
5. Click "Save All Prices"
6. ✅ Verify saves to `ProductUnitPrice` (global)

### Test Scenario 4: Fallback to Global Prices

1. Login as cashier at Tuguegarao location (no location-specific prices set)
2. Add "Sample UTP CABLE" to cart
3. Click "Change Unit & Quantity"
4. Select "Meter" unit
5. ✅ Verify price shows **₱6.71 per Meter** (global price fallback)

## Rollback Plan

If issues occur:
1. Revert `src/app/api/pos/product-units/route.ts` to use `ProductUnitPrice` only
2. Revert `src/components/POSUnitSelector.tsx` to remove `locationId` prop
3. Revert `src/app/dashboard/pos/page.tsx` to not pass `locationId`
4. Location-specific prices in database remain safe for future use

## Future Enhancements

- [ ] Bulk import location-specific prices from CSV/Excel
- [ ] Report showing price variances across locations
- [ ] Copy prices from one location to another
- [ ] Price history tracking per location
- [ ] Location-specific discount rules

## Notes

- Database schema for `ProductUnitLocationPrice` already existed
- This implementation integrates it into the main POS workflow
- The feature was previously only accessible through `/dashboard/products/location-pricing`
- Now fully integrated into the simple Price Editor for easier use
