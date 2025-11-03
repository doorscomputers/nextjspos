# Step-by-Step Migration Guide: Local PostgreSQL to Supabase

## ✅ What You've Already Done

1. ✅ Created Supabase project
2. ✅ Got connection strings
3. ✅ Deployed schema to Supabase (`npx prisma db push`)

## 📋 Next Steps: Migrate Your Actual Data

### Step 1: Verify Your `.env.migration` File

Make sure this file exists with correct values:

```env
SOURCE_DATABASE_URL=postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern
TARGET_DATABASE_URL=postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### Step 2: Migrate Parent Tables First

Open PowerShell in your project folder and run:

```powershell
$env:SOURCE_DATABASE_URL="postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern"
$env:TARGET_DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
npm run migrate:parent
```

**What this does:**
- Migrates 6 parent tables in order:
  1. Currency
  2. Business
  3. BusinessLocation
  4. Permission
  5. Role
  6. User

**Expected result:**
```
✅ Currency: 3/3 records
✅ Business: 1/1 records
✅ BusinessLocation: 2/2 records
✅ Permission: 50/50 records
✅ Role: 4/4 records
✅ User: 5/5 records

🎉 All parent tables migrated successfully!
```

**If you see errors:** STOP and tell me which table failed. Don't proceed to Step 3.

### Step 3: Migrate Child Tables

If Step 2 was successful (all ✅), run:

```powershell
$env:SOURCE_DATABASE_URL="postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern"
$env:TARGET_DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
npm run migrate:child
```

**What this does:**
- Migrates junction tables (UserRole, RolePermission, UserPermission)
- Migrates master data (Category, Brand, Unit, Tax)
- Migrates contacts (Supplier, Customer)
- Migrates products and variations
- Migrates accounting (ChartOfAccounts, ExpenseCategory, Expense)

**Expected result:**
```
✅ UserRole: X/X records
✅ RolePermission: X/X records
✅ UserPermission: X/X records
... (and so on)

🎉 All child tables migrated successfully!
```

### Step 4: Verify Your Data

After both migrations succeed, verify by opening Supabase Table Editor:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to "Table Editor"
4. Check tables: Business, BusinessLocation, User, Role, Product

## 🚀 Deploy to Vercel

Once your data is in Supabase:

### Step 1: Update Your `.env` File Locally

Create/update `.env` file with your Supabase connection:

```env
DATABASE_URL=postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

OPENAI_API_KEY=your-openai-key-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
NEXT_PUBLIC_APP_NAME=Igoro Tech(IT) Inventory Management System
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Test locally first:
```powershell
npm run dev
```

Visit http://localhost:3000 and login with your actual user account.

### Step 2: Deploy to Vercel

1. **Install Vercel CLI** (if not already):
   ```powershell
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```powershell
   vercel login
   ```

3. **Deploy**:
   ```powershell
   vercel
   ```

4. **When prompted**:
   - Set up and deploy? → Yes
   - Which scope? → Choose your account
   - Link to existing project? → No
   - Project name? → ultimatepos-modern (or your choice)
   - In which directory is your code? → ./ (just press Enter)
   - Want to modify settings? → No

5. **Set Environment Variables** in Vercel Dashboard:
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add these variables:

   ```
   DATABASE_URL = postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
   OPENAI_API_KEY = your-openai-key
   NEXTAUTH_SECRET = your-secret-here
   NEXTAUTH_URL = https://your-app.vercel.app
   NEXT_PUBLIC_APP_NAME = Igoro Tech(IT) Inventory Management System
   NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
   ```

6. **Redeploy**:
   ```powershell
   vercel --prod
   ```

## 🔑 Super Admin Access

**Yes, you will have super admin access!**

Your migrated User account will have:
- Same username
- Same password
- Same roles and permissions
- Same business ownership

Just login with your existing credentials at your Vercel URL.

## ⚠️ Troubleshooting

### If Parent Table Migration Fails:
1. Check the error message
2. Note which table failed
3. Tell me which table and the error

### If Child Table Migration Fails:
1. Check if it's a foreign key error
2. Make sure parent tables migrated successfully
3. Tell me the error

### If Login Doesn't Work After Deployment:
1. Check Vercel logs: `vercel logs`
2. Verify DATABASE_URL is set in Vercel dashboard
3. Verify NEXTAUTH_SECRET is set
4. Make sure NEXTAUTH_URL matches your Vercel domain

## 🎯 Quick Command Reference

```powershell
# Set environment variables (run before each migrate command)
$env:SOURCE_DATABASE_URL="postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern"
$env:TARGET_DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Migrate parent tables
npm run migrate:parent

# Migrate child tables
npm run migrate:child

# Deploy to Vercel
vercel --prod
```
