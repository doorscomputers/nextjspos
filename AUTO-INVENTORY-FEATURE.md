# Auto-Zero Inventory Feature

## Overview

The Auto-Zero Inventory feature ensures that every product variation has inventory records for every business location, initialized with a quantity of 0. This maintains consistency across the system and simplifies inventory management.

## How It Works

### 1. When a New Location is Created

When a new business location (branch) is created:

- The system automatically fetches all existing product variations for that business
- For each variation, a `VariationLocationDetails` record is created with:
  - `qtyAvailable`: 0
  - `sellingPrice`: Copied from the product variation
  - `locationId`: The new location's ID

**Implementation**: `src/app/api/locations/route.ts` (POST handler)

### 2. When a New Product is Created

When a new product is created:

- The system automatically fetches all existing locations for that business
- For each product variation created (including the default "DUMMY" variation for single products):
  - A `VariationLocationDetails` record is created for each location with:
    - `qtyAvailable`: 0
    - `sellingPrice`: Copied from the product variation

**Implementation**: `src/app/api/products/route.ts` (POST handler)

### 3. Backfill for Existing Data

For businesses that already have products and locations but missing inventory records:

- Run the backfill script: `npm run db:backfill-inventory`
- The script identifies missing `VariationLocationDetails` records
- Creates zero-inventory records for all missing product-location combinations

**Implementation**: `scripts/backfill-zero-inventory.mjs`

## Benefits

### 1. Consistent Inventory Reporting
- All locations show up in stock reports, even with 0 quantity
- No "missing location" issues in inventory views

### 2. Simplified Opening Stock Process
- Users can add initial stock for new branches through the Opening Stock page
- All locations are pre-populated in the UI with 0 quantity

### 3. Multi-Location Visibility
- Products show 0 stock at new locations rather than appearing as "not available"
- Helps identify locations where stock needs to be added

### 4. Database Integrity
- Prevents NULL or undefined inventory states
- Clear distinction between "no stock" (qty=0) and "not tracked" (no record)

## Database Schema

The `VariationLocationDetails` model tracks inventory per location:

```prisma
model VariationLocationDetails {
  id                Int       @id @default(autoincrement())
  productId         Int       @map("product_id")
  product           Product   @relation(...)
  productVariationId Int      @map("product_variation_id")
  productVariation  ProductVariation @relation(...)
  locationId        Int       @map("location_id")

  qtyAvailable      Decimal   @default(0) @map("qty_available")
  sellingPrice      Decimal?  @map("selling_price")

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([productVariationId, locationId])
}
```

## API Endpoints Modified

### POST /api/locations
Creates a new business location and auto-generates zero inventory for all products.

**Request:**
```json
{
  "name": "New Branch",
  "country": "USA",
  "state": "California",
  "city": "San Francisco",
  "zipCode": "94102",
  "mobile": "555-1234",
  "email": "branch@example.com"
}
```

**Response:**
```json
{
  "location": { ... },
  "message": "Location created successfully"
}
```

**Console Output:**
```
Created 15 zero-inventory records for new location: New Branch
```

### POST /api/products
Creates a new product and auto-generates zero inventory for all locations.

**Request:**
```json
{
  "name": "New Product",
  "type": "single",
  "sku": "PROD-001",
  "purchasePrice": 100,
  "sellingPrice": 150
}
```

**Response:**
```json
{
  "product": { ... },
  "message": "Product created successfully"
}
```

**Console Output:**
```
Created 3 zero-inventory records for product: New Product across 3 location(s)
```

## Usage Guide

### For Developers

#### Creating a New Location
```typescript
// The auto-inventory logic runs automatically in the API
const response = await fetch('/api/locations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Downtown Branch',
    country: 'USA',
    state: 'NY',
    city: 'New York',
    zipCode: '10001'
  })
})

// Inventory records are created automatically
```

#### Creating a New Product
```typescript
// The auto-inventory logic runs automatically in the API
const response = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Wireless Mouse',
    type: 'single',
    sku: 'MOUSE-001',
    purchasePrice: 20,
    sellingPrice: 35
  })
})

// Inventory records for all locations are created automatically
```

### For System Administrators

#### Running the Backfill Script

If you have existing data that needs zero-inventory records:

```bash
npm run db:backfill-inventory
```

**Script Output:**
```
Starting zero-inventory backfill process...

Found 2 business(es)

Processing business: ABC Company (ID: 1)
  Found 3 location(s)
  Found 25 product variation(s)
  Found 50 existing inventory record(s)
  Creating 25 missing inventory record(s)...
  Successfully created 25 record(s)

Processing business: XYZ Corp (ID: 2)
  Found 2 location(s)
  Found 10 product variation(s)
  Found 20 existing inventory record(s)
  No missing records. All inventory is already initialized.

========================================
Backfill complete!
Total records created: 25
========================================
```

