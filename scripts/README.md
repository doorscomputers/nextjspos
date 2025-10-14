# Scripts Directory

This directory contains utility scripts for managing the UltimatePOS Modern application.

## Available Scripts

### 1. Backfill Zero Inventory (`backfill-zero-inventory.mjs`)

**Purpose:** Creates missing zero-inventory records for existing products and locations.

**When to use:**
- After upgrading to a version with auto-inventory feature
- When you discover missing inventory records
- After manual database modifications

**Usage:**
```bash
npm run db:backfill-inventory
```

**What it does:**
- Scans all businesses in the database
- Identifies missing `VariationLocationDetails` records
- Creates zero-inventory records (qty=0) for all product-location combinations
- Processes in batches of 1,000 records for performance
- Skips duplicates automatically

**Output:**
```
Starting zero-inventory backfill process...

Found 2 business(es)

Processing business: ABC Company (ID: 1)
  Found 3 location(s)
  Found 25 product variation(s)
  Found 50 existing inventory record(s)
  Creating 25 missing inventory record(s)...
  Successfully created 25 record(s)

========================================
Backfill complete!
Total records created: 25
========================================
```

---

### 2. Test Auto Inventory (`test-auto-inventory.mjs`)

**Purpose:** Manual testing and verification of the auto-inventory feature.

**When to use:**
- After implementing the auto-inventory feature
- To verify the system is working correctly
- For debugging inventory issues

**Usage:**
```bash
node scripts/test-auto-inventory.mjs
```

**What it does:**
- Creates a test product and verifies inventory records are created for all locations
- Creates a test location and verifies inventory records are created for all products
- Validates that all quantities are set to 0
- Cleans up test data automatically

**Output:**
```
=================================================
Auto-Inventory Feature Test
=================================================

Using business: ABC Company (ID: 1)

Initial state:
  - Locations: 3
  - Products: 10

Test 1: Creating product - should auto-create inventory for all locations
------------------------------------------------------------------------
Created product: Auto-Inventory Test Product 1234567890 (ID: 42)
Created variation: DUMMY (ID: 123)
Created 3 inventory record(s)

Verification:
  Expected inventory records: 3
  Actual inventory records: 3
  ✓ PASSED: Inventory records created for all locations
  All quantities are 0: ✓ PASSED

Test 2: Creating location - should auto-create inventory for all products
--------------------------------------------------------------------------
Created location: Test Branch 1234567890 (ID: 15)
Created 11 inventory record(s)

Verification:
  Expected inventory records: 11
  Actual inventory records: 11
  ✓ PASSED: Inventory records created for all products
  All quantities are 0: ✓ PASSED

Cleanup: Removing test data...
Cleanup complete

=================================================
All tests completed successfully!
=================================================
```

---

## Adding New Scripts

When creating new scripts:

1. **Use `.mjs` extension** for ES modules with Prisma Client
2. **Add to package.json scripts** section for easy access
3. **Include error handling** with try-catch blocks
4. **Always disconnect Prisma** in the finally block
5. **Document usage** in this README

Example:
```javascript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function myScript() {
  try {
    // Your logic here
  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

myScript()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
```

## Troubleshooting

### "Cannot find module '@prisma/client'"

**Solution:** Run `npx prisma generate` to generate the Prisma Client.

### "Database connection error"

**Solution:** Check your `.env` file and ensure `DATABASE_URL` is correct.

### Script hangs or doesn't complete

**Solution:**
- Check database connection
- Look for unhandled promises
- Ensure `prisma.$disconnect()` is called

### Permission errors

**Solution:** Run the script with appropriate permissions or from the project root directory.

## Best Practices

1. **Always test scripts on a backup/dev database first**
2. **Review output logs carefully**
3. **Run during low-traffic periods for production**
4. **Keep a database backup before running data-modifying scripts**
5. **Monitor performance with large datasets**

## Related Documentation

- [Auto-Inventory Feature Documentation](../AUTO-INVENTORY-FEATURE.md)
- [Database Schema](../prisma/schema.prisma)
- [Package Scripts](../package.json)
