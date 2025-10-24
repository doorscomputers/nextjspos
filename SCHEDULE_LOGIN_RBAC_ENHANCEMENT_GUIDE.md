# Schedule Login RBAC Enhancement - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the recommended RBAC enhancements for the Schedule-Based Login Security feature. Each enhancement is designed to improve security, usability, and maintainability.

---

## Enhancement Priority Matrix

| Priority | Enhancement | Effort | Impact | Risk |
|----------|------------|--------|--------|------|
| 1 | Documentation & Audit | 1 hour | High | None |
| 2 | Role Validation UI | 4-6 hours | High | Low |
| 3 | Granular Permissions | 8-12 hours | Very High | Medium |
| 4 | Advanced Features | 40+ hours | Medium | High |

---

# Priority 1: Documentation & Immediate Actions

## Goal
Improve awareness and prevent misconfigurations without code changes.

## Duration
1-2 hours

---

## Task 1.1: Document Exempt Roles Policy

**Create File:** `docs/schedule-login-policy.md`

```markdown
# Schedule Login Exemption Policy

## Exempt Roles

The following roles are exempt from schedule-based login restrictions:

| Role Name | Reason for Exemption | Approved By | Date Approved |
|-----------|---------------------|-------------|---------------|
| Super Admin | Platform owner, 24/7 access required | CEO | 2025-01-01 |
| System Administrator | Emergency technical support | CTO | 2025-01-01 |

## Requesting Exemption

To request a role be added to the exempt list:

1. Submit request to IT Security team
2. Provide business justification
3. Obtain manager approval
4. IT Security reviews and approves/denies

## Review Cycle

Exempt roles are reviewed quarterly by:
- IT Security Manager
- Operations Director
- Compliance Officer

Next review date: [Insert date]

## Contact

Questions? Contact: security@company.com
```

---

## Task 1.2: Audit Current Configurations

**Run this SQL query for each business:**

```sql
-- Check current schedule login configuration
SELECT
  b.id as business_id,
  b.name as business_name,
  slc.enforce_schedule_login,
  slc.early_clock_in_grace_minutes,
  slc.late_clock_out_grace_minutes,
  slc.exempt_roles,
  slc.updated_at,
  slc.created_at
FROM business b
LEFT JOIN schedule_login_configurations slc ON b.id = slc.business_id
ORDER BY b.name;
```

**Review checklist:**
- [ ] Is the feature enabled appropriately?
- [ ] Are grace periods reasonable?
- [ ] Are only necessary roles in exempt list?
- [ ] Are exempt role names spelled correctly?

---

## Task 1.3: Audit Users with Edit Permissions

**Run this SQL query:**

```sql
-- Find all users with BUSINESS_SETTINGS_EDIT permission
SELECT DISTINCT
  u.id,
  u.username,
  u.first_name,
  u.last_name,
  b.name as business_name,
  r.name as role_name
FROM users u
JOIN business b ON u.business_id = b.id
JOIN user_role ur ON u.id = ur.user_id
JOIN role r ON ur.role_id = r.id
JOIN role_permission rp ON r.id = rp.role_id
JOIN permission p ON rp.permission_id = p.id
WHERE p.name = 'business_settings.edit'
  AND u.allow_login = true
ORDER BY b.name, u.username;
```

**Review questions:**
- Do all these users need this permission?
- Could any of them abuse self-exemption?
- Should any be downgraded to view-only?

---

## Task 1.4: Create User Guide Section

**Add to User Manual:**

```markdown
## Schedule-Based Login Security

### What It Does

This feature restricts when users can login based on their scheduled working hours.

### Who Can Login Anytime

Users with these roles can login at any time:
- Super Admin
- System Administrator

All other users can only login during their scheduled hours (plus grace periods).

### Grace Periods

- **Early Clock-In:** You can login 30 minutes before your shift starts
- **Late Clock-Out:** You can login up to 60 minutes after your shift ends

Example: If your shift is 9:00 AM - 6:00 PM, you can login from 8:30 AM to 7:00 PM.

### What If I Need Access Outside Hours?

Contact your manager or IT support. They can:
1. Temporarily adjust your schedule
2. Add you to an exempt role (requires approval)
3. Temporarily disable the feature (requires approval)

### Configuration

**Location:** Dashboard → Settings → Schedule Login Security

**Who Can Configure:** Users with Business Settings Manager or Branch Manager role

**What Can Be Configured:**
- Enable/disable the feature
- Adjust grace periods
- Modify exempt roles list
- Customize error messages
```

