# Deployment Quick Reference Card

One-page reference for production deployment. For detailed guide, see `PRODUCTION_DEPLOYMENT_GUIDE.md`.

---

## Pre-Deployment

### 1. Backup Local Database
```bash
cd "C:\Program Files\PostgreSQL\15\bin"
pg_dump -U postgres -d ultimatepos_modern -F c -b -v -f "C:\xampp\htdocs\ultimatepos-modern\backup\backup.dump"
```

### 2. Export Production Data
```bash
cd C:\xampp\htdocs\ultimatepos-modern
node scripts\export-data.mjs
```

---

## Production Database Setup

### Supabase (Recommended)
1. Create account: https://supabase.com
2. New project → Save password
3. Get connection strings:
   - Direct: Port 5432 (for migrations)
   - Pooled: Port 6543 + `?pgbouncer=true` (for Vercel)

### Environment Variables Template
```env
# Direct connection (for migrations)
DATABASE_URL="postgresql://postgres.[ref]:[password]@[host]:5432/postgres"

# Pooled connection (for Vercel)
DATABASE_URL_POOLED="postgresql://postgres.[ref]:[password]@[host]:6543/postgres?pgbouncer=true"

# Auth
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="[generate with: openssl rand -base64 32]"

# OpenAI
OPENAI_API_KEY="sk-proj-your-key"

# App
NEXT_PUBLIC_APP_NAME="Igoro Tech(IT) Inventory Management System"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

---

## Database Migration

### 1. Push Schema
```bash
$env:DATABASE_URL="YOUR_DIRECT_CONNECTION_URL"
npx prisma db push
npx prisma generate
```

### 2. Import Data
```bash
node scripts\import-data.mjs backup\export-TIMESTAMP.json
```

### 3. Create Admin
```bash
node scripts\create-production-admin.mjs
```

### 4. Verify
```bash
node scripts\verify-production-data.mjs
```

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: Production deployment ready"
git push origin master
```

### 2. Import on Vercel
- Go to https://vercel.com/new
- Import GitHub repository
- Configure:
  - Framework: Next.js
  - Root Directory: ./

### 3. Environment Variables (Vercel Dashboard)

**CRITICAL:** Use POOLED connection for DATABASE_URL!

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Pooled connection (port 6543) |
| `NEXTAUTH_URL` | https://your-app.vercel.app |
| `NEXTAUTH_SECRET` | Generated secret |
| `OPENAI_API_KEY` | Your OpenAI key |
| `NEXT_PUBLIC_APP_NAME` | App name |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |

### 4. Deploy
- Click "Deploy"
- Wait 2-5 minutes
- After first deploy, update `NEXTAUTH_URL` with actual Vercel URL
- Redeploy

---

## Verification

### Test Checklist
- [ ] Login works
- [ ] Dashboard loads
- [ ] Products display correctly
- [ ] Stock levels accurate
- [ ] Can create/edit products
- [ ] Reports generate
- [ ] No console errors

---

## Common Issues

### "Too many connections"
→ Use pooled DATABASE_URL (port 6543 + pgbouncer=true)

### "Invalid credentials"
→ Check NEXTAUTH_URL matches exactly (no trailing slash)

### "Module not found"
→ Run `npm install`, commit package-lock.json, push

### "Connection timeout"
→ Whitelist Vercel IPs in database firewall

### Products missing
→ Verify DATABASE_URL points to correct database

---

## Emergency Rollback

### Revert Deployment
Vercel Dashboard → Deployments → Previous version → Promote

### Restore Database
```bash
pg_restore -U postgres -d db_name backup/backup.dump
```

### Revert Code
```bash
git revert HEAD
git push origin master
```

---

## Important Commands

```bash
# View production database
$env:DATABASE_URL="PROD_URL"
npx prisma studio

# Check database connection
psql "PROD_URL" -c "SELECT version();"

# Generate new auth secret
openssl rand -base64 32

# Verify data integrity
node scripts\verify-production-data.mjs

# Export current data
node scripts\export-data.mjs

# Import data
node scripts\import-data.mjs backup\file.json

# Create admin user
node scripts\create-production-admin.mjs
```

---

## File Locations

| File | Purpose |
|------|---------|
| `PRODUCTION_DEPLOYMENT_GUIDE.md` | Complete step-by-step guide |
| `PRODUCTION_MIGRATION_CHECKLIST.md` | Detailed checklist |
| `scripts/export-data.mjs` | Export production data |
| `scripts/import-data.mjs` | Import to production |
| `scripts/create-production-admin.mjs` | Create admin user |
| `scripts/verify-production-data.mjs` | Verify data integrity |
| `.env.production` | Production environment vars (NOT in Git) |
| `backup/` | Database backups (NOT in Git) |

---

## Security Reminders

✅ Never commit `.env*` files
✅ Use strong passwords
✅ Generate new `NEXTAUTH_SECRET` for production
✅ Use pooled connections for Vercel
✅ Enable SSL for database
✅ Whitelist IPs when possible
✅ Regular backups
✅ Test restore procedures

---

## Support Resources

- **Full Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Checklist**: `PRODUCTION_MIGRATION_CHECKLIST.md`
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Quick Help**: For detailed instructions on any step, refer to `PRODUCTION_DEPLOYMENT_GUIDE.md`
