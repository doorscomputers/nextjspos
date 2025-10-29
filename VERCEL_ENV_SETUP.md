# Vercel Environment Variables Setup Guide

## ✅ Your Generated NEXTAUTH_SECRET

```
T9dmEqtofzClYPr/pXY/NdhXPBzrFuWiR9TVjYYpr8U=
```

**IMPORTANT:** Keep this secret safe! You'll paste this into Vercel.

---

## 📋 Step-by-Step Environment Variables Setup

### Step 1: Create Supabase Database (5 minutes)

**Do this first if you haven't already:**

1. Go to: **https://supabase.com**
2. Click "Start your project" (FREE - no credit card)
3. Sign up or login with GitHub
4. Click "New Project"
5. Fill in:
   - **Name:** `ultimatepos-test`
   - **Database Password:** Create a strong password and **SAVE IT!**
   - **Region:** Choose closest to you (e.g., Southeast Asia, US West, etc.)
   - **Pricing Plan:** Free (default)
6. Click "Create new project"
7. **Wait 2-3 minutes** for database to provision

---

### Step 2: Get Your Database Connection Strings

**Once your Supabase project is ready:**

1. Click the **"Connect"** button (top right, green button)
2. Click **"Connection String"** tab
3. Select **"Session pooler"**
4. You'll see a connection string like this:

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres

```

5. **Copy this string** and replace `[YOUR-PASSWORD]` with the password you created in Step 1

**Example:**

```
postgresql://postgres.abcdefghijklmnop:MyStr0ng!Pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**Add the pgbouncer parameter:**

```
postgresql://postgres.abcdefghijklmnop:MyStr0ng!Pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**SAVE THIS!** You'll need it for Vercel.

---

### Step 3: Push Database Schema to Supabase

**Before deploying to Vercel, set up your database schema:**

1. Open your terminal
2. Run these commands:

```bash
# Set the DATABASE_URL (use the connection string from Step 2, but change port to 5432)
$env:DATABASE_URL="postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Push the schema
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed with demo data
npm run db:seed
```

**Expected output:**

```
✔ Datasource "db": PostgreSQL database
✔ Your database is now in sync with your Prisma schema
✔ Generated Prisma Client
✔ Seeded database with demo data
```

---

## 🔐 All Environment Variables for Vercel

**Copy these and fill in YOUR values:**

### Required Variables (Must Have):

```env
# Database Connection (IMPORTANT: Use port 6543 with pgbouncer=true)
DATABASE_URL=postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Authentication Secret (from Step 1 above)
NEXTAUTH_SECRET=T9dmEqtofzClYPr/pXY/NdhXPBzrFuWiR9TVjYYpr8U=

# Your Vercel Deployment URL (you'll know this after creating project)
NEXTAUTH_URL=https://your-project-name.vercel.app
```

### Optional Variables (Recommended):

```env
# App Information
NEXT_PUBLIC_APP_NAME=UltimatePOS Modern
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app

# OpenAI API Key (Optional - only if you want AI Assistant to work)
OPENAI_API_KEY=sk-proj-your-key-here-if-you-have-one
```

---

## 📝 Template with YOUR Values

**Fill this out and keep it handy:**

```env
# === REQUIRED ===

DATABASE_URL=postgresql://postgres.________________:________________@aws-0-________.pooler.supabase.com:6543/postgres?pgbouncer=true

NEXTAUTH_SECRET=T9dmEqtofzClYPr/pXY/NdhXPBzrFuWiR9TVjYYpr8U=

NEXTAUTH_URL=https://________________.vercel.app


# === OPTIONAL (can add later) ===

NEXT_PUBLIC_APP_NAME=UltimatePOS Modern

NEXT_PUBLIC_APP_URL=https://________________.vercel.app

# OPENAI_API_KEY=sk-proj-________________ (skip for now if you don't have)
```

---

## 🚀 How to Add These to Vercel

**During deployment:**

1. Go to: **https://vercel.com/new**
2. Import your GitHub repository: `doorscomputers/nextjspos`
3. Before clicking "Deploy", scroll to **"Environment Variables"** section
4. Click **"Add"** for each variable:

**Add one by one:**

| Name                   | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | Your Supabase connection string (port 6543 + pgbouncer=true) |
| `NEXTAUTH_SECRET`      | `T9dmEqtofzClYPr/pXY/NdhXPBzrFuWiR9TVjYYpr8U=`               |
| `NEXTAUTH_URL`         | `https://your-project-name.vercel.app`                       |
| `NEXT_PUBLIC_APP_NAME` | `UltimatePOS Modern`                                         |
| `NEXT_PUBLIC_APP_URL`  | `https://your-project-name.vercel.app`                       |

