# Database Migration Guide - Local to Supabase

Complete guide for migrating your UltimatePOS database from local PostgreSQL/MySQL to Supabase.

## 📋 Prerequisites

1. ✅ Local database running and accessible
2. ✅ Supabase project created
3. ✅ Supabase connection string ready
4. ✅ Backup of both databases

## 🚀 Step-by-Step Migration Process

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project initialization (~2 minutes)
4. Get your connection string from **Settings → Database**

### Step 2: Backup Your Local Database

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres -d ultimatepos_modern > backup_$(date +%Y%m%d).sql

# MySQL backup (if using MySQL)
mysqldump -u root -p ultimatepos_modern > backup_$(date +%Y%m%d).sql
```

### Step 3: Deploy Schema to Supabase

Update your `.env` file:

```env
# Keep your local database URL
DATABASE_URL="postgresql://localhost:5432/ultimatepos_modern"

# Add Supabase connection string
SUPABASE_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

Push schema to Supabase:

```bash
# Use Supabase connection for schema deployment
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" npx prisma db push

# Or generate Prisma Client
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" npx prisma generate
```

### Step 4: Configure Migration Script

Create/update `.env.migration` file:

```env
# Source database (your local database)
SOURCE_DATABASE_URL="postgresql://localhost:5432/ultimatepos_modern"

# Target database (Supabase)
TARGET_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Step 5: Run Migration Script

```bash
# Install tsx if not already installed
npm install -g tsx

# Run migration with environment variables
SOURCE_DATABASE_URL="postgresql://localhost:5432/ultimatepos_modern" \
TARGET_DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
npx tsx scripts/migrate-to-supabase.ts
```

The script will:
1. ✅ Validate database connections
2. ✅ Show current table counts
3. ⚠️ Ask for confirmation
4. ✅ Migrate all tables in proper order
5. ✅ Show migration statistics

### Step 6: Verify Migration

After migration completes:

```bash
# Check table counts
npx prisma studio

# Or use psql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
  -c "SELECT 'businesses' as table, COUNT(*) FROM business UNION ALL
      SELECT 'users', COUNT(*) FROM users UNION ALL
      SELECT 'products', COUNT(*) FROM products UNION ALL
      SELECT 'expenses', COUNT(*) FROM expenses;"
```

### Step 7: Update Production Environment

Update your production `.env`:

```env
# Switch to Supabase database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Keep other environment variables
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secret"
OPENAI_API_KEY="your-key"
```

## 📊 Migration Order

The script migrates tables in this order to maintain referential integrity:

1. **Currencies** (no dependencies)
2. **Businesses** (depends on: Currency)
3. **Business Locations** (depends on: Business)
4. **Roles** (depends on: Business)
5. **Permissions** (no dependencies)
6. **Users** (depends on: Business)
7. **Junction Tables** (User Roles, Role Permissions, User Permissions, User Locations)
8. **Categories, Brands, Units, Taxes** (depends on: Business)
9. **Suppliers & Customers** (depends on: Business)
10. **Products & Variations** (depends on: Category, Brand, Unit, Tax)
11. **Chart of Accounts** (depends on: Business)
12. **Expense Categories & Expenses** (depends on: Business, Location, Category)

## ⚙️ Advanced Options

### Migrate Specific Tables Only

Edit `scripts/migrate-to-supabase.ts` and comment out tables you don't want to migrate:

```typescript
// Comment out unwanted migrations
// stats.push(await migrateTable('expenses', ...))
```

### Handle Large Datasets

For databases with millions of records, modify batch size:

```typescript
// In migrateTable function, add batch processing:
const BATCH_SIZE = 1000
for (let i = 0; i < sourceData.length; i += BATCH_SIZE) {
  const batch = sourceData.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(record => insertData(record)))
}
```

### Resume Failed Migration

If migration fails midway, you can:

1. Check which tables were migrated in the console output
2. Comment out successfully migrated tables in the script
3. Re-run the script

### Dry Run (Validation Only)

To test without migrating:

```typescript
// In migrate-to-supabase.ts, replace insertData calls with:
console.log('Would insert:', data.id)
return Promise.resolve()
```

## 🔧 Troubleshooting

### Connection Errors

**Error:** `Can't reach database server`

**Solution:**
- Check if Supabase project is active
- Verify connection string is correct
- Check firewall settings

### Unique Constraint Violations

**Error:** `Unique constraint failed on the fields: (id)`

**Solution:**
- Data already exists in target database
- Script automatically skips duplicates
- Or clean target database first:

```sql
-- WARNING: This deletes all data!
TRUNCATE TABLE businesses CASCADE;
```

### Memory Issues

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/migrate-to-supabase.ts
```

### Slow Migration

**Tips:**
- Disable RLS during migration
- Use direct database connection (not pooler)
- Migrate during off-peak hours
- Use batch processing for large tables

## 🔒 Security Considerations

### Before Migration

1. **Disable Row Level Security (RLS)** temporarily:

```sql
-- In Supabase SQL Editor
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- ... for all tables
```

2. **Use Direct Connection** (not pooler):
```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### After Migration

1. **Enable RLS** on all tables:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

2. **Create RLS Policies**:

```sql
-- Example: Users can only see their own business data
CREATE POLICY "Users can view own business"
ON products FOR SELECT
USING (business_id IN (
  SELECT business_id FROM users WHERE id = auth.uid()
));
```

3. **Verify Permissions**:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

## 📈 Performance Optimization

### For Supabase Free Tier

- Limit: 500 MB storage
- Bandwidth: 2 GB/month
- Consider upgrading to Pro for production

### Connection Pooling

Use Supabase pooler for application connections:

```env
# Application connection (pooled)
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (migrations, admin tasks)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

### Indexing

After migration, verify indexes exist:

```sql
-- Check indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 📝 Post-Migration Checklist

- [ ] All table counts match between source and target
- [ ] Test login with existing user credentials
- [ ] Verify business data loads correctly
- [ ] Check product inventory matches
- [ ] Test expense creation
- [ ] Validate all reports generate correctly
- [ ] Enable RLS policies
- [ ] Update production environment variables
- [ ] Monitor Supabase dashboard for errors
- [ ] Set up automated backups in Supabase

## 🆘 Rollback Plan

If something goes wrong:

### Option 1: Restore Supabase from Backup

```bash
# Restore from backup file
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" < backup_20250101.sql
```

### Option 2: Recreate Supabase Project

1. Delete current Supabase project
2. Create new project
3. Re-run migration script

### Option 3: Keep Using Local Database

```env
# Revert .env to local database
DATABASE_URL="postgresql://localhost:5432/ultimatepos_modern"
```

## 📞 Support

If you encounter issues:

1. Check Supabase logs: **Database → Logs**
2. Review migration statistics output
3. Verify schema matches with `npx prisma db pull`
4. Check GitHub issues: https://github.com/supabase/supabase/issues

## 🎯 Best Practices

1. **Always backup** before migrating
2. **Test on staging** environment first
3. **Migrate during low traffic** periods
4. **Monitor database size** on Supabase dashboard
5. **Use connection pooling** for application
6. **Enable RLS** after migration
7. **Set up automated backups** in Supabase
8. **Keep local backup** for at least 30 days

---

**Migration Estimated Time:**
- Small database (< 1000 records): 2-5 minutes
- Medium database (1000-10000 records): 5-15 minutes
- Large database (10000+ records): 15-60 minutes
