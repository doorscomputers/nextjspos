# Schedule-Based Login Security - Implementation Guide

## 📋 Overview

The Schedule-Based Login Security feature prevents users from logging in outside their scheduled working hours. This enhances security by ensuring employees can only access the system during their assigned shifts.

## ✅ Implementation Status: **COMPLETE - WITH CONFIGURABLE UI**

### What Was Implemented

**1. Database Configuration Table** (`ScheduleLoginConfiguration` model)
- Business-specific configuration storage
- Configurable grace periods (early/late)
- Customizable exempt roles
- Custom error messages
- Enable/disable toggle

**2. Enhanced Authentication** (`src/lib/auth.ts`)
- Reads configuration from database (auto-creates if missing)
- Checks user's schedule for the current day
- Validates login time against schedule start/end times
- Applies configured grace periods
- Exempts configured roles from restrictions
- Provides clear error messages with schedule times

**3. Configuration API** (`/api/schedule-login-config`)
- GET: Retrieve configuration (creates default if not exists)
- PUT: Update configuration with validation
- Full audit trail
- Permission-based access control

**4. Configuration UI** (`/dashboard/settings/schedule-login`)
- User-friendly settings interface
- Real-time preview of login windows
- Form validation
- Dark mode support
- Permission-based editing

## 🔐 Security Features

### 1. Schedule Time Enforcement

**Login is blocked if:**
- Current time is **before** scheduled start time (minus early clock-in grace period)
- Current time is **after** scheduled end time (plus late clock-out grace period)

**Example:**
```
Schedule: 8:00 AM - 7:00 PM
Early clock-in grace: 30 minutes
Late clock-out grace: 15 minutes

Allowed login window: 7:30 AM - 7:15 PM
```

### 2. Grace Periods

**Configurable Grace Periods (Default Values)**

**Early Clock-In Grace: 30 minutes (configurable)**
- Allows employees to clock in before their scheduled start
- Useful for employees arriving early to prepare for their shift
- Configurable from 0 to 240 minutes (4 hours)

**Late Clock-Out Grace: 60 minutes (configurable)**
- Allows employees to log in after their scheduled end
- Ensures employees can clock out and handle end-of-shift tasks
- Configurable from 0 to 240 minutes (4 hours)
- **Updated to 1 hour as requested for better flexibility**

### 3. Admin Role Exemption

**Configurable Exempt Roles (Default Values)**
- Super Admin
- System Administrator
- Super Admin (Legacy)
- Admin (Legacy)

These roles can login at any time, regardless of schedule, since they may need to:
- Handle emergencies
- Approve overtime
- Review attendance
- Manage system settings

**Customizable:** You can add or remove roles from the exempt list via the configuration UI

### 4. Day-Based Schedule Detection

The system automatically:
- Detects current day of week (Monday, Tuesday, etc.)
- Uses Manila timezone (`Asia/Manila`)
- Looks up user's schedule for that specific day
- Handles users without schedules (allows login)

## 🔄 Login Flow

```
User enters credentials
       ↓
Password validated ✓
       ↓
Check if user has admin role
       ↓
   Admin? → YES → Allow login (skip schedule check)
       ↓ NO
Get today's schedule for user
       ↓
Schedule exists? → NO → Allow login
       ↓ YES
Get current Manila time
       ↓
Calculate allowed window:
  Start: scheduleStart - 30 min
  End: scheduleEnd + 15 min
       ↓
Current time in window? → NO → BLOCK LOGIN (show error)
       ↓ YES
Allow login ✓
```

## 📊 Example Scenarios

### Scenario 1: Normal Login During Scheduled Hours

**User:** John Doe (Cashier)
**Schedule:** Monday 8:00 AM - 5:00 PM
**Login Attempt:** Monday 9:30 AM

**Result:** ✅ **Login allowed** (within scheduled hours)

---

### Scenario 2: Early Arrival

**User:** Jane Smith (Sales Associate)
**Schedule:** Monday 9:00 AM - 6:00 PM
**Login Attempt:** Monday 8:35 AM

**Result:** ✅ **Login allowed** (within 30-minute early grace period)

---

### Scenario 3: Attempting Login Too Early

**User:** Bob Wilson (Cashier)
**Schedule:** Monday 8:00 AM - 5:00 PM
**Login Attempt:** Monday 7:15 AM

**Result:** ❌ **Login blocked**

**Error Message:**
```
Login denied: You cannot login before your scheduled working hours (08:00:00).
Please wait until 7:30 AM.
```

---

### Scenario 4: Clock-Out After Shift

**User:** Alice Johnson (Cashier)
**Schedule:** Monday 8:00 AM - 7:00 PM
**Login Attempt:** Monday 7:10 PM

**Result:** ✅ **Login allowed** (within 15-minute late grace period for clock-out)

---

### Scenario 5: Attempting Login Too Late

**User:** Tom Brown (Sales Associate)
**Schedule:** Monday 8:00 AM - 7:00 PM
**Login Attempt:** Monday 7:30 PM

**Result:** ❌ **Login blocked**

