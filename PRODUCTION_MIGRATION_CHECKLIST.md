# Production Database Migration Checklist

Follow this checklist in order to safely migrate your local database to production.

## Phase 1: Pre-Migration (Local Environment)

- [ ] **Backup local database**
  ```bash
  cd "C:\Program Files\PostgreSQL\15\bin"
  pg_dump -U postgres -d ultimatepos_modern -F c -b -v -f "C:\xampp\htdocs\ultimatepos-modern\backup\full_backup_$(date +%Y%m%d).dump"
  ```

- [ ] **Export data using Prisma script**
  ```bash
  cd C:\xampp\htdocs\ultimatepos-modern
  node scripts/export-data.mjs
  ```

- [ ] **Verify export file was created**
  - Check `C:\xampp\htdocs\ultimatepos-modern\backup\` folder
  - Verify JSON file contains data (should be several MB)
  - Open in text editor and spot-check products, users, etc.

- [ ] **Document current database state**
  - Count products: `SELECT COUNT(*) FROM "Product";`
  - Count variations: `SELECT COUNT(*) FROM "ProductVariation";`
  - Count stock records: `SELECT COUNT(*) FROM "Stock";`
  - Count users: `SELECT COUNT(*) FROM "User";`

## Phase 2: Production Database Setup

- [ ] **Choose database provider** (Supabase/Vercel/Railway)

- [ ] **Create production database project**
  - Project name: `ultimatepos-production`
  - Region: Select closest to your users
  - Note the connection strings

- [ ] **Save connection strings securely**
  - [ ] Direct connection URL (for migrations)
  - [ ] Pooled connection URL (for Vercel deployment)
  - [ ] Store in password manager or .env.production (DO NOT COMMIT)

- [ ] **Test connection to production database**
  ```bash
  $env:DATABASE_URL="YOUR_PRODUCTION_URL"
  npx prisma db execute --stdin < test.sql
  # Or use: psql YOUR_PRODUCTION_URL -c "SELECT version();"
  ```

## Phase 3: Schema Migration

- [ ] **Set production DATABASE_URL**
  ```bash
  $env:DATABASE_URL="YOUR_PRODUCTION_DIRECT_CONNECTION_URL"
  ```

- [ ] **Push Prisma schema to production**
  ```bash
  npx prisma db push
  ```
  Expected output: "Your database is now in sync with your Prisma schema"

- [ ] **Generate Prisma Client**
  ```bash
  npx prisma generate
  ```

- [ ] **Verify schema in production**
  ```bash
  npx prisma studio
  ```
  - Should show empty tables but correct structure
  - Check key tables: Product, ProductVariation, Stock, User

## Phase 4: Data Import

- [ ] **Run import script**
  ```bash
  cd C:\xampp\htdocs\ultimatepos-modern
  $env:DATABASE_URL="YOUR_PRODUCTION_DIRECT_CONNECTION_URL"
  node scripts/import-data.mjs backup\export-TIMESTAMP.json
  ```

- [ ] **Monitor import progress**
  - Watch for "✓ Imported X records" messages
  - Note any errors or warnings
  - Should complete in 1-5 minutes depending on data size

- [ ] **Verify data import**
  ```bash
  npx prisma studio
  ```
  - Check product counts match local
  - Verify variations are linked correctly
  - Check stock levels are accurate
  - Confirm business and location data

## Phase 5: Production User Setup

Since demo accounts are excluded, you need to create a production admin:

- [ ] **Create production admin script**
  ```bash
  node scripts/create-production-admin.mjs
  ```

- [ ] **Or manually via Prisma Studio**
  - Open Prisma Studio connected to production
  - Create new User with:
    - username: your_choice
    - password: (hashed with bcrypt)
    - businessId: your business ID
  - Assign Super Admin role

- [ ] **Test production login credentials**
  - Try logging in locally with production DATABASE_URL
  - Verify permissions work correctly
  - Check dashboard loads with proper data

## Phase 6: Environment Variables for Vercel

- [ ] **Generate new NEXTAUTH_SECRET for production**
  ```bash
  openssl rand -base64 32
  ```

- [ ] **Prepare Vercel environment variables**
  Copy these to Vercel Dashboard → Project → Settings → Environment Variables:

  ```env
  # Database (use POOLED connection for Vercel)
  DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true

  # NextAuth (MUST be production URL)
  NEXTAUTH_URL=https://your-app.vercel.app
  NEXTAUTH_SECRET=YOUR_NEW_SECRET_FROM_OPENSSL

  # OpenAI (if using AI features)
  OPENAI_API_KEY=sk-proj-your-key

  # App Config
  NEXT_PUBLIC_APP_NAME=Igoro Tech(IT) Inventory Management System
  NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
  ```

- [ ] **Set environment for each scope**
  - Production: Yes
  - Preview: Yes (optional)
  - Development: No

## Phase 7: Data Verification

Run these checks in production database:

- [ ] **Product counts match**
  ```sql
  SELECT COUNT(*) as total_products FROM "Product";
  SELECT COUNT(*) as total_variations FROM "ProductVariation";
  ```

- [ ] **Inventory totals are correct**
  ```sql
  SELECT
    COUNT(*) as total_stock_records,
    SUM(quantity) as total_units
  FROM "Stock";
  ```

- [ ] **All products have variations**
  ```sql
  SELECT p.name, p.sku
  FROM "Product" p
  LEFT JOIN "ProductVariation" pv ON p.id = pv."productId"
  WHERE pv.id IS NULL;
  ```
  Should return 0 rows (all products should have variations)

- [ ] **Stock references valid variations**
  ```sql
  SELECT s.id
  FROM "Stock" s
  LEFT JOIN "ProductVariation" pv ON s."productVariationId" = pv.id
  WHERE pv.id IS NULL;
  ```
  Should return 0 rows (all stock should reference valid variations)

- [ ] **Business relationships intact**
  ```sql
  SELECT
    b.name as business_name,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT u.id) as user_count
  FROM "Business" b
  LEFT JOIN "Product" p ON b.id = p."businessId"
  LEFT JOIN "User" u ON b.id = u."businessId"
  GROUP BY b.id, b.name;
  ```

## Phase 8: Security Checklist

- [ ] **Verify .gitignore excludes sensitive files**
  - .env
  - .env.production
  - .env.local
  - backup/*.dump
  - backup/*.json

- [ ] **Remove or secure export files**
  - Don't commit JSON exports to Git
  - Store backups in secure location
  - Consider encrypting sensitive backups

- [ ] **Verify production admin credentials are strong**
  - Password is NOT "password" or "admin"
  - Use password manager
  - Enable 2FA if available

- [ ] **Audit user access**
  - Remove test/demo accounts from production
  - Verify only real users have access
  - Check role assignments are correct

- [ ] **Database security settings**
  - Ensure database has firewall rules (allow only Vercel IPs)
  - Use SSL for database connections
  - Rotate database password periodically

## Phase 9: Vercel Deployment

- [ ] **Commit final code to Git**
  ```bash
  git add .
  git commit -m "feat: Prepare for production deployment"
  git push origin master
  ```

- [ ] **Link Vercel to GitHub repository**
  - Go to https://vercel.com/new
  - Import Git Repository
  - Select your GitHub repo

- [ ] **Configure build settings**
  - Framework Preset: Next.js
  - Root Directory: ./
  - Build Command: `npm run build` (or leave default)
  - Output Directory: `.next` (default)
  - Install Command: `npm install` (or leave default)

- [ ] **Add environment variables in Vercel**
  - Copy all variables from Phase 6
  - Double-check DATABASE_URL uses pooled connection
  - Verify NEXTAUTH_URL matches your Vercel domain

- [ ] **Deploy**
  - Click "Deploy"
  - Wait for build (2-5 minutes)
  - Monitor build logs for errors

## Phase 10: Post-Deployment Verification

- [ ] **Test production deployment**
  - Visit your Vercel URL
  - Test login with production admin
  - Check dashboard loads
  - Verify products display correctly
  - Test creating/editing a product
  - Check inventory shows correct stock levels

- [ ] **Test key workflows**
  - [ ] User login/logout
  - [ ] Product listing and search
  - [ ] Product detail view
  - [ ] Stock movements
  - [ ] Purchase orders (if applicable)
  - [ ] Reports generation
  - [ ] Multi-location stock (if applicable)

- [ ] **Check database connections**
  - Monitor Vercel logs for database errors
  - Check connection pool usage in database provider
  - Verify no timeout errors

- [ ] **Performance check**
  - Test page load times
  - Check for slow queries in database logs
  - Verify images and assets load correctly

## Phase 11: Monitoring & Maintenance

- [ ] **Set up monitoring**
  - Vercel Analytics (if available)
  - Database connection monitoring
  - Error tracking (Sentry, etc.)

- [ ] **Document production setup**
  - Save connection strings securely
  - Document admin credentials
  - Note any custom configurations

- [ ] **Plan backup strategy**
  - Schedule regular database backups
  - Test restore procedure
  - Document recovery process

- [ ] **Prepare rollback plan**
  - Keep local database backup
  - Document how to revert deployment
  - Know how to switch DATABASE_URL back

## Emergency Contacts & Resources

- **Supabase Support**: https://supabase.com/support
- **Vercel Support**: https://vercel.com/support
- **Railway Support**: https://railway.app/help
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment

## Common Issues & Solutions

### Issue: "Prepared statement already exists"
**Solution**: Use pooled connection (pgbouncer=true) in DATABASE_URL for Vercel

### Issue: "Cannot read properties of null (reading 'id')"
**Solution**: Check that all foreign key relationships are correct in imported data

### Issue: Build fails with "Module not found"
**Solution**: Run `npm install` locally, commit package-lock.json, and redeploy

### Issue: Database connection timeout
**Solution**: Verify Vercel IPs are whitelisted in database firewall settings

### Issue: Wrong data showing in production
**Solution**: Verify DATABASE_URL in Vercel points to correct database, not local

---

## Success Criteria

✅ All products from local database appear in production
✅ Stock levels match exactly
✅ Can login with production admin credentials
✅ All dashboard pages load without errors
✅ Database queries complete in < 1 second
✅ No CORS or authentication errors
✅ Multi-tenant isolation works (if testing with multiple businesses)
✅ Vercel deployment status shows "Ready"

---

**Last Updated**: $(date)
**Migration Completed By**: ___________
**Production Database Provider**: ___________
**Production URL**: ___________