---

# Priority 2: Role Validation UI Enhancement

## Goal
Replace text input with validated multi-select dropdown to prevent typos and improve security awareness.

## Duration
4-6 hours

---

## Task 2.1: Create Role Fetching API Endpoint

**Create File:** `src/app/api/roles/available/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/roles/available
 * Get all roles for the current business (for dropdowns)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Permission check - need settings view to see roles
    const permissions = user.permissions || []
    if (!permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_VIEW) &&
        !permissions.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({
        error: 'You do not have permission to view roles'
      }, { status: 403 })
    }

    // Fetch all roles for this business
    const roles = await prisma.role.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json({
      error: 'Failed to fetch roles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
```

---

## Task 2.2: Update Configuration UI Component

**Update File:** `src/app/dashboard/settings/schedule-login/page.tsx`

**Step 1: Add state for available roles**

```typescript
// Add to existing state declarations (around line 36)
const [availableRoles, setAvailableRoles] = useState<Array<{
  id: number
  name: string
  description: string | null
}>>([])
const [selectedExemptRoles, setSelectedExemptRoles] = useState<string[]>([])
```

**Step 2: Add function to fetch roles**

```typescript
// Add after fetchConfiguration function (around line 66)
const fetchAvailableRoles = async () => {
  try {
    const response = await fetch('/api/roles/available')
    if (response.ok) {
      const data = await response.json()
      setAvailableRoles(data.roles)
    }
  } catch (error) {
    console.error('Failed to fetch roles:', error)
  }
}
```

**Step 3: Call fetchAvailableRoles on component mount**

```typescript
// Update useEffect (around line 38)
useEffect(() => {
  fetchConfiguration()
  fetchAvailableRoles() // Add this line
}, [])
```

**Step 4: Parse exempt roles when config loads**

```typescript
// Update fetchConfiguration function (around line 54)
setExemptRoles(data.configuration.exemptRoles || '')
// Add this:
const exemptList = (data.configuration.exemptRoles || '')
  .split(',')
  .map(r => r.trim())
  .filter(r => r.length > 0)
setSelectedExemptRoles(exemptList)
```

**Step 5: Replace text input with multi-select**

Replace the existing exempt roles input (around line 226-241) with:

```typescript
{/* Exempt Roles - Multi-Select */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    Exempt Roles
  </label>

  {/* Selected roles display */}
  <div className="mb-3 flex flex-wrap gap-2">
    {selectedExemptRoles.map(roleName => {
      const isAdminRole = ['Super Admin', 'System Administrator', 'Super Admin (Legacy)', 'Admin (Legacy)'].includes(roleName)
      return (
        <span
          key={roleName}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isAdminRole
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
          }`}
        >
          {roleName}
          {!isAdminRole && (
            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {canEdit && (
            <button
              onClick={() => {
                const updated = selectedExemptRoles.filter(r => r !== roleName)
                setSelectedExemptRoles(updated)
                setExemptRoles(updated.join(','))
              }}
              className="ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              ×
            </button>
          )}
        </span>
      )
    })}
  </div>

  {/* Role selector dropdown */}
  {canEdit && (
    <select
      onChange={(e) => {
        const roleName = e.target.value
        if (roleName && !selectedExemptRoles.includes(roleName)) {
          const updated = [...selectedExemptRoles, roleName]
          setSelectedExemptRoles(updated)
          setExemptRoles(updated.join(','))
        }
        e.target.value = '' // Reset dropdown
      }}
      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    >
      <option value="">+ Add role to exempt list</option>
      {availableRoles
        .filter(role => !selectedExemptRoles.includes(role.name))
        .map(role => (
          <option key={role.id} value={role.name}>
            {role.name}
            {role.description ? ` - ${role.description}` : ''}
          </option>
        ))}
    </select>
  )}

  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
    Users with these roles can login anytime, regardless of schedule
  </p>

  {/* Warning for non-admin exempt roles */}
  {selectedExemptRoles.some(r => !['Super Admin', 'System Administrator', 'Super Admin (Legacy)', 'Admin (Legacy)'].includes(r)) && (
    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-start">
        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Security Warning:</strong> You have exempted non-administrator roles.
          These users will be able to login at any time, bypassing schedule restrictions.
          Ensure this is intentional and approved by management.
        </div>
      </div>
    </div>
  )}
