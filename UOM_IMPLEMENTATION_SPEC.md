# UOM (Unit of Measure) Implementation Specification

## Executive Summary

This document outlines the complete implementation of Unit of Measure (UOM) functionality for the UltimatePOS Modern system, enabling users to:
1. **Set prices for sub-units** (e.g., price per Meter when selling Rolls)
2. **Sell in sub-units** via POS (e.g., sell 5 Meters from a Roll)
3. **Maintain 100% inventory accuracy** through automatic base unit conversion

---

## ✅ COMPLETED COMPONENTS

### 1. Sub-Unit Price Management

**Files Created:**
- `src/app/api/products/unit-prices/route.ts` - API for managing unit prices
- `src/components/UnitPriceUpdateForm.tsx` - UI component for editing prices

**Files Modified:**
- `src/app/dashboard/products/simple-price-editor/page.tsx` - Added "Step 5: Update Unit Prices"

**Functionality:**
- ✅ GET `/api/products/unit-prices?productId=123` - Fetch all unit prices for a product
- ✅ POST `/api/products/unit-prices` - Update/create unit prices
- ✅ Professional table UI showing all units (PRIMARY + sub-units)
- ✅ Edit purchase & selling prices for each unit
- ✅ Real-time profit margin calculation with color coding
- ✅ Change tracking and validation

**Database Tables Used:**
- `product_unit_prices` - Stores price per unit (purchase_price, selling_price, unit_id, product_id)
- `units` - Unit definitions with conversion factors (base_unit_id, base_unit_multiplier)
- `products` - Product with primary unit (unit_id, sub_unit_ids)

---

### 2. UOM Conversion System

**Files Created:**
- `src/lib/uomConverter.ts` - Core conversion library

**Functions Implemented:**

```typescript
// Convert sub-unit quantity → base unit quantity
// Example: 5 Meters → 0.05 Rolls (if 1 Roll = 100 Meters)
convertToBaseUnit(quantity, selectedUnit, allUnits): ConversionResult

// Convert base unit quantity → sub-unit quantity
// Example: 0.05 Rolls → 5 Meters
convertFromBaseUnit(baseQuantity, targetUnit, allUnits): number

// Get price for specific unit (uses ProductUnitPrice or calculates proportionally)
getUnitPrice(baseUnitPrice, selectedUnit, unitPrices): number

// Validate quantity for unit (check if decimals allowed)
isValidQuantity(quantity, unit): boolean

// Format quantity with correct decimal places
formatQuantity(quantity, unit): string

// Calculate available stock in any unit
getAvailableStockInUnit(baseUnitStock, targetUnit, allUnits): number
```

**Conversion Logic:**
```
Base Unit Multiplier Example:
- 1 Roll = 100 Meters (base_unit_multiplier = 100 for Meter)
- To convert 5 Meters → Rolls: 5 / 100 = 0.05 Rolls
- To convert 0.05 Rolls → Meters: 0.05 * 100 = 5 Meters

Price Calculation:
- If Roll costs ₱100 and 1 Roll = 100 Meters
- Then Meter price = ₱100 / 100 = ₱1.00 per Meter
- Or use specific price from product_unit_prices table
```

---

### 3. POS Infrastructure

**Files Created:**
- `src/app/api/pos/product-units/route.ts` - Optimized API for POS
- `src/components/POSUnitSelector.tsx` - Smart UOM selector component

**Files Modified:**
- `src/app/dashboard/pos/page.tsx` - Added POSUnitSelector import (line 19)

**POSUnitSelector Component Features:**
- ✅ Dropdown showing all available units (PRIMARY unit marked with ⭐)
- ✅ Quantity input with decimal validation
- ✅ Real-time unit price display
- ✅ Available stock in selected unit
- ✅ Automatic conversion to base unit
- ✅ Stock validation before applying
- ✅ Error handling and user feedback

---

## 🚧 PENDING IMPLEMENTATION

### 4. POS Cart Modification

**File to Modify:** `src/app/dashboard/pos/page.tsx`

#### 4.1 Add UOM State Management (Line ~80)

```typescript
// Add after line 80 (after holdNote state)
const [showUnitSelector, setShowUnitSelector] = useState<number | null>(null)
```

#### 4.2 Modify Cart Item Structure

