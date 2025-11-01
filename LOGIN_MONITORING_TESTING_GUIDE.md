# Login Monitoring System - Testing Guide

## ✅ Implementation Complete

All login monitoring features have been successfully implemented:

1. ✅ SMS Configuration (Semaphore API)
2. ✅ SMS Notification Service
3. ✅ Unified Login Alert Service (Telegram + Email + SMS)
4. ✅ Location Selector on Login Page
5. ✅ Integration with Authentication System
6. ✅ Admin Login History Dashboard
7. ✅ Sidebar Menu Item Added

## 🚀 Quick Start

The development server is running at: **http://localhost:3000**

## 📋 Testing Checklist

### 1. Test Login Page Location Selector

**Steps:**
1. Navigate to http://localhost:3000/login
2. Verify the location selector dropdown appears with green border
3. Check that it shows "I am logging in at:" label with map pin icon
4. Verify all business locations are listed
5. Try to submit without selecting a location - should show error

**Expected Result:**
- Location dropdown is visible and required
- All locations from database are listed
- Cannot login without selecting a location

---

### 2. Test Cashier Login (SMS Enabled)

**Test User:** Any cashier user (e.g., `cashier` / `password`)

**Steps:**
1. Log out if currently logged in
2. Go to login page
3. Enter cashier credentials
4. **Important:** Select their ASSIGNED location
5. Click LOGIN

**Expected Notifications:**
- ✅ Telegram alert sent (if TELEGRAM_NOTIFICATIONS_ENABLED=true)
- ✅ Email alert sent (if EMAIL_NOTIFICATIONS_ENABLED=true)
- ✅ SMS sent to `+639176553488` (if SMS_ENABLED=true and SEND_SMS_FOR_CASHIER_LOGINS=true)

**Check Console Logs:**
```
[LoginAlert] Sending notifications...
[LoginAlert] User: cashier | Location: [Selected Location] | Mismatch: false
[Telegram] ✓ Login alert sent
[Email] ✓ Login alert sent
[SMS] ✓ Sent to 1 admin(s), 0 failed
[LoginAlert] ✓ All notifications processed
```

**SMS Message Format:**
```
POS LOGIN: cashier at [Location Name], [Time]
```

**Cost:** ₱0.70 per SMS

---

### 3. Test Admin Login (SMS Skipped)

**Test User:** Super Admin (e.g., `superadmin` / `password`)

**Steps:**
1. Log out
2. Log in as Super Admin
3. Select any location

**Expected Notifications:**
- ✅ Telegram alert sent
- ✅ Email alert sent
- ❌ SMS **NOT** sent (cost saving - SEND_SMS_FOR_ADMIN_LOGINS=false)

**Check Console Logs:**
```
[SMS] Skipping SMS for admin login (cost saving)
```

---

### 4. Test Location Mismatch (CRITICAL ALERT)

**Setup:**
1. Log in as Super Admin
2. Go to Administration → Users
3. Find a cashier user (e.g., `cashier`)
4. Note their assigned location(s)

**Test Steps:**
1. Log out
2. Log in as that cashier
3. **Select a DIFFERENT location** than their assigned one
4. Click LOGIN

**Expected Notifications:**
- 🚨 Telegram alert with CRITICAL flag
- 🚨 Email alert with RED header
- 🚨 SMS alert with ⚠️ symbol (even for admins if mismatch occurs)

**SMS Message Format:**
```
⚠️ ALERT: cashier logged at MAIN STORE but assigned to BAMBANG. Verify now!
```

**Telegram Message:**
```
🚨 CRITICAL: LOCATION MISMATCH

👤 User: cashier (John Doe)
🎭 Role: Cashier
❌ Logged in at: Main Store
✅ Assigned to: Bambang
⏰ Time: Oct 31, 2025 10:30 AM
📍 IP: unknown

⚠️ ACTION REQUIRED: Verify immediately!
```

**Cost:** ₱0.70 per SMS