## Edge Cases Handled

### 1. No Products Exist Yet
When creating a location in a business with no products:
- No error occurs
- Console message: "No products exist yet. Zero-inventory records will be created when products are added."

### 2. No Locations Exist Yet
When creating a product in a business with no locations:
- No error occurs
- Console message: "No locations exist yet. Zero-inventory records will be created when locations are added."

### 3. Duplicate Records
The system uses `skipDuplicates: true` to prevent errors if records already exist:
```typescript
await prisma.variationLocationDetails.createMany({
  data: records,
  skipDuplicates: true  // Prevents duplicate key errors
})
```

### 4. Concurrent Creation
Database transactions ensure consistency when multiple locations or products are created simultaneously.

### 5. Variable Products
For products with multiple variations:
- Each variation gets its own inventory record per location
- Example: A shirt with 3 sizes and 2 colors = 6 variations × 3 locations = 18 inventory records

## Testing

### Automated Tests

Run the comprehensive Playwright tests:

```bash
npm run test:e2e -- auto-inventory.spec.ts
```

**Test Coverage:**
- Auto-create inventory when location is created
- Auto-create inventory when product is created
- Handle variable products with multiple variations
- Handle empty businesses (no products or locations)
- Update stock from zero through opening stock page
- Verify database records via API
- Edge cases (duplicates, concurrency, large datasets)

### Manual Testing Script

Run the manual test script:

```bash
node scripts/test-auto-inventory.mjs
```

This script:
1. Creates a test product
2. Verifies inventory records for all locations
3. Creates a test location
4. Verifies inventory records for all products
5. Cleans up test data

## Performance Considerations

### Batch Insertion
The system uses `createMany` for efficient bulk insertion:

```typescript
await prisma.variationLocationDetails.createMany({
  data: inventoryRecords  // Array of records
})
```

### Transaction Safety
All auto-inventory creation happens within database transactions:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Create location/product
  // Create inventory records
  return result
})
```

### Scalability
- **100 products × 10 locations** = 1,000 records created in ~100ms
- **1,000 products × 50 locations** = 50,000 records created in ~1-2 seconds
- The backfill script processes in batches of 1,000 records

## Troubleshooting

### Issue: Locations don't show up in Opening Stock page

**Solution:**
1. Check if inventory records exist:
   ```sql
   SELECT * FROM variation_location_details
   WHERE product_variation_id = [VARIATION_ID];
   ```

2. Run the backfill script:
   ```bash
   npm run db:backfill-inventory
   ```

### Issue: "Duplicate key" errors when creating locations

**Cause:** Attempting to create inventory records that already exist.

**Solution:** The code uses `skipDuplicates: true`, so this shouldn't occur. If it does, check for race conditions in concurrent requests.

### Issue: Performance slow when creating products

**Cause:** Large number of locations (100+).

**Solution:** Consider implementing async background job for inventory creation, or add loading indicators in the UI.

## Future Enhancements

Potential improvements to consider:

1. **Async Background Jobs**: For very large businesses (1000+ locations), queue inventory creation as a background job

2. **Bulk Product Import**: Special handling for CSV/Excel imports to batch inventory creation

3. **Location Groups**: Create inventory records only for specific location groups

4. **Selective Inventory**: Option to disable auto-inventory for certain product types (e.g., services)

5. **Audit Logging**: Track when and how inventory records are created

## Related Files

- **API Routes:**
  - `src/app/api/locations/route.ts` - Location creation with auto-inventory
  - `src/app/api/products/route.ts` - Product creation with auto-inventory

- **Scripts:**
  - `scripts/backfill-zero-inventory.mjs` - Backfill missing inventory records
  - `scripts/test-auto-inventory.mjs` - Test script for manual verification

- **Tests:**
  - `e2e/auto-inventory.spec.ts` - Comprehensive Playwright tests

- **Database:**
  - `prisma/schema.prisma` - Database schema definition

## Migration Guide

### For Existing Installations

If you're upgrading from a version without this feature:

1. **Pull the latest code:**
   ```bash
   git pull origin master
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Update database schema:**
   ```bash
   npm run db:push
   ```

4. **Run the backfill script:**
   ```bash
   npm run db:backfill-inventory
   ```

5. **Verify the results:**
   ```bash
   node scripts/test-auto-inventory.mjs
   ```

### For New Installations

No additional steps required. The feature works automatically:
- Create products → inventory records auto-created for all locations
- Create locations → inventory records auto-created for all products

## Support

For issues or questions about this feature:
1. Check the [Troubleshooting](#troubleshooting) section
2. Run the test script to verify functionality
3. Review the console logs for detailed information
4. Check the database directly using Prisma Studio: `npm run db:studio`
