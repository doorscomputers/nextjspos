# Database Schema Update Instructions

## Overview
This document provides step-by-step instructions to manually update your Supabase database schema since `npx prisma db push` is timing out.

## What This Update Does
1. **Fixes Receipt Printing**: Adds columns to store display quantities (e.g., "100 Meters" instead of "0.33 Rolls")
2. **Enables Per-Location Pricing**: Creates table for location-specific product pricing

## Prerequisites
- Access to your Supabase dashboard
- Database credentials
- SQL execution permissions

---

## STEP 1: Execute SQL Script in Supabase

### Option A: Using Supabase SQL Editor (Recommended)

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Paste and Execute**
   - Open the file `manual-schema-update.sql` from your project root
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Check the "Logs" section for any errors

### Option B: Using Command Line (Alternative)

If you have `psql` installed:

```bash
# Replace with your Supabase connection string
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f manual-schema-update.sql
```

---

## STEP 2: Verify Database Changes

Run these verification queries in Supabase SQL Editor:

### Check sale_items columns:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sale_items'
  AND column_name IN ('display_quantity', 'selected_unit_name');
```

**Expected Result:** Should show 2 rows with these columns

### Check product_unit_location_prices table:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'product_unit_location_prices';
```

**Expected Result:** Should show 1 row

### Check indexes:
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'product_unit_location_prices';
```

**Expected Result:** Should show 4-5 indexes

---

## STEP 3: Regenerate Prisma Client

After database update succeeds, regenerate Prisma Client locally:

```bash
cd C:\xampp\htdocs\ultimatepos-modern
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (5.x.x) to .\node_modules\.prisma\client in Xms
```

---

## STEP 4: Restart Development Server

```bash
# Stop current dev server (Ctrl+C)
npm run dev
```

---

## STEP 5: Test the Changes

### Test 1: Sales Completion
1. Navigate to POS (`/dashboard/pos`)
2. Add a product with UOM (e.g., Sample UTP CABLE)
3. Select a sub-unit (e.g., Meter instead of Roll)
4. Complete the sale
5. **Expected:** Sale completes successfully without Status 500 error

### Test 2: Receipt Printing (Will work after additional code restoration)
1. After STEP 3 is complete, I will restore the receipt display fields
2. Make a new sale with UOM product
3. Print receipt
4. **Expected:** Receipt shows "100 Meters" instead of "0.33 Rolls"

### Test 3: Location Pricing (Admin)
1. Navigate to Price Editor → Location Pricing (Admin)
2. Select a product
3. Edit prices for different locations
4. Save changes
5. **Expected:** Prices save successfully

### Test 4: Location Pricing (Manager)
1. Login as a Manager with assigned locations
2. Navigate to Price Editor → My Location Pricing
3. Select a location
4. Edit prices for products
5. Save changes
6. **Expected:** Prices save successfully

---

## Troubleshooting

### Error: "relation already exists"
**Solution:** Some objects already exist. This is safe - the script uses `IF NOT EXISTS` clauses.

### Error: "permission denied"
**Solution:** Ensure you're using a user with CREATE TABLE permissions (usually `postgres` user).

### Error: "duplicate key value violates unique constraint"
**Solution:** If you have existing data in `product_unit_location_prices`, this is expected. The script will skip creation.

### Prisma Generate Fails with EPERM
**Solution:**
1. Stop development server (Ctrl+C)
2. Wait 5 seconds
3. Run `npx prisma generate` again

### Changes Not Reflected in Application
**Solution:**
1. Verify database changes using verification queries
2. Regenerate Prisma Client: `npx prisma generate`
3. Restart dev server: `npm run dev`
4. Hard refresh browser: Ctrl+Shift+R

---

## Rollback Instructions

If something goes wrong, you can undo all changes:

```sql
BEGIN;
DROP TABLE IF EXISTS product_unit_location_prices CASCADE;
ALTER TABLE sale_items DROP COLUMN IF EXISTS display_quantity;
ALTER TABLE sale_items DROP COLUMN IF EXISTS selected_unit_name;
COMMIT;
```

---

## Current Status

✅ **COMPLETED**
- Database schema defined in Prisma
- API endpoints created
- UI pages created (Admin and Manager)
- Sidebar menu items added
- Documentation written
- SQL migration script created

⏳ **PENDING** (After Database Update)
- Execute SQL script in Supabase (STEP 1)
- Regenerate Prisma Client (STEP 3)
- Restore receipt display code (I will do this after STEP 3)
- Test all features (STEP 5)

---

## Next Steps After Completion

Once database update is complete:

1. **Notify me** so I can restore the receipt display fields in the code
2. **Test sales** to ensure Status 500 error is gone
3. **Test per-location pricing** feature (Admin and Manager views)
4. **Make a test sale** with UOM product to verify receipt printing

---

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Verify each step was completed successfully
3. Review database logs in Supabase dashboard
4. Share error messages if problems persist

---

**Created:** 2025-11-08
**Status:** Ready for execution
**Estimated Time:** 5-10 minutes