</div>
```

**Step 6: Add confirmation dialog before save**

```typescript
// Update handleSave function (around line 68)
const handleSave = async () => {
  // Check for non-admin exempt roles
  const nonAdminExempt = selectedExemptRoles.filter(r =>
    !['Super Admin', 'System Administrator', 'Super Admin (Legacy)', 'Admin (Legacy)'].includes(r)
  )

  if (nonAdminExempt.length > 0) {
    const confirmed = window.confirm(
      `Warning: You are exempting the following non-administrator roles:\n\n${nonAdminExempt.join(', ')}\n\n` +
      `These users will be able to login at ANY time, bypassing schedule restrictions.\n\n` +
      `Are you sure you want to continue?`
    )
    if (!confirmed) {
      return
    }
  }

  try {
    setSaving(true)
    setMessage(null)

    // ... rest of existing save logic
  } catch (error) {
    // ... existing error handling
  } finally {
    setSaving(false)
  }
}
```

---

## Task 2.3: Validate Role Names on Server

**Update File:** `src/app/api/schedule-login-config/route.ts`

Add validation before updating (around line 90):

```typescript
// Add after body parsing, before upsert (around line 90)
if (body.exemptRoles !== undefined) {
  // Validate that all exempt role names exist
  const exemptRoleNames = body.exemptRoles
    .split(',')
    .map((r: string) => r.trim())
    .filter((r: string) => r.length > 0)

  if (exemptRoleNames.length > 0) {
    const existingRoles = await prisma.role.findMany({
      where: {
        businessId,
        name: { in: exemptRoleNames }
      },
      select: { name: true }
    })

    const existingRoleNames = existingRoles.map(r => r.name)
    const invalidRoles = exemptRoleNames.filter(
      (name: string) => !existingRoleNames.includes(name)
    )

    if (invalidRoles.length > 0) {
      return NextResponse.json({
        error: `The following role names do not exist: ${invalidRoles.join(', ')}`,
        invalidRoles
      }, { status: 400 })
    }
  }
}
```

---

## Task 2.4: Add "Last Modified By" Display

**Update UI File:** `src/app/dashboard/settings/schedule-login/page.tsx`

Add state for last modified info:

```typescript
const [lastModifiedBy, setLastModifiedBy] = useState<string | null>(null)
const [lastModifiedAt, setLastModifiedAt] = useState<string | null>(null)
```

Fetch from audit log:

```typescript
const fetchLastModified = async () => {
  try {
    const response = await fetch('/api/audit-log?entityType=ScheduleLoginConfiguration&limit=1')
    if (response.ok) {
      const data = await response.json()
      if (data.logs && data.logs.length > 0) {
        setLastModifiedBy(data.logs[0].username)
        setLastModifiedAt(data.logs[0].createdAt)
      }
    }
  } catch (error) {
    console.error('Failed to fetch last modified info:', error)
  }
}
```

Display in UI (add before form):

```typescript
{lastModifiedBy && lastModifiedAt && (
  <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
    Last modified by <strong>{lastModifiedBy}</strong> on{' '}
    {new Date(lastModifiedAt).toLocaleString()}
  </div>
)}
```

---

# Priority 3: Granular Permissions Implementation

## Goal
Separate permissions for different aspects of schedule login configuration, preventing self-exemption attacks.

## Duration
8-12 hours

---

## Task 3.1: Add New Permissions to RBAC

**Update File:** `src/lib/rbac.ts`

Add new permissions (insert before SUPERADMIN_ALL, around line 398):

```typescript
// Schedule Login Security - Granular Permissions
SCHEDULE_LOGIN_CONFIG_VIEW: 'schedule_login.config.view',
SCHEDULE_LOGIN_CONFIG_EDIT: 'schedule_login.config.edit',
SCHEDULE_LOGIN_EXEMPTION_MANAGE: 'schedule_login.exemption.manage',
SCHEDULE_LOGIN_FEATURE_TOGGLE: 'schedule_login.feature.toggle',
SCHEDULE_LOGIN_AUDIT_VIEW: 'schedule_login.audit.view',
```

---

## Task 3.2: Update Default Roles

**Update File:** `src/lib/rbac.ts`

**System Administrator** (already has ALL permissions, no change needed)

**Business Settings Manager** (update around line 563-572):

```typescript
BUSINESS_SETTINGS_MANAGER: {
  name: 'Business Settings Manager',
  description: 'Configures business settings and preferences',
  category: 'Administrative',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BUSINESS_SETTINGS_VIEW,
    PERMISSIONS.BUSINESS_SETTINGS_EDIT,
    // Schedule login - can configure grace periods but NOT exemptions
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW,
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_EDIT,
    // Does NOT have: EXEMPTION_MANAGE or FEATURE_TOGGLE
  ],
},
```

**Branch Manager** (update around line 1368):

```typescript
BRANCH_MANAGER: {
  name: 'Branch Manager',
  description: 'Full operational control of a branch (no user/role management)',
  category: 'Convenience Admin',
  permissions: [
    // ... existing permissions ...
    PERMISSIONS.BUSINESS_SETTINGS_VIEW,
    PERMISSIONS.BUSINESS_SETTINGS_EDIT,
    // Schedule login - can configure grace periods but NOT exemptions
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW,
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_EDIT,
    // Does NOT have: EXEMPTION_MANAGE or FEATURE_TOGGLE
    // ... other permissions ...
  ],
},
```

---

## Task 3.3: Create New Roles

**Add to File:** `src/lib/rbac.ts` (around line 1340)

```typescript
HR_MANAGER: {
  name: 'HR Manager',
  description: 'Manages employee schedules, attendance, and schedule login settings',
  category: 'HR & Scheduling',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USER_VIEW,

    // Scheduling
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.SCHEDULE_DELETE,
    PERMISSIONS.SCHEDULE_ASSIGN,
    PERMISSIONS.SCHEDULE_MANAGE_ALL,

    // Attendance
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.ATTENDANCE_REPORT,

    // Leave requests
    PERMISSIONS.LEAVE_REQUEST_VIEW_ALL,
    PERMISSIONS.LEAVE_REQUEST_APPROVE,
    PERMISSIONS.LEAVE_REQUEST_REJECT,
    PERMISSIONS.LEAVE_REQUEST_MANAGE,

    // Location changes
    PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW,
    PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE,
    PERMISSIONS.LOCATION_CHANGE_REQUEST_REJECT,

    // Overtime
    PERMISSIONS.OVERTIME_VIEW_ALL,
    PERMISSIONS.OVERTIME_APPROVE,
    PERMISSIONS.OVERTIME_CONFIGURE,
    PERMISSIONS.OVERTIME_ALERTS_VIEW,
    PERMISSIONS.OVERTIME_ALERTS_ACKNOWLEDGE,
    PERMISSIONS.OVERTIME_ALERTS_MANAGE,

    // Schedule login - can configure grace periods but NOT exemptions
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW,
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_EDIT,
    // Does NOT have: EXEMPTION_MANAGE or FEATURE_TOGGLE
  ],
},