**Error Message:**
```
Login denied: You cannot login after your scheduled working hours (19:00:00).
Please contact your manager if you need access.
```

---

### Scenario 6: Manager Override

**User:** Sarah Manager (Branch Manager)
**Schedule:** Monday 8:00 AM - 5:00 PM
**Login Attempt:** Monday 10:00 PM

**Result:** ✅ **Login allowed** (admin role exemption)

---

### Scenario 7: No Schedule for Today

**User:** Mike Employee (Warehouse)
**Schedule:** No schedule for Sunday
**Login Attempt:** Sunday 3:00 PM

**Result:** ✅ **Login allowed** (no schedule restriction)

---

### Scenario 8: Day Off

**User:** Lisa Worker (Cashier)
**Schedule:** Tuesday OFF (no schedule record)
**Login Attempt:** Tuesday 2:00 PM

**Result:** ✅ **Login allowed** (no schedule found for today)

**Note:** This is intentional. If employees shouldn't access the system on their day off, managers should set `allowLogin = false` or the schedule system should be configured differently.

## ⚙️ Configuration

### Configuration Options

All settings are now configurable via the UI or API:

**Access UI:** Dashboard → Settings → Schedule Login Security

**Configuration Fields:**
1. **Enforce Schedule Login** (toggle) - Enable/disable the feature
2. **Early Clock-In Grace** (0-240 minutes) - Default: 30 minutes
3. **Late Clock-Out Grace** (0-240 minutes) - Default: 60 minutes
4. **Exempt Roles** (comma-separated) - Default: Admin roles
5. **Custom Error Messages** (optional) - Override default messages

### Grace Period Recommendations

| Business Type | Early Grace | Late Grace | Reasoning |
|--------------|-------------|------------|-----------|
| **Retail Store** | 30 min | 15 min | Allow early prep, quick clock-out |
| **Call Center** | 15 min | 30 min | Strict start, allow call completion |
| **Restaurant** | 30 min | 30 min | Early prep, late cleanup |
| **Office** | 30 min | 15 min | Flexible start, standard end |
| **Manufacturing** | 15 min | 15 min | Strict shift timing |

### ✅ Configurable Settings (IMPLEMENTED)

Grace periods and all settings are now fully configurable per business:

```typescript
interface ScheduleLoginConfiguration {
  enforceScheduleLogin: boolean          // Enable/disable feature
  earlyClockInGraceMinutes: number      // 0-240 minutes
  lateClockOutGraceMinutes: number      // 0-240 minutes
  exemptRoles: string                    // Comma-separated role names
  tooEarlyMessage?: string               // Custom error message
  tooLateMessage?: string                // Custom error message
}
```

**How to Configure:**
1. Navigate to Dashboard → Settings → Schedule Login Security
2. Adjust grace periods using the UI
3. Add/remove exempt roles
4. Optionally customize error messages
5. Click "Save Configuration"

## 🎯 Benefits

### For Business Owners
- ✅ **Prevent unauthorized access** outside business hours
- ✅ **Reduce security risks** from after-hours logins
- ✅ **Ensure schedule compliance**
- ✅ **Audit trail** (login attempts are logged)
- ✅ **Labor law compliance** (no work outside scheduled hours)

### For Managers
- ✅ **Control access** to system
- ✅ **Exception handling** via admin accounts
- ✅ **Clear employee expectations**
- ✅ **Automatic enforcement** (no manual monitoring needed)

### For Employees
- ✅ **Clear work boundaries** (no pressure to work outside hours)
- ✅ **Flexible arrival** (30-minute early grace)
- ✅ **Clock-out protection** (15-minute late grace)
- ✅ **Transparent rules** (error messages explain restrictions)

## 🛡️ Security Advantages

### 1. Time-Based Access Control
- Limits attack window for compromised credentials
- Prevents off-hours unauthorized access
- Reduces insider threat surface

### 2. Schedule Enforcement
- Ensures employees only work scheduled hours
- Prevents unauthorized overtime
- Supports labor law compliance

### 3. Audit Trail
- All login attempts logged (including blocked ones)
- Can identify suspicious access patterns
- Supports compliance investigations

### 4. Defense in Depth
- Adds layer to existing authentication
- Complements username/password security
- Reduces risk from stolen credentials

## 🔧 Troubleshooting

### Error: "Login denied: You cannot login after your scheduled working hours"

**Cause:** Current time is past schedule end time + grace period

**Solutions:**
1. **For Employee:** Contact your manager if you need emergency access
2. **For Manager:** Login with admin account to approve/assist
3. **For Admin:** Either:
   - Extend employee's schedule for today
   - Temporarily assign admin role if needed
   - Update business configuration to increase grace period

---

### Error: "Login denied: You cannot login before your scheduled working hours"

**Cause:** Current time is before schedule start time - early grace period

**Solutions:**
1. **For Employee:** Wait until the allowed window (shown in error message)
2. **For Manager:** If employee needs early access:
   - Adjust schedule start time
   - Increase early grace period in configuration
   - Temporarily assign role with schedule exemption