---

### 5. Test Login History Dashboard

**Access:**
1. Log in as Super Admin or any user with AUDIT_LOG_VIEW permission
2. Go to **Administration → Login History**

**Features to Test:**

#### A. View Login Records
- Verify table shows all recent logins
- Check columns: Date/Time, Username, Full Name, Role, Location, Status, IP
- Location mismatches should have RED background

#### B. Filters
1. **User Filter:**
   - Select specific user from dropdown
   - Verify only that user's logins appear

2. **Location Filter:**
   - Select specific location
   - Verify only logins at that location appear

3. **Date Range:**
   - Select start and end dates
   - Verify only logins within range appear

4. **Quick Filters:**
   - Click "Last 7 Days" → shows last week
   - Click "Last 30 Days" → shows last month
   - Click "Last 90 Days" → shows last 3 months

#### C. Statistics Cards
- **Total Logins:** Count all login records
- **Valid Logins:** Count of successful location matches
- **Location Mismatches:** Count of location mismatches (should be RED)

#### D. Export to Excel
1. Click Export button in toolbar
2. Verify Excel file downloads: `login-history.xlsx`
3. Open file and verify all data is present

#### E. Real-time Updates
1. Click Refresh button
2. Verify new logins appear

---

### 6. Test Notification Failures (Graceful Degradation)

**Purpose:** Ensure login still works even if notifications fail

**Test A: Disable SMS**
1. In `.env`, set `SMS_ENABLED="false"`
2. Restart dev server
3. Log in as cashier
4. **Expected:** Login succeeds, console shows `[SMS] SMS disabled via environment variable`

**Test B: Invalid Telegram Token**
1. In `.env`, set `TELEGRAM_BOT_TOKEN="invalid"`
2. Restart dev server
3. Log in as cashier
4. **Expected:** Login succeeds, console shows error but doesn't block login

**Test C: Invalid SMTP Credentials**
1. In `.env`, set `SMTP_PASS="wrong"`
2. Restart dev server
3. Log in as cashier
4. **Expected:** Login succeeds, console shows email error but doesn't block login

**Important:** All notification failures are non-blocking!

---

## 📊 Cost Estimation

### SMS Costs (Semaphore - ₱0.70 per SMS)

**Scenario 1: 10 cashiers, 2 logins/day each**
- Daily: 20 logins × ₱0.70 = ₱14
- Monthly: ₱14 × 30 = ₱420

**Scenario 2: 5 location mismatches per month**
- Monthly: 5 × ₱0.70 = ₱3.50

**Total Estimated Monthly Cost:** ₱420 - ₱500

**Savings:**
- Admin logins: ₱0 (SMS skipped)
- Telegram: FREE
- Email: FREE

---

## 🔍 Console Log Reference

### Successful Login (Cashier)
```
[LOGIN] ✓ Shift validation passed for user: cashier
[LoginAlert] Sending notifications...
[LoginAlert] User: cashier | Location: Bambang | Mismatch: false
[Telegram] ✓ Login alert sent
[Email] ✓ Login alert sent
[SMS] Sending SMS to +639176553488
[SMS] ✓ SMS sent successfully
[SMS] ✓ Sent to 1 admin(s), 0 failed
[LoginAlert] ✓ All notifications processed
[LoginAlert] Notifications queued for cashier (OK)
```

### Location Mismatch (CRITICAL)
```
[LoginAlert] User: cashier | Location: Main Store | Mismatch: true
[Telegram] ✓ Login alert sent
[Email] ✓ Login alert sent
[SMS] Sending SMS to +639176553488
[SMS] Message: ⚠️ ALERT: cashier logged at MAIN STORE but assigned to BAMBANG. Verify now!
[SMS] ✓ SMS sent successfully
[LoginAlert] Notifications queued for cashier (MISMATCH)
```

