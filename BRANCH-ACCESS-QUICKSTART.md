# Branch-Level Access Control - Quick Start Guide

## Problem
Users assigned to specific branches (e.g., "Warehouse Manager" assigned only to "Warehouse" branch) can currently see ALL branches in the system. This is a security issue.

## Solution Implemented
Branch-level access control that filters data based on user's assigned locations.

## Quick Test (5 Minutes)

### Option 1: Using Existing Users (If seed worked)

1. **Login as Branch Admin** (sees all branches):
   - Username: `branchadmin`
   - Password: `password`
   - Navigate to Products > Add Product > Opening Stock
   - You should see ALL 4 branches

2. **Create Warehouse Manager manually**:
   ```bash
   # Open your PostgreSQL client or Prisma Studio
   npx prisma studio
   ```

   In Prisma Studio:
   - Go to Users table
   - Click "Add Record"
   - Fill in:
     - surname: Robert
     - firstName: Davis
     - lastName: Warehouse Manager
     - username: warehousemanager
     - email: warehouse@ultimatepos.com
     - password: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi (bcrypt hash of "password")
     - businessId: 1
     - allowLogin: true
     - userType: user
   - Save

3. **Assign Warehouse Manager to Warehouse location**:
   - Run the assignment script:
   ```bash
   npx tsx scripts/assign-user-locations.ts
   ```

4. **Login as Warehouse Manager**:
   - Username: `warehousemanager`
   - Password: `password`
   - Navigate to Products > Add Product > Opening Stock
   - You should see ONLY the Warehouse branch

### Option 2: Manual Database Setup

```bash
# 1. Connect to your PostgreSQL database
psql -U your_username -d ultimatepos_modern

# 2. Run the SQL script
\i scripts/setup-branch-access.sql

# Or copy-paste the SQL commands from the file
```

### Option 3: Using Node Script (Recommended if users exist)

```bash
# This script assigns existing users to branches
npx tsx scripts/assign-user-locations.ts
```

## Test Scenarios

| User | Password | Assigned Branches | What They Should See |
|------|----------|------------------|---------------------|
| `branchadmin` | `password` | All (via permission) | All 4 branches |
| `superadmin` | `password` | All (Super Admin) | All 4 branches |
| `warehousemanager` | `password` | Warehouse only | Warehouse only |
| `branchmanager` | `password` | Main Store only | Main Store only |
| `staff` | `password` | Main Store + Bambang | 2 branches |
| `cashier` | `password` | Tuguegarao Downtown | 1 branch only |

## How to Verify It's Working

### Test 1: Opening Stock Page
1. Login as `warehousemanager`
2. Go to: `/dashboard/products/[any-product-id]/opening-stock`
3. Check the location dropdown
4. Expected: Only shows "Warehouse"
5. Try to manually add stock for another location using browser dev tools
6. Expected: 403 Forbidden error

### Test 2: Locations API
1. Login as `warehousemanager`
2. Open browser console
3. Run:
   ```javascript
   fetch('/api/locations').then(r => r.json()).then(console.log)
   ```
4. Expected: Returns only Warehouse location

### Test 3: Compare with Branch Admin
1. Login as `branchadmin`
2. Run same API call
3. Expected: Returns all 4 locations

## Common Issues

### "User still sees all branches"
**Cause**: Session not refreshed
**Solution**: Log out completely and log back in

### "No locations shown"
**Cause**: User not assigned to any location
**Solution**: Run `npx tsx scripts/assign-user-locations.ts`

### "Script says 'No users found'"
**Cause**: Demo users not created yet
**Solution**: Create users manually or fix seed script email conflicts

### "403 Forbidden on opening stock"
**Cause**: User lacks PRODUCT_OPENING_STOCK permission
**Solution**: Assign Branch Manager role which has this permission

## Architecture Summary

```
User Session
├── businessId (tenant isolation)
├── permissions (role-based access)
└── locationIds[] (branch-level access)
    ├── null = ACCESS_ALL_LOCATIONS permission
    └── [1, 3] = specific branch IDs

API Route Flow:
1. Get session
2. Check permissions (RBAC)
3. Get accessible locations (getUserAccessibleLocationIds)
4. Filter query by locations
5. Return filtered data
```

## Key Files Changed

1. **src/lib/auth.ts** - Added `locationIds` to session
2. **src/lib/rbac.ts** - Added branch filtering utilities
3. **src/app/api/locations/route.ts** - Filters locations by user access
4. **prisma/seed.ts** - Creates 4 branches (Main Store, Warehouse, Bambang, Tuguegarao Downtown)

## Next Steps After Testing

Once you verify branch access control works:

1. **Apply to other modules**:
   - Sales records (filter by user's accessible branches)
   - Purchase records (filter by user's accessible branches)
   - Reports (filter by user's accessible branches)
   - Stock transfers (validate source/destination access)

2. **UI Enhancements**:
   - Add branch selector in navigation
   - Show current branch in header
   - Branch badges on data tables

3. **Audit Logging**:
   - Log which branch user accessed data from
   - Track cross-branch activities

## Need Help?

Check the full implementation guide: `BRANCH-ACCESS-IMPLEMENTATION.md`

Or review the RBAC utilities in: `src/lib/rbac.ts`
