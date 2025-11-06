# How to Create Location-Independent Roles

**Date**: 2025-11-06
**Last Updated**: 2025-11-06

---

## Overview

The system now uses **dynamic permission checking** instead of hardcoded role names. Any role with the `access_all_locations` permission will automatically not require location assignment.

**No code changes needed to create new location-independent roles!**

---

## Step-by-Step: Create a Custom Location-Independent Role

### Example: "Regional Manager" Role

Let's say you want to create a "Regional Manager" who can:
- View all transfers, sales, purchases across all locations
- Approve transfers
- View reports
- But CANNOT create transactions or access settings

---

### Step 1: Create the Role via UI

1. **Login as Super Admin**
2. **Navigate to**: Settings → Roles → Add New Role
3. **Enter Role Name**: `Regional Manager`
4. **Select Permissions** (check these boxes):

#### Required for Location Independence
- ✅ `access_all_locations` ← **MOST IMPORTANT**

#### View Permissions
- ✅ `dashboard.view`
- ✅ `product.view`
- ✅ `stock_transfer.view`
- ✅ `sell.view`
- ✅ `purchase.view`

#### Approval Permissions
- ✅ `stock_transfer.check`
- ✅ `stock_transfer.complete`

#### Report Permissions
- ✅ `report.view`
- ✅ `report.transfer.view`
- ✅ `report.sales.view`
- ✅ `report.purchase.view`
- ✅ `stock_report.view`

5. **Click "Create Role"**

---

### Step 2: Assign User to This Role

1. **Go to**: Settings → User Management
2. **Click "Edit"** on the user (or "Add New User")
3. **Assign Roles**: Check "Regional Manager"
4. **Assign Location**: Select **"-- All Locations (No Restriction) --"**
5. **Click "Save"**

**The form will allow saving without a specific location!** ✅

---

## How It Works Automatically

### Frontend (User Forms)

The edit and new user forms check if **ANY selected role** has the `access_all_locations` permission:

```typescript
// src/app/dashboard/users/[id]/edit/page.tsx (lines 30-42)
const locationRequired = useMemo(() => {
  if (formData.roleIds.length === 0) return true

  const selectedRoles = roles.filter(r => formData.roleIds.includes(r.id))

  // If ANY selected role has ACCESS_ALL_LOCATIONS permission, location is NOT required
  const hasAccessAllLocations = selectedRoles.some(role =>
    role.permissions?.includes('access_all_locations')
  )

  return !hasAccessAllLocations
}, [formData.roleIds, roles])
```

**Result**: If the role has `access_all_locations`, the location dropdown becomes optional and the save button is enabled.

---

### Backend (API Validation)

The API endpoints check permissions dynamically:

```typescript
// src/app/api/users/route.ts (lines 101-123)
const assignedRoles = await prisma.role.findMany({
  where: { id: { in: roleIds } },
  include: { permissions: true }
})

// Check if ANY role has ACCESS_ALL_LOCATIONS permission
const hasAccessAllLocations = assignedRoles.some(role =>
  role.permissions.some(p => p.permission === 'access_all_locations')
)

// Location is ONLY required if user does NOT have a role with ACCESS_ALL_LOCATIONS
if (!hasAccessAllLocations && !locationId) {
  return NextResponse.json({
    error: 'Location is required for transactional roles...'
  }, { status: 400 })
}
```

**Result**: API allows saving users with `access_all_locations` permission without location.

---

## Examples of Location-Independent Roles

### 1. Cross-Location Approver (Already Created)
**Purpose**: Approve transfers and Z-Readings across all locations

**Permissions**:
- `access_all_locations` ← Makes it location-independent
- `stock_transfer.view`
- `stock_transfer.check` (approval)
- `stock_transfer.complete`
- `reading.z_reading`
- Report viewing permissions

**Cannot**: Create anything, access settings

---

### 2. Regional Manager (Example)
**Purpose**: Oversee multiple locations, view all data, approve operations

**Permissions**:
- `access_all_locations` ← Makes it location-independent
- `stock_transfer.view`, `stock_transfer.check`, `stock_transfer.complete`
- `sell.view`, `purchase.view`
- `report.view` + all report types
- `audit_log.view`

