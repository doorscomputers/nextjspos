# Production Login Fix Guide - 405 Error Resolution

## Issue Summary

**Problem:** Login fails on production (https://nextjspos-six.vercel.app) with 405 Method Not Allowed errors
**Affected Routes:** `/api/auth/session`, `/api/auth/providers`
**Root Cause:** NextAuth API routes returning HTML instead of JSON
**Impact:** 100% of users cannot login

---

## Diagnostic Information

### Error Messages Captured:
```
[next-auth][error][CLIENT_FETCH_ERROR]
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
{error: Object, url: /api/auth/session, message: Unexpected token '<', "<!DOCTYPE "... is not valid JSON}

Failed to load resource: the server responded with a status of 405 ()
```

### Current Code Status:
✅ **Route file exists and is correct:**
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth.simple"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }  // ✓ Correct for App Router
```

✅ **Auth configuration exists:**
- File: `src/lib/auth.simple.ts`
- Has proper providers, callbacks, and session config
- Uses JWT strategy
- Cookie configuration present

---

## Most Likely Causes

### 1. Missing or Incorrect NEXTAUTH_URL Environment Variable (MOST LIKELY)
The 405 error often occurs when `NEXTAUTH_URL` is not set correctly in production.

**Check:**
```bash
# In Vercel dashboard > Settings > Environment Variables
NEXTAUTH_URL = https://nextjspos-six.vercel.app
```

**CRITICAL:** Must NOT have trailing slash!
- ✅ Correct: `https://nextjspos-six.vercel.app`
- ❌ Wrong: `https://nextjspos-six.vercel.app/`

### 2. Missing NEXTAUTH_SECRET
NextAuth requires a secret for JWT signing.

**Check:**
```bash
# In Vercel dashboard > Settings > Environment Variables
NEXTAUTH_SECRET = <random-32-character-string>
```

Generate a new secret:
```bash
openssl rand -base64 32
```

### 3. Next.js 14 Build Configuration
The downgrade to Next.js 14 may have changed the build output.

**Check `next.config.js`:**
```javascript
// Ensure experimental features are not breaking API routes
module.exports = {
  // DO NOT USE: experimental: { appDir: true }
  // (This is default in Next.js 13+)
}
```

### 4. Vercel Build Command
API routes may not be building correctly.

**Check Vercel Project Settings:**
- Build Command: `npm run build` or `next build`
- Output Directory: `.next` (default)
- Install Command: `npm install`

---

## Step-by-Step Fix

### Step 1: Verify Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project `nextjspos-six`
3. Go to **Settings** → **Environment Variables**
4. Verify these exist for **Production**:

```bash
NEXTAUTH_URL=https://nextjspos-six.vercel.app
NEXTAUTH_SECRET=<your-secret-here>
DATABASE_URL=<your-database-url>
```

5. If missing or wrong, add/update them
6. **IMPORTANT:** Check for typos - `NEXTAUTH_URL` NOT `NEXT_AUTH_URL`

### Step 2: Trigger a New Deployment

After updating environment variables:
```bash
# Option A: Via Vercel CLI
vercel --prod

# Option B: Via Dashboard
# Go to Deployments tab, click "..." on latest deployment, select "Redeploy"

# Option C: Push a dummy commit
git commit --allow-empty -m "Trigger redeploy to apply env vars"
git push
```

### Step 3: Check Build Logs

1. Go to Vercel Dashboard → Deployments → Latest deployment
2. Click "Building" logs
3. Look for:
   - ✅ "Compiled successfully"
   - ✅ API routes being detected
   - ❌ Any warnings about `[...nextauth]`
   - ❌ Any errors about missing environment variables

### Step 4: Test API Routes Directly

```bash
# Test if API route responds
curl -X GET https://nextjspos-six.vercel.app/api/auth/providers

# Should return JSON like:
# {"credentials":{"id":"credentials","name":"credentials","type":"credentials"}}

# NOT HTML like:
# <!DOCTYPE html>...
```

### Step 5: Rerun the Test

```bash
npx playwright test e2e/production-login.spec.ts --headed
```

---

## Alternative Causes & Fixes

### If ENV vars are correct but still 405:

#### Issue A: Next.js 14 Incompatibility with NextAuth v4

**Check package.json versions:**
```json
{
  "next": "^14.x.x",
  "next-auth": "^4.x.x"
}
```

**NextAuth v4 officially supports:**
- Next.js 12.2+ ✅
- Next.js 13.x ✅
- Next.js 14.x ⚠️ (partial support, may have issues)

**Solution Options:**

1. **Option A: Upgrade to Next.js 15** (recommended)
   ```bash
   npm install next@latest react@latest react-dom@latest
   ```

2. **Option B: Use NextAuth v5 (Auth.js)** with Next.js 14
   ```bash
   npm install next-auth@beta
   # Then update auth configuration for v5 syntax
   ```

3. **Option C: Stay on Next.js 13** (if 14 is not required)
   ```bash
   npm install next@13
   ```

#### Issue B: Vercel Edge Runtime Conflict

Some Vercel deployments force Edge Runtime, which NextAuth v4 doesn't fully support.

**Fix: Add runtime configuration to route:**
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth.simple"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

// ADD THIS:
export const runtime = 'nodejs'  // Force Node.js runtime, not Edge
```

#### Issue C: Middleware Blocking API Routes

**Check `middleware.ts`:**
```typescript
// Ensure /api/auth/* is excluded from middleware
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ]
}
```

---

## Verification Steps After Fix

### 1. Check Browser Console
Login page should NOT show:
```
❌ [next-auth][error][CLIENT_FETCH_ERROR]
```

### 2. Check Network Tab
- `/api/auth/session` → **200 OK** (JSON response)
- `/api/auth/providers` → **200 OK** (JSON response)
- `/api/auth/callback/credentials` → **200 OK** (after login)

### 3. Check Cookies
After successful login:
- Cookie name: `next-auth.session-token` (HTTP) or `__Secure-next-auth.session-token` (HTTPS)
- Should be set with `HttpOnly`, `SameSite=lax`

### 4. Test Login
- Fill username: `superadmin`
- Fill password: `password`
- Click LOGIN
- Should redirect to `/dashboard` within 2 seconds

---

## Quick Diagnostic Commands

```bash
# 1. Test if API routes exist
curl -I https://nextjspos-six.vercel.app/api/auth/providers

