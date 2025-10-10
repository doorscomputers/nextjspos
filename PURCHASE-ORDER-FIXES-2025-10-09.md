# Purchase Order Page Fixes - October 9, 2025

## Issues Fixed

### 1. ✅ Product Search Dropdown Not Showing Results

**Problem:** When searching by product name (e.g., "gener" or "generic"), the dropdown showed "No products found" even though matching products existed in the database.

**Root Cause:** The fuzzy search query in `src/app/api/products/search/route.ts` was filtering variations by the search term. When searching for "gener", it found products "Generic Mouse" and "Generic PS", but their variations ("Default" with SKUs "PCI-0001" and "PCI-0002") didn't contain "gener", so they were filtered out.

**Fix:** Removed the variation filtering in fuzzy search (lines 120-124). Now when a product matches by name, ALL variations of that product are returned.

```typescript
// BEFORE (broken):
include: {
  variations: {
    where: {
      OR: [
        { name: { contains: searchTrimmed, mode: 'insensitive' } },
        { sku: { contains: searchTrimmed, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
  },
}

// AFTER (fixed):
include: {
  variations: {
    // Return ALL variations of matching products, not filtered by search term
    orderBy: { name: 'asc' },
  },
}
```

**File:** `src/app/api/products/search/route.ts`

---

### 2. ✅ Location Access Error When Saving Purchase Order

**Problem:** User Jheirone received "You do not have access to this location" error when trying to save a purchase order.

**Root Cause:** The user had no locations assigned in the `userLocation` table. The API checks location access on line 173-191 of `src/app/api/purchases/route.ts`.

**Fix:** Assigned the Warehouse location (ID: 2) to user Jheirone (ID: 12).

**Script Used:** `assign-jheirone-warehouse.js`

**Verification:**
```
✓ Successfully assigned Warehouse (ID: 2) to Jheirone
User now has access to 1 location(s):
  - Warehouse (ID: 2)
```

---

### 3. ✅ Missing Validation Messages

**Problem:** No friendly error messages when required fields (supplier, location) were not filled before clicking "Create Purchase Order".

**Fix:** Enhanced validation messages in `src/app/dashboard/purchases/create/page.tsx` (lines 224-254):

```typescript
// Enhanced validation messages:
if (!supplierId) {
  toast.error('Please select a supplier before creating the purchase order')
  return
}

if (!warehouseLocationId) {
  toast.error('Please select a receiving location before creating the purchase order')
  return
}

if (items.length === 0) {
  toast.error('Please add at least one product to the purchase order')
  return
}

const invalidQuantityItems = items.filter(item => item.quantity <= 0)
if (invalidQuantityItems.length > 0) {
  toast.error(`Invalid quantity for ${invalidQuantityItems[0].productName}. Quantity must be greater than 0.`)
  return
}

const invalidCostItems = items.filter(item => item.unitCost < 0)
if (invalidCostItems.length > 0) {
  toast.error(`Invalid unit cost for ${invalidCostItems[0].productName}. Cost cannot be negative.`)
  return
}
```

---

### 4. ✅ Currency Symbol Change (from previous session)

**Problem:** All currency amounts showed $ instead of ₱.

**Fix:** Changed all currency displays to literal ₱ symbol throughout:
- Unit Cost labels
- Subtotal displays
- Tax, Discount, Shipping labels
- Order Summary amounts
- ProductAutocomplete component

**Files:**
- `src/app/dashboard/purchases/create/page.tsx`
- `src/components/ProductAutocomplete.tsx`

---

## Testing Verification

### Test 1: Product Search by Name ✅
```
Search term: "gener"
Expected: Dropdown shows:
  - Generic Mouse - Default (SKU: PCI-0001)
  - Generic PS - Default (SKU: PCI-0002)
Result: ✅ PASSED
```

### Test 2: Location Access ✅
```
User: Jheirone
Location: Warehouse (ID: 2)
Action: Create purchase order
Result: ✅ Location access granted
```

### Test 3: Validation Messages ✅
```
Scenario 1: No supplier selected
Result: ✅ "Please select a supplier before creating the purchase order"

Scenario 2: No location selected
Result: ✅ "Please select a receiving location before creating the purchase order"

Scenario 3: No products added
Result: ✅ "Please add at least one product to the purchase order"
```

---

## Technical Details

### Database Changes
- Added `UserLocation` record:
  - userId: 12 (Jheirone)
  - locationId: 2 (Warehouse)

### API Changes
- `src/app/api/products/search/route.ts`: Removed variation filtering in fuzzy search

### UI Changes
- `src/app/dashboard/purchases/create/page.tsx`: Enhanced validation with detailed error messages
- Error response handling improved with console logging

---

## Files Modified

1. ✅ `src/app/api/products/search/route.ts` - Fixed fuzzy search variation filtering
2. ✅ `src/app/dashboard/purchases/create/page.tsx` - Enhanced validation messages
3. ✅ Database: Added UserLocation for Jheirone → Warehouse

---

## Scripts Created for Debugging

- `check-products-gene.js` - Verify products exist in database
- `check-jheirone-locations.js` - Check user's location assignments
- `assign-jheirone-warehouse.js` - Assign location to user
- `test-search-fix.js` - Test the fixed search query directly against database

---

## Next Steps

1. Test creating a complete purchase order end-to-end
2. Verify purchase order appears in the list
3. Test receiving goods against the purchase order
4. Ensure inventory updates correctly upon receipt

---

## Server Status

- Development server running at: http://localhost:3000
- All changes compiled successfully
- No TypeScript errors
- Ready for testing
