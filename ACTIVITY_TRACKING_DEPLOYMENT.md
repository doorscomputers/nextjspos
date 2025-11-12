# Activity Tracking System - Safe Deployment Guide

## 🎯 Overview

This guide provides step-by-step instructions for safely deploying the new Activity Tracking System to your production environment (pcinet.shop).

**What this fixes:**
- ✅ Active Users Monitor now works with JWT authentication
- ✅ Shows users active in last 5-60 minutes (configurable)
- ✅ Tracks device type, browser, IP address, current page
- ✅ No changes to existing authentication or sessions
- ✅ 100% safe - only adds new functionality

**What's NOT affected:**
- ✅ Existing users, roles, permissions - UNTOUCHED
- ✅ User locations and assignments - UNTOUCHED
- ✅ Authentication system - UNTOUCHED
- ✅ Existing data - UNTOUCHED

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ Access to production server (pcinet.shop)
2. ✅ Database backup tool available
3. ✅ SSH or terminal access to server
4. ✅ Git access to pull latest code
5. ✅ Node.js and npm installed
6. ✅ 15-30 minutes for deployment

---

## 🛡️ Phase 1: Backup (CRITICAL - DO NOT SKIP!)

### **Step 1.1: Backup Database**

```bash
# PostgreSQL backup
pg_dump -U your_username -d your_database_name > backup_activity_tracking_$(date +%Y%m%d_%H%M%S).sql

# OR use your hosting provider's backup feature
# Supabase: Dashboard → Database → Backups
# Vercel Postgres: Dashboard → Storage → Create Backup
```

**Verify backup:**
```bash
# Check file size (should be several MB)
ls -lh backup_activity_tracking_*.sql
```

### **Step 1.2: Backup Code**

```bash
# Create a git tag before deployment
git tag -a pre-activity-tracking-$(date +%Y%m%d) -m "Backup before activity tracking deployment"
git push --tags
```

---

## 🚀 Phase 2: Deploy to Production

### **Step 2.1: Pull Latest Code**

```bash
cd /path/to/your/project
git pull origin master
```

**Verify you have the new files:**
```bash
# Check if new files exist
ls -la src/lib/activity-tracker.ts
ls -la src/app/api/admin/active-users-v2/
```

### **Step 2.2: Install Dependencies**

```bash
npm install
```

### **Step 2.3: Generate Prisma Client**

This updates the Prisma client with the new UserActivity model:

```bash
npx prisma generate
```

**Expected output:**
```
✔ Generated Prisma Client
```

### **Step 2.4: Apply Database Schema Changes**

**IMPORTANT:** We're using `db:push` because this is an **additive change only** - no data will be lost.

```bash
npm run db:push
```

**Expected output:**
```
Your database is now in sync with your Prisma schema. Done in X.XXs
```

**What this does:**
- ✅ Creates new `user_activity` table
- ✅ Adds foreign key to users table
- ✅ Does NOT modify existing tables
- ✅ Does NOT delete any data

---

## ✅ Phase 3: Verification

### **Step 3.1: Verify Database Schema**

```sql
-- Check if user_activity table was created
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'user_activity';

-- Expected: Returns 'user_activity'

-- Check table structure
\d user_activity

-- Expected: Shows columns: id, user_id, last_seen_at, current_url, ip_address, etc.
```

### **Step 3.2: Test the Application**

1. **Login to pcinet.shop**
2. **Navigate to:** Administration → Active Users Monitor
3. **Expected behavior:**
   - Page loads without errors
   - Shows time window selector (Last 5 min, Last 15 min, etc.)
   - Initially shows "No Records" or just you (if enough time has passed)
4. **Click around the dashboard** (Products, Sales, etc.)
5. **Go back to Active Users Monitor**
6. **Expected:** You should now appear in the list!

### **Step 3.3: Test Activity Tracking**

**Test with multiple users:**

1. Open another browser (or incognito mode)
2. Login as a different user
3. Both users navigate around the dashboard
4. Check Active Users Monitor
5. **Expected:** Both users visible with:
   - Last seen timestamp
   - Device type (desktop/mobile)
   - Browser name
   - Current page URL
   - IP address

---

## 🔧 Phase 4: Optional Enhancements

### **Option A: Add Activity Tracking to Middleware (Real-time tracking)**

This makes activity tracking automatic on every page visit:

**Edit `middleware.ts`** and add after line 92:

