# Branch-Level Access Control Implementation

## Overview
This document describes the implementation of branch-level (location-level) access control for the UltimatePOS Modern multi-tenant system.

## Problem Statement
Users were able to see data from ALL branches even when assigned to specific branches only. This violated the principle of least privilege and could expose sensitive business data.

## Solution Architecture

### 1. Session Enhancement
**File**: `src/lib/auth.ts`

Added `locationIds` array to user session:
- Loads user's assigned locations during login via `userLocations` relation
- Stores location IDs in JWT token and session object
- Available in all API routes via `session.user.locationIds`

### 2. RBAC Utility Functions
**File**: `src/lib/rbac.ts`

New utility functions:
- `hasAccessToAllLocations(user)` - Checks if user has ACCESS_ALL_LOCATIONS permission or is Super Admin
- `hasAccessToLocation(user, locationId)` - Checks if user can access specific location
- `getUserAccessibleLocationIds(user)` - Returns location IDs user can access (null = all locations)
- `getLocationWhereClause(user, fieldName)` - Builds Prisma where clause for location filtering

### 3. API Route Updates

#### `/api/locations` route
**File**: `src/app/api/locations/route.ts`

Now uses `getUserAccessibleLocationIds()` to filter locations:
- Users with ACCESS_ALL_LOCATIONS permission see all business locations
- Other users only see their assigned locations
- Empty array returned if user has no location assignments

#### `/api/products/[id]/opening-stock` route
**File**: `src/app/api/products/[id]/opening-stock/route.ts`

Already implements branch filtering:
- Validates stock entries against user's accessible locations
- Prevents unauthorized stock additions to inaccessible branches
- Returns 403 Forbidden if user tries to access unauthorized locations

### 4. Database Schema
**Model**: `UserLocation` (junction table)

Existing schema already supports user-branch assignments:
```prisma
model UserLocation {
  userId     Int
  locationId Int
  user       User             @relation(...)
  location   BusinessLocation @relation(...)

  @@id([userId, locationId])
}
```

### 5. Permission System

**New Permission**: `ACCESS_ALL_LOCATIONS`
- Grants access to all business locations
- Assigned to Super Admin and Branch Admin roles by default
- Other roles must be explicitly assigned to specific locations

**Role Configurations**:
- **Super Admin**: All permissions (including ACCESS_ALL_LOCATIONS)
- **Branch Admin**: All business operations + ACCESS_ALL_LOCATIONS
- **Branch Manager**: Limited to assigned locations only
- **Accounting Staff**: Limited to assigned locations only
- **Regular Staff**: Limited to assigned locations only
- **Cashier**: Limited to assigned locations only

## Test Scenarios

### Scenario 1: Warehouse Manager (Single Branch Access)
- **Username**: `warehousemanager`
- **Password**: `password`
- **Assigned Locations**: Warehouse only
- **Expected Behavior**:
  - Opening stock page shows only Warehouse branch
  - Cannot add stock to other branches
  - Location dropdown shows only Warehouse

### Scenario 2: Regular Staff (Multiple Branch Access)
- **Username**: `staff`
- **Password**: `password`
- **Assigned Locations**: Main Store + Bambang
- **Expected Behavior**:
  - Opening stock page shows Main Store and Bambang only
  - Cannot add stock to Warehouse or Tuguegarao Downtown
  - Location dropdown shows 2 locations

### Scenario 3: Cashier (Single Branch Access)
- **Username**: `cashier`
- **Password**: `password`
- **Assigned Locations**: Tuguegarao Downtown only
- **Expected Behavior**:
  - Opening stock page shows only Tuguegarao Downtown
  - Cannot add stock to other branches

### Scenario 4: Branch Admin (All Locations)
- **Username**: `branchadmin`
- **Password**: `password`
- **Assigned Locations**: All (via ACCESS_ALL_LOCATIONS permission)
- **Expected Behavior**:
  - Opening stock page shows all 4 branches
  - Can add stock to any branch
  - Location dropdown shows all locations

