# Database Cleanup Guide

## Overview

This guide explains how to clean up test/demo data from your deployed database after testing online and before going live with real production data.

---

## Two Cleanup Options

### Option 1: Delete ONLY Test Data (Selective Cleanup) 🎯

**Script:** `scripts/cleanup-test-data.mjs`

**What it does:**
- Deletes only records with "TEST", "DUMMY", or "ADECS" in their names/notes
- Keeps all other data intact
- Safe for selective cleanup

**What gets deleted:**
- ✅ Products/Variations with "TEST" or "DUMMY" in name/SKU
- ✅ Transactions with "TEST" in transaction numbers or notes
- ✅ Suppliers with "TEST" or "ADECS" in name
- ✅ Customers with "TEST" in name
- ✅ Related items and history for deleted records

**What is preserved:**
- ✅ All "real" products (without TEST/DUMMY keywords)
- ✅ All "real" transactions
- ✅ Business settings
- ✅ Locations/branches
- ✅ Users and permissions
- ✅ Roles

**When to use:**
- When you have a mix of test and real data
- When you want to keep some data but remove test records
- During development/testing phases

**Usage:**
```bash
node scripts/cleanup-test-data.mjs
```

---

### Option 2: Delete ALL Data (Complete Cleanup) 🧹

**Script:** `scripts/cleanup-all-data.mjs`

**What it does:**
- Deletes **ALL** transactional data from database
- Leaves only the empty structure
- Complete fresh start

**What gets deleted:**
- ❌ ALL products and variations
- ❌ ALL sales transactions
- ❌ ALL purchases and receipts
- ❌ ALL stock transfers
- ❌ ALL supplier returns
- ❌ ALL product history
- ❌ ALL audit logs
- ❌ ALL item ledger entries
- ❌ ALL inventory corrections
- ❌ ALL suppliers
- ❌ ALL customers

**What is preserved:**
- ✅ Database structure (tables, schema)
- ✅ Business settings
- ✅ Locations/branches
- ✅ Users and permissions
- ✅ Roles

**When to use:**
- After finishing online testing and ready for production
- When you want to start completely fresh
- Before importing real production data
- When test data is too mixed with other data

**Usage:**
```bash
node scripts/cleanup-all-data.mjs
```

---

## Recommended Workflow for Production Deployment

### Phase 1: Initial Online Testing

1. **Deploy to Vercel** with test/demo data
2. **Test all features** online
3. **Verify everything works** correctly

### Phase 2: Clean Up Test Data

Choose one of these approaches:

**Approach A: Selective Cleanup (if you have some real data)**
```bash
# Delete only test data, keep real data
node scripts/cleanup-test-data.mjs
```

**Approach B: Complete Cleanup (recommended for fresh start)**
```bash
# Delete ALL data for fresh start
node scripts/cleanup-all-data.mjs
```

### Phase 3: Import Production Data

After cleanup, import your real data:

```bash
# If you have a backup/export file
node scripts/import-data.mjs backup/your-real-data.json
```

Or create data manually through the UI.

### Phase 4: Go Live

1. ✅ Verify all data is correct
2. ✅ Test critical workflows
3. ✅ Train users
4. ✅ Start using in production!

---

## Safety Features

Both scripts include:

1. **Confirmation Prompts** - You must confirm before deletion
2. **Preview Before Delete** - Shows what will be deleted
3. **Record Counts** - Displays how many records will be affected
4. **Safe Deletion Order** - Deletes child records first to avoid errors
5. **Error Handling** - Stops if something goes wrong

---

## Example Usage

### Selective Cleanup Example

```bash
C:\xampp\htdocs\ultimatepos-modern> node scripts/cleanup-test-data.mjs

🔍 Scanning for test data...

================================================================================
TEST DATA FOUND:
================================================================================

📦 Products (3):
  - DUMMY Product A | SKU: DUMMY-001 | 2 variations
  - TEST Product B | SKU: TEST-002 | 1 variations
  - Test Sample | SKU: TEST-003 | 1 variations

🛒 Purchase Orders (2):
  - PO-TEST-001 | ADECS Supplier | ₱5,000 | 3 items
  - PO-TEST-002 | Test Supplier | ₱3,000 | 2 items

================================================================================
TOTAL TEST RECORDS FOUND: 5
================================================================================

⚠️  WARNING: This will PERMANENTLY DELETE all the test data listed above!

Are you sure you want to continue? (yes/no): yes

🗑️  Starting deletion process...

✅ Deleted 5 purchase items
✅ Deleted 2 purchases
✅ Deleted 4 product variations
✅ Deleted 3 products

🎉 Successfully deleted 5 test records!

✅ Cleanup complete! You can now run your own tests with clean data.
```

### Complete Cleanup Example

