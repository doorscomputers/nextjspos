# Schedule Login RBAC - Quick Reference Guide

## Overview

This guide provides quick answers to common RBAC questions about the Schedule-Based Login Security feature.

---

## Who Can Access What?

### View Configuration

**Required Permission:** `BUSINESS_SETTINGS_VIEW` or `BUSINESS_SETTINGS_EDIT`

**Roles That Have It:**
- System Administrator (all permissions)
- Business Settings Manager
- Branch Manager

**Can Do:**
- View current configuration
- See grace period settings
- See exempt roles list
- View custom error messages

**Cannot Do:**
- Save changes
- Modify settings

---

### Edit Configuration

**Required Permission:** `BUSINESS_SETTINGS_EDIT`

**Roles That Have It:**
- System Administrator (all permissions)
- Business Settings Manager
- Branch Manager

**Can Do:**
- Modify grace periods
- Add/remove exempt roles
- Toggle feature on/off
- Change error messages
- Save configuration

**Security Note:** Users with this permission can add their own role to the exempt list!

---

### Login Exemption

**How It Works:** Not permission-based, but **role-based**

**Default Exempt Roles:**
1. Super Admin
2. System Administrator
3. Super Admin (Legacy)
4. Admin (Legacy)

**Users with these roles can:**
- Login at any time
- Ignore all schedule restrictions
- No grace periods applied

**Configurable:** Yes, via the Schedule Login Settings page

---

## Permission Matrix

| Action | Permission Required | Default Roles |
|--------|-------------------|---------------|
| View Settings | `BUSINESS_SETTINGS_VIEW` | System Admin, Settings Manager, Branch Manager |
| Edit Grace Periods | `BUSINESS_SETTINGS_EDIT` | System Admin, Settings Manager, Branch Manager |
| Edit Exempt Roles | `BUSINESS_SETTINGS_EDIT` | System Admin, Settings Manager, Branch Manager |
| Toggle Feature | `BUSINESS_SETTINGS_EDIT` | System Admin, Settings Manager, Branch Manager |
| Login Anytime | (Role must be in exempt list) | Super Admin, System Administrator |

---

## Common Scenarios

### Scenario 1: HR wants to configure grace periods

**Question:** What permissions does HR need?

**Answer:** `BUSINESS_SETTINGS_EDIT`

**How to grant:**
1. Go to Users page
2. Select HR user
3. Assign role: "Business Settings Manager"
   - OR -
4. Add direct permission: `BUSINESS_SETTINGS_EDIT`

**Security consideration:** This also allows HR to modify exempt roles!

---

### Scenario 2: Auditor needs to review settings

**Question:** What permissions does an auditor need?

**Answer:** `BUSINESS_SETTINGS_VIEW` (read-only)

**Current limitation:** No dedicated "viewer" role exists yet

**Workaround:**
1. Create custom role: "Settings Viewer"
2. Add permission: `BUSINESS_SETTINGS_VIEW`
3. Assign to auditor

---

### Scenario 3: Branch Manager wants to login early

**Question:** How do I allow Branch Managers to login anytime?

**Answer:** Add "Branch Manager" to exempt roles list

**Steps:**
1. Login as admin with `BUSINESS_SETTINGS_EDIT`
2. Go to: Dashboard → Settings → Schedule Login Security
3. In "Exempt Roles" field, add: `Branch Manager`
4. Save Configuration

**Result:** All users with "Branch Manager" role can now login anytime

**Warning:** This bypasses schedule restrictions for ALL branch managers!

---

### Scenario 4: Prevent self-exemption

**Question:** How do I prevent Branch Managers from exempting themselves?

**Current answer:** This is a known security gap - see RBAC_SCHEDULE_LOGIN_ANALYSIS.md

**Recommended solution:**
1. Create dedicated "Schedule Login Admin" role
2. Only assign to trusted System Administrators
3. Remove `BUSINESS_SETTINGS_EDIT` from Branch Manager role
4. Branch Managers can request changes via ticket/approval

**Future enhancement:** Separate `SCHEDULE_LOGIN_EXEMPTION_MANAGE` permission

---

## Role Exemption Best Practices

### 1. Keep Exempt List Minimal

**Good:**
```
Super Admin,System Administrator
```

**Avoid:**
```
Super Admin,System Administrator,Branch Manager,Warehouse Manager,Store Supervisor,HR Manager
```

**Why:** Too many exemptions defeat the purpose of schedule-based security

---

### 2. Use Descriptive Role Names

**Good:**
```
Super Admin,System Administrator,Emergency Access
```