# Expected: HTTP/1.1 200 OK
# Content-Type: application/json

# Actual (broken): HTTP/1.1 405 Method Not Allowed
# Content-Type: text/html


# 2. Check NEXTAUTH_URL is set correctly
curl -v https://nextjspos-six.vercel.app/api/auth/csrf

# Should return JSON with csrfToken
# If returns HTML, NEXTAUTH_URL is wrong or missing


# 3. Test POST to callback
curl -X POST https://nextjspos-six.vercel.app/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Should return JSON (even if credentials wrong)
# If returns HTML 405, route is not registered
```

---

## Contact Vercel Support

If none of the above works, the issue may be Vercel-specific.

**Provide Vercel Support with:**
1. Deployment URL: https://nextjspos-six.vercel.app
2. Error message: "405 Method Not Allowed on /api/auth/session"
3. Next.js version: 14.x.x
4. NextAuth version: 4.x.x
5. Build logs (from Vercel dashboard)
6. Screenshot of environment variables (hide sensitive values)

**Ask Vercel Support:**
- "Why are my App Router API routes returning 405 instead of executing?"
- "Is there a conflict between Next.js 14 App Router and dynamic routes like `[...nextauth]`?"

---

## Expected Outcome

After applying the fix:

✅ `/api/auth/session` returns 200 with JSON
✅ No CLIENT_FETCH_ERROR messages in console
✅ Login form submits successfully
✅ User redirects to `/dashboard`
✅ Session cookie is set
✅ No 405 errors

---

## Files to Review

1. `src/app/api/auth/[...nextauth]/route.ts` - Main NextAuth handler
2. `src/lib/auth.simple.ts` - NextAuth configuration
3. `next.config.js` - Next.js build configuration
4. `middleware.ts` - Request middleware (if exists)
5. `.env.local` - Local environment variables
6. Vercel Dashboard → Environment Variables - Production env vars

---

## Test File Location

The comprehensive test that revealed this issue:
```
e2e/production-login.spec.ts
```

Run with:
```bash
npx playwright test e2e/production-login.spec.ts --headed
```

---

## Summary

**The 405 error is almost certainly caused by missing/incorrect `NEXTAUTH_URL` in Vercel production environment variables.**

**Fix Steps:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Set `NEXTAUTH_URL=https://nextjspos-six.vercel.app` (no trailing slash!)
3. Set `NEXTAUTH_SECRET=<random-32-char-string>`
4. Redeploy
5. Test again

**If that doesn't work:**
- Add `export const runtime = 'nodejs'` to the route file
- Check middleware isn't blocking `/api/auth/*`
- Consider upgrading to Next.js 15 or NextAuth v5

---

*Generated: 2025-11-03*
*Test Report: PRODUCTION_LOGIN_TEST_REPORT.md*
