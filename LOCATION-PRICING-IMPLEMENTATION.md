# Per-Location Pricing Implementation

## Overview
This document describes the implementation of per-location pricing feature that allows setting different purchase and selling prices for each product unit at each business location.

## Implementation Status: ✅ 90% Complete

### ✅ Completed Features

#### 1. Database Schema
**File:** `prisma/schema.prisma`

Created new model `ProductUnitLocationPrice`:
- Stores location-specific pricing per product per unit
- Fields: businessId, productId, locationId, unitId, purchasePrice, sellingPrice
- Includes audit trail (createdAt, updatedAt, lastUpdatedBy)
- Unique constraint on (productId, locationId, unitId)
- Relations to Product, BusinessLocation, Unit, and User models

**Status:** ✅ Schema defined, needs manual database push

#### 2. Pricing Library
**File:** `src/lib/productLocationPricing.ts`

Created comprehensive library with functions:
- `getProductLocationPrices()` - Get prices for product across locations
- `getLocationUnitPrice()` - Get specific location/unit price
- `getLocationPricesForLocation()` - Get all product prices for a location
- `saveProductLocationPrices()` - Save/update location prices
- `deleteProductLocationPrices()` - Delete location prices
- `copyGlobalPricesToLocations()` - Bulk copy global prices
- `applyPriceAdjustment()` - Bulk percentage adjustments

**Key Features:**
- Automatic fallback to global unit prices if no location-specific price exists
- Only stores location prices that differ from global prices (optimization)
- Full CRUD operations with validation
- Bulk operations support

#### 3. API Endpoints

**a) Product Location Prices API**
**File:** `src/app/api/products/[id]/location-prices/route.ts`

- `GET /api/products/[id]/location-prices` - Get all location prices for a product
  - Admin/Super Admin: See all locations
  - Manager: See only assigned locations
  - Returns prices with fallback to global prices

- `POST /api/products/[id]/location-prices` - Save location prices
  - Validates user permissions
  - Managers can only edit assigned locations
  - Returns updated prices after save

**b) Location Prices API**
**File:** `src/app/api/locations/[id]/prices/route.ts`

- `GET /api/locations/[id]/prices` - Get all product prices for a location
  - Used by Manager view
  - Validates location access

- `POST /api/locations/[id]/prices` - Save prices for multiple products at location
  - Batch update support
  - Returns success/failure for each product

#### 4. Admin Page: Location Pricing
**File:** `src/app/dashboard/products/location-pricing/page.tsx`

**Features:**
- Product selector (search by name or SKU)
- DevExtreme DataGrid with:
  - Grouping by location
  - Inline cell editing
  - Excel export
  - Search and filtering
  - Profit margin calculation
- Edit purchase/selling prices for all units across all locations
- Real-time validation (no negative prices, selling ≥ purchase)
- Change tracking with unsaved changes warning
- Bulk save functionality

**Access:** Admin and Super Admin roles

#### 5. Manager Page: My Location Pricing
**File:** `src/app/dashboard/products/my-location-pricing/page.tsx`

**Features:**
- Location selector (only shows assigned locations)
- View/edit prices for ALL products at selected location
- DevExtreme DataGrid with:
  - Grouping by product
  - Inline cell editing
  - Excel export
  - Search and filtering
  - Profit margin calculation
- Same validation and change tracking as Admin page
- Auto-selects first location if user has only one

**Access:** Managers (and Admin/Super Admin)

#### 6. Sidebar Menu Items
**File:** `src/components/Sidebar.tsx`

Added two new menu items under "Price Editor":
- **Location Pricing (Admin)** → `/dashboard/products/location-pricing`
  - Permission: `PRODUCT_PRICE_EDIT`
  - Icon: BuildingStorefrontIcon

- **My Location Pricing** → `/dashboard/products/my-location-pricing`
  - Permission: `PRODUCT_PRICE_EDIT`
  - Icon: BuildingStorefrontIcon

#### 7. User Locations API
**File:** `src/app/api/user-locations/route.ts`

- `GET /api/user-locations` - Get user's assigned locations
  - Already existed in codebase
  - Admin/Super Admin get all locations
  - Managers get only assigned locations

---

## ⏳ Pending Tasks

