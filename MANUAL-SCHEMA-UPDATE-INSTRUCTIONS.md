# Manual Schema Update Instructions for Supabase

## Problem
`npx prisma db push` is stuck due to Supabase connection pool issues. This is a known issue with cloud-hosted PostgreSQL when there are stale prepared statements.

## Solution
Run the SQL manually in Supabase Dashboard, then regenerate the Prisma client.

---

## Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar

---

## Step 2: Run the SQL Script

Copy the entire SQL script from `SUPABASE-MANUAL-SCHEMA-UPDATE.sql` or use this:

```sql
-- Add replacement tracking columns to customer_returns
ALTER TABLE customer_returns
ADD COLUMN IF NOT EXISTS replacement_issued BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replacement_issued_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS replacement_issued_by INTEGER,
ADD COLUMN IF NOT EXISTS replacement_sale_id INTEGER UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_returns_replacement_issued
  ON customer_returns(replacement_issued);

CREATE INDEX IF NOT EXISTS idx_customer_returns_replacement_sale_id
  ON customer_returns(replacement_sale_id);

-- Add sale_type column to sales
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS sale_type VARCHAR(50) DEFAULT 'regular';

-- Create index for sale_type
CREATE INDEX IF NOT EXISTS idx_sales_sale_type
  ON sales(sale_type);

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customer_returns'
  AND column_name IN ('replacement_issued', 'replacement_issued_at', 'replacement_issued_by', 'replacement_sale_id')
ORDER BY ordinal_position;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name = 'sale_type'
ORDER BY ordinal_position;
```

3. Click **Run** button (or press Ctrl+Enter)
4. You should see the verification query results showing the new columns

---

## Step 3: Verify Success

After running the SQL, you should see output like this:

**customer_returns table:**
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| replacement_issued | boolean | NO | false |
| replacement_issued_at | timestamp without time zone | YES | NULL |
| replacement_issued_by | integer | YES | NULL |
| replacement_sale_id | integer | YES | NULL |

**sales table:**
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| sale_type | character varying | YES | 'regular'::character varying |

---

## Step 4: Regenerate Prisma Client (Local)

After the schema is updated in Supabase, run this command locally:

```bash
npx prisma generate
```

This should complete in 2-3 seconds without any database connection.

---

## Step 5: Test the Replacement Feature

Once the schema is updated, you can test the replacement issuance workflow:

1. **Create a test return:**
   - Go to Dashboard → Customer Returns
   - Create a new return with `returnType: 'replacement'`

2. **Approve the return:**
   - Open the return detail page
   - Click "Approve" (this adds inventory back to the location)

3. **Issue the replacement:**
   - After approval, you'll see an "Issue Replacement" button
   - Click it to deduct inventory for the replacement items
   - This creates a new Sale with `saleType: 'replacement'`

4. **Verify inventory:**
   - Check the product stock at the location
   - Should see both the return (adding stock) and replacement (deducting stock) in product history

---

## Why This Happened

The `npx prisma db push` command was stuck because:
1. Multiple Prisma processes were running simultaneously (including Prisma Studio)
2. Supabase connection pooler had stale prepared statements
3. Database locks were preventing schema changes

**This manual SQL approach is SAFE because:**
- ✅ We're only ADDING columns (no data deletion)
- ✅ All new columns are nullable or have defaults
- ✅ No existing data is modified
- ✅ Uses `IF NOT EXISTS` to prevent errors if columns already exist

---

## Next Steps After Schema Update

1. ✅ Schema updated in Supabase
2. ✅ Prisma client regenerated locally
3. 🔄 Test replacement issuance feature
4. 🔄 Complete product edit form performance optimization

---

## If You Encounter Issues

**Error: "column already exists"**
- This is fine! The `IF NOT EXISTS` clause prevents duplicate creation
- Continue with the verification queries

**Error: "permission denied"**
- Ensure you're connected as the database owner
- Check Supabase project permissions

**Prisma client out of sync**
- Run `npx prisma generate` again
- Restart your development server
