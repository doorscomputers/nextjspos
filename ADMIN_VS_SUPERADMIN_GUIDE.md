# Admin vs Super Admin - RBAC Configuration Guide

## Role Differences

### Super Admin
**Purpose**: Platform owner/operator who manages multiple businesses

**Exclusive Permissions**:
- `SUPERADMIN_ALL` - Master permission
- `SUPERADMIN_BUSINESS_VIEW/CREATE/UPDATE/DELETE` - Manage multiple businesses
- `SUPERADMIN_PACKAGE_VIEW/CREATE/UPDATE/DELETE` - Subscription packages
- `SUPERADMIN_SUBSCRIPTION_VIEW/CREATE/UPDATE/DELETE` - Business subscriptions

**Characteristics**:
- Can access ALL businesses in the system
- Not bound to a single business location
- Platform-level administrative access
- Typically used by SaaS owners/operators

**Location Assignment**: NOT REQUIRED (operates across all businesses and locations)

---

### Branch Admin (Admin)
**Purpose**: Business owner or top-level manager within a single business

**Permissions**: All operational permissions EXCEPT `SUPERADMIN_*` permissions, including:
- User management (create, update, delete users)
- Role management (create, update, delete roles)
- Product management (full CRUD)
- Sales, purchases, inventory management
- All reports and analytics
- Business settings configuration
- Location management
- `ACCESS_ALL_LOCATIONS` - Can view/manage all branches within their business

**Characteristics**:
- Bound to a single business via `businessId`
- Can access all locations within their business (if granted `ACCESS_ALL_LOCATIONS`)
- Cannot manage other businesses
- Cannot modify subscription/package settings

**Location Assignment**: OPTIONAL (can be granted `ACCESS_ALL_LOCATIONS` permission)

---

## Location Assignment Requirements by Role

### Roles That REQUIRE Location Assignment:
These are transactional roles that perform day-to-day operations at specific branches:

1. **Regular Cashier** - Needs specific location for POS transactions
2. **Branch Manager** - Manages specific branch operations
3. **Regular Staff** - Works at specific location
4. **Accounting Staff** - May work at specific location or across all (configurable)

### Roles That DO NOT Require Location Assignment:
These are administrative roles that can work across all locations:

1. **Super Admin** - Platform-level access
2. **Branch Admin** - Business-level access with `ACCESS_ALL_LOCATIONS` permission

---

## How to Create an Admin User with Maximum Permissions

### Step 1: Create the Admin User
1. Navigate to **Dashboard > Users > Create User**
2. Fill in user details (surname, first name, username, password)
3. **IMPORTANT**: You can now leave "Assign Location" empty for Admin roles
4. Check "Allow Login"

### Step 2: Assign the Branch Admin Role
1. Select the **Branch Admin** role (or create a custom admin role)
2. The Branch Admin role includes `ACCESS_ALL_LOCATIONS` permission
3. This allows the user to access all locations within their business

### Step 3: Configure Additional Permissions (Optional)
If you need an Admin with specific restrictions:

1. Create a custom role based on Branch Admin
2. Add/remove permissions as needed
3. Ensure `ACCESS_ALL_LOCATIONS` is included if they should access all branches
4. Assign the custom role to the user

---

## Permission Configuration Examples

### Example 1: Full Branch Admin (Maximum Non-SuperAdmin Access)
```
Role: Branch Admin
Permissions: All EXCEPT SUPERADMIN_*
Location: None (has ACCESS_ALL_LOCATIONS)
Result: Can manage everything within their business across all locations
```

### Example 2: Regional Manager (Multiple Locations)
```
Role: Custom Role (Regional Manager)
Permissions: Subset of Branch Admin
Locations: Location A, Location B, Location C
Result: Can manage only assigned locations
```

### Example 3: Single Location Manager
```
Role: Branch Manager
Permissions: Branch Manager permission set
Location: Location A only
Result: Can manage only Location A
```

### Example 4: Cashier (Location-Bound)
```
Role: Regular Cashier
Permissions: POS, basic sales reporting
Location: Location A (REQUIRED)
Result: Can only process sales at Location A
```

---

## Validation Rules After Fix

### Frontend Validation (User Edit/Create Form):
```typescript
// Location is REQUIRED if:
// - User has transactional roles (Cashier, Manager, Regular Staff)
// - User does NOT have ACCESS_ALL_LOCATIONS permission

// Location is OPTIONAL if:
// - User has Admin or Super Admin role
// - User has ACCESS_ALL_LOCATIONS permission
```

### Backend Validation (API):
```typescript
// POST /api/users (Create)
// PUT /api/users/:id (Update)

// Location validation:
// 1. Check user's assigned roles
// 2. If ANY role has ACCESS_ALL_LOCATIONS → location optional
// 3. If user is Super Admin → location optional
// 4. Otherwise → location required
```

---

## Best Practices

### 1. Location Assignment Strategy
- Assign specific locations to operational staff (Cashier, Staff)
- Grant `ACCESS_ALL_LOCATIONS` to managers and admins
- Super Admins should never have location assignments

### 2. Role Assignment
- Use default roles as templates
- Create custom roles for specific use cases
- Never modify Super Admin role
- Document custom role purposes

### 3. Permission Inheritance
- Users inherit permissions from ALL assigned roles
- Users can have direct permissions (bypasses role)
- More specific permissions override general ones

### 4. Security Considerations
- Limit Branch Admin role to trusted business owners
- Regularly audit user permissions
- Use least privilege principle for custom roles
- Review audit logs for suspicious activity

---

## Troubleshooting

### Issue: Cannot save Admin user without location
**Solution**: Apply the fix in this update. Admin users with `ACCESS_ALL_LOCATIONS` can be saved without location.

### Issue: User can't access certain locations
**Solution**:
1. Check user's role permissions for `ACCESS_ALL_LOCATIONS`
2. Verify user's assigned locations in UserLocation table
3. Check if user's role has location restrictions

### Issue: Admin user can see other businesses
**Solution**: This should NEVER happen. Admin users are filtered by `businessId`. If this occurs:
1. Check session businessId
2. Review query filters in API routes
3. Ensure multi-tenant isolation is enforced

### Issue: Difference between Admin and Super Admin unclear
**Solution**:
- Admin: Manages ONE business, all locations within it
- Super Admin: Manages ALL businesses (platform owner)
- Check permissions: Admin has NO `SUPERADMIN_*` permissions

---

## Migration Notes

If you have existing Admin users with forced location assignments:

1. The fix maintains backward compatibility
2. Existing location assignments remain valid
3. You can remove location assignments from Admin users manually
4. No database migration required

---

## Technical Implementation

### Modified Files:
1. `src/app/dashboard/users/[id]/edit/page.tsx` - Frontend validation
2. `src/app/api/users/route.ts` - Create user validation
3. `src/app/api/users/[id]/route.ts` - Update user validation
4. `src/lib/rbac.ts` - Helper function to check if role requires location

### New Helper Function:
```typescript
export function requiresLocationAssignment(roles: string[]): boolean {
  const adminRoles = ['Super Admin', 'Branch Admin']
  return !roles.some(role => adminRoles.includes(role))
}
```

This function checks if any assigned role is administrative, making location assignment optional.