```typescript
// Add this import at the top
import { trackUserActivityFromToken } from '@/lib/activity-tracker'

// Add this after the authentication check (around line 92)
if (token && url.startsWith('/dashboard')) {
  // Track user activity (fire and forget - don't block request)
  trackUserActivityFromToken(token, request).catch(err => {
    console.error('[Middleware] Activity tracking failed:', err)
  })
}
```

**Benefits:**
- Automatic tracking on every dashboard page visit
- No need to manually call tracking in API routes
- Real-time "Last Seen" updates

**Rebuild:**
```bash
npm run build
```

### **Option B: Add Cleanup Cron Job**

To prevent old activity records from accumulating:

**Create: `scripts/cleanup-old-activity.ts`**

```typescript
import { cleanupOldActivity } from '../src/lib/activity-tracker'

async function main() {
  console.log('Cleaning up old activity records...')
  const deleted = await cleanupOldActivity(30) // Remove records older than 30 days
  console.log(`Deleted ${deleted} old activity records`)
}

main()
```

**Add to cron (run daily):**
```bash
0 2 * * * cd /path/to/project && npx tsx scripts/cleanup-old-activity.ts
```

---

## 🚨 Rollback Procedure (If Needed)

If something goes wrong:

### **Step 1: Stop the Application**
```bash
# If using PM2
pm2 stop your-app-name

# If using Vercel/Netlify, pause deployments
```

### **Step 2: Restore Database**

**Drop the new table:**
```sql
DROP TABLE IF EXISTS user_activity CASCADE;
```

**Or restore full backup:**
```bash
psql -U your_username -d your_database_name < backup_activity_tracking_YYYYMMDD_HHMMSS.sql
```

### **Step 3: Revert Code**

```bash
git checkout pre-activity-tracking-$(date +%Y%m%d)
npm install
npx prisma generate
npm run build
```

### **Step 4: Restart Application**

```bash
pm2 restart your-app-name
```

---

## 📊 Expected Results

### **Before Deployment:**
- ❌ Active Users Monitor shows "No Records"
- ❌ Session table empty (JWT authentication)

### **After Deployment:**
- ✅ Active Users Monitor shows active users
- ✅ Configurable time windows (5 min to 4 hours)
- ✅ Detailed activity info (device, browser, IP, current page)
- ✅ Auto-refresh every 60 seconds
- ✅ Real-time monitoring

---

## 🎉 Success Criteria

Deployment is successful if:

1. ✅ No errors during database migration
2. ✅ Application starts without errors
3. ✅ Active Users Monitor page loads
4. ✅ Users appear in the list after activity
5. ✅ Time window selector works
6. ✅ All existing features still work (Users, Roles, Products, Sales, etc.)

---

## 📞 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   # Application logs
   pm2 logs your-app-name

   # Database logs
   tail -f /var/log/postgresql/postgresql-*.log
   ```

2. **Common issues:**
   - **"user_activity table already exists"** → Table created but not tracked by Prisma → Run `npx prisma db pull` then `npx prisma generate`
   - **"Failed to fetch active users"** → Check API logs for detailed error
   - **"No Records to Show"** → Wait 1-2 minutes after logging in for activity to be tracked

3. **Emergency Rollback:**
   Follow the Rollback Procedure above

---

## 📝 Post-Deployment Tasks

After successful deployment:

1. ✅ Monitor application logs for 24 hours
2. ✅ Check Active Users Monitor daily
3. ✅ Consider adding middleware tracking (Option A)
4. ✅ Set up cleanup cron job (Option B)
5. ✅ Update your team about the new feature

---

## 🔐 Security Notes

- **IP addresses are logged** - Ensure compliance with privacy policies
- **Activity tracking is per-user** - Respects multi-tenant isolation
- **No sensitive data stored** - Only URLs, timestamps, and metadata
- **RBAC enforced** - Only users with `USER_VIEW_ACTIVE_SESSIONS` permission can view

---

## ✅ Deployment Checklist

Print this and check off as you go:

- [ ] Database backup created and verified
- [ ] Git tag created for rollback point
- [ ] Code pulled from GitHub
- [ ] Dependencies installed (`npm install`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Database schema updated (`npm run db:push`)
- [ ] Application restarted
- [ ] Active Users Monitor page loads
- [ ] Activity tracking verified with test users
- [ ] No errors in application logs
- [ ] All existing features still work
- [ ] Team notified of new feature

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Rollback Date (if needed):** _______________

**Notes:**
________________________________________________________________________________
________________________________________________________________________________
________________________________________________________________________________
