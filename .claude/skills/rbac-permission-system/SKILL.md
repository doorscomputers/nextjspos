# rbac-permission-system

## Purpose
Implements role-based access control (RBAC) with permission checking throughout the application. Ensures users can only access features and data they're authorized to use.

## When to Use
- Checking if a user can perform an action
- Hiding/showing UI elements based on permissions
- Protecting API routes with permission gates
- Implementing role-based logic
- Checking location access

## Permission System Structure

### User Object with RBAC

```typescript
interface RBACUser {
  id: string
  permissions: string[]      // Aggregated from roles + direct permissions
  roles: string[]            // Role names (e.g., "Super Admin", "Cashier")
  businessId?: string        // Multi-tenant isolation
  locationIds?: number[]     // Accessible locations
}
```

### How Permissions Are Loaded

From `auth.ts` (lines 186-230):
1. **Role Permissions** - Inherited from assigned roles
2. **Direct Permissions** - Assigned directly to user
3. **Super Admin Override** - Super Admin gets ALL permissions automatically

```typescript
// Permissions are aggregated during login:
const rolePermissions = user.roles.flatMap(ur =>
  ur.role.permissions.map(rp => rp.permission.name)
)
const directPermissions = user.permissions.map(up => up.permission.name)
let allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

// Super Admin gets everything
if (roleNames.includes('Super Admin') ||
    roleNames.includes('System Administrator') ||
    roleNames.includes('Super Admin (Legacy)')) {
  allPermissions = Object.values(PERMISSIONS)
}
```

## Core Permission Functions

### Import

```typescript
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  isSuperAdmin,
  PERMISSIONS
} from '@/lib/rbac'
```

### 1. hasPermission()

Check single permission:

```typescript
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

// In API route
const user = session.user as any

if (hasPermission(user, PERMISSIONS.PRODUCT_CREATE)) {
  // User can create products
}

// Super Admin automatically passes
if (hasPermission(superAdminUser, PERMISSIONS.PRODUCT_CREATE)) {
  // Returns true even if permission not explicitly assigned
}
```

### 2. hasAnyPermission()

User needs AT LEAST ONE of the permissions:

```typescript
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac'

// Check if user can view products (own or all)
if (hasAnyPermission(user, [
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_VIEW_OWN
])) {
  // User can view at least some products
}
```

### 3. hasAllPermissions()

User needs ALL listed permissions:

```typescript
import { hasAllPermissions, PERMISSIONS } from '@/lib/rbac'

// Check if user can fully manage products
if (hasAllPermissions(user, [
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_UPDATE,
  PERMISSIONS.PRODUCT_DELETE
])) {
  // User has full product management access
}
```

### 4. hasRole()

Check specific role:

```typescript
import { hasRole } from '@/lib/rbac'

if (hasRole(user, 'Branch Manager')) {
  // User is a Branch Manager
}
```

### 5. hasAnyRole()

Check if user has any of the roles:

```typescript
import { hasAnyRole } from '@/lib/rbac'

if (hasAnyRole(user, ['Super Admin', 'Branch Manager', 'Admin'])) {
  // User is an admin-level user
}
```

### 6. isSuperAdmin()

Check if user is Super Admin:

```typescript
import { isSuperAdmin } from '@/lib/rbac'

if (isSuperAdmin(user)) {
  // User has platform-level access
  // Automatically has ALL permissions
}
```

## PERMISSIONS Constant

All available permissions are defined in `PERMISSIONS` object:

### Dashboard
```typescript
PERMISSIONS.DASHBOARD_VIEW
```

### Users
```typescript
PERMISSIONS.USER_VIEW
PERMISSIONS.USER_CREATE
PERMISSIONS.USER_UPDATE
PERMISSIONS.USER_DELETE
```

### Roles
```typescript
PERMISSIONS.ROLE_VIEW
PERMISSIONS.ROLE_CREATE
PERMISSIONS.ROLE_UPDATE
PERMISSIONS.ROLE_DELETE
```

### Products - Basic CRUD
```typescript
PERMISSIONS.PRODUCT_VIEW
PERMISSIONS.PRODUCT_CREATE
PERMISSIONS.PRODUCT_UPDATE
PERMISSIONS.PRODUCT_DELETE
```