### Admin Login (SMS Skipped)
```
[LoginAlert] User: superadmin | Location: Main Store | Mismatch: false
[Telegram] ✓ Login alert sent
[Email] ✓ Login alert sent
[SMS] Skipping SMS for admin login (cost saving)
[LoginAlert] ✓ All notifications processed
```

---

## 🔧 Environment Variables Reference

```env
# SMS Configuration
SMS_ENABLED="true"
SEMAPHORE_API_KEY="02ef675f3c7ac04fe39b2d33ae385df3"
SEMAPHORE_SENDER_NAME="POSSystem"
ADMIN_SMS_NUMBERS="+639176553488"

# SMS Alert Settings
SEND_SMS_FOR_ADMIN_LOGINS="false"        # Save costs
SEND_SMS_FOR_CASHIER_LOGINS="true"       # Monitor cashiers
SEND_SMS_FOR_LOCATION_MISMATCH="true"    # Always alert on mismatch

# Telegram Configuration (Already Configured)
TELEGRAM_NOTIFICATIONS_ENABLED="true"
TELEGRAM_BOT_TOKEN="8344635676:AAGhZVRmYHMrNI12le48arnGqUt5xV-eQHc"
TELEGRAM_CHAT_IDS="7411148092"

# Email Configuration (Already Configured)
EMAIL_NOTIFICATIONS_ENABLED="true"
EMAIL_ADMIN_RECIPIENTS="rr3800@gmail.com,doors_computers@yahoo.com"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="rr3800@gmail.com"
SMTP_PASS="zcgugacciaksiuze"
```

---

## 🐛 Troubleshooting

### Issue: SMS not sending

**Check:**
1. `SMS_ENABLED="true"` in .env
2. `SEND_SMS_FOR_CASHIER_LOGINS="true"` in .env
3. `SEMAPHORE_API_KEY` is correct
4. Phone number format: `+639176553488` (must start with +63)
5. Semaphore account has credits

**Console Error:**
```
[SMS] SEMAPHORE_API_KEY not configured
[SMS] Invalid phone number format
[SMS] Semaphore API error: Insufficient credits
```

---

### Issue: Location mismatch not detected

**Check:**
1. User has assigned locations in database (UserLocation table)
2. Selected location is different from assigned location
3. User is not Super Admin (admins bypass mismatch check)

---

### Issue: Login History page not visible

**Check:**
1. User has `AUDIT_LOG_VIEW` permission
2. Menu permissions are synced (run sync script)
3. Clear browser cache and refresh

---

### Issue: Login blocked even though user selected correct location

**Possible Causes:**
1. Another user has open shift at that location
2. User's schedule doesn't allow login at current time
3. Check console logs for exact error message

---

## ✅ Success Criteria

All tests should pass with:
- ✅ Login page shows location selector
- ✅ Cashier login sends all 3 notifications
- ✅ Admin login skips SMS (cost saving)
- ✅ Location mismatch sends CRITICAL alerts
- ✅ Login History dashboard displays correctly
- ✅ Filters work properly
- ✅ Export to Excel works
- ✅ No errors in console (except intentional test failures)
- ✅ Login still works even if notifications fail

---

## 📞 Support

If you encounter issues:
1. Check console logs for detailed error messages
2. Verify .env configuration
3. Test each notification channel independently
4. Check Semaphore account balance

---

## 🎉 Implementation Summary

**Files Created:**
- `src/lib/notifications/sms-semaphore.ts` - SMS service
- `src/lib/notifications/login-alert-service.ts` - Unified notification service
- `src/app/api/admin/login-history/route.ts` - API for login history
- `src/app/dashboard/admin/login-history/page.tsx` - Login history dashboard

**Files Modified:**
- `.env` - Added SMS configuration
- `src/app/login/page.tsx` - Added location selector
- `src/lib/auth.ts` - Integrated login monitoring
- `src/components/Sidebar.tsx` - Added Login History menu item

**Total Lines of Code:** ~1,200

**Development Time:** ~2 hours

**Status:** ✅ Ready for Production Testing
