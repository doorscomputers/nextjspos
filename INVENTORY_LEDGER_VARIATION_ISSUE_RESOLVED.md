# Inventory Ledger - Variation Issue Resolution

## Problem Summary
The product "ADATA 512GB 2.5 SSD" was not showing any variations in the Inventory Transaction Ledger page's variation dropdown.

## Root Cause
The product had a "Default" variation that was **soft-deleted** on October 20, 2025 at 21:41:56. When variations are soft-deleted (deletedAt is not null), they are excluded from the API response and therefore don't appear in the dropdown.

### Technical Details:
- Product ID: 343
- Product Name: ADATA 512GB 2.5 SSD
- Product SKU: 4711085931528
- Product Type: single
- Variation Name: Default
- Variation SKU: 4711085931528
- Status: Was soft-deleted, now restored

## Resolution Steps Taken

1. **Diagnostic Script Created** (`check-product-variations.mjs`)
   - Identified the product had a soft-deleted variation
   - Confirmed no active variations existed

2. **Restoration Script Created** (`restore-product-variation.mjs`)
   - Restored the soft-deleted variation by setting deletedAt to null
   - Verified the restoration was successful

3. **System-Wide Check** (`find-products-without-variations.mjs`)
   - Scanned all 1,538 active products
   - Confirmed all products now have active variations

## Current Status
✅ **RESOLVED** - The product now has 1 active variation and will appear in the variation dropdown.

## How the System Works

### API Level (`/api/products`)
```javascript
variations: {
  where: { deletedAt: null },  // Only returns non-deleted variations
  include: {
    variationLocationDetails: true,
    supplier: { ... }
  }
}
```

### Frontend Level (`inventory-ledger/page.tsx`)
```javascript
// Variations are populated from the product's variations array
{selectedProductData?.variations.map((variation) => (
  <option key={variation.id} value={variation.id}>
    {variation.name}
  </option>
))}
```

## Prevention Tips

### 1. Avoid Soft-Deleting Variations
- Variations are critical for inventory tracking
- Deleting a variation breaks the inventory ledger and stock tracking
- Instead of deleting, consider:
  - Marking products as inactive (isActive = false)
  - Using a different status field

### 2. Product CRUD Operations
When editing/deleting products:
- **Single Products**: Always maintain at least one "Default" variation
- **Variable Products**: Ensure at least one variation exists
- Never delete all variations of a product

### 3. Data Integrity Checks
Consider adding:
- Database constraint: Products must have at least one active variation
- UI validation: Prevent deletion of the last variation
- Background job: Periodic check for products without variations

### 4. Soft Delete Best Practices
- Soft deletes are useful for audit trails
- But they can break relational dependencies
- Consider cascade rules carefully

## Database Schema Reference

```prisma
model ProductVariation {
  id         Int       @id @default(autoincrement())
  productId  Int
  businessId Int
  name       String
  sku        String
  deletedAt  DateTime? // When set, variation is soft-deleted
  // ... other fields
}
```

## Diagnostic Commands

### Check Specific Product
```bash
node check-product-variations.mjs
```

### Find All Products Without Variations
```bash
node find-products-without-variations.mjs
```

### Restore Deleted Variations
```bash
node restore-product-variation.mjs
```

## API Endpoint Notes

### GET /api/products
- Returns products with active variations only
- Filters: `where: { deletedAt: null }`
- Includes: category, brand, unit, tax, variations

### Product Variations in Response
```json
{
  "products": [
    {
      "id": 343,
      "name": "ADATA 512GB 2.5 SSD",
      "sku": "4711085931528",
      "variations": [
        {
          "id": 343,
          "name": "Default",
          "sku": "4711085931528",
          "purchasePrice": 1554.4828,
          "sellingPrice": 1980,
          "isDefault": true
        }
      ]
    }
  ]
}
```

## Related Files
- `src/app/dashboard/reports/inventory-ledger/page.tsx` - Frontend page
- `src/app/api/products/route.ts` - Products API
- `src/app/api/reports/inventory-ledger/route.ts` - Ledger report API
- `prisma/schema.prisma` - Database schema

## Future Enhancements

1. **Add UI Warning**
   - Show warning when trying to delete the last variation
   - Prevent soft-delete of all variations

2. **Database Trigger/Constraint**
   - Ensure at least one active variation per product
   - Or auto-create "Default" variation if missing

3. **Background Health Check**
   - Periodic scan for data integrity issues
   - Auto-fix or alert for products without variations

4. **Audit Log Enhancement**
   - Track who deleted variations
   - Add restore functionality in UI

## Verification

After the fix, the Inventory Transaction Ledger page now:
- ✅ Shows "Main Warehouse" in location dropdown
- ✅ Shows "ADATA 512GB 2.5 SSD (4711085931528)" in product dropdown
- ✅ Shows "Default" variation in variation dropdown
- ✅ Can generate ledger reports for this product

---

**Resolution Date:** October 21, 2025
**Status:** ✅ RESOLVED
**Products Affected:** 1 (ADATA 512GB 2.5 SSD)
**System Health:** All 1,538 products now have active variations