## Setup Instructions

### 1. Run Migrations
```bash
npx prisma db push
npx prisma generate
```

### 2. Assign Users to Locations
```bash
npx tsx scripts/assign-user-locations.ts
```

This script:
- Clears existing user-location assignments
- Assigns branch manager to Main Store
- Assigns warehouse manager to Warehouse
- Assigns staff to Main Store + Bambang
- Assigns cashier to Tuguegarao Downtown

### 3. Users Must Re-Login
After location assignments, users must:
1. Log out of the system
2. Log back in
3. Session will now include `locationIds` array

## API Integration Guide

### For New API Routes

When creating new API routes that deal with location-specific data:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserAccessibleLocationIds } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session.user as any

  // Get accessible location IDs
  const locationIds = getUserAccessibleLocationIds(user)

  // Build where clause
  const whereClause: any = {
    businessId: parseInt(user.businessId)
  }

  // Add location filter
  if (locationIds !== null) {
    if (locationIds.length === 0) {
      // User has no location access
      return NextResponse.json({ data: [] })
    }
    whereClause.locationId = { in: locationIds }
  }
  // If locationIds is null, user has access to all locations (no filter)

  const data = await prisma.yourModel.findMany({
    where: whereClause
  })

  return NextResponse.json({ data })
}
```

### Using the Where Clause Helper

```typescript
import { getLocationWhereClause } from '@/lib/rbac'

const locationFilter = getLocationWhereClause(user, 'locationId')

const data = await prisma.stockTransaction.findMany({
  where: {
    businessId: parseInt(user.businessId),
    ...locationFilter // Spreads { locationId: { in: [1, 2] } } or {}
  }
})
```

## Testing Checklist

- [ ] Warehouse Manager sees only Warehouse on opening stock page
- [ ] Warehouse Manager cannot add stock to other branches (403 error)
- [ ] Regular Staff sees Main Store and Bambang only
- [ ] Cashier sees only Tuguegarao Downtown
- [ ] Branch Admin sees all 4 branches
- [ ] Super Admin sees all 4 branches
- [ ] Location dropdown filters correctly for each user type
- [ ] Users without location assignments see empty location list
- [ ] API returns 403 when user tries to access unauthorized location

## Files Modified

1. `src/lib/auth.ts` - Added locationIds to session
2. `src/lib/rbac.ts` - Added branch access control utilities
3. `src/app/api/locations/route.ts` - Updated to use new utilities
4. `prisma/seed.ts` - Updated to create 4 branches and assign users
5. `scripts/assign-user-locations.ts` - New script to assign users to branches

## Database Changes

No schema changes required - the `UserLocation` junction table already existed.

## Security Considerations

1. **Multi-Tenant Isolation**: Business-level isolation remains primary (businessId filter)
2. **Branch-Level Isolation**: Additional layer on top of business isolation
3. **Permission Hierarchy**:
   - Super Admin > Branch Admin > Location-specific users
   - ACCESS_ALL_LOCATIONS bypasses location filtering
4. **Validation**: All location-specific operations validate user access before execution
5. **Session Security**: Location IDs stored in JWT, regenerated on login

## Future Enhancements

1. **UI Updates**: Add branch selector in navigation bar for multi-branch users
2. **Reports**: Filter reports by user's accessible branches
3. **Transfers**: Implement stock transfers between branches (with access validation)
4. **Sales**: Filter sales by branch access
5. **Purchases**: Filter purchases by branch access
6. **Audit Logs**: Track which branch users accessed data from

## Troubleshooting

### Issue: User still sees all branches after assignment
**Solution**: User must log out and log back in for session to refresh

### Issue: Getting "No locations found" error
**Solution**: Run `npx tsx scripts/assign-user-locations.ts` to assign locations

### Issue: Seed script fails with email conflict
**Solution**: Existing users in database. Use the assign-user-locations script instead

### Issue: 403 Forbidden when accessing opening stock
**Solution**: User doesn't have PRODUCT_OPENING_STOCK permission or isn't assigned to any locations