**Cannot**: Create transactions, manage users/settings

---

### 3. Financial Auditor (Example)
**Purpose**: View financial data across all locations for auditing

**Permissions**:
- `access_all_locations` ← Makes it location-independent
- `sell.view` (read-only sales)
- `purchase.view` (read-only purchases)
- `report.view` + financial reports
- `report.profit_loss`
- `audit_log.view`

**Cannot**: Create/edit/delete anything, just VIEW

---

### 4. Inventory Analyst (Example)
**Purpose**: Monitor stock levels across all locations

**Permissions**:
- `access_all_locations` ← Makes it location-independent
- `product.view`
- `stock_report.view`
- `view_inventory_reports`
- `inventory_ledger.view`
- `report.stock_alert`

**Cannot**: Create products, manage inventory, just ANALYZE

---

## The Magic Permission

### `access_all_locations`

**What it does**:
1. ✅ Allows viewing data from ALL locations (bypasses location filtering in GET endpoints)
2. ✅ Makes location assignment OPTIONAL (can save users without specific location)
3. ✅ Works automatically - no code changes needed

**What it does NOT do**:
- ❌ Does NOT grant permission to CREATE transactions (need separate permissions)
- ❌ Does NOT grant permission to access Settings (need `business_settings.view`)
- ❌ Does NOT grant permission to manage users (need `user.create`, `user.update`)

---

## Common Patterns

### Pattern 1: Approver (View + Approve Only)
```
✅ access_all_locations
✅ [entity].view
✅ [entity].approve or [entity].check
❌ NO [entity].create
❌ NO [entity].update
❌ NO [entity].delete
```

### Pattern 2: Analyst (View Only)
```
✅ access_all_locations
✅ [entity].view
✅ report.*
✅ audit_log.view
❌ NO create/update/delete permissions
```

### Pattern 3: Manager (View + Create + Approve)
```
✅ access_all_locations
✅ [entity].view
✅ [entity].create
✅ [entity].update
✅ [entity].approve
❌ NO settings or user management
```

---

## Troubleshooting

### Issue: "Location is required" error when saving user

**Cause**: The role does NOT have `access_all_locations` permission

**Solution**:
1. Go to Settings → Roles
2. Edit the role
3. Check the `access_all_locations` permission
4. Save the role
5. Try assigning the user again

---

### Issue: User can view but cannot create from any location

**This is EXPECTED behavior!**

**Why**: `access_all_locations` only grants the ability to VIEW across locations. To CREATE transactions, the user either needs:
- A specific location assigned (e.g., Main Warehouse)
- OR the transaction endpoints need to be updated to allow cross-location creation

**Current System Design**: CREATE operations require a specific location to:
- Know which inventory to deduct from
- Know which register/POS to record under
- Prevent accidental cross-location transactions

**If you want a user to CREATE from any location**:
- Assign them to a specific "default" location
- OR modify the CREATE endpoints to accept location as a parameter

---

### Issue: Frontend shows location as optional, but API rejects

**Cause**: API and frontend are out of sync (old cached code)

**Solution**:
1. Clear browser cache: Ctrl+Shift+R (hard refresh)
2. Sign out and sign in again
3. Verify Vercel deployment has latest code

---

## Summary

**To create a location-independent role**:
1. ✅ Create role via Settings → Roles
2. ✅ **Include `access_all_locations` permission**
3. ✅ Add view/approve permissions as needed
4. ✅ Assign user to this role
5. ✅ Select "All Locations (No Restriction)" when assigning

**No code changes required!** The system dynamically checks for `access_all_locations` permission.

---

## Future-Proof Guarantee

**Any role you create with `access_all_locations` permission will work correctly without code updates.**

The system checks the actual permission, not the role name. This means:
- ✅ Add 100 custom location-independent roles
- ✅ Name them anything you want
- ✅ No code changes needed
- ✅ Just include `access_all_locations` permission

---

**Prepared by**: Claude Code
**For**: UltimatePOS Modern - Dynamic Permission System
**Last Updated**: 2025-11-06
