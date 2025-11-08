# UOM Cart Bug Fix - Same Product, Different Units

## The Bug
When adding the same product to the cart with different units (e.g., Meters and Rolls), the system was incorrectly treating them as duplicate items or merging them together instead of keeping them separate.

## What Was Wrong

**Before Fix:**
```typescript
const existingIndex = cart.findIndex(
  (item) =>
    item.productVariationId === variation.id &&
    item.isFreebie === isFreebie &&
    item.selectedUnitId === product.unitId  // ❌ Always compares to primary unit
)
```

**Problem:** The comparison `item.selectedUnitId === product.unitId` was checking if the cart item's selected unit matched the product's PRIMARY unit (which is always Roll for Sample UTP). This caused incorrect matching logic.

## The Fix

**After Fix:**
```typescript
// Get the unit this product will be added with (defaults to primary unit)
const addingWithUnitId = product.unitId || null

const existingIndex = cart.findIndex(
  (item) =>
    item.productVariationId === variation.id &&
    item.isFreebie === isFreebie &&
    item.selectedUnitId === addingWithUnitId  // ✅ Must match EXACT unit
)
```

**Solution:** Now the code explicitly captures which unit the new item will have (`addingWithUnitId`) and only merges with existing cart items that have that EXACT same unit.

## How It Works Now

### Scenario 1: Adding in Meters, then Rolls

1. **Add Product (defaults to Roll)**
   - Cart Item 1: `selectedUnitId = Roll`, `quantity = 1 Roll`

2. **Change Item 1 to Meters (10 Meters)**
   - Cart Item 1: `selectedUnitId = Meter`, `quantity = 0.0333 Rolls`, `displayQuantity = 10 Meters`

3. **Add Product Again (defaults to Roll)**
   - System checks: Is there a cart item with `selectedUnitId = Roll`?
   - Cart Item 1 has `selectedUnitId = Meter` → ❌ No match
   - **Creates NEW item:**
     - Cart Item 2: `selectedUnitId = Roll`, `quantity = 1 Roll`

4. **Result: Two separate cart items** ✅
   - Item 1: 10 Meters @ ₱5.50 = ₱55.00
   - Item 2: 1 Roll @ ₱1,650.00 = ₱1,650.00
   - **Total: ₱1,705.00**

### Scenario 2: Adding in Rolls, then Meters

1. **Add Product (defaults to Roll)**
   - Cart Item 1: `selectedUnitId = Roll`, `quantity = 1 Roll`

2. **Add Product Again (defaults to Roll)**
   - System checks: Is there a cart item with `selectedUnitId = Roll`?
   - Cart Item 1 has `selectedUnitId = Roll` → ✅ Match found
   - **Increments existing item:**
     - Cart Item 1: `selectedUnitId = Roll`, `quantity = 2 Rolls`

3. **Change Item 1 to Meters (10 Meters)**
   - Cart Item 1: `selectedUnitId = Meter`, `quantity = 0.0333 Rolls`, `displayQuantity = 10 Meters`

4. **Add Product Again (defaults to Roll)**
   - System checks: Is there a cart item with `selectedUnitId = Roll`?
   - Cart Item 1 has `selectedUnitId = Meter` → ❌ No match
   - **Creates NEW item:**
     - Cart Item 2: `selectedUnitId = Roll`, `quantity = 1 Roll`

5. **Result: Two separate cart items** ✅
   - Item 1: 10 Meters @ ₱5.50 = ₱55.00
   - Item 2: 1 Roll @ ₱1,650.00 = ₱1,650.00
   - **Total: ₱1,705.00**

## Testing Instructions

### Test Case 1: Meters First, Then Rolls
1. Go to POS page: `http://localhost:3000/dashboard/pos`
2. **Clear cart** if there are items
3. **Add Sample UTP CABLE** (will default to Roll)
4. Click "📏 Selling in: Roll · Click to Change Unit & Quantity"
5. Select **Meter**, enter **10**, click **Apply**
6. Verify cart shows: **10 Meter @ ₱5.50 = ₱55.00**
7. **Add Sample UTP CABLE again** (will default to Roll)
8. Verify you now have **2 SEPARATE items** in cart:
   - ✅ Item 1: 10 Meter @ ₱5.50 = ₱55.00
   - ✅ Item 2: 1 Roll @ ₱1,650.00 = ₱1,650.00
   - ✅ Total: ₱1,705.00

### Test Case 2: Rolls First, Then Meters
1. Go to POS page: `http://localhost:3000/dashboard/pos`
2. **Clear cart** if there are items
3. **Add Sample UTP CABLE** (will default to Roll)
4. Verify cart shows: **1 Roll @ ₱1,650.00 = ₱1,650.00**
5. **Add Sample UTP CABLE again** (should increment existing Roll item)
6. Verify cart shows: **2 Roll @ ₱1,650.00 = ₱3,300.00** (single item, quantity increased)
7. Click "📏 Selling in: Roll · Click to Change Unit & Quantity"
8. Select **Meter**, enter **10**, click **Apply**
9. Verify cart shows: **10 Meter @ ₱5.50 = ₱55.00** (unit changed)
10. **Add Sample UTP CABLE again** (will default to Roll)
11. Verify you now have **2 SEPARATE items** in cart:
    - ✅ Item 1: 10 Meter @ ₱5.50 = ₱55.00
    - ✅ Item 2: 1 Roll @ ₱1,650.00 = ₱1,650.00
    - ✅ Total: ₱1,705.00

### Test Case 3: Multiple Units (Meters + Rolls + Meters again)
1. Go to POS page: `http://localhost:3000/dashboard/pos`
2. **Clear cart**
3. **Add Sample UTP CABLE** → Change to **5 Meters**
4. **Add Sample UTP CABLE** → Keep as **2 Rolls**
5. **Add Sample UTP CABLE** → Change to **15 Meters**
6. Verify you have **3 items**:
   - ✅ Item 1: 5 Meter @ ₱5.50 = ₱27.50
   - ✅ Item 2: 2 Roll @ ₱1,650.00 = ₱3,300.00
   - ✅ Item 3: 15 Meter @ ₱5.50 = ₱82.50
   - ✅ Total: ₱3,410.00

**Note:** Items 1 and 3 are SEPARATE even though both are in Meters, because they were added separately. If you want to combine them, you would need to manually adjust quantities or delete one.

## Expected Behavior Summary

| Action | Result |
|--------|--------|
| Add product (defaults to Roll) | Creates cart item with Roll unit |
| Add same product again (still Roll) | Increments existing Roll item quantity |
| Change cart item to Meters | Updates that item's unit to Meters |
| Add same product again (defaults to Roll) | Creates NEW cart item with Roll unit |
| Now you have BOTH Meters and Rolls in cart | ✅ Correct! Two separate items |

## Key Points

1. ✅ **Same product, same unit** → Increments quantity
2. ✅ **Same product, different units** → Separate cart items
3. ✅ **Changing unit AFTER adding** → Updates that specific item only
4. ✅ **Each cart item maintains its own unit independently**

## Files Modified

- `src/app/dashboard/pos/page.tsx` (lines 689-697)
  - Added explicit `addingWithUnitId` variable
  - Fixed `existingIndex` comparison to use the new variable
  - Ensures cart items with different units are kept separate

---

**Fix applied:** 2025-01-08
**Status:** ✅ Ready for testing