### Products - Field-Level Security
```typescript
PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE     // Can see cost price
PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN      // Can see profit calculations
PERMISSIONS.PRODUCT_VIEW_SUPPLIER           // Can see supplier information
PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK   // Can see stock at other locations
```

### Products - Stock Management
```typescript
PERMISSIONS.PRODUCT_OPENING_STOCK
PERMISSIONS.PRODUCT_LOCK_OPENING_STOCK
PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK
PERMISSIONS.PRODUCT_MODIFY_LOCKED_STOCK
```

### Products - Pricing
```typescript
PERMISSIONS.PRODUCT_PRICE_EDIT              // Edit own location prices
PERMISSIONS.PRODUCT_PRICE_EDIT_ALL          // Edit all locations prices
PERMISSIONS.PRODUCT_PRICE_GLOBAL            // Edit base/global prices
PERMISSIONS.PRODUCT_PRICE_BULK_EDIT         // Bulk price editing
PERMISSIONS.PRODUCT_PRICE_IMPORT            // Import prices from Excel
PERMISSIONS.PRODUCT_PRICE_EXPORT            // Export price lists
PERMISSIONS.PRODUCT_COST_AUDIT_VIEW         // View cost audit report
PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW   // View price comparison report
```

### Sales
```typescript
PERMISSIONS.SALE_VIEW
PERMISSIONS.SALE_CREATE
PERMISSIONS.SALE_UPDATE
PERMISSIONS.SALE_DELETE
PERMISSIONS.SALE_VOID
PERMISSIONS.SALE_REFUND
PERMISSIONS.SALE_VIEW_OWN                   // Only see own sales
```

### Purchases
```typescript
PERMISSIONS.PURCHASE_VIEW
PERMISSIONS.PURCHASE_CREATE
PERMISSIONS.PURCHASE_UPDATE
PERMISSIONS.PURCHASE_DELETE
PERMISSIONS.PURCHASE_APPROVE
```

### Inventory
```typescript
PERMISSIONS.INVENTORY_VIEW
PERMISSIONS.INVENTORY_ADJUSTMENT
PERMISSIONS.INVENTORY_TRANSFER
PERMISSIONS.STOCK_TRANSFER_VIEW
PERMISSIONS.STOCK_TRANSFER_CREATE
PERMISSIONS.STOCK_TRANSFER_SEND
PERMISSIONS.STOCK_TRANSFER_RECEIVE
```

### Reports
```typescript
PERMISSIONS.REPORT_SALES
PERMISSIONS.REPORT_PURCHASE
PERMISSIONS.REPORT_INVENTORY
PERMISSIONS.REPORT_PROFIT_LOSS
PERMISSIONS.REPORT_STOCK_ALERT
```

### Customers
```typescript
PERMISSIONS.CUSTOMER_VIEW
PERMISSIONS.CUSTOMER_CREATE
PERMISSIONS.CUSTOMER_UPDATE
PERMISSIONS.CUSTOMER_DELETE
```

### Suppliers
```typescript
PERMISSIONS.SUPPLIER_VIEW
PERMISSIONS.SUPPLIER_CREATE
PERMISSIONS.SUPPLIER_UPDATE
PERMISSIONS.SUPPLIER_DELETE
```

### Payments
```typescript
PERMISSIONS.PAYMENT_VIEW
PERMISSIONS.PAYMENT_CREATE
PERMISSIONS.PAYMENT_UPDATE
PERMISSIONS.PAYMENT_DELETE
```

### Shifts
```typescript
PERMISSIONS.SHIFT_VIEW
PERMISSIONS.SHIFT_VIEW_ALL
PERMISSIONS.SHIFT_OPEN
PERMISSIONS.SHIFT_CLOSE
```

### Settings
```typescript
PERMISSIONS.SETTINGS_VIEW
PERMISSIONS.SETTINGS_UPDATE
PERMISSIONS.BUSINESS_SETTINGS_VIEW
PERMISSIONS.BUSINESS_SETTINGS_UPDATE
```

### Super Admin
```typescript
PERMISSIONS.SUPERADMIN_ALL                  // Platform owner - has everything
```

## Implementation Patterns