COMPLIANCE_AUDITOR: {
  name: 'Compliance Auditor',
  description: 'Reviews security settings and audit logs (read-only)',
  category: 'Administrative',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,

    // Audit access
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.SCHEDULE_LOGIN_AUDIT_VIEW,

    // View-only settings access
    PERMISSIONS.BUSINESS_SETTINGS_VIEW,
    PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW,

    // View-only user/role access
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.ROLE_VIEW,

    // View-only reports
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.ATTENDANCE_REPORT,
  ],
},
```

---

## Task 3.4: Update API Route with Granular Checks

**Update File:** `src/app/api/schedule-login-config/route.ts`

**GET endpoint** (around line 11):

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Updated permission check - use granular permission
    const permissions = user.permissions || []
    if (!permissions.includes(PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW) &&
        !permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_VIEW)) {
      return NextResponse.json({
        error: 'You do not have permission to view schedule login configuration'
      }, { status: 403 })
    }

    // ... rest of GET logic
  }
}
```

**PUT endpoint** (around line 70):

```typescript
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const permissions = user.permissions || []

    const body = await request.json()

    // Field-level permission checks

    // Check: Can user edit exempt roles?
    if (body.exemptRoles !== undefined) {
      if (!permissions.includes(PERMISSIONS.SCHEDULE_LOGIN_EXEMPTION_MANAGE)) {
        return NextResponse.json({
          error: 'You do not have permission to modify exempt roles. Contact a System Administrator.'
        }, { status: 403 })
      }
    }

    // Check: Can user toggle the feature?
    if (body.enforceScheduleLogin !== undefined) {
      if (!permissions.includes(PERMISSIONS.SCHEDULE_LOGIN_FEATURE_TOGGLE)) {
        return NextResponse.json({
          error: 'You do not have permission to enable/disable this feature. Contact a System Administrator.'
        }, { status: 403 })
      }
    }

    // Check: Can user edit grace periods and messages?
    if (body.earlyClockInGraceMinutes !== undefined ||
        body.lateClockOutGraceMinutes !== undefined ||
        body.tooEarlyMessage !== undefined ||
        body.tooLateMessage !== undefined) {
      if (!permissions.includes(PERMISSIONS.SCHEDULE_LOGIN_CONFIG_EDIT) &&
          !permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
        return NextResponse.json({
          error: 'You do not have permission to edit schedule login configuration'
        }, { status: 403 })
      }
    }

    // Validate grace periods
    if (body.earlyClockInGraceMinutes !== undefined &&
        (body.earlyClockInGraceMinutes < 0 || body.earlyClockInGraceMinutes > 240)) {
      return NextResponse.json({
        error: 'Early clock-in grace period must be between 0 and 240 minutes (4 hours)'
      }, { status: 400 })
    }

    if (body.lateClockOutGraceMinutes !== undefined &&
        (body.lateClockOutGraceMinutes < 0 || body.lateClockOutGraceMinutes > 240)) {
      return NextResponse.json({
        error: 'Late clock-out grace period must be between 0 and 240 minutes (4 hours)'
      }, { status: 400 })
    }

    // Validate exempt roles (existing logic)
    if (body.exemptRoles !== undefined) {
      const exemptRoleNames = body.exemptRoles
        .split(',')
        .map((r: string) => r.trim())
        .filter((r: string) => r.length > 0)

      if (exemptRoleNames.length > 0) {
        const existingRoles = await prisma.role.findMany({
          where: {
            businessId,
            name: { in: exemptRoleNames }
          },
          select: { name: true }
        })

        const existingRoleNames = existingRoles.map(r => r.name)
        const invalidRoles = exemptRoleNames.filter(
          (name: string) => !existingRoleNames.includes(name)
        )

        if (invalidRoles.length > 0) {
          return NextResponse.json({
            error: `The following role names do not exist: ${invalidRoles.join(', ')}`,
            invalidRoles
          }, { status: 400 })
        }
      }
    }

    // Update or create configuration
    const config = await prisma.scheduleLoginConfiguration.upsert({
      where: { businessId },
      create: {
        businessId,
        enforceScheduleLogin: body.enforceScheduleLogin ?? true,
        earlyClockInGraceMinutes: body.earlyClockInGraceMinutes ?? 30,
        lateClockOutGraceMinutes: body.lateClockOutGraceMinutes ?? 60,
        exemptRoles: body.exemptRoles ?? "Super Admin,System Administrator",
        tooEarlyMessage: body.tooEarlyMessage,
        tooLateMessage: body.tooLateMessage,
      },
      update: {
        ...(body.enforceScheduleLogin !== undefined && { enforceScheduleLogin: body.enforceScheduleLogin }),
        ...(body.earlyClockInGraceMinutes !== undefined && { earlyClockInGraceMinutes: body.earlyClockInGraceMinutes }),
        ...(body.lateClockOutGraceMinutes !== undefined && { lateClockOutGraceMinutes: body.lateClockOutGraceMinutes }),
        ...(body.exemptRoles !== undefined && { exemptRoles: body.exemptRoles }),
        ...(body.tooEarlyMessage !== undefined && { tooEarlyMessage: body.tooEarlyMessage }),
        ...(body.tooLateMessage !== undefined && { tooLateMessage: body.tooLateMessage }),
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'ScheduleLoginConfiguration',
        entityId: config.id,
        changes: body,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: 'Schedule login configuration updated successfully',
      configuration: config
    })
  } catch (error) {
    console.error('Error updating schedule login configuration:', error)
    return NextResponse.json({
      error: 'Failed to update schedule login configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
```