**Current cart item:**
```typescript
{
  productId: number
  productVariationId: number
  name: string
  sku: string
  unitPrice: number
  originalPrice: number
  quantity: number
  availableStock: number
  isFreebie: boolean
  requiresSerial: boolean
  serialNumberIds: number[]
  serialNumbers: any[]
}
```

**New cart item (add UOM fields):**
```typescript
{
  productId: number
  productVariationId: number
  name: string
  sku: string
  unitPrice: number         // Price for selected unit
  originalPrice: number     // Base unit price
  quantity: number          // ALWAYS in base unit for inventory
  displayQuantity: number   // Quantity in selected unit for display
  selectedUnitId: number    // Selected unit ID (defaults to primary)
  selectedUnitName: string  // Unit name for display (e.g., "Meters")
  availableStock: number    // Stock in base unit
  isFreebie: boolean
  requiresSerial: boolean
  serialNumberIds: number[]
  serialNumbers: any[]
  // UOM-specific fields
  subUnitId?: number        // For sales API
  subUnitPrice?: number     // For sales API
}
```

#### 4.3 Modify `addToCart()` Function (Line 669)

**Current implementation:**
- Adds product with quantity = 1 or quantityMultiplier
- Uses variation.sellingPrice directly

**Required changes:**
```typescript
const addToCart = async (product: any, isFreebie: boolean = false) => {
  const variation = product.variations?.[0]
  if (!variation) return

  const locationStock = variation.variationLocationDetails?.find(
    (vl: any) => vl.locationId === currentShift?.locationId
  )

  if (!locationStock || parseFloat(locationStock.qtyAvailable) <= 0) {
    setError('Product out of stock at your location')
    setTimeout(() => setError(''), 3000)
    return
  }

  const availableStock = parseFloat(locationStock.qtyAvailable)
  const existingIndex = cart.findIndex(
    (item) =>
      item.productVariationId === variation.id &&
      item.isFreebie === isFreebie &&
      item.selectedUnitId === product.unitId  // Match by unit too
  )

  const price = parseFloat(variation.sellingPrice)
  const qtyToAdd = quantityMultiplier || 1

  if (quantityMultiplier) {
    setQuantityMultiplier(null)
  }

  if (existingIndex >= 0) {
    const newCart = [...cart]
    const newQuantity = newCart[existingIndex].quantity + qtyToAdd

    if (newQuantity > availableStock) {
      setError(`Insufficient stock! Only ${availableStock} units available at this branch.`)
      setTimeout(() => setError(''), 4000)
      return
    }

    newCart[existingIndex].quantity = newQuantity
    newCart[existingIndex].displayQuantity = newQuantity  // Same for primary unit
    setCart(newCart)
  } else {
    if (qtyToAdd > availableStock) {
      setError(`Insufficient stock! Only ${availableStock} units available at this branch.`)
      setTimeout(() => setError(''), 4000)
      return
    }

    // Get primary unit info
    const primaryUnitId = product.unitId
    const primaryUnitName = product.unit?.name || 'Unit'

    setCart([
      ...cart,
      {
        productId: product.id,
        productVariationId: variation.id,
        name: product.name,
        sku: variation.sku || product.sku,
        unitPrice: isFreebie ? 0 : price,
        originalPrice: price,
        quantity: qtyToAdd,  // In base unit
        displayQuantity: qtyToAdd,  // Same for primary unit initially
        selectedUnitId: primaryUnitId,  // Default to primary unit
        selectedUnitName: primaryUnitName,
        availableStock: availableStock,
        isFreebie,
        requiresSerial: false,
        serialNumberIds: [],
        serialNumbers: [],
      },
    ])
  }
}
```

#### 4.4 Add Unit Change Handler (New function after `addToCart`)

```typescript
const handleUnitChange = (cartIndex: number, unitData: {
  selectedUnitId: number
  displayQuantity: number
  baseQuantity: number
  unitPrice: number
  unitName: string
}) => {
  const newCart = [...cart]

  newCart[cartIndex] = {
    ...newCart[cartIndex],
    quantity: unitData.baseQuantity,  // Store base quantity for inventory
    displayQuantity: unitData.displayQuantity,  // Display quantity in selected unit
    selectedUnitId: unitData.selectedUnitId,
    selectedUnitName: unitData.unitName,
    unitPrice: unitData.unitPrice,
    subUnitId: unitData.selectedUnitId,  // For sales API
    subUnitPrice: unitData.unitPrice,  // For sales API
  }

  setCart(newCart)
  setShowUnitSelector(null)  // Close selector
}
```