**IMPORTANT NOTES:**

- ✅ For `NEXTAUTH_URL`, use YOUR actual Vercel project URL (you'll see it in the project name field)
- ✅ Make sure `DATABASE_URL` has `?pgbouncer=true` at the end
- ✅ Make sure `DATABASE_URL` uses port **6543** (pooled connection)
- ✅ No trailing slashes on URLs

5. Click **"Deploy"**

---

## ⚠️ Common Mistakes to Avoid

### ❌ Wrong Database Port

```env
# WRONG - Port 5432 without pooling
DATABASE_URL=postgresql://...@host:5432/postgres

# CORRECT - Port 6543 with pgbouncer=true
DATABASE_URL=postgresql://...@host:6543/postgres?pgbouncer=true
```

### ❌ Trailing Slash in URLs

```env
# WRONG - Has trailing slash
NEXTAUTH_URL=https://myapp.vercel.app/

# CORRECT - No trailing slash
NEXTAUTH_URL=https://myapp.vercel.app
```

### ❌ Missing pgbouncer Parameter

```env
# WRONG - Missing connection pooling
DATABASE_URL=postgresql://...@host:6543/postgres

# CORRECT - Has pgbouncer=true
DATABASE_URL=postgresql://...@host:6543/postgres?pgbouncer=true
```

---

## 🔍 How to Get Your Vercel Project URL

**Before deploying, you choose the project name:**

When you import from GitHub, Vercel shows:

```
Project Name: [your-project-name]
```

Your URL will be:

```
https://[your-project-name].vercel.app
```

**Example:**

- Project Name: `ultimatepos-test`
- Your URL: `https://ultimatepos-test.vercel.app`

Use this URL for `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`

---

## 📋 Pre-Deployment Checklist

Before clicking "Deploy" in Vercel, verify:

- [ ] ✅ Supabase project created and ready
- [ ] ✅ Database password saved
- [ ] ✅ Connection string copied (port 6543 + pgbouncer=true)
- [ ] ✅ Ran `npx prisma db push` successfully
- [ ] ✅ Ran `npm run db:seed` successfully
- [ ] ✅ NEXTAUTH_SECRET generated (see top of this file)
- [ ] ✅ All environment variables prepared
- [ ] ✅ Project name chosen for Vercel
- [ ] ✅ URLs updated with correct project name
- [ ] ✅ Ready to paste variables into Vercel!

---

## 🎯 Quick Copy-Paste Format for Vercel

**When you're in Vercel adding environment variables, use this format:**

```
Name: DATABASE_URL
Value: postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

Name: NEXTAUTH_SECRET
Value: T9dmEqtofzClYPr/pXY/NdhXPBzrFuWiR9TVjYYpr8U=

Name: NEXTAUTH_URL
Value: https://your-project-name.vercel.app

Name: NEXT_PUBLIC_APP_NAME
Value: UltimatePOS Modern

Name: NEXT_PUBLIC_APP_URL
Value: https://your-project-name.vercel.app
```

---

## 🆘 Need Help?

### If Supabase Connection String Looks Different:

**Your string should look like this:**

```
postgresql://postgres.abcdefghijklmnop:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**Parts:**

- `postgres.abcdefghijklmnop` - Your project reference
- `YourPassword` - The password you created
- `aws-0-ap-southeast-1` - Your region
- `6543` - Pooled connection port (IMPORTANT!)
- `/postgres` - Database name

**Then add:**

```
?pgbouncer=true
```

**Final:**

```
postgresql://postgres.abcdefghijklmnop:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## ✅ You're Ready!

Once you have:

- ✅ Supabase database created
- ✅ Connection string ready
- ✅ Database schema pushed
- ✅ Demo data seeded
- ✅ All environment variables prepared

**Next step:** Go to https://vercel.com/new and deploy! 🚀

---

## 📞 Troubleshooting

### "Cannot connect to database"

- Check DATABASE_URL has correct password
- Verify port is 6543 (not 5432)
- Ensure `?pgbouncer=true` is at the end

### "Invalid credentials" when logging in

- Check NEXTAUTH_URL matches your deployment URL exactly
- Verify NEXTAUTH_SECRET is set
- No trailing slash on NEXTAUTH_URL

### Build fails on Vercel

- Check Vercel logs (Deployments → Your deployment → Logs)
- Verify all required env vars are set
- Check if Prisma generated correctly

---

**Good luck with your deployment!** 🎉
