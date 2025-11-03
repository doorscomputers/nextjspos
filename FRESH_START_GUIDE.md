# Fresh Start: Clean Supabase Database with Super Admin

This guide will help you start fresh with a clean database that has only 1 super admin user for testing login.

## 🎯 Goal

- Clear all existing data from Supabase
- Create fresh demo data with 1 super admin user
- Test login works
- Then add your real business through the UI

## 📋 Step-by-Step Instructions

### Step 1: Update Your `.env` File

Create/update your `.env` file with Supabase connection:

```env
DATABASE_URL=postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

OPENAI_API_KEY=your-openai-key-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-min-32-chars-here
NEXT_PUBLIC_APP_NAME=Igoro Tech(IT) Inventory Management System
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** Make sure your NEXTAUTH_SECRET is at least 32 characters. Generate one with:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Reset Supabase Database Schema

Open PowerShell and run:

```powershell
# This will push the schema to Supabase (recreates all tables)
$env:DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"; npx prisma db push --force-reset
```

**What this does:**
- Drops all existing tables in Supabase
- Creates fresh empty tables
- Resets everything to clean state

### Step 3: Seed with Fresh Demo Data

Run the seeding script:

```powershell
$env:DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"; npm run db:seed:supabase
```

**What this creates:**
- 1 Currency (USD)
- 1 Business (Demo Business)
- 1 Location (Main Warehouse)
- All necessary permissions
- 1 Super Admin role with all permissions
- 1 Super Admin user

**Expected output:**
```
🌱 SEEDING SUPABASE DATABASE
✅ Connected to Supabase
✅ Currency created: USD
✅ Business created: Demo Business
✅ Location created: Main Warehouse
✅ Created 25 permissions
✅ Role created: Super Admin
✅ Assigned 25 permissions to Super Admin
✅ User created: superadmin
✅ Role assigned to user

🎉 SEEDING COMPLETE!

📋 Login Credentials:
Username: superadmin
Password: password
```

### Step 4: Test Login Locally

Start your development server:

```powershell
npm run dev
```

Visit http://localhost:3000 and login with:
- **Username:** `superadmin`
- **Password:** `password`

**If login works ✅** → Continue to Step 5
**If login fails ❌** → Tell me the error

### Step 5: Deploy to Vercel

Once login works locally, deploy to Vercel:

```powershell
# Make sure you're logged in
vercel login

# Deploy to production
vercel --prod
```

### Step 6: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
DATABASE_URL
postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

OPENAI_API_KEY
your-openai-key-here

NEXTAUTH_SECRET
your-secret-min-32-chars-here

NEXTAUTH_URL
https://your-app-name.vercel.app

NEXT_PUBLIC_APP_NAME
Igoro Tech(IT) Inventory Management System

NEXT_PUBLIC_APP_URL
https://your-app-name.vercel.app
```

### Step 7: Test Login on Vercel

Visit your Vercel URL: `https://your-app-name.vercel.app`

Login with:
- **Username:** `superadmin`
- **Password:** `password`

**If login works ✅** → You're done! Continue to Step 8
**If login fails ❌** → Check Vercel logs: `vercel logs`

### Step 8: Create Your Real Business (Optional)

After login, you can:

1. **Create your real business:**
   - Go to Settings → Business Settings
   - Update business name, address, etc.

2. **Create real locations:**
   - Go to Settings → Locations
   - Add your actual store/warehouse locations

3. **Create real users:**
   - Go to Users
   - Add your staff with appropriate roles

4. **Add products:**
   - Go to Products
   - Add your actual products

## 🔧 Troubleshooting

### Login fails with "Invalid credentials"

**Check:**
1. Username is exactly: `superadmin` (lowercase, no spaces)
2. Password is exactly: `password`
3. Database has data: Check Supabase Table Editor → Users table

### Login fails with "Database connection error"

**Check:**
1. DATABASE_URL is correct in `.env` (local) and Vercel (production)
2. Password in URL is encoded: `!` = `%21`
3. Using pooler connection (port 6543, not 5432)

### Page shows 500 error

**Check Vercel logs:**
```powershell
vercel logs
```

**Common issues:**
- NEXTAUTH_SECRET not set
- DATABASE_URL not set
- NEXTAUTH_URL doesn't match actual domain

## 📝 Quick Commands Reference

```powershell
# Reset and seed Supabase (all in one)
$env:DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"; npx prisma db push --force-reset; npm run db:seed:supabase

# Test locally
npm run dev

# Deploy to production
vercel --prod

# Check Vercel logs
vercel logs
```

## ✅ Success Checklist

- [ ] `.env` file created with correct DATABASE_URL
- [ ] Schema pushed to Supabase (`npx prisma db push --force-reset`)
- [ ] Database seeded (`npm run db:seed:supabase`)
- [ ] Login works locally (http://localhost:3000)
- [ ] Deployed to Vercel (`vercel --prod`)
- [ ] Environment variables set in Vercel dashboard
- [ ] Login works on Vercel (https://your-app.vercel.app)

## 🎉 Next Steps After Success

Once you can login successfully on Vercel:

1. **Change the super admin password** (through Settings)
2. **Create your real business details** (Settings → Business)
3. **Add locations, users, and products** (through the UI)
4. **Later:** If you want to migrate your old data, we can do that selectively

---

**Need help?** Tell me:
1. Which step you're on
2. What error you see
3. Whether it's local (localhost) or production (Vercel)