#### 4.5 Modify Cart Display (Line ~1842)

**Add UOM selector button after serial number section:**

```typescript
{/* Serial Number Section */}
<div className="mt-2 pt-2 border-t">
  <Button
    size="sm"
    variant="outline"
    className={`w-full text-sm h-9 ${
      item.serialNumberIds && item.serialNumberIds.length > 0
        ? 'bg-green-50 border-green-500 text-green-700'
        : 'bg-gray-50 border-gray-300 text-gray-600'
    }`}
    onClick={() => handleOpenSerialDialog(index)}
  >
    {item.serialNumberIds && item.serialNumberIds.length > 0 ? (
      <>✓ {item.serialNumberIds.length} Serial(s) Added</>
    ) : (
      <>📝 Add Serial Numbers (Optional)</>
    )}
  </Button>
</div>

{/* UOM Selector Section - NEW */}
<div className="mt-2 pt-2 border-t">
  <Button
    size="sm"
    variant="outline"
    className="w-full text-sm h-9 bg-amber-50 border-amber-400 text-amber-700"
    onClick={() => setShowUnitSelector(showUnitSelector === index ? null : index)}
  >
    📏 {item.selectedUnitName} · Change Unit
  </Button>

  {showUnitSelector === index && (
    <div className="mt-2">
      <POSUnitSelector
        productId={item.productId}
        productName={item.name}
        baseUnitPrice={item.originalPrice}
        availableStock={item.availableStock}
        currentQuantity={item.quantity}
        onUnitChange={(unitData) => handleUnitChange(index, unitData)}
      />
    </div>
  )}
</div>
```

**Update quantity display to show unit:**

```typescript
// Change from:
<p className="text-base font-semibold text-gray-600 mt-1">
  ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.quantity}
</p>

// To:
<p className="text-base font-semibold text-gray-600 mt-1">
  ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.displayQuantity} {item.selectedUnitName}
</p>
```

---

### 5. Sales API Modification

**File to Modify:** `src/app/api/sales/route.ts`

#### 5.1 Update Sale Item Processing (around line 150)

**Current item structure:**
```typescript
{
  productId: item.productId,
  productVariationId: item.productVariationId,
  quantity: item.quantity,  // Used directly for inventory
  unitPrice: item.unitPrice,
  isFreebie: item.isFreebie,
  requiresSerial: item.requiresSerial,
  serialNumberIds: item.serialNumberIds,
}
```

**New structure (add UOM fields):**
```typescript
{
  productId: item.productId,
  productVariationId: item.productVariationId,
  quantity: item.quantity,  // ALWAYS base unit quantity
  unitPrice: item.unitPrice,  // Price for selected unit
  isFreebie: item.isFreebie,
  requiresSerial: item.requiresSerial,
  serialNumberIds: item.serialNumberIds,
  subUnitId: item.subUnitId || null,  // Unit used in sale
  subUnitPrice: item.subUnitPrice || item.unitPrice,  // Price for that unit
}
```

#### 5.2 Database Schema (Already Exists)

**SaleItem table has:**
```prisma
subUnitId    Int?     @map("sub_unit_id")
subUnitPrice Decimal? @map("sub_unit_price") @db.Decimal(22, 4)
```

**ProductHistory table has:**
```prisma
subUnitId Int? @map("sub_unit_id")
```

**No code changes needed** - inventory deduction uses `quantity` field which is ALWAYS in base unit

---

## 🔒 CRITICAL INVENTORY ACCURACY RULES

### Rule 1: Quantity Storage
**ALWAYS store quantity in BASE UNIT in database:**
- `sale_items.quantity` = base unit quantity (e.g., 0.05 for 5 Meters of 100m Roll)
- `product_history.quantity` = base unit quantity
- `variation_location_details.qty_available` = base unit quantity

### Rule 2: UOM Display Information
**Store display information separately:**
- `sale_items.sub_unit_id` = unit ID used in sale (e.g., Meter)
- `sale_items.sub_unit_price` = price per unit charged (e.g., ₱1.00 per Meter)
- Display in receipt: "5 Meters @ ₱1.00 = ₱5.00"
- But inventory deducted: 0.05 Rolls