---

## Task 3.5: Update UI with Permission-Based Sections

**Update File:** `src/app/dashboard/settings/schedule-login/page.tsx`

Check permissions for each section:

```typescript
const { can } = usePermissions()

const canViewConfig = can(PERMISSIONS.SCHEDULE_LOGIN_CONFIG_VIEW) || can(PERMISSIONS.BUSINESS_SETTINGS_VIEW)
const canEditGrace = can(PERMISSIONS.SCHEDULE_LOGIN_CONFIG_EDIT) || can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)
const canEditExempt = can(PERMISSIONS.SCHEDULE_LOGIN_EXEMPTION_MANAGE)
const canToggleFeature = can(PERMISSIONS.SCHEDULE_LOGIN_FEATURE_TOGGLE)

// Use throughout component:
// - Feature toggle: disabled={!canToggleFeature}
// - Grace period inputs: disabled={!canEditGrace}
// - Exempt roles selector: disabled={!canEditExempt}
// - Save button: visible only if user can edit SOMETHING
```

---

## Task 3.6: Run Permission Migration

**Create File:** `migrations/add-schedule-login-granular-permissions.sql`

```sql
-- Add granular schedule login permissions
INSERT INTO permission (name, description, created_at, updated_at)
VALUES
  ('schedule_login.config.view', 'View schedule login configuration', NOW(), NOW()),
  ('schedule_login.config.edit', 'Edit schedule login grace periods and messages', NOW(), NOW()),
  ('schedule_login.exemption.manage', 'Manage exempt roles list (high security)', NOW(), NOW()),
  ('schedule_login.feature.toggle', 'Enable/disable schedule login feature', NOW(), NOW()),
  ('schedule_login.audit.view', 'View schedule login audit logs', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Get permission IDs (adjust based on your actual IDs)
-- You'll need to query these first, then update the script
DO $$
DECLARE
  perm_view_id INT;
  perm_edit_id INT;
  perm_exempt_id INT;
  perm_toggle_id INT;
  perm_audit_id INT;
  role_sysadmin_id INT;
  role_hr_id INT;
  role_auditor_id INT;
BEGIN
  -- Get permission IDs
  SELECT id INTO perm_view_id FROM permission WHERE name = 'schedule_login.config.view';
  SELECT id INTO perm_edit_id FROM permission WHERE name = 'schedule_login.config.edit';
  SELECT id INTO perm_exempt_id FROM permission WHERE name = 'schedule_login.exemption.manage';
  SELECT id INTO perm_toggle_id FROM permission WHERE name = 'schedule_login.feature.toggle';
  SELECT id INTO perm_audit_id FROM permission WHERE name = 'schedule_login.audit.view';

  -- Assign to System Administrator (all permissions)
  FOR role_sysadmin_id IN (SELECT id FROM role WHERE name = 'System Administrator')
  LOOP
    INSERT INTO role_permission (role_id, permission_id, created_at, updated_at)
    VALUES
      (role_sysadmin_id, perm_view_id, NOW(), NOW()),
      (role_sysadmin_id, perm_edit_id, NOW(), NOW()),
      (role_sysadmin_id, perm_exempt_id, NOW(), NOW()),
      (role_sysadmin_id, perm_toggle_id, NOW(), NOW()),
      (role_sysadmin_id, perm_audit_id, NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Assign to HR Manager (view + edit, but NOT exempt or toggle)
  FOR role_hr_id IN (SELECT id FROM role WHERE name = 'HR Manager')
  LOOP
    INSERT INTO role_permission (role_id, permission_id, created_at, updated_at)
    VALUES
      (role_hr_id, perm_view_id, NOW(), NOW()),
      (role_hr_id, perm_edit_id, NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Assign to Compliance Auditor (view + audit only)
  FOR role_auditor_id IN (SELECT id FROM role WHERE name = 'Compliance Auditor')
  LOOP
    INSERT INTO role_permission (role_id, permission_id, created_at, updated_at)
    VALUES
      (role_auditor_id, perm_view_id, NOW(), NOW()),
      (role_auditor_id, perm_audit_id, NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
```

