# Location Access Control Model

## Overview
This document explains how branch/location access works in the UltimatePOS Modern multi-branch system.

## Architecture: Hybrid Access Model

The system uses a **hybrid approach** combining **Role-based** and **User-based** location access with a clear priority order.

### Database Tables
1. **role_locations** - Assigns locations to roles (e.g., "WarehouseManager" role → Warehouse A, B, C)
2. **user_locations** - Assigns locations directly to individual users (overrides role assignments)

### Access Priority Logic

```
Priority 1: ACCESS_ALL_LOCATIONS Permission
├─ If user has this permission → Access ALL locations in their business
└─ Typical for: Super Admin, Branch Admin

Priority 2: Direct User Location Assignments (UserLocation)
├─ If user has direct location assignments → Use ONLY those locations
├─ This OVERRIDES any role-based location assignments
└─ Use case: Restrict or expand a specific user's access

Priority 3: Role Location Assignments (RoleLocation)
├─ If no direct user assignments → Use union of ALL role locations
├─ User inherits locations from ALL their assigned roles
└─ Use case: Standard access pattern for most users

Priority 4: No Access
└─ If none of above → User has no location access
```

## Examples

### Example 1: Standard Role-Based Access
**Setup:**
- WarehouseManager role → Assigned to Warehouse A, B, C
- User "John" has WarehouseManager role
- User "John" has NO direct UserLocation assignments

**Result:** John can access Warehouse A, B, C (inherited from role)

---

### Example 2: User Override (Restriction)
**Setup:**
- WarehouseManager role → Assigned to Warehouse A, B, C
- User "Maria" has WarehouseManager role
- User "Maria" has direct UserLocation → Warehouse A only

**Result:** Maria can access ONLY Warehouse A (direct assignment overrides role)

**Use case:** During training period, restrict Maria to one warehouse

---

### Example 3: User Override (Expansion)
**Setup:**
- Cashier role → Assigned to Retail Store A
- User "Tom" has Cashier role
- User "Tom" has direct UserLocation → Retail Store A, Retail Store B

**Result:** Tom can access Retail Store A and B (direct assignment overrides role)

**Use case:** Tom works at two stores, most cashiers work at one

---

### Example 4: Multiple Roles (Union)
**Setup:**
- WarehouseManager role → Warehouse A, B
- BranchManager role → Retail Store X
- User "Sarah" has BOTH roles
- User "Sarah" has NO direct UserLocation assignments

**Result:** Sarah can access Warehouse A, B, AND Retail Store X (union of all role locations)

---

### Example 5: Full Access Permission
**Setup:**
- User "Admin" has ACCESS_ALL_LOCATIONS permission
- (Any role or user location assignments are ignored)

**Result:** Admin can access ALL locations in the business

---

## Management Guidelines

### For Super Admins

#### Setting Up Standard Access (Recommended for most users)
1. Go to **Roles Management**
2. Edit or create a role (e.g., "WarehouseManager")
3. Assign the appropriate branches under "Branch/Location Access"
4. Assign users to this role
5. Users will automatically inherit the role's location access

#### Setting Up Special Access (For exceptions)
1. Go to **User Management**
2. Edit a specific user
3. Directly assign branches to that user in "Assigned Locations"
4. This will override any role-based access for that user

### Best Practices

✅ **DO:**
- Use role-based location assignments for standard access patterns
- Use user-based assignments for temporary or special access
- Document why a user has direct location assignments (e.g., "Training", "Temporary coverage")

❌ **DON'T:**
- Assign direct locations to every user (defeats the purpose of roles)
- Mix both methods unless necessary (keep it simple)

## Technical Implementation

### auth.ts (Login)
When a user logs in:
```typescript
const directLocationIds = user.userLocations.map(ul => ul.locationId)
const roleLocationIds = user.roles.flatMap(ur =>
  ur.role.locations.map(rl => rl.locationId)
)

// Priority: Direct user locations override role locations
const locationIds = directLocationIds.length > 0
  ? directLocationIds
  : [...new Set(roleLocationIds)]
```

### RBAC Utility (getUserAccessibleLocationIds)
```typescript
export function getUserAccessibleLocationIds(user: RBACUser | null): number[] | null {
  if (!user) return []

  // Priority 1: Check for ACCESS_ALL_LOCATIONS permission
  if (hasAccessToAllLocations(user)) return null

  // Priority 2 & 3: Return locationIds (already merged in auth.ts)
  return user.locationIds || []
}
```

### API Route Usage
```typescript
import { getUserAccessibleLocationIds } from '@/lib/rbac'

const session = await getServerSession(authOptions)
const user = session.user as any
const accessibleLocationIds = getUserAccessibleLocationIds(user)

// Query with location filter
const stocks = await prisma.variationLocationDetails.findMany({
  where: {
    businessId: user.businessId,
    // If null = all locations, if array = specific locations
    ...(accessibleLocationIds !== null && {
      locationId: { in: accessibleLocationIds }
    })
  }
})
```

## Testing Checklist

- [ ] Create a role with 2 locations assigned
- [ ] Assign user to that role (no direct UserLocation)
- [ ] Verify user sees 2 locations
- [ ] Assign direct UserLocation (1 location) to same user
- [ ] Verify user now sees only 1 location (override works)
- [ ] Remove direct UserLocation from user
- [ ] Verify user sees 2 locations again (role-based restored)
- [ ] Assign user to multiple roles with different locations
- [ ] Verify user sees union of all role locations

## Migration Notes

**Existing UserLocation assignments** will continue to work and will OVERRIDE role-based assignments. If you want to switch to role-based access:

1. Assign locations to the user's role
2. Remove direct UserLocation assignments from that user
3. User will now inherit from role

To keep using direct assignments: Do nothing, current behavior is preserved.
