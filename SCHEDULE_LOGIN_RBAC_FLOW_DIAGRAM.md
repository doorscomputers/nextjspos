# Schedule Login RBAC Flow Diagram

## Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER LOGIN ATTEMPT                              │
│                     (Username + Password)                               │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   CREDENTIAL VERIFICATION                               │
│                 (src/lib/auth.ts, line 28-74)                          │
│  • Check username exists                                                │
│  • Verify password with bcrypt                                          │
│  • Check allowLogin flag                                                │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              LOAD SCHEDULE LOGIN CONFIGURATION                          │
│                 (src/lib/auth.ts, line 76-94)                          │
│                                                                         │
│  Query: SELECT * FROM schedule_login_configurations                    │
│         WHERE business_id = user.businessId                            │
│                                                                         │
│  If NOT EXISTS → Create default configuration:                        │
│    • enforceScheduleLogin: true                                        │
│    • earlyClockInGraceMinutes: 30                                      │
│    • lateClockOutGraceMinutes: 60                                      │
│    • exemptRoles: "Super Admin,System Administrator,..."              │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHECK IF FEATURE ENABLED                             │
│                 (src/lib/auth.ts, line 97)                             │
│                                                                         │
│                config.enforceScheduleLogin === true?                    │
│                                                                         │
└─────────────┬───────────────────────────────────────────┬───────────────┘
              │                                           │
              │ NO (disabled)                             │ YES (enabled)
              │                                           │
              ▼                                           ▼
    ┌──────────────────────┐           ┌─────────────────────────────────┐
    │  ALLOW LOGIN         │           │  CHECK USER ROLES                │
    │  (Skip restrictions) │           │  (src/lib/auth.ts, line 98-102)│
    └──────────────────────┘           │                                 │
                                       │  User roles:                    │
                                       │  ["Branch Manager", "Cashier"]  │
                                       │                                 │
                                       │  Exempt roles from config:      │
                                       │  ["Super Admin",                │
                                       │   "System Administrator"]       │
                                       └────────┬─────────────────┬──────┘
                                                │                 │
                                    Does user have ANY exempt role?
                                                │                 │
                                        YES ────┘                 └──── NO
                                         │                               │
                                         ▼                               ▼
                            ┌──────────────────────┐      ┌──────────────────────────┐
                            │  ALLOW LOGIN         │      │  CHECK SCHEDULE          │
                            │  (Exempt role)       │      │  (src/lib/auth.ts,       │
                            │                      │      │   line 105-148)          │
                            │  Examples:           │      └──────────┬───────────────┘
                            │  • Super Admin       │                 │
                            │  • System Admin      │                 ▼
                            │  • (configurable)    │      ┌──────────────────────────┐
                            └──────────────────────┘      │  GET TODAY'S SCHEDULE    │
                                                          │                          │
                                                          │  Query: SELECT * FROM    │
                                                          │  employee_schedule       │
                                                          │  WHERE user_id = ? AND   │
                                                          │  day_of_week = 'Monday'  │
                                                          └────────┬─────────────────┘
                                                                   │
                                                ┌──────────────────┴──────────────────┐
                                                │                                     │
                                         NO SCHEDULE                           SCHEDULE EXISTS
                                          (for today)                          (startTime, endTime)
                                                │                                     │
                                                ▼                                     ▼
                                    ┌──────────────────────┐      ┌─────────────────────────────────┐
                                    │  ALLOW LOGIN         │      │  APPLY GRACE PERIODS            │
                                    │  (No schedule        │      │  (src/lib/auth.ts, line 120-147)│
                                    │   = no restriction)  │      │                                 │
                                    └──────────────────────┘      │  Current Time: 9:30 AM          │
                                                                  │  Schedule: 9:00 AM - 6:00 PM    │
                                                                  │                                 │
                                                                  │  Early Grace: 30 min            │
                                                                  │  Late Grace: 60 min             │
                                                                  │                                 │
                                                                  │  Allowed Window:                │
                                                                  │  8:30 AM ─────────────── 7:00 PM│
                                                                  └────────┬────────────────────────┘
                                                                           │
                                                        ┌──────────────────┴──────────────────┐
                                                        │                                     │
                                                 WITHIN WINDOW                         OUTSIDE WINDOW
                                              (8:30 AM - 7:00 PM)                   (before 8:30 or after 7:00)
                                                        │                                     │
                                                        ▼                                     ▼
                                            ┌──────────────────────┐          ┌─────────────────────────────┐
                                            │  ALLOW LOGIN         │          │  BLOCK LOGIN                │
                                            │  (Within grace)      │          │  (src/lib/auth.ts,          │
                                            └──────────────────────┘          │   line 129-147)             │
                                                                              │                             │
                                                                              │  Throw Error:               │
                                                                              │  • Too Early Message        │
                                                                              │  • Too Late Message         │
                                                                              │  (Custom or default)        │
                                                                              └─────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                     LOGIN SUCCESSFUL PATH                               │