### Rule 3: Price Calculation
**Use unit-specific prices:**
```
If ProductUnitPrice exists for unit:
  Use that price directly
Else:
  Calculate: base_price / base_unit_multiplier
  Example: ₱100 per Roll / 100 = ₱1.00 per Meter
```

### Rule 4: Stock Validation
**Always validate in base unit:**
```typescript
const baseQuantityToDeduct = convertToBaseUnit(displayQty, selectedUnit, units)
if (baseQuantityToDeduct > availableBaseStock) {
  throw Error("Insufficient stock")
}
```

---

## 📊 TESTING CHECKLIST

### Test Scenario 1: Sub-Unit Pricing
- [ ] Create product: "Cable Roll" (100 Meters)
- [ ] Set unit price: Roll = ₱100, Meter = ₱1.20
- [ ] Verify prices saved correctly
- [ ] Verify margin calculations

### Test Scenario 2: POS Sales with UOM
- [ ] Add "Cable Roll" to cart
- [ ] Change unit to "Meters"
- [ ] Set quantity to 25 Meters
- [ ] Verify:
  - Display shows "25 Meters @ ₱1.20 = ₱30.00"
  - Stock to deduct: 0.25 Rolls (25/100)
  - Price used: ₱1.20 (from unit price)

### Test Scenario 3: Inventory Accuracy
- [ ] Before sale: Stock = 10 Rolls (1000 Meters)
- [ ] Sell 25 Meters
- [ ] After sale: Stock = 9.75 Rolls (975 Meters)
- [ ] Check `variation_location_details.qty_available` = 9.75
- [ ] Check `product_history`:
  - `quantity` = -0.25 (Rolls)
  - `sub_unit_id` = Meter ID
  - `transaction_type` = SALE

### Test Scenario 4: Decimal Validation
- [ ] Unit allows decimals: Can sell 5.5 Meters
- [ ] Unit disallows decimals: Cannot sell 2.5 Boxes
- [ ] Error shown when decimal entered for whole-number-only unit

### Test Scenario 5: Stock Availability
- [ ] Stock = 0.5 Rolls (50 Meters)
- [ ] Try to sell 60 Meters → Error: "Only 50 Meters available"
- [ ] Sell 30 Meters → Success
- [ ] Remaining: 0.2 Rolls (20 Meters)

---

## 🚀 DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] Run `npx tsc --noEmit` - no errors
- [ ] Test all 5 scenarios above
- [ ] Verify database schema has required fields
- [ ] Check ProductHistory records have correct sub_unit_id
- [ ] Verify receipts show unit information correctly

### After Deployment
- [ ] Monitor for decimal precision issues
- [ ] Check inventory balances match expectations
- [ ] Verify no negative stock situations
- [ ] Test with high-volume products (100+ units/day)
- [ ] Validate reports show correct unit information

---

## 📝 IMPLEMENTATION SEQUENCE

1. ✅ **Complete Unit Price Management** (DONE)
2. ✅ **Create UOM Conversion Library** (DONE)
3. ✅ **Create POS Infrastructure** (DONE)
4. 🚧 **Modify POS Cart System** (IN PROGRESS)
5. 🚧 **Update Sales API** (PENDING)
6. 🧪 **End-to-End Testing** (PENDING)

**Estimated remaining work:** 2-3 hours
**Risk level:** MEDIUM (touching critical POS and sales code)

---

## ⚠️ IMPORTANT NOTES

1. **DO NOT** modify inventory deduction logic - it already uses `quantity` field correctly
2. **DO NOT** change `updateStock()` function - it works with base units
3. **ALWAYS** test with actual database to verify decimal precision
4. **BACKUP** database before testing sales with UOM
5. **MONITOR** product_history table for any quantity discrepancies

---

## 🆘 ROLLBACK PLAN

If issues occur:
1. Remove POSUnitSelector from cart display
2. Remove `showUnitSelector` state
3. Revert `addToCart()` changes
4. Sales will continue to work with base units only
5. Unit pricing feature remains functional for future use

---

## 📞 SUPPORT CONTACTS

- Database issues: Check `product_history` table for discrepancies
- Conversion errors: Review `src/lib/uomConverter.ts` logic
- UI issues: Check `POSUnitSelector` component props
- Sales API: Review `src/app/api/sales/route.ts` item processing

---

**Document Version:** 1.0
**Last Updated:** 2025-11-08
**Status:** Ready for Review → Implementation → Testing
