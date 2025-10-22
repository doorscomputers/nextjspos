# Variation Soft-Delete Root Cause Analysis

## Executive Summary

**Issue:** Product "ADATA 512GB 2.5 SSD" had no variations showing in dropdown
**Root Cause:** Variation was **soft-deleted during product edit**
**Trigger:** Product edit API receives variations array without the existing variation
**Resolution:** Variation restored; No other products affected
**Status:** ✅ **RESOLVED** - Prevention measures recommended

---

## What Happened

### Timeline
1. **Product Created:** ADATA 512GB 2.5 SSD with "Default" variation
2. **October 20, 2025 @ 21:41:56** - Variation soft-deleted (deletedAt set)
3. **October 21, 2025** - Issue discovered: No variations in dropdown
4. **October 21, 2025** - Variation restored (deletedAt set to null)

### Impact
- **Products Affected:** 1 (ADATA 512GB 2.5 SSD)
- **Variations Affected:** 1 ("Default" variation)
- **User Impact:** Unable to generate inventory ledger reports for this product
- **System-Wide Impact:** None (all other 1,537 products have active variations)

---

## Root Cause: Product Edit API Behavior

### Location in Code
**File:** `src/app/api/products/[id]/route.ts`
**Lines:** 354-361, 408-414

### The Problematic Code

```typescript
// Lines 354-361: Soft-deletes variations not in the incoming array
if (type === 'variable' && variations && Array.isArray(variations)) {
  const existingVariationIds = existingProduct.variations.map(v => v.id)
  const incomingVariationIds = variations.filter(v => v.id).map(v => parseInt(v.id))

  // Delete removed variations (soft delete)
  const toDelete = existingVariationIds.filter(id => !incomingVariationIds.includes(id))
  if (toDelete.length > 0) {
    await tx.productVariation.updateMany({
      where: { id: { in: toDelete } },
      data: { deletedAt: new Date() }  // ⚠️ SOFT-DELETES variations
    })
  }
  // ... update/create variations
}

// Lines 408-414: Soft-deletes ALL variations for non-variable products
else if (type !== 'variable') {
  // If changing from variable to single/combo, soft delete all variations
  await tx.productVariation.updateMany({
    where: { productId: productId, deletedAt: null },
    data: { deletedAt: new Date() }  // ⚠️ SOFT-DELETES ALL variations
  })
}
```

### How It Works
1. Product edit API receives a `variations` array in the request body
2. **If variation ID exists in DB but NOT in request array → Soft-deleted**
3. **If product type is NOT 'variable' → ALL variations soft-deleted**

---

## Possible Triggers

### Scenario 1: Frontend Form Sends Empty Variations Array ⭐ **MOST LIKELY**
```javascript
// Frontend sends:
{
  name: "ADATA 512GB 2.5 SSD",
  type: "single",
  variations: []  // ← Empty or missing variations array!
}

// API interprets this as:
// "User wants to delete all variations"
```

**Why this happens:**
- Edit form doesn't populate variations for single products
- Form submits without variations field
- Variations field is conditionally rendered (only for variable products)
- JavaScript error prevents variations from being included

### Scenario 2: Product Type Change
```javascript
// User changes type from "variable" to "single"
// API automatically soft-deletes all variations
```

**Note:** This is now **prevented** by validation (line 228):
```typescript
if (type && type !== existingProduct.type) {
  return NextResponse.json({
    error: 'Product type cannot be changed after creation...'
  }, { status: 400 })
}
```

### Scenario 3: Bulk Edit Operation
- User selects multiple products and edits them
- Bulk edit doesn't include variations
- All variations soft-deleted

### Scenario 4: API Client/Import Issue
- External tool or CSV import updates product
- Request doesn't include variations
- Variations soft-deleted

---

## Why This Is Problematic

### 1. **Breaks Inventory Tracking**
- Products need at least one variation for stock tracking
- Soft-deleted variations → No variations in dropdown
- Cannot generate inventory reports

### 2. **Silent Failure**
- No error message to user
- Product still appears "normal"
- Issue only discovered when trying to view inventory

### 3. **Data Loss**
- Variation stock levels still exist in `variation_location_details`
- But variation itself is "deleted"
- Creates orphaned inventory data

### 4. **Single Products Affected Too**
- Even "single" products have a "Default" variation
- Editing single products can accidentally delete this variation
- System assumes all products have variations

---

## How CSV Import Works (No Issue Here)

The CSV import routes (`/api/products/import` and `/api/products/import-branch-stock`) do **NOT** soft-delete variations:

### `/api/products/import/route.ts`
- **Creates NEW products only** (lines 254-269)
- Always creates variations (single: "Default", variable: custom)
- Never updates existing products
- **No soft-delete operations**