│                 (src/lib/auth.ts, line 176-217)                        │
│                                                                         │
│  1. Collect Permissions:                                               │
│     • From Roles: role.permissions[]                                   │
│     • Direct Permissions: user.permissions[]                           │
│     • Super Admin → ALL permissions                                    │
│                                                                         │
│  2. Collect Location IDs:                                              │
│     • Priority 1: user.userLocations[]                                 │
│     • Priority 2: role.locations[]                                     │
│                                                                         │
│  3. Create Session Token with:                                         │
│     • userId, username, businessId                                     │
│     • permissions[], roles[]                                           │
│     • locationIds[]                                                    │
│                                                                         │
│  4. Create Audit Log:                                                  │
│     • Action: USER_LOGIN                                               │
│     • Timestamp, IP, User Agent                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Management Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  USER NAVIGATES TO SETTINGS PAGE                        │
│         /dashboard/settings/schedule-login                              │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CHECK PERMISSIONS (UI)                              │
│   (src/app/dashboard/settings/schedule-login/page.tsx, line 101-111)  │
│                                                                         │
│                  user.permissions.includes(                             │
│                   BUSINESS_SETTINGS_VIEW                                │
│                  )                                                      │
│                                                                         │
└─────────────┬───────────────────────────────────────────┬───────────────┘
              │                                           │
           NO │                                           │ YES
              │                                           │
              ▼                                           ▼
    ┌──────────────────────┐           ┌─────────────────────────────────┐
    │  SHOW ERROR          │           │  LOAD CONFIGURATION              │
    │  "You do not have    │           │                                 │
    │   permission to      │           │  GET /api/schedule-login-config │
    │   view this page"    │           └────────┬────────────────────────┘
    └──────────────────────┘                    │
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │    API PERMISSION CHECK (Server-Side)        │
                          │    (src/app/api/schedule-login-config/       │
                          │     route.ts, line 24-28)                    │
                          │                                              │
                          │    session.user.permissions.includes(        │
                          │      BUSINESS_SETTINGS_VIEW ||               │
                          │      BUSINESS_SETTINGS_EDIT                  │
                          │    )                                         │
                          └────────┬─────────────────┬───────────────────┘
                                   │                 │
                                NO │                 │ YES
                                   │                 │
                                   ▼                 ▼
                        ┌──────────────────┐   ┌─────────────────────────┐
                        │  HTTP 403        │   │  FETCH FROM DATABASE    │
                        │  Forbidden       │   │                         │
                        └──────────────────┘   │  SELECT * FROM          │
                                               │  schedule_login_configs │
                                               │  WHERE business_id = ?  │
                                               └────────┬────────────────┘
                                                        │
                                         ┌──────────────┴──────────────┐
                                         │                             │
                                    NOT FOUND                       EXISTS
                                         │                             │
                                         ▼                             ▼
                              ┌──────────────────────┐    ┌────────────────────┐
                              │  CREATE DEFAULT      │    │  RETURN CONFIG     │
                              │  CONFIGURATION       │    │  TO UI             │
                              │                      │    └────────────────────┘
                              │  INSERT INTO         │
                              │  schedule_login_...  │
                              │  (default values)    │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  RETURN NEW CONFIG   │
                              │  TO UI               │
                              └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    UI DISPLAYS CONFIGURATION FORM                       │