```bash
C:\xampp\htdocs\ultimatepos-modern> node scripts/cleanup-all-data.mjs

================================================================================
⚠️  DELETE ALL DATA SCRIPT ⚠️
================================================================================

📊 Counting current database records...

================================================================================
CURRENT DATABASE CONTENTS:
================================================================================

📦 PRODUCTS & INVENTORY:
  • Products: 45
  • Product Variations: 78
  • Product History: 234
  • Inventory Corrections: 12

💰 SALES:
  • Sales Transactions: 23
  • Sale Items: 67

🛒 PURCHASES:
  • Purchase Orders: 15
  • Purchase Items: 45
  • Purchase Receipts (GRNs): 10
  • Receipt Items: 30

================================================================================
TOTAL RECORDS TO DELETE: 559
================================================================================

Type "DELETE ALL" to continue (or anything else to cancel): DELETE ALL

⚠️  FINAL WARNING: This CANNOT be undone! Type "I UNDERSTAND" to proceed: I UNDERSTAND

🗑️  Starting deletion process...

🗑️  Step 1/14: Deleting sale items...
   ✓ Deleted 67 sale items
🗑️  Step 2/14: Deleting sales...
   ✓ Deleted 23 sales
...
(all steps)
...

================================================================================
✅ CLEANUP COMPLETED SUCCESSFULLY!
================================================================================

TOTAL RECORDS DELETED: 559

✅ Your database is now clean and ready for production data!
```

---

## FAQ

### Q: Can I undo a cleanup?

**A:** No, deletion is permanent. **Always make a database backup first!**

To backup your database before cleanup:
```bash
# Export current data first
node scripts/export-data.mjs

# Backup file saved to: backup/export-YYYY-MM-DD-HHmmss.json
```

### Q: Which cleanup script should I use?

**A:**
- Use **cleanup-test-data.mjs** if you have mixed test and real data
- Use **cleanup-all-data.mjs** if you want to start completely fresh

### Q: Will this delete my admin users?

**A:** No, both scripts preserve all users, business settings, locations, and permissions.

### Q: What if I only want to delete products but keep transactions?

**A:** You can modify the scripts or delete manually through Prisma Studio:
```bash
npm run db:studio
```

### Q: Can I run these scripts multiple times?

**A:** Yes, they're safe to run multiple times. If there's nothing to delete, they'll just report that the database is clean.

### Q: How do I backup before cleanup?

**A:** Use the export script:
```bash
# Export everything
node scripts/export-data.mjs

# This creates: backup/export-YYYY-MM-DD-HHmmss.json
```

If you need to restore:
```bash
node scripts/import-data.mjs backup/export-YYYY-MM-DD-HHmmss.json
```

---

## Connection Strings

### For Local Database (Development)
```bash
# Use direct connection
$env:DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
node scripts/cleanup-all-data.mjs
```

### For Production Database (Vercel/Supabase)
```bash
# Use direct connection (NOT pooled) for migrations/scripts
$env:DATABASE_URL="postgresql://user:password@host:5432/dbname"
node scripts/cleanup-all-data.mjs

# Note: Use port 5432 (direct) for scripts, not 6543 (pooled)
```

---

## Troubleshooting

### Error: "Foreign key constraint failed"

**Solution:** The script deletes in the correct order. If you get this error, make sure you're using the latest version of the script.

### Error: "Table does not exist"

**Solution:** This is normal if your database doesn't have optional tables like `AuditLog` or `ItemLedger`. The script will skip these automatically.

### Error: "Too many connections"

**Solution:** Make sure you're using the **direct connection** (port 5432), not the pooled connection (port 6543) when running cleanup scripts.

---

## Best Practices

1. **Always backup before cleanup**
   ```bash
   node scripts/export-data.mjs
   ```

2. **Test the cleanup on a copy first**
   - Create a test database
   - Run cleanup there first
   - Verify it works as expected

3. **Use test data naming convention**
   - Name test products: "TEST Product Name" or "DUMMY Product"
   - Name test transactions with "TEST" in notes
   - This makes selective cleanup easier

4. **Document what you're keeping**
   - Note which data is real vs test
   - Keep a list of what should be preserved

5. **Verify after cleanup**
   ```bash
   node scripts/verify-production-data.mjs
   ```

---

## Summary

| Feature | cleanup-test-data.mjs | cleanup-all-data.mjs |
|---------|----------------------|---------------------|
| **Deletes** | Only TEST/DUMMY records | ALL transactional data |
| **Preserves** | Real data + settings | Settings only |
| **Safety** | High (selective) | Medium (complete wipe) |
| **Use Case** | Mixed data cleanup | Fresh start |
| **Reversible** | No (backup first!) | No (backup first!) |

---

**Remember:** Always backup your database before running any cleanup script!

```bash
# Backup command
node scripts/export-data.mjs
```

Your backup will be saved in: `backup/export-YYYY-MM-DD-HHmmss.json`