---

### User has schedule but needs off-hours access

**Solution:**
1. **Temporary:** Assign an admin-type role (e.g., "Admin (Legacy)")
2. **Permanent:** Add user to exempt roles in configuration
3. **One-time:** Manager performs action on user's behalf

---

### Feature is too strict for business needs

**Solutions:**
1. Increase grace periods (modify `earlyClockInMinutes` and `graceMinutes`)
2. Disable feature by commenting out schedule check in `auth.ts`
3. Create business-specific configuration table with toggle

## 📝 Implementation Details

### Code Location
- **File:** `src/lib/auth.ts`
- **Function:** `authorize()` in CredentialsProvider
- **Lines:** 76-128

### Database Dependencies
- **Table:** `employee_schedules`
- **Fields:** `userId`, `dayOfWeek`, `startTime`, `endTime`
- **Timezone:** Manila (`Asia/Manila`)

### Error Handling
- Throws clear error messages with schedule times
- Uses Next-Auth's built-in error handling
- Logs blocked login attempts via audit system

## 🧪 Testing Checklist

- [ ] **Test with regular employee:**
  - [ ] Login during scheduled hours → Should succeed
  - [ ] Login 25 minutes early → Should succeed
  - [ ] Login 35 minutes early → Should fail
  - [ ] Login 10 minutes after end → Should succeed
  - [ ] Login 20 minutes after end → Should fail

- [ ] **Test with admin user:**
  - [ ] Login at midnight → Should succeed
  - [ ] Login on day off → Should succeed

- [ ] **Test error messages:**
  - [ ] Too early login shows correct allowed time
  - [ ] Too late login shows schedule end time
  - [ ] Messages are user-friendly

- [ ] **Test edge cases:**
  - [ ] User with no schedule → Should allow login
  - [ ] User with schedule on day off → Should allow login
  - [ ] Timezone conversion works correctly

## 🗄️ Database Setup

**IMPORTANT:** Run the SQL migration script to add the configuration table.

```bash
# Using psql
psql -h localhost -U postgres -d ultimatepos_modern -f add-schedule-login-config.sql

# Or using PostgreSQL GUI (pgAdmin, DBeaver, etc.)
# Open add-schedule-login-config.sql and execute
```

The migration script will:
- ✅ Create `schedule_login_configurations` table
- ✅ Add default configuration for all existing businesses
- ✅ Set grace periods to 30 min early / 60 min late
- ✅ Configure default admin role exemptions

## 🔮 Future Enhancements

### High Priority
1. ~~**Configurable Grace Periods**~~ ✅ **IMPLEMENTED**
   - ~~Business-level configuration~~ ✅ Done
   - ~~Per-role grace periods~~
   - ~~UI for configuration management~~ ✅ Done

2. **Emergency Access**
   - Manager can grant temporary access
   - Time-limited emergency tokens
   - Audit trail for emergency access

3. **Schedule Override UI**
   - Manager can temporarily extend schedules
   - Bulk schedule adjustments
   - Holiday schedule handling

### Medium Priority
4. **Mobile App Support**
   - Push notifications when access denied
   - Request access via mobile
   - Manager approval workflow

5. **Geolocation Integration**
   - Require on-site location for login
   - Combine schedule + location validation
   - Geofencing for business locations

6. **Analytics Dashboard**
   - Track blocked login attempts
   - Identify patterns (repeated violations)
   - Schedule compliance reporting

## 📚 Related Documentation

- [Authentication System](src/lib/auth.ts)
- [Employee Scheduling](EMPLOYEE_MANAGEMENT_IMPLEMENTATION_COMPLETE.md)
- [Attendance System](src/app/api/attendance/)
- [RBAC System](src/lib/rbac.ts)
- [Audit Logging](src/lib/auditLog.ts)

## 🎉 Summary

The Schedule-Based Login Security feature is now **FULLY IMPLEMENTED WITH CONFIGURABLE UI**. This feature:

- ✅ **Automatically enforces** schedule-based access control
- ✅ **Configurable grace periods** (default: 30min early, 60min late)
- ✅ **Configurable exempt roles** via UI
- ✅ **Full configuration interface** with dark mode support
- ✅ **Custom error messages** (optional)
- ✅ **Enable/disable toggle** per business
- ✅ **Shows clear error messages** to users
- ✅ **Integrates seamlessly** with existing authentication
- ✅ **Works with Manila timezone**
- ✅ **Logs all access attempts** for audit trail
- ✅ **API endpoints** for programmatic configuration

**Status**: ✅ Complete - Requires Database Migration

**Action Required:**
1. Run `add-schedule-login-config.sql` to create configuration table
2. Run `npx prisma generate` (already done)
3. Navigate to Dashboard → Settings → Schedule Login Security to configure
4. Test with non-admin users

**Default Configuration:**
- Early grace: 30 minutes
- Late grace: 60 minutes (as requested)
- Exempt roles: Super Admin, System Administrator, Admin (Legacy)
- Feature: Enabled by default