│                                                                         │
│  Check user.permissions.includes(BUSINESS_SETTINGS_EDIT)               │
│                                                                         │
└─────────────┬───────────────────────────────────────────┬───────────────┘
              │                                           │
       NO (view only)                                     │ YES (can edit)
              │                                           │
              ▼                                           ▼
    ┌──────────────────────┐           ┌─────────────────────────────────┐
    │  FORM READ-ONLY      │           │  FORM EDITABLE                  │
    │  • All inputs        │           │  • All inputs enabled           │
    │    disabled          │           │  • Save button visible          │
    │  • Save button       │           │                                 │
    │    hidden            │           │  User can modify:               │
    │                      │           │  • Feature toggle               │
    │  User can only       │           │  • Grace periods                │
    │  view current        │           │  • Exempt roles                 │
    │  settings            │           │  • Error messages               │
    └──────────────────────┘           └────────┬────────────────────────┘
                                                 │
                                        USER CLICKS SAVE
                                                 │
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │    API PERMISSION CHECK (Server-Side)        │
                          │    (src/app/api/schedule-login-config/       │
                          │     route.ts, line 84-87)                    │
                          │                                              │
                          │    session.user.permissions.includes(        │
                          │      BUSINESS_SETTINGS_EDIT                  │
                          │    ) [STRICT CHECK - EDIT REQUIRED]          │
                          └────────┬─────────────────┬───────────────────┘
                                   │                 │
                                NO │                 │ YES
                                   │                 │
                                   ▼                 ▼
                        ┌──────────────────┐   ┌─────────────────────────┐
                        │  HTTP 403        │   │  VALIDATE INPUT         │
                        │  Forbidden       │   │                         │
                        └──────────────────┘   │  • Grace periods:       │
                                               │    0-240 minutes        │
                                               │  • Role names: string   │
                                               │  • Messages: optional   │
                                               └────────┬────────────────┘
                                                        │
                                         ┌──────────────┴──────────────┐
                                         │                             │
                                   VALIDATION FAILS              VALIDATION PASSES
                                         │                             │
                                         ▼                             ▼
                              ┌──────────────────────┐    ┌────────────────────────┐
                              │  HTTP 400            │    │  UPDATE DATABASE       │
                              │  Bad Request         │    │                        │
                              │  (Error message)     │    │  UPSERT schedule_login │
                              └──────────────────────┘    │  SET grace_minutes = ? │
                                                          │  SET exempt_roles = ?  │
                                                          └────────┬───────────────┘
                                                                   │
                                                                   ▼
                                                          ┌────────────────────────┐
                                                          │  CREATE AUDIT LOG      │
                                                          │                        │
                                                          │  INSERT INTO audit_log │
                                                          │  (action, user, IP,    │
                                                          │   changes, timestamp)  │
                                                          └────────┬───────────────┘
                                                                   │
                                                                   ▼
                                                          ┌────────────────────────┐
                                                          │  HTTP 200 OK           │
                                                          │  Success message       │
                                                          │  Updated configuration │
                                                          └────────────────────────┘