### 1. Database Schema Push
**Action Required:**
```bash
cd C:\xampp\htdocs\ultimatepos-modern
npx prisma db push --accept-data-loss
npx prisma generate
```

**Note:** Previous attempts to push hung due to Supabase connection timeout. You may need to:
- Check your internet connection
- Try pushing during off-peak hours
- Or push manually using a database client

### 2. Update POS to Use Location-Specific Prices
**File to Modify:** `src/app/dashboard/pos/page.tsx`

**Changes Needed:**
- When fetching product prices, check for location-specific prices first
- Fall back to global unit price if no location price exists
- Use location-specific price in calculations

**Implementation:**
```typescript
// In POS page, when loading product prices
const locationPrice = await fetch(
  `/api/products/${productId}/location-prices?locationIds=${currentLocationId}`
)
const priceData = await locationPrice.json()

// Use priceData.prices to find the price for the selected unit
// Fall back to global unit price if not found
```

### 3. Testing Workflow
**Test Scenarios:**

1. **Admin Workflow:**
   - Navigate to Price Editor → Location Pricing (Admin)
   - Select a product with multiple units
   - Edit prices for different locations
   - Verify changes save correctly
   - Verify prices differ from global prices

2. **Manager Workflow:**
   - Navigate to Price Editor → My Location Pricing
   - Verify only assigned locations appear
   - Edit prices for various products
   - Verify changes save correctly

3. **POS Integration:**
   - Select a location in POS
   - Add products with location-specific prices
   - Verify correct prices are used
   - Test with products having no location-specific price (should use global)

4. **Fallback Behavior:**
   - Edit global unit price
   - Verify locations without custom pricing reflect the change
   - Verify locations with custom pricing remain unchanged

---

## Database Schema Details

### ProductUnitLocationPrice Table
```prisma
model ProductUnitLocationPrice {
  id         Int      @id @default(autoincrement())
  businessId Int      @map("business_id")
  productId  Int      @map("product_id")
  locationId Int      @map("location_id")
  unitId     Int      @map("unit_id")

  // Location-specific pricing per unit
  purchasePrice Decimal  @map("purchase_price") @db.Decimal(22, 4)
  sellingPrice  Decimal  @map("selling_price") @db.Decimal(22, 4)

  // Audit trail
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  lastUpdatedBy     Int?      @map("last_updated_by")
  lastUpdatedByUser User?     @relation("LocationPriceUpdatedBy", fields: [lastUpdatedBy], references: [id])

  // Relations
  product  Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  location BusinessLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  unit     Unit             @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([productId, locationId, unitId])
  @@index([businessId, productId])
  @@index([businessId, locationId])
  @@index([productId, locationId])
  @@index([lastUpdatedBy])
  @@map("product_unit_location_prices")
}
```

### Relations Added

**Product Model:**
```prisma
unitLocationPrices ProductUnitLocationPrice[]
```

**Unit Model:**
```prisma
locationPrices ProductUnitLocationPrice[]
```

**BusinessLocation Model:**
```prisma
unitLocationPrices ProductUnitLocationPrice[]
```

**User Model:**
```prisma
locationPriceUpdates ProductUnitLocationPrice[] @relation("LocationPriceUpdatedBy")
```

---

## Key Design Decisions

### 1. Fallback to Global Prices
- Location-specific prices are **optional**
- If no location price exists, system uses global unit price
- This prevents data duplication and maintains consistency

### 2. Optimization
- Only store location prices that **differ** from global prices
- When saving, if location price equals global price, the location record is deleted
- Reduces database size and improves query performance

### 3. RBAC Integration
- Uses existing `PRODUCT_PRICE_EDIT` permission
- Admin/Super Admin: Access all locations
- Manager: Access only assigned locations via `UserLocation` table

### 4. Audit Trail
- Tracks who last updated prices and when
- Enables accountability and troubleshooting

### 5. Multi-Unit Support
- Works with existing UOM (Unit of Measure) system
- Each unit can have different prices per location
- Respects base unit multipliers for calculations

---

## Usage Examples