**Run Migration:**
```bash
psql -h localhost -U postgres -d ultimatepos_modern -f migrations/add-schedule-login-granular-permissions.sql
```

---

## Task 3.7: Update Prisma Client

```bash
npx prisma generate
```

---

## Task 3.8: Test Permission Enforcement

**Test Matrix:**

| User Role | Can View? | Can Edit Grace? | Can Edit Exempt? | Can Toggle? |
|-----------|-----------|----------------|------------------|-------------|
| System Admin | ✓ | ✓ | ✓ | ✓ |
| HR Manager | ✓ | ✓ | ✗ | ✗ |
| Compliance Auditor | ✓ | ✗ | ✗ | ✗ |
| Branch Manager | ✓ | ✓ | ✗ | ✗ |
| Sales Cashier | ✗ | ✗ | ✗ | ✗ |

**Test each scenario:**
1. Login as each user type
2. Navigate to Schedule Login Settings
3. Verify permissions match expected results
4. Attempt to save (should be blocked if no edit permission)
5. Attempt to modify exempt roles (should require EXEMPTION_MANAGE)

---

# Testing & Validation

## Test Plan

### Test Suite 1: Role Validation UI

**Test 1.1: Role Dropdown Population**
- Login as admin
- Navigate to Schedule Login Settings
- Verify dropdown shows all business roles
- Verify roles are sorted alphabetically

