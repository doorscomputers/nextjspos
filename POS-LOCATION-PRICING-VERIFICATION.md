# POS Location-Specific Pricing - Verification Document

## ✅ Status: COMMITTED & DEPLOYED

**Commits**:
- `e2edac3` - Main pricing fix (5 files)
- `7f39b01` - Admin API for bulk population

**Deployed to**: GitHub → Vercel Production (auto-deploy)

---

## 🎯 How POS Gets User's Location Pricing

### 1. User Login & Shift Start

```
User logs in → Starts shift at location (e.g., Bambang)
  ↓
Shift record created with locationId
  ↓
currentShift object stored in POS page state
  {
    id: 123,
    userId: 456,
    locationId: 5,  ← User's location
    ...
  }
```

### 2. Adding Product to Cart

**File**: `src/app/dashboard/pos/page.tsx` (Line 704)

```typescript
const addToCart = async (product, isFreebie) => {
  // ...

  // ✅ Fetch location-specific unit price
  const response = await fetch(
    `/api/pos/product-units?productId=${product.id}&locationId=${currentShift?.locationId || 0}`
    //                                                          ^^^^^^^^^^^^^^^^^^^^^^^^
    //                                                          Uses logged-in user's shift location!
  )

  // Get price for primary unit (e.g., Roll)
  const primaryUnitPrice = result.data.unitPrices.find(up => up.unitId === primaryUnitId)
  price = primaryUnitPrice.sellingPrice  // ✅ Location-specific price!
}
```

### 3. Changing Units (Roll → Meter)

**File**: `src/app/dashboard/pos/page.tsx` (Line 2009)

```typescript
<POSUnitSelector
  productId={item.productId}
  locationId={currentShift?.locationId || 0}  ← User's location
  //          ^^^^^^^^^^^^^^^^^^^^^^^^
  //          Passed to POSUnitSelector
  onUnitChange={(unitData) => handleUnitChange(index, unitData)}
/>
```

**Component**: `src/components/POSUnitSelector.tsx` (Line 58)

```typescript
const fetchUnitData = async () => {
  const response = await fetch(
    `/api/pos/product-units?productId=${productId}&locationId=${locationId}`
    //                                              ^^^^^^^^^^^^
    //                                              User's shift location
  )
  // Returns location-specific prices for all units
}
```

### 4. API Returns Location-Specific Prices

**File**: `src/app/api/pos/product-units/route.ts` (Lines 84-135)

```typescript
// 1. Fetch location-specific prices FIRST
const locationUnitPrices = await prisma.productUnitLocationPrice.findMany({
  where: { productId, locationId, businessId }  ← User's location
})

// 2. Fetch global prices as fallback
const globalUnitPrices = await prisma.productUnitPrice.findMany({
  where: { productId, businessId }
})

// 3. Merge with priority to location-specific
const unitPrices = allUnitIds.map(unitId => {
  // Priority 1: Location-specific price
  const locationPrice = locationUnitPrices.find(up => up.unitId === unitId)
  if (locationPrice) {
    return { unitId, sellingPrice: locationPrice.sellingPrice, isLocationSpecific: true }
  }

  // Priority 2: Global price fallback
  const globalPrice = globalUnitPrices.find(up => up.unitId === unitId)
  if (globalPrice) {
    return { unitId, sellingPrice: globalPrice.sellingPrice, isLocationSpecific: false }
  }
})
```

---

## 📊 Example Flow

### Scenario: Cashier at Bambang location adds Sample UTP CABLE

```
Step 1: Cashier logs in
  └─> Username: BambangCashier
  └─> Starts shift at: Bambang (locationId: 5)

Step 2: Search for product
  └─> Types: "Sample UTP CABLE"
  └─> Clicks to add to cart

Step 3: addToCart() function runs
  └─> Fetches: /api/pos/product-units?productId=4627&locationId=5
                                                      ^^^^^^^^^^^^
                                                      Bambang location

Step 4: API checks database
  └─> Query ProductUnitLocationPrice
      WHERE productId = 4627
        AND locationId = 5        ← Bambang
        AND unitId = 3            ← Roll (primary unit)

  └─> If found: Return Bambang-specific price (e.g., ₱2,014)
  └─> If not found: Return global price fallback (e.g., ₱1,650)

Step 5: Cart displays price
  └─> Sample UTP CABLE
  └─> ₱2,014.00 × 1 Roll        ← Bambang-specific price!

Step 6: User changes unit to Meter
  └─> POSUnitSelector fetches: /api/pos/product-units?productId=4627&locationId=5

  └─> Query ProductUnitLocationPrice
      WHERE productId = 4627
        AND locationId = 5        ← Bambang
        AND unitId = 4            ← Meter

  └─> Returns: ₱9.00 (Bambang Meter price)

Step 7: Cart updates
  └─> Sample UTP CABLE
  └─> ₱9.00 × 1 Meter          ← Bambang-specific Meter price!
```

