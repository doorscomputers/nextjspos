# UltimatePOS Modern - Vercel Deployment Checklist

## Pre-Deployment Checklist

### 1. Code Repository
- [x] All changes committed to Git
- [x] Code pushed to GitHub (https://github.com/doorscomputers/nextjspos.git)
- [x] .gitignore properly configured (excludes .env files)
- [x] .env.example created for documentation
- [x] package.json includes `postinstall: prisma generate` script

### 2. Database Preparation

Choose one option:

**Option A: Vercel Postgres** (Recommended - Easiest)
- [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard) > Storage
- [ ] Create new Postgres database
- [ ] Copy DATABASE_URL connection string
- [ ] Save for Step 4

**Option B: Supabase** (Free Tier Available)
- [ ] Create project at [supabase.com](https://supabase.com)
- [ ] Get connection pooling URL from Settings > Database
- [ ] Format: `postgresql://[user]:[password]@[host]:6543/postgres?pgbouncer=true`
- [ ] Save for Step 4

**Option C: Railway** (Free Tier Available)
- [ ] Create project at [railway.app](https://railway.app)
- [ ] Add PostgreSQL service
- [ ] Copy DATABASE_URL from Connect tab
- [ ] Save for Step 4

**Option D: Your Own PostgreSQL**
- [ ] Ensure database is publicly accessible or whitelist Vercel IPs
- [ ] SSL enabled recommended
- [ ] Connection string ready: `postgresql://user:pass@host:5432/dbname`

### 3. Required Secrets Generation

Generate these before deployment:

**NEXTAUTH_SECRET** (REQUIRED):
```bash
# Using Git Bash on Windows or any Unix terminal:
openssl rand -base64 32

# Or visit: https://generate-secret.vercel.app/32
```
- [ ] Generated NEXTAUTH_SECRET
- [ ] Saved securely

**OPENAI_API_KEY** (OPTIONAL - for AI Assistant):
- [ ] Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- [ ] Or skip if not using AI features

---

## Deployment Steps

### Step 4: Create Vercel Project

1. **Import Repository**:
   - [ ] Go to [vercel.com/new](https://vercel.com/new)
   - [ ] Sign in with GitHub account
   - [ ] Click "Import Git Repository"
   - [ ] Select **doorscomputers/nextjspos**
   - [ ] Click **Import**

2. **Configure Project Settings**:
   - [ ] Project Name: `ultimatepos-modern` (or your choice)
   - [ ] Framework: Next.js (should auto-detect)
   - [ ] Root Directory: `./`
   - [ ] Build Command: `npm run build`
   - [ ] Output Directory: `.next`
   - [ ] Install Command: `npm install`
   - [ ] Node Version: 20.x (auto-selected)

3. **Environment Variables** (Click "Environment Variables" section):

   **REQUIRED Variables** (Application will not work without these):
   ```env
   DATABASE_URL=<your-production-database-url>
   NEXTAUTH_SECRET=<your-generated-secret-from-step-3>
   NEXTAUTH_URL=https://your-project.vercel.app
   ```

   **OPTIONAL Variables** (Recommended):
   ```env
   OPENAI_API_KEY=sk-proj-your-key
   NEXT_PUBLIC_APP_NAME=Igoro Tech(IT) Inventory Management System
   NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
   ```

   Environment Selection:
   - [ ] Set all variables to **Production**
   - [ ] Optionally add to **Preview** and **Development**

4. **Deploy**:
   - [ ] Click **Deploy** button
   - [ ] Wait 3-5 minutes for build to complete
   - [ ] Note your deployment URL (e.g., `https://ultimatepos-modern.vercel.app`)

---

### Step 5: Database Schema Setup

After successful deployment, you need to set up your production database:

**Method 1: Using Vercel CLI** (Recommended)

```bash
# 1. Install Vercel CLI (if not already installed)
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Link your local project
cd C:\xampp\htdocs\ultimatepos-modern
vercel link

# Answer the prompts:
# - Set up and deploy? N (No)
# - Which scope? (Select your account)
# - Link to existing project? Y (Yes)
# - Project name? ultimatepos-modern (or your project name)

# 4. Pull production environment variables
vercel env pull .env.production

# 5. Push database schema to production
npx prisma db push

# 6. Seed production database with demo data
npm run db:seed
```

- [ ] Vercel CLI installed
- [ ] Logged into Vercel
- [ ] Project linked
- [ ] Environment pulled
- [ ] Schema pushed to production
- [ ] Database seeded

**Method 2: Manual Database Setup** (Alternative)

If you can't use Vercel CLI:

1. [ ] Connect to your production database using a database client (e.g., TablePlus, pgAdmin)
2. [ ] Run the SQL schema manually from Prisma schema
3. [ ] Insert seed data manually (see `prisma/seed.ts` for reference)

---

### Step 6: Verify Deployment

1. **Access Application**:
   - [ ] Visit: `https://your-project.vercel.app`
   - [ ] Page loads without errors
   - [ ] No console errors in browser DevTools

2. **Test Login**:
   - [ ] Go to `/login` page
   - [ ] Login with demo account:
     - Username: `superadmin`
     - Password: `password`
   - [ ] Successfully redirects to dashboard

3. **Test Database Connection**:
   - [ ] Dashboard loads with data
   - [ ] Can view products, sales, purchases
   - [ ] No database connection errors

4. **Check Deployment Logs**:
   - [ ] Go to Vercel Dashboard > Your Project > Deployments
   - [ ] Select latest deployment
   - [ ] Check "Function Logs" for any errors
   - [ ] No critical errors present

---

### Step 7: Update Environment Variables (If Needed)

If you need to change NEXTAUTH_URL or other settings:

1. [ ] Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. [ ] Update `NEXTAUTH_URL` to your actual domain (if using custom domain)
3. [ ] Update `NEXT_PUBLIC_APP_URL` to match
4. [ ] Click "Save"
5. [ ] Redeploy: Deployments > Latest > "..." menu > "Redeploy"

---

### Step 8: Security Hardening (IMPORTANT)

**CRITICAL: Do this immediately after first successful login!**

1. [ ] Login as `superadmin`
2. [ ] Go to Settings > Users
3. [ ] Change superadmin password to a strong, unique password
4. [ ] Create your real admin account with proper credentials
5. [ ] Disable or delete demo accounts (admin, manager, cashier)
6. [ ] Review user permissions and roles

---

### Step 9: Custom Domain Setup (Optional)

If you want to use your own domain:

1. **Add Domain in Vercel**:
   - [ ] Go to Vercel Dashboard > Your Project > Settings > Domains
   - [ ] Click "Add"
   - [ ] Enter your domain (e.g., `pos.yourdomain.com`)
   - [ ] Follow DNS configuration instructions

2. **Update Environment Variables**:
   - [ ] Update `NEXTAUTH_URL` to `https://pos.yourdomain.com`
   - [ ] Update `NEXT_PUBLIC_APP_URL` to match
   - [ ] Redeploy application

3. **Verify**:
   - [ ] Visit your custom domain
   - [ ] SSL certificate is active (HTTPS works)
   - [ ] Application loads correctly

---

### Step 10: Enable Automatic Deployments

By default, Vercel automatically deploys when you push to GitHub:

1. [ ] Verify: Settings > Git > Production Branch is `master`
2. [ ] Test: Make a small change, commit, and push
3. [ ] Check: Vercel auto-deploys the change

---

## Post-Deployment Checklist

### Monitoring and Maintenance

- [ ] Set up Vercel Analytics (Dashboard > Analytics)
- [ ] Enable Speed Insights (Dashboard > Speed Insights)
- [ ] Configure deployment notifications (Settings > Notifications)
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)

### Backups

- [ ] Set up automated database backups
  - Vercel Postgres: Automatic backups included
  - Supabase: Configure backup schedule in dashboard
  - Railway: Configure backup settings
  - Self-hosted: Set up pg_dump cron job

### Performance

- [ ] Test application speed with multiple users
- [ ] Check function execution times (Vercel Dashboard > Functions)
- [ ] Optimize slow queries if needed
- [ ] Enable caching where appropriate

### Documentation

- [ ] Document your production environment variables (securely)
- [ ] Create runbook for common operations
- [ ] Document backup and restore procedures
- [ ] Train team on using the deployed system

---

## Troubleshooting Common Issues

### Build Fails with Prisma Errors

**Symptom**: Build fails with "Cannot find module '@prisma/client'"

**Solution**:
```bash
# Ensure postinstall script exists in package.json
# Already added in recent commit
```

### Database Connection Timeouts

**Symptom**: Application loads but shows database errors

**Solution**:
1. Check DATABASE_URL is correct in Vercel environment variables
2. For Supabase, ensure using connection pooling URL (port 6543)
3. Verify database allows connections from Vercel (check IP whitelist)

### Authentication Errors

**Symptom**: Can't login or "NextAuth Error" messages

**Solution**:
1. Verify NEXTAUTH_SECRET is set
2. Verify NEXTAUTH_URL matches your deployment URL exactly
3. Check database has User and Session tables
4. Redeploy after fixing environment variables

### Build Succeeds but App Shows 500 Errors

**Symptom**: Deployment succeeds but pages show Internal Server Error

**Solution**:
1. Check Function Logs in Vercel Dashboard
2. Verify all environment variables are set
3. Ensure database schema is pushed (`npx prisma db push`)
4. Check for missing dependencies in package.json

### Environment Variables Not Loading

**Symptom**: Environment variables return undefined

**Solution**:
1. Ensure variables are set in correct environment (Production)
2. Variables with `NEXT_PUBLIC_` prefix are accessible client-side
3. Server-side variables need server-side access only
4. Redeploy after adding/changing variables

---

## Success Criteria

Your deployment is successful when:

- [x] Application accessible at Vercel URL
- [x] Login works with demo credentials
- [x] Dashboard displays without errors
- [x] Can perform basic operations (view products, sales, etc.)
- [x] No critical errors in Vercel Function Logs
- [x] Database queries execute successfully
- [x] Superadmin password changed from default
- [x] Demo accounts disabled or secured

---

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Deployment**: https://www.prisma.io/docs/guides/deployment/deployment
- **Project Repository**: https://github.com/doorscomputers/nextjspos

---

## Next Steps After Deployment

1. **Data Migration**: Import your existing inventory data
2. **User Setup**: Create actual user accounts for your team
3. **Configuration**: Set up business settings, locations, currencies
4. **Training**: Train your team on the system
5. **Testing**: Thoroughly test all workflows with real data
6. **Go Live**: Switch from demo to production mode

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Production URL**: _________________

**Database Provider**: _________________

**Notes**:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
