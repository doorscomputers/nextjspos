# Location-Specific Invoice Numbering System

## 🎯 Overview

The system has been upgraded to support **location-specific invoice numbering** where each business location maintains its own independent invoice sequence.

### Previous System:
```
Main Store:    INV-202510-0001
Tuguegarao:    INV-202510-0002  ❌ (shared sequence)
Manila Branch: INV-202510-0003
```

### New System:
```
Main Store:    INVM-202510-0001  ✅ (independent sequence)
Tuguegarao:    INVT-202510-0001  ✅ (independent sequence)
Manila Branch: INVMB-202510-0001 ✅ (independent sequence)
```

---

## 🔢 Invoice Number Format

**Format:** `INV{LocationPrefix}-YYYYMM-####`

### Location Prefix Generation

The system automatically generates a prefix from the location name:

| Location Name | Prefix | Example Invoice Number |
|---------------|--------|------------------------|
| Tuguegarao | T | INVT-202510-0001 |
| Main Store | M | INVM-202510-0001 |
| Manila Branch | MB | INVMB-202510-0001 |
| Quezon City Store | QC | INVQC-202510-0001 |
| Warehouse | W | INVW-202510-0001 |

**Rules:**
- Single-word locations → First letter (e.g., "Tuguegarao" → "T")
- Multi-word locations → First letter of each word (e.g., "Manila Branch" → "MB")
- Common words like "Store", "Branch", "Warehouse" are ignored
- Maximum 3 characters for the prefix
- Always uppercase

---

## 📊 Database Changes

### Schema Update

The `invoice_sequences` table now includes `location_id`:

```prisma
model InvoiceSequence {
  id         Int @id @default(autoincrement())
  businessId Int @map("business_id")
  locationId Int @map("location_id") // NEW: Location-specific sequences
  year       Int
  month      Int
  sequence   Int @default(1)

  @@unique([businessId, locationId, year, month]) // NEW unique constraint
  @@index([businessId])
  @@index([locationId]) // NEW index
  @@map("invoice_sequences")
}
```

### Migration

The migration script (`scripts/migrate-invoice-sequences.ts`) handles existing data by:
1. Adding `location_id` column
2. Assigning existing sequences to the first location of each business
3. Creating new unique constraint with location_id
4. Each location starts fresh sequences from 0001

---

## 🚀 How It Works

### 1. Invoice Generation

When a sale is created at a location:

```typescript
// Example: Sale at Tuguegarao location
const invoiceNumber = await getNextInvoiceNumber(
  businessId: 1,
  locationId: 2,
  locationName: "Tuguegarao",
  transaction
)
// Returns: "INVT-202510-0001"
```

### 2. Sequence Counter

Each location has its own sequence counter that:
- Starts at 0001 each month
- Increments independently per location
- Never conflicts with other locations
- Uses atomic database operations (race-condition free)

### 3. Monthly Reset

All locations reset their sequence to 0001 at the start of each month:

```
October 2025:
- Tuguegarao: INVT-202510-0001, INVT-202510-0002, ...
- Main Store: INVM-202510-0001, INVM-202510-0002, ...

November 2025:
- Tuguegarao: INVT-202511-0001 (reset to 0001)
- Main Store: INVM-202511-0001 (reset to 0001)
```

---

## 📦 Impact on Inventory Management

### ✅ **No Impact on Inventory**

The invoice numbering change **does not affect inventory management** because:

1. **Inventory is already location-specific**
   - Each sale has a `locationId` field
   - Stock deductions happen at the correct location
   - Inventory tracking is independent of invoice numbers

2. **Invoice numbers are just identifiers**
   - They don't affect stock calculations
   - They don't determine which location's inventory to deduct
   - They're only used for display and BIR compliance

3. **Location context is maintained**
   ```typescript
   // Sale record
   {
     id: 123,
     invoiceNumber: "INVT-202510-0001",
     locationId: 2,  // ← This determines inventory deduction
     // ... other fields
   }
   ```

### Inventory Operations Remain Unchanged

