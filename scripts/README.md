# Scripts Directory

This directory contains utility scripts for managing the UltimatePOS Modern application.

## Table of Contents

- [Production Migration Scripts](#production-migration-scripts)
- [Development & Testing Scripts](#development--testing-scripts)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Production Migration Scripts

These scripts help you migrate your local database to production for Vercel deployment.

### 1. Export Production Data (`export-data.mjs`)

**Purpose:** Export production-ready data from your local database (excludes demo accounts).

**When to use:**
- Before production deployment
- Creating backups
- Moving data between environments

**Usage:**
```bash
node scripts/export-data.mjs
```

**What it does:**
- Exports all business data, products, inventory, users
- **Excludes demo accounts** (superadmin, admin, manager, cashier)
- Creates timestamped JSON file in `backup/` directory
- Validates data before export

**Output:**
```
Starting data export...

Exporting businesses...
✓ Exported 1 businesses
Exporting products...
✓ Exported 250 products
Exporting product variations...
✓ Exported 500 variations
Exporting stock/inventory...
✓ Exported 1000 stock records

✅ Export completed successfully!
📁 File saved to: backup/export-2025-01-15T10-30-00.json
```

---

### 2. Import Production Data (`import-data.mjs`)

**Purpose:** Import data to production database.

**When to use:**
- Initial production deployment
- Restoring from backup
- Syncing data between environments

**Usage:**
```bash
# Set production database URL first
$env:DATABASE_URL="YOUR_PRODUCTION_DIRECT_CONNECTION_URL"

# Run import
node scripts/import-data.mjs backup/export-2025-01-15T10-30-00.json
```

**Prerequisites:**
- Production database must exist
- Prisma schema must be pushed (`npx prisma db push`)

**What it does:**
- Reads JSON export file
- Imports data in correct order (respects foreign keys)
- Uses upsert operations (safe to run multiple times)

**Output:**
```
Starting data import...

Importing businesses...
✓ Imported 1 businesses
Importing products...
✓ Imported 250 products
Importing product variations...
✓ Imported 500 variations
Importing stock/inventory...
✓ Imported 1000 stock records

✅ Import completed successfully!
```

---

### 3. Create Production Admin (`create-production-admin.mjs`)

**Purpose:** Create admin user for production environment.

**When to use:**
- After initial data import (demo accounts are excluded)
- Creating additional admin users
- Resetting admin access

**Usage:**
```bash
# Set production database URL first
$env:DATABASE_URL="YOUR_PRODUCTION_DIRECT_CONNECTION_URL"

# Run script
node scripts/create-production-admin.mjs
```

**Interactive prompts:**
- Select business
- Enter username, email, first name, last name
- Enter password (min 8 characters)
- Confirm password

**Output:**
```
✅ Production Admin Created Successfully!

User Details:
   Username:     admin_production
   Email:        admin@example.com
   Name:         System Administrator
   Business:     Your Business Name
   Role:         Super Admin
```

---

### 4. Verify Production Data (`verify-production-data.mjs`)

**Purpose:** Verify data integrity after migration to production.

**When to use:**
- After data import
- Before production deployment
- Regular data audits

**Usage:**
```bash
# Set production database URL first
$env:DATABASE_URL="YOUR_PRODUCTION_DIRECT_CONNECTION_URL"

# Run verification
node scripts/verify-production-data.mjs
```

**What it checks:**
- All products have variations
- All variations reference valid products
- All stock references valid variations
- All users have roles
- All businesses have locations
- Admin users exist
- Multi-tenant data structure

**Output:**
```
✅ PASSED CHECKS:
  ✓ Products have variations
  ✓ Variations linked to products
  ✓ Stock linked to variations

📋 Summary:
   8 checks passed
   0 warnings
   0 critical issues

🚀 Database is ready for production deployment!
```

---

## Development & Testing Scripts

### Available Scripts

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

### Production Deployment Documentation

For complete production deployment guide, see:
- **[Production Deployment Guide](../PRODUCTION_DEPLOYMENT_GUIDE.md)** - Complete step-by-step guide
- **[Production Migration Checklist](../PRODUCTION_MIGRATION_CHECKLIST.md)** - Detailed checklist
- **[Deployment Quick Reference](../DEPLOYMENT_QUICK_REFERENCE.md)** - One-page quick reference
- **[Database Provider Comparison](../DATABASE_PROVIDER_COMPARISON.md)** - Choose the right database