### Example 1: Set Custom Price for Main Warehouse
```typescript
// Product: Sample UTP CABLE
// Unit: Meter
// Main Warehouse: Custom purchase ₱6.00, selling ₱6.50
// Other locations: Use global pricing (₱6.33/₱6.71)

await saveProductLocationPrices(
  productId,
  businessId,
  [
    {
      locationId: mainWarehouseId,
      unitId: meterUnitId,
      purchasePrice: 6.00,
      sellingPrice: 6.50,
    },
  ],
  userId
)
```

### Example 2: Bulk Copy Global Prices
```typescript
// Copy current global prices to all locations as starting point
await copyGlobalPricesToLocations(
  productId,
  businessId,
  [location1Id, location2Id, location3Id],
  userId
)
```

### Example 3: Apply Percentage Adjustment
```typescript
// Increase all prices by 10% at specific locations
await applyPriceAdjustment(
  productId,
  businessId,
  [location1Id, location2Id],
  10, // Purchase price +10%
  10, // Selling price +10%
  userId
)
```

---

## Screenshots & UI Flow

### Admin Flow:
1. **Navigate:** Sidebar → Price Editor → Location Pricing (Admin)
2. **Select Product:** Use dropdown to search and select product
3. **View Grid:** See all locations grouped, with units as rows
4. **Edit Prices:** Click cells to edit purchase/selling prices
5. **Save:** Click "Save Changes" button
6. **Export:** Use "Export to Excel" button if needed

### Manager Flow:
1. **Navigate:** Sidebar → Price Editor → My Location Pricing
2. **Select Location:** Choose from assigned locations dropdown
3. **View Grid:** See all products grouped, with units as rows
4. **Edit Prices:** Click cells to edit purchase/selling prices
5. **Save:** Click "Save Changes" button
6. **Switch Location:** Select different location to edit others

---

## Troubleshooting

### Database Push Fails
- **Issue:** `npx prisma db push` hangs or times out
- **Solution:**
  - Check Supabase connectivity
  - Try `npx prisma db push --force-reset` (⚠️ DATA LOSS)
  - Use database client to manually create table

### Prices Not Showing in POS
- **Issue:** Location-specific prices not used in POS
- **Solution:** POS integration not yet implemented (pending task)

### Permission Denied Error
- **Issue:** Manager can't access Location Pricing pages
- **Solution:** Ensure user has `PRODUCT_PRICE_EDIT` permission and locations assigned via `UserLocation` table

### Prices Revert to Global
- **Issue:** Location prices deleted after save
- **Solution:** This is expected if location price equals global price (optimization)

---

## Next Steps

1. **Push Database Schema** (Priority: HIGH)
   - Run `npx prisma db push --accept-data-loss`
   - Run `npx prisma generate`

2. **Test Admin Page** (Priority: HIGH)
   - Login as Admin
   - Navigate to Location Pricing (Admin)
   - Test editing and saving prices

3. **Test Manager Page** (Priority: HIGH)
   - Login as Manager with assigned locations
   - Navigate to My Location Pricing
   - Test editing and saving prices

4. **Integrate with POS** (Priority: MEDIUM)
   - Modify POS to fetch location-specific prices
   - Implement fallback to global prices
   - Test transactions with location prices

5. **User Training** (Priority: LOW)
   - Create user guide
   - Train staff on new pricing features

---

## Files Modified/Created

### New Files:
- `src/lib/productLocationPricing.ts` - Pricing library
- `src/app/api/products/[id]/location-prices/route.ts` - Product API
- `src/app/api/locations/[id]/prices/route.ts` - Location API
- `src/app/dashboard/products/location-pricing/page.tsx` - Admin page
- `src/app/dashboard/products/my-location-pricing/page.tsx` - Manager page
- `LOCATION-PRICING-IMPLEMENTATION.md` - This document

### Modified Files:
- `prisma/schema.prisma` - Added ProductUnitLocationPrice model and relations
- `src/components/Sidebar.tsx` - Added menu items

### Pending Modifications:
- `src/app/dashboard/pos/page.tsx` - Needs location price integration

---

## Support

For questions or issues:
1. Check this document first
2. Review code comments in implementation files
3. Test in development environment before production
4. Contact development team if issues persist

---

**Implementation Date:** 2025-11-08
**Developer:** Claude (AI Assistant)
**Status:** 90% Complete - Database push and POS integration pending