**Bad:**
```
Admin,Manager,User123
```

**Why:** Makes it clear who can login anytime and why

---

### 3. Document Exemption Reasons

**Example Policy:**

| Exempt Role | Reason | Approved By | Date |
|-------------|--------|-------------|------|
| Super Admin | Platform owner, needs 24/7 access | CEO | 2025-01-01 |
| System Administrator | Technical support, emergency fixes | CTO | 2025-01-01 |
| On-Call Manager | Handles after-hours emergencies | Operations Director | 2025-02-15 |

---

### 4. Regular Audit Reviews

**Quarterly Checklist:**
- [ ] Review exempt roles list
- [ ] Verify each exempt role is still necessary
- [ ] Check who has those roles assigned
- [ ] Review recent login audit logs
- [ ] Remove unnecessary exemptions

---

## Grace Period Recommendations

### Conservative (High Security)

```
Early Clock-In: 15 minutes
Late Clock-Out: 30 minutes
```

**Use for:**
- High-security facilities
- Strict attendance policies
- Manufacturing with fixed shifts

---

### Moderate (Balanced)

```
Early Clock-In: 30 minutes (default)
Late Clock-Out: 60 minutes (default)
```

**Use for:**
- Retail stores
- Office environments
- General business operations

---

### Flexible (Low Security)

```
Early Clock-In: 60 minutes
Late Clock-Out: 120 minutes
```

**Use for:**
- Flexible work environments
- Remote workers
- Testing/development

---

## Troubleshooting

### Problem: Admin locked out of system

**Symptom:** Admin cannot login outside scheduled hours

**Cause:** Admin role not in exempt list

**Solution:**
1. Check database directly:
   ```sql
   SELECT exempt_roles FROM schedule_login_configurations
   WHERE business_id = 1;
   ```
2. Add admin role if missing:
   ```sql
   UPDATE schedule_login_configurations
   SET exempt_roles = 'Super Admin,System Administrator,Admin'
   WHERE business_id = 1;
   ```

---

### Problem: Employee can login anytime

**Symptom:** Non-admin user ignoring schedule restrictions

**Cause 1:** User has exempt role

**Solution 1:** Check user's roles, remove from exempt list

**Cause 2:** User has no schedule for today

**Solution 2:** Assign schedule to user (if no schedule = no restriction)

**Cause 3:** Feature is disabled

**Solution 3:** Check `enforce_schedule_login` is `true`

---

### Problem: Permission denied accessing settings page

**Symptom:** User sees "You do not have permission to view this page"

**Cause:** User lacks `BUSINESS_SETTINGS_VIEW`

**Solution:** Assign appropriate role or direct permission

**Steps:**
1. Go to Users page
2. Select user
3. Assign role with permission, such as:
   - Business Settings Manager
   - Branch Manager
   - System Administrator

---

### Problem: Can view but cannot save changes

**Symptom:** Save button is hidden or disabled

**Cause:** User has `VIEW` but not `EDIT` permission

**Solution:** Assign `BUSINESS_SETTINGS_EDIT` permission

**This is expected behavior** for read-only access

---

## API Quick Reference

### Get Current Configuration

```bash
GET /api/schedule-login-config
Authorization: Session required
Permission: BUSINESS_SETTINGS_VIEW or BUSINESS_SETTINGS_EDIT
```

**Response:**
```json
{
  "configuration": {
    "id": 1,
    "businessId": 1,
    "enforceScheduleLogin": true,
    "earlyClockInGraceMinutes": 30,
    "lateClockOutGraceMinutes": 60,
    "exemptRoles": "Super Admin,System Administrator",
    "tooEarlyMessage": null,
    "tooLateMessage": null
  }
}
```

---

### Update Configuration

```bash
PUT /api/schedule-login-config
Authorization: Session required
Permission: BUSINESS_SETTINGS_EDIT (required)
Content-Type: application/json
```

**Request Body:**
```json
{
  "enforceScheduleLogin": true,
  "earlyClockInGraceMinutes": 45,
  "lateClockOutGraceMinutes": 90,
  "exemptRoles": "Super Admin,Branch Manager",
  "tooEarlyMessage": "Please wait until your shift starts",
  "tooLateMessage": "Your shift has ended. Contact your manager."
}
```

**Response:**
```json
{
  "message": "Schedule login configuration updated successfully",
  "configuration": { ... }
}
```

---

## Database Schema

### Table: schedule_login_configurations