---

## 🔐 Location Isolation

### Multi-Location Pricing

| Location | Roll Price | Meter Price | Source |
|----------|------------|-------------|--------|
| **Bambang** | ₱2,014 | ₱9 | ProductUnitLocationPrice (if set) |
| **Tuguegarao** | ₱2,014 | ₱9 | ProductUnitLocationPrice (if set) |
| **Santiago** | ₱1,650 | ₱6.71 | Global fallback (if not set) |
| **Baguio** | ₱1,650 | ₱6.71 | Global fallback (if not set) |

### Cashier Sees Only Their Location's Prices

- **Bambang cashier** sees: ₱2,014 Roll, ₱9 Meter (Bambang prices)
- **Santiago cashier** sees: ₱1,650 Roll, ₱6.71 Meter (global fallback)
- **Tuguegarao cashier** sees: ₱2,014 Roll, ₱9 Meter (Tuguegarao prices)

**Each location is isolated!** ✅

---

## 🧪 Testing on Production

### Step 1: Set Prices for Your Location

1. Login as admin: https://pcinet.shop
2. Products > Simple Price Editor
3. Search: "Sample UTP CABLE"
4. Step 3: Check ✓ **Bambang** (or your location)
5. Step 5: Set Roll = ₱2,014, Meter = ₱9
6. Click "Save All Prices"

**Result**: ONLY Bambang prices are updated (not other locations)

### Step 2: Test in POS

1. Login as Bambang cashier
2. Dashboard > POS
3. Add "Sample UTP CABLE" to cart

**Expected Result**:
```
✅ Shows: ₱2,014.00 × 1 Roll (Bambang Roll price)
```

4. Click "Change Unit & Quantity"
5. Select "Meter"

**Expected Result**:
```
✅ Shows: ₱9.00 / Meter (Bambang Meter price)
```

### Step 3: Verify Other Locations Unaffected

1. Login as Santiago cashier (different location)
2. Add "Sample UTP CABLE" to cart

**Expected Result**:
```
✅ Shows: ₱1,650.00 × 1 Roll (global fallback, Santiago not set)
```

This proves location isolation is working! ✅

---

## 🚨 Important Notes

### Why You Might See Wrong Prices:

1. **Location has no prices set in database**
   - Solution: Set prices via Step 5 in Price Editor

2. **Browser cache**
   - Solution: Hard refresh (Ctrl+Shift+R) or Incognito mode

3. **Vercel deployment not complete**
   - Solution: Check Vercel dashboard, wait for "Ready" status

4. **User not in a shift**
   - Solution: Begin shift at correct location

### Price Priority:

```
1. ProductUnitLocationPrice (Step 5) ← Highest priority
   └─> Specific to location + unit

2. ProductUnitPrice (Global)         ← Fallback
   └─> Global across all locations

3. VariationLocationDetails (Step 4) ← Last resort
   └─> Base product price per location
```

---

## 📝 Files Involved

| File | Purpose |
|------|---------|
| `src/app/dashboard/pos/page.tsx` | POS page - calls API with locationId |
| `src/components/POSUnitSelector.tsx` | Unit selector - fetches location prices |
| `src/app/api/pos/product-units/route.ts` | API - returns location-specific prices |
| `src/components/UnitPriceUpdateForm.tsx` | Price editor - saves location prices |
| `src/app/api/products/unit-prices/route.ts` | API - saves/loads location prices |

---

## ✅ Verification Checklist

- [x] POS gets locationId from currentShift (user's shift location)
- [x] addToCart() passes locationId to API
- [x] POSUnitSelector passes locationId to API
- [x] API fetches ProductUnitLocationPrice with locationId
- [x] API falls back to global prices if location price not set
- [x] Price Editor only updates checked locations
- [x] Different locations can have different prices
- [x] Code committed to GitHub (e2edac3, 7f39b01)
- [x] Code deployed to Vercel production

---

## 🎯 Final Summary

**The POS correctly fetches location-specific prices based on the logged-in user's shift location.**

When a cashier at **Bambang** adds a product:
1. POS gets `currentShift.locationId = 5` (Bambang)
2. API queries `ProductUnitLocationPrice WHERE locationId = 5`
3. Returns Bambang-specific prices
4. Cart shows Bambang prices

When a cashier at **Tuguegarao** adds the same product:
1. POS gets `currentShift.locationId = 4` (Tuguegarao)
2. API queries `ProductUnitLocationPrice WHERE locationId = 4`
3. Returns Tuguegarao-specific prices
4. Cart shows Tuguegarao prices

**Each location is completely isolated!** ✅

---

**Date**: 2025-11-11
**Status**: ✅ DEPLOYED TO PRODUCTION
**Commits**: e2edac3, 7f39b01