### Pattern 1: API Route Protection

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any

  // Check permission
  if (!hasPermission(user, PERMISSIONS.PRODUCT_CREATE)) {
    return NextResponse.json(
      { error: 'Forbidden - Insufficient permissions' },
      { status: 403 }
    )
  }

  // User has permission - proceed with operation
  // ...
}
```

### Pattern 2: Client-Side Component Protection

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'

export default function ProductManagement() {
  const { data: session } = useSession()
  const user = session?.user as any

  const canCreate = hasPermission(user, PERMISSIONS.PRODUCT_CREATE)
  const canDelete = hasPermission(user, PERMISSIONS.PRODUCT_DELETE)
  const canViewCost = hasPermission(user, PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)

  return (
    <div>
      {/* Show create button only if user has permission */}
      {canCreate && (
        <Button onClick={() => createProduct()}>
          Create Product
        </Button>
      )}

      {/* Show cost column only if user can view it */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            {canViewCost && <th>Cost</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.price}</td>
              {canViewCost && <td>{product.cost}</td>}
              <td>
                {canDelete && (
                  <Button variant="destructive" onClick={() => deleteProduct(product.id)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Pattern 3: Custom Hook for Permissions

```typescript
// hooks/usePermissions.ts
import { useSession } from 'next-auth/react'
import { hasPermission, hasAnyPermission, hasRole, isSuperAdmin, PERMISSIONS } from '@/lib/rbac'

export function usePermissions() {
  const { data: session } = useSession()
  const user = session?.user as any

  return {
    user,
    can: (permission: string) => hasPermission(user, permission),
    canAny: (permissions: string[]) => hasAnyPermission(user, permissions),
    hasRole: (role: string) => hasRole(user, role),
    isSuperAdmin: () => isSuperAdmin(user),
  }
}

// Usage in components:
export default function MyComponent() {
  const { can, hasRole, isSuperAdmin } = usePermissions()

  if (isSuperAdmin()) {
    return <AdminPanel />
  }

  return (
    <div>
      {can(PERMISSIONS.PRODUCT_CREATE) && <CreateButton />}
      {hasRole('Manager') && <ManagerTools />}
    </div>
  )
}
```

### Pattern 4: Multi-Level Permission Check

```typescript
// Check different permission levels
const user = session.user as any

// Level 1: Can user view any sales?
const canViewSales = hasAnyPermission(user, [
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_VIEW_OWN
])

// Level 2: Can user view ALL sales or only their own?
const canViewAllSales = hasPermission(user, PERMISSIONS.SALE_VIEW)
const canViewOwnSales = hasPermission(user, PERMISSIONS.SALE_VIEW_OWN)

// Apply filter based on permission level
const where: any = {
  businessId: parseInt(user.businessId),
  deletedAt: null,
}

if (canViewOwnSales && !canViewAllSales) {
  // Restrict to user's own sales
  where.createdBy = parseInt(user.id)
}

const sales = await prisma.sale.findMany({ where })
```

### Pattern 5: Role-Based Logic

```typescript
import { hasAnyRole } from '@/lib/rbac'

const user = session.user as any

if (hasAnyRole(user, ['Super Admin', 'Branch Manager'])) {
  // Allow access to sensitive reports
  const financialReport = await generateFinancialReport()
}

// Check specific role
if (hasRole(user, 'Cashier')) {
  // Cashier-specific logic
  // e.g., auto-open shift on login
}
```

## Field-Level Security

Control what data users can see:

```typescript
const user = session.user as any

const canViewCost = hasPermission(user, PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)
const canViewProfit = hasPermission(user, PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN)
const canViewSupplier = hasPermission(user, PERMISSIONS.PRODUCT_VIEW_SUPPLIER)

const product = await prisma.product.findUnique({
  where: { id: productId },
  select: {
    id: true,
    name: true,
    sku: true,
    sellingPrice: true,
    // Conditionally include sensitive fields
    purchasePrice: canViewCost,
    profitMargin: canViewProfit,
    supplier: canViewSupplier ? {
      select: {
        id: true,
        name: true,
        contactPerson: true,
      }
    } : false,
  }
})
```

## Location-Based Access Control

```typescript
const user = session.user as any