```

---

## Permission Inheritance Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER: branch_manager_01                          │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ASSIGNED ROLES                                  │
│                                                                         │
│  UserRole Table:                                                        │
│    user_id: 123                                                         │
│    role_id: 5  → "Branch Manager"                                      │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROLE PERMISSIONS                                     │
│                                                                         │
│  Role: "Branch Manager" (DEFAULT_ROLES.BRANCH_MANAGER)                 │
│  Category: Convenience Admin                                           │
│  Lines in rbac.ts: 1368-1572                                           │
│                                                                         │
│  Permissions Include:                                                  │
│    ✓ DASHBOARD_VIEW                                                    │
│    ✓ BUSINESS_SETTINGS_VIEW                                            │
│    ✓ BUSINESS_SETTINGS_EDIT      ← GRANTS SCHEDULE LOGIN CONFIG      │
│    ✓ PRODUCT_VIEW                                                      │
│    ✓ PURCHASE_APPROVE                                                  │
│    ... (many others)                                                   │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DIRECT PERMISSIONS                                   │
│                    (UserPermission table)                               │
│                                                                         │
│  User may also have direct permissions:                                │
│    user_id: 123                                                         │
│    permission_id: 42 → "ACCESS_ALL_LOCATIONS"                          │
│                                                                         │
│  These are ADDED to role permissions                                   │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FINAL PERMISSION SET                                 │
│                    (Session user.permissions[])                         │
│                                                                         │
│  Collected from:                                                        │
│    1. Role Permissions (role.permissions)                              │
│    2. Direct Permissions (user.permissions)                            │
│    3. De-duplicated (Set)                                              │
│                                                                         │
│  Special Case:                                                          │
│    If user has role "Super Admin" → ALL permissions automatically     │
│                                                                         │
│  Result for branch_manager_01:                                         │
│    [                                                                    │
│      "dashboard.view",                                                  │
│      "business_settings.view",      ← Can VIEW config                 │
│      "business_settings.edit",      ← Can EDIT config                 │
│      "product.view",                                                    │
│      "access_all_locations",                                            │
│      ... (100+ permissions)                                             │
│    ]                                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECK EXAMPLE                             │
│                                                                         │
│  Code: can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)                         │
│                                                                         │
│  Function: hasPermission(user, "business_settings.edit")               │
│  (src/lib/rbac.ts, line 32-38)                                         │
│                                                                         │
│  Logic:                                                                 │
│    1. Check if user is Super Admin → return true                      │
│    2. Check if "business_settings.edit" in user.permissions[]         │
│    3. Return true/false                                                │
│                                                                         │
│  Result for branch_manager_01: TRUE ✓                                  │
│  Result for sales_cashier_01: FALSE ✗                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Role Exemption Check Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER LOGIN ATTEMPT                               │
│                      (After credential check)                           │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   GET USER ROLE NAMES                                   │
│                   (src/lib/auth.ts, line 98)                           │
│                                                                         │
│  const roleNames = user.roles.map(ur => ur.role.name)                  │
│                                                                         │
│  Example result:                                                        │
│    User A: ["Branch Manager", "Inventory Manager"]                     │
│    User B: ["Super Admin"]                                             │
│    User C: ["Sales Cashier"]                                           │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               GET EXEMPT ROLES FROM CONFIGURATION                       │
│               (src/lib/auth.ts, line 101)                              │
│                                                                         │
│  config.exemptRoles = "Super Admin,System Administrator,Admin"         │
│                                                                         │
│  Parse and trim:                                                        │
│    exemptRolesList = config.exemptRoles                                │
│                       .split(',')                                       │
│                       .map(r => r.trim())                              │
│                                                                         │
│  Result:                                                                │
│    ["Super Admin", "System Administrator", "Admin"]                    │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  CHECK FOR ROLE OVERLAP                                 │
│            (src/lib/auth.ts, line 102)                                 │
│                                                                         │
│  const isExemptRole = roleNames.some(role =>                           │
│    exemptRolesList.includes(role)                                      │
│  )                                                                      │
│                                                                         │
│  Logic: Does user have ANY role in the exempt list?                    │
│         (Not ALL, just ANY)                                             │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXAMPLES                                         │
│                                                                         │
│  User A: ["Branch Manager", "Inventory Manager"]                       │
│  Exempt: ["Super Admin", "System Administrator", "Admin"]              │
│  Overlap? NO → isExemptRole = false → Apply schedule restrictions     │
│                                                                         │
│  User B: ["Super Admin"]                                               │
│  Exempt: ["Super Admin", "System Administrator", "Admin"]              │
│  Overlap? YES → isExemptRole = true → Skip schedule restrictions      │
│                                                                         │
│  User C: ["Sales Cashier"]                                             │
│  Exempt: ["Super Admin", "System Administrator", "Admin"]              │
│  Overlap? NO → isExemptRole = false → Apply schedule restrictions     │
│                                                                         │
│  User D: ["Branch Manager", "Admin"]  (multiple roles)                 │
│  Exempt: ["Super Admin", "System Administrator", "Admin"]              │
│  Overlap? YES (has "Admin") → isExemptRole = true → Skip restrictions │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SECURITY CONSIDERATION                             │
│                                                                         │
│  Problem: User with BUSINESS_SETTINGS_EDIT can add their own role      │
│           to the exempt list!                                           │
│                                                                         │
│  Example Attack:                                                        │
│    1. Branch Manager has BUSINESS_SETTINGS_EDIT                        │
│    2. Opens Schedule Login Settings                                    │
│    3. Changes exempt roles from:                                       │
│       "Super Admin,System Administrator"                               │
│       to:                                                               │
│       "Super Admin,System Administrator,Branch Manager"                │
│    4. Saves configuration                                               │
│    5. Now can login anytime!                                           │
│                                                                         │
│  Mitigation Needed:                                                     │
│    • Separate permission: SCHEDULE_LOGIN_EXEMPTION_MANAGE              │
│    • Only Super Admins should have this permission                     │
│    • UI warning when modifying exempt roles                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Isolation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUSINESS ISOLATION                              │
│                                                                         │
│  Every operation is scoped by businessId from session                  │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE STRUCTURE                                   │
│                                                                         │
│  Business 1 (businessId: 1)                                            │
│  ├── Configuration 1                                                    │
│  │   ├── enforceScheduleLogin: true                                    │
│  │   ├── earlyGrace: 30                                                │
│  │   ├── lateGrace: 60                                                 │
│  │   └── exemptRoles: "Super Admin,System Administrator"              │
│  │                                                                      │
│  ├── Users (businessId = 1)                                            │
│  │   ├── User 1: Super Admin                                           │
│  │   ├── User 2: Branch Manager                                        │
│  │   └── User 3: Sales Cashier                                         │
│  │                                                                      │
│  └── Schedules (businessId = 1)                                        │
│      ├── Schedule for User 2: 9 AM - 6 PM                              │
│      └── Schedule for User 3: 8 AM - 5 PM                              │
│                                                                         │
│  Business 2 (businessId: 2)                                            │
│  ├── Configuration 2                                                    │
│  │   ├── enforceScheduleLogin: false  (DIFFERENT CONFIG!)             │
│  │   ├── earlyGrace: 15                                                │
│  │   ├── lateGrace: 120                                                │
│  │   └── exemptRoles: "Admin,Manager"                                 │
│  │                                                                      │
│  ├── Users (businessId = 2)                                            │
│  │   ├── User 4: Admin                                                 │
│  │   └── User 5: Store Clerk                                           │
│  │                                                                      │
│  └── Schedules (businessId = 2)                                        │
│      └── Schedule for User 5: 10 AM - 7 PM                             │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ISOLATION ENFORCEMENT                                │
│                                                                         │
│  Authentication (src/lib/auth.ts):                                     │
│    • Gets businessId from user record                                  │
│    • Loads config WHERE business_id = user.businessId                 │
│    • Gets schedules WHERE business_id = user.businessId               │
│                                                                         │
│  API Routes (src/app/api/schedule-login-config/route.ts):             │
│    • Gets businessId from session.user.businessId                      │
│    • All queries WHERE business_id = businessId                        │
│    • Cannot access other businesses' configurations                    │
│                                                                         │
│  Result:                                                                │
│    • Business 1 cannot see Business 2's configuration                  │
│    • Business 2 cannot modify Business 1's settings                    │
│    • Complete data isolation                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**Created:** 2025-10-23
**Diagram Version:** 1.0
**System:** UltimatePOS Modern - Schedule Login RBAC Flows