```sql
CREATE TABLE schedule_login_configurations (
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL UNIQUE,
  enforce_schedule_login BOOLEAN DEFAULT true,
  early_clock_in_grace_minutes INT DEFAULT 30,
  late_clock_out_grace_minutes INT DEFAULT 60,
  exempt_roles TEXT DEFAULT 'Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)',
  too_early_message TEXT,
  too_late_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE
);
```

### Direct Database Access (Emergency Only)

**View configuration:**
```sql
SELECT * FROM schedule_login_configurations
WHERE business_id = 1;
```

**Add exempt role:**
```sql
UPDATE schedule_login_configurations
SET exempt_roles = concat(exempt_roles, ',Emergency Manager')
WHERE business_id = 1;
```

**Disable feature:**
```sql
UPDATE schedule_login_configurations
SET enforce_schedule_login = false
WHERE business_id = 1;
```

**Warning:** Direct database changes bypass audit logging!

---

## Audit Logs

### View Schedule Login Configuration Changes

```sql
SELECT
  al.id,
  al.created_at,
  u.username,
  al.action,
  al.changes,
  al.ip_address
FROM audit_log al
JOIN users u ON al.user_id = u.id
WHERE al.entity_type = 'ScheduleLoginConfiguration'
  AND al.business_id = 1
ORDER BY al.created_at DESC;
```

### View Login Attempts (from audit logs)

```sql
SELECT
  al.id,
  al.created_at,
  u.username,
  u.first_name,
  u.last_name,
  al.action,
  al.description,
  al.ip_address
FROM audit_log al
JOIN users u ON al.user_id = u.id
WHERE al.action = 'USER_LOGIN'
  AND al.business_id = 1
ORDER BY al.created_at DESC
LIMIT 100;
```

---

## Security Checklist

### Before Going Live

- [ ] Review exempt roles list - only include necessary roles
- [ ] Set appropriate grace periods for your business
- [ ] Test with non-exempt user outside scheduled hours
- [ ] Test with exempt user outside scheduled hours
- [ ] Verify audit logging is working
- [ ] Document who has `BUSINESS_SETTINGS_EDIT` permission
- [ ] Train admins on how to add/remove exempt roles
- [ ] Create backup plan for locked-out admins

---

### Monthly Review

- [ ] Review recent configuration changes in audit logs
- [ ] Verify exempt roles list is still appropriate
- [ ] Check for unusual login patterns
- [ ] Ensure grace periods are adequate
- [ ] Review user feedback about schedule restrictions

---

## Common Questions

### Q: Can I have different grace periods for different roles?

**A:** Not currently. Grace periods are business-wide. This is a planned future enhancement.

**Workaround:** Use exempt roles for roles that need more flexibility.

---

### Q: What happens if a user has no schedule for today?

**A:** They can login freely. Schedule restrictions only apply when a schedule exists for that day.

---

### Q: Can I temporarily exempt a user?

**A:** Not currently. You can:
1. Add user to an exempt role (temporarily)
2. Disable the feature (affects all users)
3. Adjust grace periods (affects all users)

Future enhancement: Temporary exemption system

---

### Q: How do I know which users are exempt?

**A:** Check the exempt roles list, then find all users with those roles:

```sql
SELECT DISTINCT u.id, u.username, r.name as role_name
FROM users u
JOIN user_role ur ON u.id = ur.user_id
JOIN role r ON ur.role_id = r.id
WHERE r.name IN ('Super Admin', 'System Administrator')
  AND u.business_id = 1;
```

---

### Q: Can I use wildcards in exempt roles?

**A:** No. Role names must match exactly (case-sensitive).

**Example:**
- ✓ Correct: "Super Admin"
- ✗ Wrong: "super admin"
- ✗ Wrong: "Super*"

---

## File Locations Reference

| File | Purpose |
|------|---------|
| `src/lib/rbac.ts` | Permission definitions (lines 332-333) |
| `src/lib/auth.ts` | Login restriction logic (lines 76-151) |
| `src/app/api/schedule-login-config/route.ts` | API endpoints |
| `src/app/dashboard/settings/schedule-login/page.tsx` | Configuration UI |
| `prisma/schema.prisma` | Database model (lines 2847-2872) |
| `add-schedule-login-config.sql` | Migration script |

---

## Support & Resources

**Full Analysis:** `RBAC_SCHEDULE_LOGIN_ANALYSIS.md`

**Implementation Guide:** `SCHEDULE_LOGIN_CONFIG_COMPLETE.md`

**Feature Documentation:** `SCHEDULE_BASED_LOGIN_SECURITY.md`

---

**Last Updated:** 2025-10-23
**Version:** 1.0
**RBAC Quick Reference**
