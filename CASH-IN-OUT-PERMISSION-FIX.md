# Cash In/Out Permission Issue - Analysis & Fix

## Issue Summary
Users with certain roles are receiving **403 Forbidden** errors when trying to use Cash In/Out features in the POS system.

## Root Cause
The **"Main Branch Manager"** role is missing the `cash.in_out` permission in the database, even though the code in `src/lib/rbac.ts` (lines 155-160) defines that Branch Manager should have this permission.

## Current State

### Users Affected ❌
The following users **CANNOT** use Cash In/Out (missing `cash.in_out` permission):
- `branchmanager` (Smith Manager) - Main Branch Manager
- `mainmgr` (Carlos Main Store Manager) - Main Branch Manager
- `makati_mgr` (Maria Branch Manager) - Main Branch Manager
- `pasig_mgr` (Juan Branch Manager) - Main Branch Manager
- `cebu_mgr` (Ana Branch Manager) - Main Branch Manager
- `warehousemanager` (Davis) - Accounting Staff
- `Jheirone` (Jheirone Terre) - Warehouse Manager
- `Gemski` (Gem Hiadan) - All Branch Admin

### Users Working ✅
Only these users have `cash.in_out` permission:
- `superadmin` (Admin User) - Super Admin role
- `cashiermain` (Store Cashier) - Regular Cashier Main role

## What's Defined in Code vs Database

### In Code (`src/lib/rbac.ts`)
Lines 154-160 show Branch Manager SHOULD have:
```typescript
BRANCH_MANAGER: {
  name: 'Branch Manager',
  permissions: [
    // ... other permissions ...
    PERMISSIONS.CASH_IN_OUT,  // Line 158 - DEFINED IN CODE
    PERMISSIONS.CASH_COUNT,
    // ... more permissions ...
  ]
}
```

### In Database
The "Main Branch Manager" role in the database is **missing** the `cash.in_out` permission entry in the `role_permissions` table.

## Improvements Made

### 1. Enhanced Error Handling in POS ✅
Updated `src/app/dashboard/pos-v2/page.tsx` to provide detailed error messages:

**Cash In Handler (lines 732-770):**
- Now logs full error details to console
- Extracts and displays specific error messages from API
- Shows both `setError()` alert and browser `alert()` for visibility

**Cash Out Handler (lines 772-815):**
- Same detailed error handling as Cash In
- Helps diagnose permission issues immediately

### 2. Fixed API Permission Checks ✅
Updated API routes to use correct permission:

**`src/app/api/cash/in/route.ts` (line 22):**
- Changed from non-existent `PERMISSIONS.CASH_IN`
- To correct: `PERMISSIONS.CASH_IN_OUT`

**`src/app/api/cash/out/route.ts` (line 22):**
- Changed from non-existent `PERMISSIONS.CASH_OUT`
- To correct: `PERMISSIONS.CASH_IN_OUT`

### 3. Fixed Quotation Delete Permission ✅
**`src/app/api/quotations/[id]/route.ts` (line 25):**
- Changed from `PERMISSIONS.SELL_DELETE` (only for managers)
- To `PERMISSIONS.SELL_CREATE` (available to all POS users)
- Reasoning: Users who can create quotations should be able to delete their drafts

## How to Fix the Permission Issue

You have two options:

### Option 1: Update Database Manually (Quick Fix)
Run this SQL to add the missing permission to "Main Branch Manager" role:

```sql
-- First, find the role ID and permission ID
SELECT r.id as role_id, p.id as permission_id
FROM roles r, permissions p
WHERE r.name = 'Main Branch Manager'
  AND p.name = 'cash.in_out';

-- Then insert the permission (replace role_id and permission_id with values from above)
INSERT INTO role_permissions (role_id, permission_id)
VALUES (
  (SELECT id FROM roles WHERE name = 'Main Branch Manager' LIMIT 1),
  (SELECT id FROM permissions WHERE name = 'cash.in_out' LIMIT 1)
);
```

### Option 2: Re-seed Database (Complete Fix)
If your seed file is up to date with the RBAC definitions:

```bash
npm run db:seed
```

This will ensure all roles have the correct permissions as defined in `src/lib/rbac.ts`.

## Other Roles to Check

Based on the code, these roles should also have `cash.in_out` but weren't tested:
- **Branch Admin** - Should have it (line 158 in rbac.ts)
- **Regular Cashier** - Should have it (line 716 in rbac.ts)

## Testing After Fix

1. **Test Cash In:**
   - Login as a Branch Manager
   - Open POS (requires active shift)
   - Click "Cash In" button or press Alt+I
   - Enter amount and remarks
   - Click "Record Cash In"
   - Should succeed without 403 error

2. **Test Cash Out:**
   - Same as above but use "Cash Out" button or Alt+O
   - Remarks are required for Cash Out

3. **Check Console:**
   - Open browser DevTools (F12)
   - Look for `[Cash In Error]` or `[Cash Out Error]` logs
   - Should see detailed error information if any issues occur

## Files Modified

1. `src/app/dashboard/pos-v2/page.tsx` - Enhanced error handling
2. `src/app/api/cash/in/route.ts` - Fixed permission check
3. `src/app/api/cash/out/route.ts` - Fixed permission check
4. `src/app/api/quotations/[id]/route.ts` - Fixed permission check
5. `test-user-cash-permissions.js` - Diagnostic script created

## Next Steps

1. ✅ Enhanced error handling is already deployed
2. ✅ API permission checks are fixed
3. ⚠️ **ACTION NEEDED:** Add `cash.in_out` permission to affected roles in database
4. 🧪 Test with affected users to confirm fix

## Verification Script

Run this script to verify permissions:
```bash
node test-user-cash-permissions.js
```

It will show:
- All users and their roles
- Whether each user has `cash.in_out` permission
- Open cashier shifts

---

**Status:** Ready for database permission fix
**Priority:** High - Blocking POS operations for multiple users
**Estimated Fix Time:** 5 minutes (run SQL or reseed)
