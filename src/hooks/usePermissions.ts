/**
 * USE PERMISSIONS HOOK
 * ====================
 *
 * This is the PRIMARY hook for checking user permissions in React components.
 * Use it to show/hide UI elements based on what the current user is allowed to do.
 *
 * RBAC (Role-Based Access Control):
 * ----------------------------------
 * The system uses RBAC to control who can do what:
 * - **Permissions**: Specific actions (e.g., "product.create", "sale.delete")
 * - **Roles**: Groups of permissions (e.g., "Admin" has many permissions, "Cashier" has fewer)
 * - **Users**: Assigned one or more roles, which grant them permissions
 *
 * This hook provides helper functions to check if the current user has specific permissions or roles.
 *
 * WHAT THIS HOOK RETURNS:
 * -----------------------
 * @returns Object with permission checking functions:
 *   - **can(permission)**: Does user have this ONE specific permission?
 *   - **canAny(permissions)**: Does user have AT LEAST ONE of these permissions?
 *   - **canAll(permissions)**: Does user have ALL of these permissions?
 *   - **hasRole(role)**: Does user have this specific role?
 *   - **hasAnyRole(roles)**: Does user have at least one of these roles?
 *   - **user**: The current user object (from session)
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Show/Hide Buttons Based on Permissions**
 * ```tsx
 * import { usePermissions } from '@/hooks/usePermissions'
 * import { PERMISSIONS } from '@/lib/rbac'
 *
 * export default function ProductsPage() {
 *   const { can } = usePermissions()
 *
 *   return (
 *     <div>
 *       <h1>Products</h1>
 *       {can(PERMISSIONS.PRODUCT_CREATE) && (
 *         <Button>Add New Product</Button>  // Only shown if user can create products
 *       )}
 *       {can(PERMISSIONS.PRODUCT_DELETE) && (
 *         <Button variant="destructive">Delete</Button>  // Only admins/managers
 *       )}
 *     </div>
 *   )
 * }
 * ```
 *
 * 2. **Check Multiple Permissions (OR logic)**
 * ```tsx
 * const { canAny } = usePermissions()
 *
 * // Show if user can EITHER view OR create products
 * if (canAny([PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE])) {
 *   return <ProductCatalog />
 * }
 * ```
 *
 * 3. **Check Multiple Permissions (AND logic)**
 * ```tsx
 * const { canAll } = usePermissions()
 *
 * // Show only if user can BOTH edit products AND manage inventory
 * if (canAll([PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.INVENTORY_MANAGE])) {
 *   return <AdvancedInventoryTools />
 * }
 * ```
 *
 * 4. **Role-Based UI**
 * ```tsx
 * const { hasRole, user } = usePermissions()
 *
 * return (
 *   <div>
 *     <h1>Welcome, {user?.username}</h1>
 *     {hasRole('Admin') && <AdminDashboard />}
 *     {hasRole('Cashier') && <CashierPOS />}
 *   </div>
 * )
 * ```
 *
 * 5. **Conditional Rendering with User Data**
 * ```tsx
 * const { user, can } = usePermissions()
 *
 * if (!user) {
 *   return <LoginPrompt />  // User not logged in
 * }
 *
 * return (
 *   <div>
 *     <p>Business: {user.businessName}</p>
 *     <p>Location: {user.locationName}</p>
 *     {can(PERMISSIONS.REPORTS_VIEW) && <ReportsMenu />}
 *   </div>
 * )
 * ```
 *
 * HOW IT WORKS:
 * -------------
 * 1. Gets the current session using NextAuth's useSession()
 * 2. Extracts the user object from the session
 * 3. Wraps RBAC helper functions to work with the current user
 * 4. Returns an object with permission checking functions
 *
 * IMPORTANT NOTES:
 * ----------------
 * - This is a CLIENT-SIDE hook (uses "use client" directive)
 * - For SERVER-SIDE permission checks, use getServerSession() and call hasPermission() directly
 * - UI checks are for user experience - ALWAYS verify permissions on the API side too
 * - Never trust client-side permission checks for security - they can be bypassed
 * - API routes should independently verify permissions before performing actions
 *
 * PERMISSIONS LIST:
 * -----------------
 * See `src/lib/rbac.ts` for the complete list of available permissions.
 * Common ones:
 * - PRODUCT_VIEW, PRODUCT_CREATE, PRODUCT_EDIT, PRODUCT_DELETE
 * - SALE_CREATE, SALE_VIEW, SALE_VOID, SALE_REFUND
 * - INVENTORY_MANAGE, INVENTORY_TRANSFER
 * - USER_MANAGE, ROLE_MANAGE
 * - REPORTS_VIEW, REPORTS_EXPORT
 */

"use client"

import { useSession } from "next-auth/react"
import { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, Permission } from "@/lib/rbac"

/**
 * React hook for checking user permissions and roles in client components
 */
export function usePermissions() {
  // Get the current authentication session (contains user info)
  const { data: session } = useSession()
  const user = session?.user as any

  // Return an object with permission checking helper functions
  return {
    /** Check if user has a specific permission */
    can: (permission: Permission) => hasPermission(user, permission),

    /** Check if user has AT LEAST ONE of the given permissions (OR logic) */
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),

    /** Check if user has ALL of the given permissions (AND logic) */
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),

    /** Check if user has a specific role */
    hasRole: (role: string) => hasRole(user, role),

    /** Check if user has AT LEAST ONE of the given roles */
    hasAnyRole: (roles: string[]) => hasAnyRole(user, roles),

    /** The current user object (with businessId, permissions, roles, etc.) */
    user,
  }
}