### `/api/products/import-branch-stock/route.ts`
- Checks if product already exists (lines 155-170)
- **Skips existing products** (doesn't update)
- Only creates new products with variations
- **No soft-delete operations**

**Conclusion:** CSV import is NOT the cause of this issue.

---

## Prevention Strategies

### Option 1: Frontend Validation ⭐ **RECOMMENDED**

**File:** `src/app/dashboard/products/[id]/edit/page.tsx`

```typescript
// Ensure variations array is ALWAYS included
const handleSubmit = async () => {
  const payload = {
    ...formData,
    variations: product.variations || []  // ← Always include existing variations
  }

  // For single products, ensure "Default" variation exists
  if (payload.type === 'single' && payload.variations.length === 0) {
    payload.variations = [{
      id: product.variations[0]?.id,  // Keep existing ID
      name: 'Default',
      sku: product.sku,
      purchasePrice: payload.purchasePrice,
      sellingPrice: payload.sellingPrice,
      isDefault: true
    }]
  }

  await fetch(`/api/products/${product.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}
```

### Option 2: API-Level Protection

**File:** `src/app/api/products/[id]/route.ts`

```typescript
// Add validation before soft-deleting variations
if (type === 'variable' && variations && Array.isArray(variations)) {
  // ... existing code ...

  const toDelete = existingVariationIds.filter(id => !incomingVariationIds.includes(id))

  // ⚠️ SAFETY CHECK: Don't delete if variations array is empty
  if (toDelete.length > 0 && variations.length === 0) {
    console.warn(`⚠️ Preventing deletion of all variations for product ${productId}`)
    console.warn('Request included empty variations array')
    // Don't delete - assume frontend bug
  } else if (toDelete.length > 0) {
    await tx.productVariation.updateMany({
      where: { id: { in: toDelete } },
      data: { deletedAt: new Date() }
    })
  }
}

// For single products, NEVER delete variations
if (type === 'single') {
  // Update existing "Default" variation instead of deleting
  const defaultVariation = existingProduct.variations.find(v => v.isDefault)
  if (defaultVariation) {
    await tx.productVariation.update({
      where: { id: defaultVariation.id },
      data: {
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        sku: finalSku
      }
    })
  }
}
```

### Option 3: Database Constraint

**File:** `prisma/schema.prisma`

```prisma
// Add a check constraint (requires raw SQL migration)
model Product {
  // ... existing fields

  @@check([sql: "
    EXISTS (
      SELECT 1 FROM product_variations pv
      WHERE pv.product_id = id
      AND pv.deleted_at IS NULL
    )
  "], map: "product_must_have_variation")
}
```

### Option 4: Audit Log & Alerts

```typescript
// Log variation deletions for monitoring
if (toDelete.length > 0) {
  console.warn(`⚠️ Soft-deleting ${toDelete.length} variation(s) for product ${productId}`)
  console.warn('Variations being deleted:', toDelete)
  console.warn('Request variations:', variations)

  // Optional: Send alert to admin
  // await sendAdminAlert(`Variations deleted for product ${productId}`)

  await tx.productVariation.updateMany({
    where: { id: { in: toDelete } },
    data: { deletedAt: new Date() }
  })
}
```

---

## Diagnostic & Recovery Tools

### Check Product Variations
```bash
node check-product-variations.mjs
```

### Restore Soft-Deleted Variations
```bash
node restore-product-variation.mjs
```

### System-Wide Audit
```bash
node audit-all-soft-deleted-variations.mjs
```

### Find Products Without Variations
```bash
node find-products-without-variations.mjs
```

---

## Current System Status

✅ **All Clear:**
- Total Products: 1,538
- Products with Active Variations: 1,538
- Products without Variations: 0
- Soft-Deleted Variations: 0

✅ **Issue Resolved:**
- ADATA 512GB 2.5 SSD variation restored
- All products now have active variations
- Inventory ledger reports working

---

## Recommendations

### Immediate Actions
1. ✅ **DONE:** Restore soft-deleted variation
2. ⚠️ **TODO:** Investigate product edit forms
3. ⚠️ **TODO:** Add frontend validation to preserve variations
4. ⚠️ **TODO:** Add API-level protection against accidental deletion

### Long-Term Improvements
1. **Frontend Forms:**
   - Always include existing variations in edit requests
   - Show hidden field for single product variations
   - Validate before submit

2. **API Endpoints:**
   - Add safety checks before soft-deleting variations
   - Require explicit `deleteVariations: true` flag
   - Log all variation deletions

3. **Monitoring:**
   - Daily cron job to check for products without variations
   - Alert admins when variations are deleted
   - Track variation deletion frequency

4. **Documentation:**
   - Document variation management behavior
   - Add warnings in product edit UI
   - Training for users on product editing

---

## Related Files

### API Routes
- `src/app/api/products/[id]/route.ts` - Product CRUD (contains soft-delete logic)
- `src/app/api/products/import/route.ts` - CSV import (no soft-delete)
- `src/app/api/products/import-branch-stock/route.ts` - Branch stock import (no soft-delete)

### Frontend Pages
- `src/app/dashboard/products/[id]/edit/page.tsx` - Product edit form (needs investigation)
- `src/app/dashboard/products/page.tsx` - Product list
- `src/app/dashboard/reports/inventory-ledger/page.tsx` - Inventory ledger report

### Diagnostic Scripts
- `check-product-variations.mjs` - Check specific product
- `restore-product-variation.mjs` - Restore soft-deleted variations
- `audit-all-soft-deleted-variations.mjs` - System-wide audit
- `find-products-without-variations.mjs` - Find problematic products

---

## Conclusion

The variation was **soft-deleted during a product edit operation** where the `variations` array was either:
- Empty (`variations: []`)
- Missing entirely
- Not populated correctly by the frontend form

**This is NOT a CSV import issue** - both import routes create new products only and never update existing ones.

**Prevention:** Add frontend validation to ensure the variations array is always populated when editing products, especially for single products that have a "Default" variation.

---

**Analysis Date:** October 21, 2025
**Status:** ✅ RESOLVED
**Next Steps:** Implement frontend validation & API protection
