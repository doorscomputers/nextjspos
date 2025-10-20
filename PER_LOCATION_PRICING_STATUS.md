# Per-Location Pricing - Current Status Report

## Summary

**✅ Database Support:** YES - The schema fully supports per-location selling prices
**❌ UI Support:** NO - There is currently no UI to edit per-location prices
**❌ API Support:** PARTIAL - Can read location prices but cannot update them

---

## Database Schema (READY)

The `variation_location_details` table has a `sellingPrice` column:

```prisma
model VariationLocationDetails {
  id                 Int              @id @default(autoincrement())
  productVariationId Int              @map("product_variation_id")
  locationId         Int              @map("location_id")
  qtyAvailable       Decimal          @default(0)
  sellingPrice       Decimal?         @map("selling_price") @db.Decimal(22, 4)  // ✅ SUPPORTS PER-LOCATION PRICING
  ...
}
```

When `sellingPrice` is NULL, the system uses the price from `ProductVariation.sellingPrice`.

---

## Current Import Behavior

The `/api/products/import-branch-stock` route creates `VariationLocationDetails` records **WITHOUT** setting the `sellingPrice` field:

```typescript
// Line 300-308 in import-branch-stock/route.ts
await tx.variationLocationDetails.create({
  data: {
    productId: newProduct.id,
    productVariationId: variation.id,
    locationId,
    qtyAvailable: stockValue
    // NOTE: sellingPrice is NOT set (will be NULL)
  }
})
```

**Result:** All locations use the same price from `ProductVariation.sellingPrice`

---

## Existing API Endpoints

### ✅ READ - Can Get Location Price
**Endpoint:** `GET /api/products/variations/[id]/inventory?locationId=X`

Returns:
```json
{
  "inventory": {
    "id": 1,
    "productVariationId": 1,
    "locationId": 1,
    "qtyAvailable": 48,
    "sellingPrice": null  // Currently NULL for all imported products
  }
}
```

### ❌ UPDATE - Cannot Set Location Price
**Missing:** `PUT/PATCH /api/products/variations/[id]/inventory`

No endpoint exists to update `sellingPrice` for a specific location.

---

## UI Components

### Product Detail Page (`/dashboard/products/[id]`)
**Displays:**
- Product-level prices (purchase/selling)
- Variation-level prices
- Stock quantities per location

**Does NOT Display:**
- Per-location selling prices
- Interface to edit location-specific prices

### Stock Management Page (`/dashboard/products/stock`)
**Displays:**
- Stock pivot table by location
- Variation selling price (single price for all locations)

**Does NOT Display:**
- Per-location price differences
- Interface to edit location prices

---

## What Needs to be Built

To enable per-location pricing, you need:

### 1. API Endpoint (Backend)
Create: `PUT /api/products/variations/[id]/inventory`

```typescript
// Update location-specific selling price
{
  "locationId": 1,
  "sellingPrice": 2500.00
}
```

### 2. UI Component (Frontend)
Options:
- **A) Product Edit Page Enhancement**
  - Add section showing price per location
  - Allow editing each location's price

- **B) Stock Management Page Enhancement**
  - Make selling price column editable per location
  - Click to edit, save changes via API

- **C) Dedicated Price Management Page**
  - Separate page for managing multi-location pricing
  - Bulk update capabilities

### 3. Import Enhancement (Optional)
Update import to optionally set location prices:
- Either copy variation price to each location
- Or accept CSV with per-location price columns

---

## Current Workaround

**Manual via Prisma Studio:**
1. Open Prisma Studio (already running)
2. Go to `variation_location_details` table
3. Find the record for specific variation + location
4. Edit the `sellingPrice` field
5. Save

**Manual via SQL:**
```sql
UPDATE variation_location_details
SET selling_price = 2500.00
WHERE product_variation_id = 1 AND location_id = 1;
```

---

## Recommendation

**For Your Use Case (Same prices across locations for now):**
✅ **No action needed** - The current setup works fine. When location price is NULL, the system uses the variation price.

**If You Want Per-Location Pricing in the Future:**
I can help you build:
1. API endpoint to update location prices
2. UI component to manage location-specific prices
3. Bulk update functionality

Would you like me to implement any of these features?
