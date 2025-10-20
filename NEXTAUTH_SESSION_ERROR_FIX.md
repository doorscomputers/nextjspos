# NextAuth Session Error Fix

## 🐛 Problem

When clicking on Audit Trail menu (or other pages), you see these errors in console:

```
Failed to load resource: :3001/api/auth/session:1 (500 Internal Server Error)
CLIENT_FETCH_ERROR
[next-auth][error] hook.js:608
Unexpected token 'I', "Internal S"... is not valid JSON
```

---

## 🔍 Root Cause

The **NextAuth session endpoint** (`/api/auth/session`) is returning 500 errors instead of valid JSON. This typically happens when:

1. **Database connection issue** - Prisma can't connect to database
2. **Auth configuration issue** - Missing environment variables
3. **Dev server needs restart** - Hot reload caused corruption
4. **Session table issue** - Database schema mismatch

---

## ✅ Solution 1: Restart Dev Server (Quick Fix)

**Step 1: Stop the dev server**
```bash
# Press Ctrl+C in the terminal running the dev server
```

**Step 2: Clear Next.js cache (optional but recommended)**
```bash
rm -rf .next
# Or on Windows:
rmdir /s /q .next
```

**Step 3: Restart dev server**
```bash
npm run dev
```

**Step 4: Refresh browser**
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear browser cache and refresh

---

## ✅ Solution 2: Check Database Connection

**Step 1: Verify database is running**
```bash
# For XAMPP MySQL:
# 1. Open XAMPP Control Panel
# 2. Ensure MySQL is running (green status)
```

**Step 2: Test Prisma connection**
```bash
npx prisma db push
```

**Expected:** Should connect successfully
**If fails:** Database is down or connection string is wrong

---

## ✅ Solution 3: Verify Environment Variables

**Check `.env` file has:**

```env
# Database
DATABASE_URL="mysql://root:@localhost:3306/ultimatepos_modern"

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key-here"  # Must be at least 32 characters

# Optional
OPENAI_API_KEY="sk-..."  # For AI features
```

**Important:**
- `NEXTAUTH_SECRET` must exist and be at least 32 characters
- `NEXTAUTH_URL` must match your dev server URL
- `DATABASE_URL` must point to running database

**Generate new NEXTAUTH_SECRET if needed:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ Solution 4: Regenerate Prisma Client

Sometimes Prisma Client gets out of sync:

```bash
npx prisma generate
```

Then restart dev server:
```bash
npm run dev
```

---

## ✅ Solution 5: Check Session Table

The NextAuth session might be looking for wrong table structure.

**Option A: Reset sessions (safe)**
```sql
-- Connect to database
USE ultimatepos_modern;

-- Clear sessions (forces users to re-login)
TRUNCATE TABLE sessions;
```

**Option B: Verify schema**
```bash
npx prisma db push
```

This ensures database matches `schema.prisma`

---

## 🧪 Testing After Fix

**Step 1: Check session endpoint directly**

Open in browser: `http://localhost:3001/api/auth/session`

**Expected response:**
```json
{
  "user": {
    "id": "...",
    "username": "...",
    "email": "...",
    ...
  },
  "expires": "..."
}
```

**OR** (if not logged in):
```json
{}
```

**❌ Should NOT see:**
- HTML error page
- "Internal Server Error" text
- 500 status

---

**Step 2: Try logging in again**

1. Go to `http://localhost:3001/login`
2. Login with a test user (e.g., `superadmin` / `password`)
3. Should redirect to dashboard
4. Check console - should NOT have NextAuth errors

---

**Step 3: Navigate to Audit Trail**

1. Go to Reports > Audit Trail
2. Page should load without errors
3. Console should be clean

---

## 🔧 Most Common Fix (90% of cases)

**Just restart the dev server:**

1. Stop dev server (Ctrl+C)
2. Delete `.next` folder
3. Run `npm run dev`
4. Hard refresh browser (Ctrl+Shift+R)

**This fixes most NextAuth session errors!**

---

## 🚨 If Still Not Working

**Check server terminal output for errors:**

Look for:
- ❌ Prisma connection errors
- ❌ Database schema errors
- ❌ Missing environment variable warnings
- ❌ Port conflicts

**Common errors and fixes:**

### Error: "Can't reach database server"
**Fix:** Start MySQL in XAMPP

### Error: "Invalid `prisma.session.findMany()` invocation"
**Fix:** Run `npx prisma db push`

### Error: "NEXTAUTH_SECRET is not set"
**Fix:** Add `NEXTAUTH_SECRET` to `.env` file

### Error: "Port 3001 is already in use"
**Fix:** Kill process using port or change port:
```bash
# Kill process on port 3001 (Windows)
taskkill /F /IM node.exe

# Or change port in package.json
"dev": "next dev -p 3002"
```

---

## 📋 Prevention

**To avoid this issue in the future:**

1. ✅ Always keep XAMPP MySQL running when dev server is running
2. ✅ Don't edit `.env` while dev server is running (restart after changes)
3. ✅ Use `npm run dev` instead of custom scripts
4. ✅ Clear `.next` folder if you see weird errors
5. ✅ Keep `NEXTAUTH_SECRET` in `.env` (never delete it)

---

## 🎯 Quick Troubleshooting Checklist

Before asking for help, check:

- [ ] Is MySQL running in XAMPP?
- [ ] Does `.env` file exist with all variables?
- [ ] Did you restart dev server after `.env` changes?
- [ ] Is port 3001 free (no other app using it)?
- [ ] Did you run `npx prisma generate` after schema changes?
- [ ] Did you try clearing `.next` folder?
- [ ] Did you try hard refresh in browser?

**If all checked and still broken:** Provide terminal output and console errors for further diagnosis.

---

**Created:** October 19, 2025
**Issue:** NextAuth SESSION API returning 500 errors
**Quick Fix:** Restart dev server + hard refresh browser
**Status:** Common development issue, easy to fix