// Get user's accessible locations
const accessibleLocations = user.locationIds || []

// Filter data by accessible locations
const products = await prisma.variationLocationDetails.findMany({
  where: {
    locationId: {
      in: accessibleLocations  // Only locations user can access
    },
    product: {
      businessId: parseInt(user.businessId)
    }
  }
})
```

## Super Admin Special Handling

Super Admin bypasses all permission checks:

```typescript
import { isSuperAdmin } from '@/lib/rbac'

const user = session.user as any

// Super Admin can access everything
if (isSuperAdmin(user)) {
  // Skip permission checks
  // Return all data without filters
  return await prisma.sale.findMany({
    where: { businessId: parseInt(user.businessId) }
  })
}

// Regular users need permission check
if (!hasPermission(user, PERMISSIONS.SALE_VIEW)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

## Best Practices

### ✅ DO:

- **Check permissions in API routes** - Never trust client-side checks alone
- **Use appropriate permission level** - Don't give more access than needed
- **Check permissions before showing UI** - Hide buttons users can't use
- **Filter data by permission level** - Show only what user can see
- **Use field-level security** - Hide sensitive fields from unauthorized users
- **Respect location access** - Filter by `locationIds`
- **Handle Super Admin** - Give them full access
- **Use the helper functions** - Don't write custom permission logic

### ❌ DON'T:

- **Don't skip permission checks** - Even for "internal" APIs
- **Don't check permissions only on client** - Always validate server-side
- **Don't hardcode role names** - Use the role checking functions
- **Don't forget Super Admin** - They should always pass checks
- **Don't mix permissions and roles** - Check permissions, not roles when possible
- **Don't expose sensitive data** - Check field-level permissions

## Common Permission Patterns

### Pattern: CRUD Permissions
```typescript
// View - Read access
PERMISSIONS.PRODUCT_VIEW

// Create - Write new records
PERMISSIONS.PRODUCT_CREATE

// Update - Modify existing records
PERMISSIONS.PRODUCT_UPDATE

// Delete - Remove records
PERMISSIONS.PRODUCT_DELETE
```

### Pattern: Field-Level Permissions
```typescript
// Base permission to see the entity
PERMISSIONS.PRODUCT_VIEW

// Additional permissions to see sensitive fields
PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE  // See cost
PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN    // See profit
PERMISSIONS.PRODUCT_VIEW_SUPPLIER         // See supplier
```

### Pattern: Scope Permissions
```typescript
// View all records
PERMISSIONS.SALE_VIEW

// View only own records
PERMISSIONS.SALE_VIEW_OWN
```

### Pattern: Action Permissions
```typescript
// Workflow actions
PERMISSIONS.PURCHASE_APPROVE
PERMISSIONS.SALE_VOID
PERMISSIONS.SALE_REFUND
PERMISSIONS.SHIFT_CLOSE
```

## Troubleshooting

### User doesn't have expected permission

1. Check if user's role includes the permission
2. Check if user has the permission directly assigned
3. Verify Super Admin gets all permissions automatically
4. Check session is properly loading permissions (in `auth.ts`)

### Permission check not working

1. Verify import: `import { hasPermission, PERMISSIONS } from '@/lib/rbac'`
2. Check user object exists: `const user = session.user as any`
3. Verify permission constant is correct: `PERMISSIONS.PRODUCT_CREATE`
4. Check Super Admin special case is handled

### UI shows but API blocks

Client-side and server-side permission checks are BOTH required:
- Client-side: Hide UI elements (UX improvement)
- Server-side: Enforce security (CRITICAL)

## File Locations

- **RBAC Library:** `/src/lib/rbac.ts` (2600 lines of permissions)
- **Auth Configuration:** `/src/lib/auth.ts` (permission loading)
- **Permission Hook:** `/src/hooks/usePermissions.ts` (client-side)

## Summary

This skill ensures:
1. ✅ Proper permission checking throughout the app
2. ✅ Role-based access control
3. ✅ Field-level security for sensitive data
4. ✅ Location-based access control
5. ✅ Super Admin special handling
6. ✅ Consistent permission patterns

**Remember:** Always check permissions server-side in API routes. Client-side checks are for UX only!
