# Menu Permissions System - Complete Guide

## Overview

This system provides **two-layer access control**:

1. **RBAC Permissions** - Controls what API actions users can perform (backend)
2. **Menu Permissions** - Controls which sidebar menus users can see (frontend)

**Important:** Both systems work together. A user needs BOTH:
- The menu permission to see the menu item in the sidebar
- The RBAC permission to access the underlying API endpoints

---

## Table of Contents

- [Quick Start](#quick-start)
- [System Architecture](#system-architecture)
- [Managing Menu Permissions (UI)](#managing-menu-permissions-ui)
- [Protecting Routes](#protecting-routes)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### For Administrators

**Assign menus to a user:**
1. Go to Settings → User Menu Manager
2. Click "By User" tab
3. Select the user from dropdown
4. Check the menus they should see
5. Click "Save User Menus"
6. User must log out and log back in to see changes

**Assign menus to a role:**
1. Go to Settings → User Menu Manager
2. Click "By Role" tab
3. Select the role from dropdown
4. Check the menus that role should see
5. Click "Save Role Menus"
6. All users with that role will see those menus after re-login

### For Developers

**Protect a new page:**

```tsx
import { RouteProtection } from "@/components/RouteProtection"

export default function MyNewPage() {
  return (
    <RouteProtection requiredMenuKey="purchases">
      {/* Your page content */}
      <div>Only users with 'purchases' menu permission can see this</div>
    </RouteProtection>
  )
}
```

---

## System Architecture

### Flow Diagram

```
User Login
    ↓
Auth System collects:
- User's roles
- RBAC permissions (from roles + direct)
    ↓
Sidebar loads:
- Fetches menu permissions from API
- Shows only accessible menus
    ↓
User clicks menu item:
- Route renders
- RouteProtection checks menu permission
- If denied: redirect to dashboard
- If allowed: show page content
    ↓
User performs action:
- API checks RBAC permission
- If denied: 403 error
- If allowed: action succeeds
```

### Database Models

```prisma
// Defines available menu items
model MenuPermission {
  id       Int     @id @default(autoincrement())
  key      String  @unique  // e.g., "purchases"
  name     String            // e.g., "Purchases"
  href     String?           // e.g., "/dashboard/purchases"
  parentId Int?              // For nested menus
  order    Int               // Display order
}

// Links roles to menus
model RoleMenuPermission {
  roleId           Int
  menuPermissionId Int
  role             Role
  menuPermission   MenuPermission
}

// Links users to menus (overrides role)
model UserMenuPermission {
  userId           Int
  menuPermissionId Int
  user             User
  menuPermission   MenuPermission
}
```

---

## Managing Menu Permissions (UI)

### Accessing the Manager

1. Navigate to: **Settings → User Menu Manager** (route: `/dashboard/settings/user-menu-manager`)
2. Requires: `USER_UPDATE` or `ROLE_UPDATE` RBAC permission
3. Super Admin always has access

### User-Specific Menus

Use this when you want to give a specific user access to menus their role doesn't have.

**Steps:**
1. Select "By User" tab
2. Choose user from dropdown
3. Check/uncheck menus
4. Click "Save User Menus"

**Use cases:**
- Temporary elevated access
- User needs one extra menu their role doesn't have
- Testing/debugging specific user access

### Role-Based Menus

Use this to configure standard access for all users with a role.

**Steps:**
1. Select "By Role" tab
2. Choose role from dropdown
3. Check/uncheck menus
4. Click "Save Role Menus"

**Use cases:**
- Standard configuration for Cashier, Manager, Admin roles
- Bulk updates for multiple users
- Consistent access across team members

### Menu Hierarchy

Menus are organized in a tree structure:

```
Dashboard
Products
  ├── Product List
  ├── Add Product
  ├── Categories
  └── Brands
Purchases
  ├── List Purchases
  ├── Add Purchase
  ├── Goods Received
  └── Accounts Payable
```

**Important:**
- Checking a parent menu does NOT automatically check children
- Use "Select All" button to quickly select all child menus
- Users need BOTH parent AND child menu permissions to see nested items

---

## Protecting Routes

### Method 1: Component Wrapper (Recommended)

```tsx
import { RouteProtection } from "@/components/RouteProtection"

export default function PurchasesPage() {
  return (
    <RouteProtection
      requiredMenuKey="purchases"
      fallbackUrl="/dashboard"
    >
      <div className="p-6">
        <h1>Purchases</h1>
        {/* Page content */}
      </div>
    </RouteProtection>
  )
}
```

### Method 2: Higher-Order Component

```tsx
import { withRouteProtection } from "@/components/RouteProtection"

function PurchasesPage() {
  return (
    <div className="p-6">
      <h1>Purchases</h1>
      {/* Page content */}
    </div>
  )
}

export default withRouteProtection(PurchasesPage, 'purchases')
```

### Method 3: Hook-Based Check

```tsx
"use client"

import { useEffect, useState } from "react"
import { usePermissions } from "@/hooks/usePermissions"

export default function PurchasesPage() {
  const { user } = usePermissions()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const res = await fetch(`/api/settings/menu-permissions/user/${user?.id}`)
      const data = await res.json()
      const keys = data.data?.accessibleMenuKeys || []
      setHasAccess(keys.includes('purchases'))
    }
    if (user?.id) checkAccess()
  }, [user])

  if (!hasAccess) {
    return <div>Access Denied</div>
  }

  return <div>Your page content</div>
}
```

---

## API Endpoints

### Get User's Menu Permissions

```http
GET /api/settings/menu-permissions/user/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 17,
    "username": "jayvillalon",
    "accessibleMenuKeys": ["dashboard", "purchases", "reports"]
  }
}
```

### Get Role's Menu Permissions

```http
GET /api/settings/menu-permissions/role/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "roleId": 95,
    "roleName": "Cross-Location Approver",
    "accessibleMenuKeys": ["dashboard", "purchases", "z_reading"]
  }
}
```

### Update User's Menu Permissions

```http
PUT /api/settings/menu-permissions/user/:id
Content-Type: application/json

{
  "menuPermissionIds": [1, 2, 3, 5, 8]
}
```

**Response:**
```json
{
  "success": true,
  "message": "User menu permissions updated successfully",
  "count": 5
}
```

### Update Role's Menu Permissions

```http
PUT /api/settings/menu-permissions/role/:id
Content-Type: application/json

{
  "menuPermissionIds": [1, 2, 3, 5, 8]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role menu permissions updated successfully",
  "count": 5
}
```

### Get All Menu Permissions (Hierarchical)

```http
GET /api/settings/menu-permissions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "flat": [...], // Array of all menus
    "hierarchy": [ // Nested structure
      {
        "id": 1,
        "key": "dashboard",
        "name": "Dashboard",
        "href": "/dashboard",
        "children": []
      },
      {
        "id": 3,
        "key": "purchases",
        "name": "Purchases",
        "href": null,
        "children": [
          {
            "id": 12,
            "key": "purchases_add",
            "name": "Add Purchase",
            "href": "/dashboard/purchases/create",
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

## Database Schema

### MenuPermission Table

| Column   | Type    | Description                              |
|----------|---------|------------------------------------------|
| id       | int     | Primary key                              |
| key      | string  | Unique identifier (e.g., "purchases")    |
| name     | string  | Display name (e.g., "Purchases")         |
| href     | string? | Route path (null for parent menus)       |
| parentId | int?    | ID of parent menu (null for root menus)  |
| order    | int     | Display order within parent              |

### RoleMenuPermission Table

| Column           | Type | Description              |
|------------------|------|--------------------------|
| roleId           | int  | Foreign key to Role      |
| menuPermissionId | int  | Foreign key to MenuPermission |

### UserMenuPermission Table

| Column           | Type | Description                   |
|------------------|------|-------------------------------|
| userId           | int  | Foreign key to User           |
| menuPermissionId | int  | Foreign key to MenuPermission |

---

## Troubleshooting

### User can't see any sidebar menus

**Symptom:** Sidebar is empty, only shows Dashboard or nothing at all

**Causes:**
1. User's role has no menu permissions assigned
2. User has no roles assigned
3. User has direct menu permissions but they're empty

**Solution:**
```bash
# Check user's menu permissions
npx tsx scripts/check-menu-permissions-jayvillalon.ts

# Fix by assigning menus via UI:
# Go to Settings → User Menu Manager → By Role
# Select the user's role and assign menus
```

### User can see menu but gets "Access Denied" when clicking

**Symptom:** Menu item visible, but clicking shows access denied error

**Causes:**
1. Page has `RouteProtection` with different menu key
2. Menu permission assigned but route has wrong `requiredMenuKey`

**Solution:**
- Check the page component's `requiredMenuKey` matches the menu's `key`
- Example: Menu key is `"purchases"`, route should use `requiredMenuKey="purchases"`

### User can access route directly by typing URL

**Symptom:** User types URL in browser and bypasses sidebar check

**Causes:**
- Page does not use `RouteProtection` component
- Route protection not implemented on that page

**Solution:**
- Wrap page content with `<RouteProtection requiredMenuKey="...">` component
- See [Protecting Routes](#protecting-routes) section

### Changes don't appear after saving

**Symptom:** Saved menu permissions but sidebar hasn't changed

**Causes:**
- User hasn't logged out and logged back in
- Session cache still has old menu permissions

**Solution:**
- User must **log out and log in again**
- Menu permissions are loaded at login time and cached in session
- Alternatively, implement real-time refresh (future enhancement)

### API returns 403 Forbidden when user has menu access

**Symptom:** User can see menu, route protection passes, but API call fails

**Causes:**
- User has menu permission but lacks RBAC permission
- Two separate permission systems - menu vs RBAC

**Solution:**
- Assign the corresponding RBAC permission
- Example: If user has `"purchases"` menu, also need `PERMISSIONS.PURCHASE_VIEW`

---

## Best Practices

### 1. Always Use Both Permission Types

**Menu Permission:** Controls sidebar visibility
**RBAC Permission:** Controls API access

Both are required for complete access control.

### 2. Keep Menu Keys Consistent

Use lowercase, underscore-separated keys:
- ✅ `purchases_add`
- ✅ `stock_transfers`
- ❌ `PurchasesAdd`
- ❌ `stock-transfers`

### 3. Parent + Child Pattern

For nested menus:
- Parent key: `purchases`
- Child keys: `purchases_list`, `purchases_add`, `goods_received`

### 4. Test After Assignment

After assigning menus:
1. Log out
2. Log in as test user
3. Verify menus appear
4. Click menu items to test route protection
5. Try API calls to test RBAC permissions

### 5. Document Custom Routes

When adding new protected routes, update:
- `src/middleware/routeProtection.ts` (route → menu key mapping)
- This documentation file

---

## Migration from Old System

If you're upgrading from a system without menu permissions:

### Step 1: Seed Menu Permissions

```bash
npx tsx scripts/seed-menu-permissions.ts
```

### Step 2: Assign to Existing Roles

```bash
# For each role, run:
npx tsx scripts/assign-menus-to-role.ts --role "Role Name"
```

### Step 3: Protect Existing Pages

Add `RouteProtection` wrapper to all dashboard pages:

```tsx
import { RouteProtection } from "@/components/RouteProtection"

export default function MyPage() {
  return (
    <RouteProtection requiredMenuKey="appropriate_key">
      {/* existing content */}
    </RouteProtection>
  )
}
```

### Step 4: Test All Roles

- Create test users for each role
- Log in as each role
- Verify correct menus appear
- Test all menu clicks work

---

## Support

If you encounter issues not covered in this guide:

1. Check console logs for permission errors
2. Use the diagnostic scripts in `/scripts` folder
3. Review the RBAC permissions (separate from menu permissions)
4. Ensure user has logged out/in after permission changes

For development questions, consult:
- `src/components/Sidebar.tsx` - Sidebar rendering logic
- `src/components/RouteProtection.tsx` - Route protection component
- `src/app/api/settings/menu-permissions/` - API endpoints