**Test 1.2: Invalid Role Prevention**
- Add a role to exempt list
- Verify role name is validated
- Verify error message if role doesn't exist

**Test 1.3: Warning for Non-Admin Roles**
- Add "Branch Manager" to exempt list
- Verify yellow warning appears
- Verify confirmation dialog on save

**Test 1.4: Role Removal**
- Add multiple roles to exempt list
- Click × to remove a role
- Verify role is removed
- Verify save works correctly

---

### Test Suite 2: Granular Permissions

**Test 2.1: HR Manager Permissions**
- Login as HR Manager
- Verify can view configuration
- Verify can edit grace periods
- Verify CANNOT edit exempt roles (field disabled)
- Verify CANNOT toggle feature (toggle disabled)
- Attempt API call to modify exempt roles → should return 403

**Test 2.2: Compliance Auditor Permissions**
- Login as Compliance Auditor
- Verify can view configuration
- Verify all inputs are disabled
- Verify save button is hidden
- Verify can view audit logs

**Test 2.3: System Admin Permissions**
- Login as System Admin
- Verify full access to all fields
- Verify can save all changes
- All operations should succeed

---

### Test Suite 3: Self-Exemption Prevention

**Before Enhancement:**
- Login as Branch Manager
- Add "Branch Manager" to exempt list
- Save configuration
- Logout and login outside hours → Allowed ⚠️

**After Enhancement:**
- Login as Branch Manager
- Attempt to modify exempt roles → Blocked (no EXEMPTION_MANAGE permission)
- Field is disabled or API returns 403
- Self-exemption prevented ✓

---

## Rollback Plan

If issues arise after implementing Priority 3:

**Step 1: Disable granular permission checks**
```typescript
// In API route, temporarily bypass granular checks:
const permissions = user.permissions || []
const isSuperAdmin = permissions.includes('superadmin.all')

if (!isSuperAdmin && !permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Skip granular checks, allow BUSINESS_SETTINGS_EDIT to do everything
```

**Step 2: Roll back database migration**
```sql
-- Remove granular permissions
DELETE FROM role_permission
WHERE permission_id IN (
  SELECT id FROM permission
  WHERE name LIKE 'schedule_login.%'
);

DELETE FROM permission
WHERE name LIKE 'schedule_login.%';
```

**Step 3: Revert code changes**
```bash
git checkout HEAD~1 src/app/api/schedule-login-config/route.ts
git checkout HEAD~1 src/app/dashboard/settings/schedule-login/page.tsx
git checkout HEAD~1 src/lib/rbac.ts
```

---

## Success Criteria

### Priority 1: Documentation
- [ ] Exempt roles policy documented
- [ ] User guide section added
- [ ] Current configurations audited
- [ ] Users with edit permissions reviewed

### Priority 2: Role Validation UI
- [ ] Role dropdown populated from database
- [ ] Invalid role names prevented
- [ ] Warning shown for non-admin exempt roles
- [ ] Confirmation dialog before saving
- [ ] "Last modified by" info displayed

### Priority 3: Granular Permissions
- [ ] 5 new permissions added to RBAC
- [ ] HR Manager role created and tested
- [ ] Compliance Auditor role created and tested
- [ ] API enforces field-level permissions
- [ ] UI respects permission-based access
- [ ] Self-exemption attack prevented
- [ ] All tests passing

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Priority 1: Documentation | 2 hours | None |
| Priority 2: Role Validation | 6 hours | Priority 1 complete |
| Priority 3: Granular Permissions | 12 hours | Priority 2 complete |
| Testing & QA | 4 hours | All priorities complete |
| **Total** | **24 hours** | Sequential implementation |

---

**Guide Version:** 1.0
**Created:** 2025-10-23
**System:** UltimatePOS Modern
**Feature:** Schedule Login RBAC Enhancement