✅ Stock deductions still happen at the sale's `locationId`
✅ Inventory reports still filter by `locationId`
✅ Stock transfers still use `fromLocationId` and `toLocationId`
✅ Multi-tenant isolation still enforced by `businessId`

---

## 🐛 Bug Fixes Included

### 1. Cashier Name Display Fixed ✅

**Problem:** Invoice printouts showed "User #82" instead of the cashier's actual name

**Solution:** Updated the sales API to include the `creator` relation:

```typescript
// Before
include: {
  customer: { ... },
  items: true,
  payments: true,
}

// After
include: {
  customer: { ... },
  creator: {  // ← Added
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      surname: true,
    },
  },
  items: true,
  payments: true,
}
```

Now invoices correctly display: **"Cashier: Kate Jasmin"** instead of "User #82"

---

## 📝 Code Changes Summary

### Files Modified:

1. **`prisma/schema.prisma`**
   - Added `locationId` to `InvoiceSequence` model
   - Updated unique constraint to include `locationId`

2. **`src/lib/atomicNumbers.ts`**
   - Added `getLocationPrefix()` function
   - Updated `getNextInvoiceNumber()` to accept `locationId` and `locationName`
   - Changed invoice format to include location prefix

3. **`src/app/api/sales/route.ts`**
   - Updated GET endpoint to include `creator` relation
   - Updated POST endpoint to pass `locationId` and `locationName` to invoice generator

4. **`scripts/migrate-invoice-sequences.ts`**
   - Created migration script to handle existing data

---

## 🧪 Testing

### Test Scenarios:

1. **Create sales at different locations**
   ```
   Main Store:    INVM-202510-0001
   Tuguegarao:    INVT-202510-0001
   Main Store:    INVM-202510-0002
   Tuguegarao:    INVT-202510-0002
   ```

2. **Verify cashier name appears correctly on printouts**
   ```
   Cashier: Kate Jasmin  ✅
   (instead of "User #82")
   ```

3. **Verify inventory deductions happen at correct location**
   ```sql
   SELECT * FROM product_history
   WHERE sale_id = 123
   -- Should show location_id matching the sale location
   ```

4. **Check sequence uniqueness**
   - Each location should have independent sequences
   - No duplicate invoice numbers across locations
   - Monthly reset should work correctly

---

## 🔐 BIR Compliance

Location-specific invoice numbering **maintains BIR compliance**:

✅ Invoice numbers are still unique (per location)
✅ Sequential numbering is maintained (per location)
✅ No gaps in sequences (per location)
✅ Monthly tracking is preserved
✅ Each location can be audited independently

---

## 🚨 Important Notes

### For Existing Installations:

1. **Backup your database first**
   ```bash
   pg_dump -U postgres ultimatepos_modern > backup.sql
   ```

2. **Existing invoice sequences:**
   - Existing sequences are assigned to the first location
   - New sales at other locations start fresh from 0001
   - No historical invoice numbers are changed

3. **No data loss:**
   - All existing sales retain their original invoice numbers
   - Only new sales use the new format

### For New Installations:

- Just run normal database seeding
- Each location automatically gets its own sequence
- No special setup required

---

## 📞 Support

If you encounter issues:

1. Check that Prisma client is generated: `npx prisma generate`
2. Verify database schema matches: `npx prisma db push`
3. Check migration status in database:
   ```sql
   SELECT * FROM invoice_sequences ORDER BY id DESC LIMIT 10;
   ```

---

## 🎉 Summary

### What Changed:
- ✅ Each location now has independent invoice numbering
- ✅ Location prefix derived from location name (e.g., INVT, INVM)
- ✅ Cashier name now displays correctly on invoices
- ✅ Database schema updated with proper migration
- ✅ Zero impact on inventory management

### What Stayed the Same:
- ✅ Monthly sequence reset
- ✅ BIR compliance
- ✅ Atomic sequence generation (no race conditions)
- ✅ Multi-tenant isolation
- ✅ Inventory tracking by location

**Result:** Professional, location-specific invoice numbering that improves organization while maintaining full compliance and data integrity! 🎯
