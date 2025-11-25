/**
 * MENU PERMISSIONS MODULE
 * =======================
 *
 * This module controls WHICH MENU ITEMS users can see in the sidebar/navigation.
 * Unlike action permissions (RBAC - what users can DO), menu permissions control
 * what navigation options are VISIBLE to users.
 *
 * WHY MENU PERMISSIONS?
 * ---------------------
 * - **User Experience**: Don't show menu items users can't access (reduces confusion)
 * - **Security by Obscurity**: Hide admin/manager features from cashiers
 * - **Role-Based UI**: Different users see different menus based on their job
 * - **Customization**: Override role defaults for specific users
 * - **Hierarchical Control**: Parent menus auto-hide if user can't access any children
 *
 * HOW IT WORKS:
 * -------------
 * 1. Menu items are stored in the MenuPermission table (hierarchical tree structure)
 * 2. Roles can be assigned menu permissions via RoleMenuPermission (role → menus)
 * 3. Individual users can have menu overrides via UserMenuPermission (user → menus)
 * 4. User's final menu access = Role menus + User overrides (union of both)
 * 5. Sidebar component calls hasMenuAccess() to show/hide each menu item
 *
 * DATABASE RELATIONSHIPS:
 * -----------------------
 * ```
 * MenuPermission (id, key, name, href, icon, order, parentId)
 *       ↓
 * RoleMenuPermission (roleId, menuPermissionId)  ← Links Roles to Menus
 *       ↓
 * UserMenuPermission (userId, menuPermissionId)  ← User-specific overrides
 * ```
 *
 * MENU HIERARCHY EXAMPLE:
 * -----------------------
 * ```
 * Dashboard (parent)
 * ├── Products (parent)
 * │   ├── Product List (child)
 * │   ├── Categories (child)
 * │   └── Brands (child)
 * ├── Sales (parent)
 * │   ├── All Sales (child)
 * │   └── Sales Reports (child)
 * └── Settings (parent)
 *     ├── Business Settings (child)
 *     └── User Management (child)
 * ```
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Check if User Can See a Menu Item** (Sidebar Component)
 * ```tsx
 * import { hasMenuAccess } from '@/lib/menu-permissions'
 *
 * // In Sidebar component
 * const canSeeProducts = await hasMenuAccess(userId, 'menu.products')
 * if (canSeeProducts) {
 *   return <NavLink href="/dashboard/products">Products</NavLink>
 * }
 * ```
 *
 * 2. **Get All Menus User Can Access**
 * ```tsx
 * const menuKeys = await getUserAccessibleMenuKeys(userId)
 * // Returns: ['menu.dashboard', 'menu.products', 'menu.sales']
 *
 * // Filter sidebar items
 * const visibleMenus = allMenus.filter(menu => menuKeys.includes(menu.key))
 * ```
 *
 * 3. **Get Menu Hierarchy for Admin Panel**
 * ```tsx
 * const menuTree = await getMenuStructure()
 * // Returns nested structure:
 * // [
 * //   {
 * //     id: 1, key: 'menu.products', name: 'Products',
 * //     children: [
 * //       { id: 2, key: 'menu.products.list', name: 'Product List' },
 * //       { id: 3, key: 'menu.products.categories', name: 'Categories' }
 * //     ]
 * //   }
 * // ]
 *
 * // Render as expandable tree in settings page
 * ```
 *
 * 4. **Update Role Menu Permissions** (Settings Page)
 * ```tsx
 * // When admin configures which menus a role can see
 * await updateRoleMenuPermissions(roleId, [
 *   'menu.dashboard',
 *   'menu.products',
 *   'menu.products.list',
 *   'menu.sales'
 * ])
 * // All users with this role now see these menus
 * ```
 *
 * 5. **Override Menus for Specific User**
 * ```tsx
 * // Give one cashier access to reports (override role defaults)
 * await updateUserMenuPermissions(userId, [
 *   'menu.dashboard',
 *   'menu.sales',
 *   'menu.reports'  // This user gets extra menu access
 * ])
 * ```
 *
 * 6. **Check Parent-Child Hierarchy**
 * ```tsx
 * // Check if user can see menu AND its parent
 * const canSeeCategoryPage = await hasMenuAccessWithParentCheck(
 *   userId,
 *   'menu.products.categories'  // Child menu
 * )
 * // Returns false if user doesn't have access to 'menu.products' (parent)
 * // This prevents orphaned child menus from appearing
 * ```
 *
 * 7. **Auto-Select Parent Menus**
 * ```tsx
 * // When admin selects child menus, auto-select parents
 * const selectedKeys = ['menu.products.list', 'menu.products.categories']
 * const allRequiredIds = await getMenuIdsWithParents(selectedKeys)
 * // Returns IDs for: 'menu.products' (parent), 'menu.products.list', 'menu.products.categories'
 * // Prevents saving invalid state where child exists but parent doesn't
 * ```
 *
 * 8. **Auto-Unselect Children**
 * ```tsx
 * // When admin unchecks parent menu, remove all children too
 * const childKeys = await getDescendantMenuKeys('menu.products')
 * // Returns: ['menu.products.list', 'menu.products.categories', 'menu.products.brands']
 * // Remove all these when parent is unchecked
 * ```
 *
 * KEY CONCEPTS:
 * -------------
 *
 * **Hierarchical Tree Structure**:
 * - Menus organized as parent-child relationships (using `parentId`)
 * - Root menus: `parentId = null` (top-level items like Dashboard, Products)
 * - Child menus: `parentId` points to parent menu ID
 * - Can nest multiple levels deep (parent → child → grandchild)
 *
 * **Two-Pass Tree Building Algorithm**:
 * - First pass: Create all nodes in a Map (fast O(1) lookup by ID)
 * - Second pass: Link children to parents by traversing again
 * - Why? You can't link a child to a parent that doesn't exist yet
 * - This is a common pattern in computer science for building trees
 *
 * **Permission Inheritance**:
 * - Roles define DEFAULT menu access for all users with that role
 * - User overrides ADD EXTRA menus beyond what their roles provide
 * - Formula: User menus = Union(All role menus) ∪ User-specific menus
 * - User overrides EXTEND (not replace) role permissions
 *
 * **Parent-Child Validation**:
 * - If user can't see parent menu, hide all child menus too
 * - Example: If cashier can't see "Products", don't show "Product List"
 * - `hasMenuAccessWithParentCheck()` recursively validates entire hierarchy
 * - Prevents orphaned child menus appearing without context
 *
 * **Menu Keys vs Menu IDs**:
 * - **Key**: Human-readable identifier (e.g., "menu.products.list")
 * - **ID**: Database primary key (auto-increment number)
 * - Keys are stable across deployments (safe for configs)
 * - IDs can change if database is recreated (not safe for hardcoding)
 * - Always use keys in code, convert to IDs only for database queries
 *
 * TYPESCRIPT PATTERNS EXPLAINED:
 * -------------------------------
 *
 * **Interface with Optional Children**:
 * ```typescript
 * interface MenuPermissionNode {
 *   children?: MenuPermissionNode[]  // ? means optional
 * }
 * ```
 * - Root menus have children, leaf menus don't
 * - `?` prevents errors when accessing `menu.children` on leaf nodes
 * - TypeScript will force you to check `if (menu.children)` before using
 *
 * **Map<number, T> for Fast Lookups**:
 * ```typescript
 * const menuMap = new Map<number, MenuPermissionNode>()
 * ```
 * - Map is like an object but optimized for lookups
 * - O(1) constant time to find a menu by ID (faster than array.find)
 * - Used in tree building for quick parent-child linking
 *
 * **Set for Unique Values**:
 * ```typescript
 * const roleMenuKeys = new Set<string>()
 * ```
 * - Set automatically removes duplicates
 * - If user has multiple roles with same menu, it only appears once
 * - Convert to array with `Array.from(set)` for return value
 *
 * **Async Recursive Functions**:
 * ```typescript
 * async function collectDescendants(parentId: number) {
 *   await collectDescendants(child.id)  // Recursive call
 * }
 * ```
 * - Function calls itself to traverse tree depth-first
 * - Each level waits for children to complete (await)
 * - Continues until no more children exist (base case)
 *
 * **Promise<T[]> Return Types**:
 * ```typescript
 * async function getMenuKeys(): Promise<string[]>
 * ```
 * - `Promise` = Will complete in the future (async operation)
 * - `<string[]>` = Will resolve to an array of strings
 * - TypeScript ensures you `await` before using the result
 *
 * PRISMA PATTERNS:
 * ----------------
 *
 * **Include for Nested Data**:
 * ```typescript
 * include: { menuPermission: true }
 * ```
 * - Fetches related MenuPermission data with RoleMenuPermission
 * - Returns: `{ roleId, menuPermissionId, menuPermission: {...} }`
 * - Alternative to manual JOIN queries (Prisma does it for you)
 *
 * **Select for Partial Data**:
 * ```typescript
 * select: { id: true }
 * ```
 * - Only fetch the `id` field (ignore name, href, icon, etc.)
 * - Reduces data transfer and memory usage
 * - Useful when you only need IDs for filtering/mapping
 *
 * **FindUnique with Where**:
 * ```typescript
 * findUnique({ where: { key } })
 * ```
 * - Fetches ONE record matching unique constraint
 * - Returns null if not found (not an error)
 * - Only works on fields marked `@unique` in schema
 *
 * **DeleteMany + CreateMany Pattern**:
 * ```typescript
 * await prisma.roleMenuPermission.deleteMany({ where: { roleId } })
 * await prisma.roleMenuPermission.createMany({ data: [...] })
 * ```
 * - Replace all existing records with new ones
 * - Used for "save all" updates (like checkboxes in settings)
 * - Not atomic (not a transaction) - could fail halfway
 * - For production, wrap in `prisma.$transaction([...])` for safety
 *
 * **OrderBy for Sorted Results**:
 * ```typescript
 * orderBy: { order: 'asc' }
 * ```
 * - Returns menus sorted by the `order` field (ascending)
 * - Ensures sidebar shows menus in correct sequence
 * - Multiple orderBy: `orderBy: [{ order: 'asc' }, { name: 'asc' }]`
 *
 * PERFORMANCE NOTES:
 * ------------------
 * - `getUserAccessibleMenuKeys()` makes N+1 queries (loops over roles)
 * - For better performance, consider batch query with `IN` clause
 * - Menu data rarely changes - good candidate for caching
 * - Consider React Query cache or Redis for production
 * - Tree building is O(n) but done on every call - cache result
 *
 * IMPORTANT NOTES:
 * ----------------
 * - Menu permissions control VISIBILITY, not FUNCTIONALITY
 * - Always verify action permissions (RBAC) on API routes
 * - Hiding a menu doesn't prevent direct URL access
 * - User could type `/dashboard/admin` even if menu is hidden
 * - Always enforce permissions on both client AND server side
 * - Menu keys must be unique across entire system
 * - Parent menus can exist without children (valid state)
 * - Child menus CANNOT exist without parent (would be orphaned)
 */

import { prisma } from '@/lib/prisma'

/**
 * Menu Permission Node Interface
 *
 * Represents a single menu item in the navigation hierarchy.
 * Used for building tree structures and checking access permissions.
 *
 * @property id - Database primary key (auto-increment)
 * @property key - Unique identifier (e.g., "menu.products.list")
 * @property name - Display name shown in UI (e.g., "Product List")
 * @property href - URL path (e.g., "/dashboard/products/list") or null for parent-only menus
 * @property icon - Icon name/class (e.g., "ShoppingBagIcon") or null
 * @property order - Sort order for display (lower numbers appear first)
 * @property parentId - ID of parent menu (null for root-level menus)
 * @property children - Array of child menu nodes (optional - only exists after tree building)
 *
 * TypeScript Concept: Optional Property (?)
 * - `children?:` means this property may or may not exist
 * - Leaf menus (no children) won't have this property
 * - Parent menus get this property added during tree building
 * - Must check `if (menu.children)` before accessing to avoid errors
 */
export interface MenuPermissionNode {
  id: number
  key: string
  name: string
  href: string | null
  icon: string | null
  order: number
  parentId: number | null
  children?: MenuPermissionNode[]
}

/**
 * Get all menu permissions as a hierarchical tree structure
 *
 * Converts a flat list of menus into a nested tree where children are
 * nested inside their parent menus.
 *
 * Algorithm: Two-Pass Tree Building
 * ----------------------------------
 * This is a classic computer science pattern for building trees from flat data.
 *
 * Why Two Passes?
 * - You can't link a child to a parent that doesn't exist yet
 * - First pass creates ALL nodes so they exist in memory
 * - Second pass can safely link children to parents (all parents exist now)
 *
 * Example Input (flat array from database):
 * [
 *   { id: 1, name: "Products", parentId: null },
 *   { id: 2, name: "Product List", parentId: 1 },
 *   { id: 3, name: "Categories", parentId: 1 }
 * ]
 *
 * Example Output (nested tree):
 * [
 *   {
 *     id: 1, name: "Products", parentId: null,
 *     children: [
 *       { id: 2, name: "Product List", parentId: 1 },
 *       { id: 3, name: "Categories", parentId: 1 }
 *     ]
 *   }
 * ]
 *
 * @returns Array of root-level menu nodes (each may contain nested children)
 */
export async function getMenuStructure(): Promise<MenuPermissionNode[]> {
  // Fetch all menus from database, sorted by display order
  // Prisma Pattern: orderBy ensures menus appear in correct sequence
  const allMenus = await prisma.menuPermission.findMany({
    orderBy: {
      order: 'asc',  // Ascending order (1, 2, 3, ...)
    },
  })

  // Data structures for tree building
  // Map allows O(1) lookup by ID (faster than array.find which is O(n))
  const menuMap = new Map<number, MenuPermissionNode>()
  const rootMenus: MenuPermissionNode[] = []  // Top-level menus (parentId = null)

  // FIRST PASS: Create all menu nodes
  // ---------------------------------
  // Convert database records to MenuPermissionNode objects
  // Store in Map for fast lookup in second pass
  allMenus.forEach((menu) => {
    menuMap.set(menu.id, {
      id: menu.id,
      key: menu.key,
      name: menu.name,
      href: menu.href,
      icon: menu.icon,
      order: menu.order,
      parentId: menu.parentId,
      children: [],  // Initialize empty children array (may be populated in second pass)
    })
  })

  // SECOND PASS: Build parent-child relationships
  // ----------------------------------------------
  // Now that ALL nodes exist in menuMap, we can safely link children to parents
  allMenus.forEach((menu) => {
    // Get the node we created in first pass (non-null assertion ! because we know it exists)
    const node = menuMap.get(menu.id)!

    // Is this a root-level menu (no parent)?
    if (menu.parentId === null) {
      rootMenus.push(node)  // Add to root array
    } else {
      // This is a child menu - find its parent
      const parent = menuMap.get(menu.parentId)

      if (parent) {
        // Ensure parent has children array initialized
        if (!parent.children) {
          parent.children = []
        }
        // Add this node to parent's children array
        parent.children.push(node)
      }
      // If parent not found, menu is orphaned (shouldn't happen with proper foreign keys)
    }
  })

  // Return only root menus (children are nested inside)
  // UI can recursively render: menu → menu.children → menu.children[0].children → ...
  return rootMenus
}

/**
 * Get flat list of all menu permissions
 *
 * Returns menus as a simple array (not nested tree).
 * Useful for displaying checkboxes in settings or searching.
 *
 * @returns Flat array of all menus, sorted by display order
 */
export async function getAllMenuPermissions(): Promise<MenuPermissionNode[]> {
  // Fetch all menus in display order
  const menus = await prisma.menuPermission.findMany({
    orderBy: [{ order: 'asc' }],
  })

  // Convert Prisma model to MenuPermissionNode interface
  // TypeScript Pattern: .map() transforms each item in array
  return menus.map((menu) => ({
    id: menu.id,
    key: menu.key,
    name: menu.name,
    href: menu.href,
    icon: menu.icon,
    order: menu.order,
    parentId: menu.parentId,
  }))
}

/**
 * Get menu permission by key
 */
export async function getMenuPermissionByKey(
  key: string
): Promise<MenuPermissionNode | null> {
  const menu = await prisma.menuPermission.findUnique({
    where: { key },
  })

  if (!menu) return null

  return {
    id: menu.id,
    key: menu.key,
    name: menu.name,
    href: menu.href,
    icon: menu.icon,
    order: menu.order,
    parentId: menu.parentId,
  }
}

/**
 * Get all menu keys that a specific role has access to
 */
export async function getRoleMenuPermissions(roleId: number): Promise<string[]> {
  const roleMenus = await prisma.roleMenuPermission.findMany({
    where: { roleId },
    include: {
      menuPermission: true,
    },
  })

  return roleMenus.map((rm) => rm.menuPermission.key)
}

/**
 * Get all menu keys that a specific user has direct access to (overrides)
 */
export async function getUserMenuPermissions(userId: number): Promise<string[]> {
  const userMenus = await prisma.userMenuPermission.findMany({
    where: { userId },
    include: {
      menuPermission: true,
    },
  })

  return userMenus.map((um) => um.menuPermission.key)
}

/**
 * Get all menu keys that a user can access (combines role + user permissions)
 *
 * This is the CORE function that determines what menus a user can see.
 * It merges permissions from two sources:
 * 1. Role-based permissions (from all roles the user has)
 * 2. User-specific overrides (direct menu grants)
 *
 * Permission Merging Logic:
 * -------------------------
 * User's Final Menus = (All Role Menus) ∪ (User Override Menus)
 *
 * Example:
 * - User has role "Cashier" with menus: ['menu.dashboard', 'menu.sales']
 * - User also has role "Stock Clerk" with menus: ['menu.inventory']
 * - User has direct override: ['menu.reports']
 * - Final result: ['menu.dashboard', 'menu.sales', 'menu.inventory', 'menu.reports']
 *
 * Why Union (not Override)?
 * - Users can have MULTIPLE roles (cashier + stock clerk)
 * - Each role adds menus (doesn't replace)
 * - User overrides ADD extra menus (doesn't replace role menus)
 * - This is ADDITIVE permissions (more roles = more access)
 *
 * @param userId - The user to check permissions for
 * @returns Array of menu keys the user can access (deduplicated)
 */
export async function getUserAccessibleMenuKeys(userId: number): Promise<string[]> {
  // STEP 1: Get user's direct menu permissions (overrides)
  // These are menu grants assigned directly to the user (not through roles)
  const userMenus = await getUserMenuPermissions(userId)

  // STEP 2: Get all roles assigned to this user
  // Prisma Pattern: select only the fields we need (roleId) to reduce data transfer
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },  // Only fetch roleId, not entire UserRole object
  })

  // EDGE CASE: User has no roles and no direct permissions
  if (userRoles.length === 0 && userMenus.length === 0) {
    return []  // No access to any menus
  }

  // STEP 3: Collect menu keys from ALL user's roles
  // TypeScript Pattern: Set<string> automatically removes duplicates
  // If user has multiple roles with same menu, it appears only once
  const roleMenuKeys = new Set<string>()

  // Loop through each role and add its menus to the set
  // N+1 Query Warning: This makes one query per role (could be optimized with IN clause)
  for (const userRole of userRoles) {
    const roleMenus = await getRoleMenuPermissions(userRole.roleId)
    roleMenus.forEach((key) => roleMenuKeys.add(key))  // Set.add() ignores duplicates
  }

  // STEP 4: Merge role menus with user-specific overrides
  // Spread operator [...roleMenuKeys] converts Set to Array
  // Then create new Set with both arrays merged (automatically deduplicates)
  const allMenuKeys = new Set<string>([...roleMenuKeys, ...userMenus])

  // Convert Set back to Array for return
  // Why Set? Automatically removes duplicates if a menu appears in both role and user overrides
  return Array.from(allMenuKeys)
}

/**
 * Check if a user has access to a specific menu by key
 * This is the main function used in the Sidebar component
 */
export async function hasMenuAccess(
  userId: number,
  menuKey: string
): Promise<boolean> {
  const accessibleKeys = await getUserAccessibleMenuKeys(userId)
  return accessibleKeys.includes(menuKey)
}

/**
 * Check if user has access to a menu and also include parent check
 *
 * This function validates the ENTIRE hierarchy from root to child.
 * A child menu should only be visible if user has access to ALL parents.
 *
 * Why Recursive Parent Checking?
 * -------------------------------
 * - Prevents orphaned menus appearing without context
 * - Example: Don't show "Product Categories" if user can't see "Products" menu
 * - Ensures logical UI structure (can't access child without parent)
 *
 * How Recursion Works Here:
 * -------------------------
 * 1. Check if user can see THIS menu → If no, return false
 * 2. If this menu has a parent → Check parent recursively
 * 3. Parent check repeats steps 1-2 for parent → Up the tree
 * 4. Continue until reaching root menu (parentId = null)
 * 5. If ANY ancestor returns false, entire check fails
 *
 * Example Call Chain:
 * ```
 * hasMenuAccessWithParentCheck(userId, 'menu.products.categories')
 *   → Check 'menu.products.categories' (child) → User has access ✓
 *   → Check parent 'menu.products' → hasMenuAccessWithParentCheck(userId, 'menu.products')
 *     → Check 'menu.products' (parent) → User has access ✓
 *     → No parent (root level) → return true
 *   → All checks passed → return true
 * ```
 *
 * @param userId - The user to check
 * @param menuKey - The menu key to validate (validates entire hierarchy)
 * @returns true only if user has access to menu AND all parent menus
 */
export async function hasMenuAccessWithParentCheck(
  userId: number,
  menuKey: string
): Promise<boolean> {
  // STEP 1: Get the menu item details
  const menu = await getMenuPermissionByKey(menuKey)
  if (!menu) return false  // Menu doesn't exist in database

  // STEP 2: Check if user has access to THIS specific menu
  const hasAccess = await hasMenuAccess(userId, menuKey)
  if (!hasAccess) return false  // User doesn't have permission for this menu

  // STEP 3: If menu has a parent, recursively check parent access
  // Base Case: If parentId is null (root menu), skip this and return true
  if (menu.parentId !== null) {
    // Fetch parent menu details
    const parentMenu = await prisma.menuPermission.findUnique({
      where: { id: menu.parentId },
    })

    if (parentMenu) {
      // RECURSIVE CALL: Check if user has access to parent (and parent's parent, etc.)
      // This call repeats the entire function for the parent menu
      const hasParentAccess = await hasMenuAccessWithParentCheck(userId, parentMenu.key)

      // If user doesn't have access to parent, child should be hidden
      if (!hasParentAccess) return false
    }
  }

  // All checks passed:
  // - User has access to this menu ✓
  // - User has access to all parent menus (or this is root) ✓
  return true
}

/**
 * Update role menu permissions
 *
 * Replaces ALL existing menu permissions for a role with new ones.
 * This is used when admin saves role menu configuration (e.g., checkboxes in settings).
 *
 * Pattern: Delete All + Create All
 * ---------------------------------
 * - Delete all existing menu permissions for this role
 * - Create new permissions based on provided menu keys
 * - This is simpler than calculating diff (what to add/remove)
 * - Common pattern for "save all" checkbox updates
 *
 * Why Not Use a Transaction?
 * --------------------------
 * - This code SHOULD wrap delete+create in a transaction for safety
 * - If create fails after delete, role would have no menus (bad state)
 * - Production code should use: `await prisma.$transaction([delete, create])`
 * - Current implementation trades safety for simplicity
 *
 * Example Usage:
 * ```typescript
 * // Admin unchecks "Reports" menu for "Cashier" role
 * await updateRoleMenuPermissions(cashierRoleId, [
 *   'menu.dashboard',
 *   'menu.sales',
 *   'menu.products'
 *   // 'menu.reports' removed - cashiers can't see reports anymore
 * ])
 * ```
 *
 * @param roleId - The role to update
 * @param menuKeys - Array of menu keys this role should have access to
 */
export async function updateRoleMenuPermissions(
  roleId: number,
  menuKeys: string[]
): Promise<void> {
  // STEP 1: Convert menu keys to menu IDs
  // API uses keys (stable), database stores IDs (primary keys)
  // Prisma Pattern: 'in' operator matches any value in array (SQL: WHERE key IN (...))
  const menus = await prisma.menuPermission.findMany({
    where: {
      key: {
        in: menuKeys,  // Match menus whose key is in the provided array
      },
    },
    select: { id: true },  // Only fetch IDs (we don't need name, href, etc.)
  })

  // Extract just the IDs from the results
  // TypeScript Pattern: .map() transforms array of objects to array of IDs
  const menuIds = menus.map((m) => m.id)

  // STEP 2: Delete ALL existing menu permissions for this role
  // This clears the slate before creating new permissions
  // Prisma Pattern: deleteMany removes all matching records
  await prisma.roleMenuPermission.deleteMany({
    where: { roleId },
  })

  // STEP 3: Create new menu permissions
  // Bulk insert all menu permissions at once (faster than creating one-by-one)
  // Prisma Pattern: createMany inserts multiple records in one query
  await prisma.roleMenuPermission.createMany({
    data: menuIds.map((menuId) => ({
      roleId,              // The role we're updating
      menuPermissionId: menuId,  // Each menu the role can access
    })),
  })
}

/**
 * Update user menu permissions (overrides)
 *
 * Replaces ALL user-specific menu overrides with new ones.
 * These are EXTRA menus beyond what the user's roles provide.
 *
 * When to Use This:
 * -----------------
 * - Give one specific user extra menu access (beyond their role)
 * - Example: One cashier needs to see reports, but others don't
 * - Customize menu access for power users or special cases
 *
 * How User Overrides Work:
 * ------------------------
 * - User overrides ADD menus (don't replace role menus)
 * - Final menus = Role menus ∪ User override menus
 * - If user has both role and override for same menu, it appears once
 * - User overrides cannot REMOVE role menus (only add)
 *
 * Example:
 * ```typescript
 * // User is a Cashier (has menu.sales from role)
 * // Give them extra access to inventory menu
 * await updateUserMenuPermissions(userId, [
 *   'menu.inventory',  // Extra menu beyond role
 *   'menu.reports'     // Another extra menu
 * ])
 * // Final menus: menu.sales (from role) + menu.inventory + menu.reports
 * ```
 *
 * @param userId - The user to update
 * @param menuKeys - Array of menu keys to grant as user-specific overrides
 */
export async function updateUserMenuPermissions(
  userId: number,
  menuKeys: string[]
): Promise<void> {
  // STEP 1: Convert menu keys to menu IDs (same as role update)
  const menus = await prisma.menuPermission.findMany({
    where: {
      key: {
        in: menuKeys,
      },
    },
    select: { id: true },
  })

  const menuIds = menus.map((m) => m.id)

  // STEP 2: Delete ALL existing user menu overrides
  // Clears previous overrides before saving new ones
  await prisma.userMenuPermission.deleteMany({
    where: { userId },
  })

  // STEP 3: Create new user menu overrides
  // These add EXTRA menus beyond what user's roles provide
  await prisma.userMenuPermission.createMany({
    data: menuIds.map((menuId) => ({
      userId,
      menuPermissionId: menuId,
    })),
  })
}

/**
 * Get menu IDs for a list of menu keys (including parent menus recursively)
 *
 * When admin selects child menus in settings, this function auto-selects
 * all parent menus too. This prevents invalid states where a child menu
 * exists but its parent doesn't.
 *
 * Why Auto-Select Parents?
 * ------------------------
 * - Child menus cannot exist without parent menus
 * - If user can see "Product Categories" but not "Products", it's orphaned
 * - This function ensures hierarchical integrity
 * - Common in tree-based UI (checkbox trees, file explorers)
 *
 * How It Works:
 * -------------
 * 1. For each selected menu, add its ID to result set
 * 2. Walk UP the tree (child → parent → grandparent → root)
 * 3. Add each ancestor's ID to result set
 * 4. Set automatically deduplicates if multiple children share same parent
 *
 * Example:
 * ```typescript
 * // Admin selects these menus in settings:
 * const selectedKeys = [
 *   'menu.products.list',      // Child menu
 *   'menu.products.categories' // Another child menu (same parent)
 * ]
 *
 * const allIds = await getMenuIdsWithParents(selectedKeys)
 * // Returns IDs for:
 * // - 'menu.products' (parent - auto-selected)
 * // - 'menu.products.list' (explicitly selected)
 * // - 'menu.products.categories' (explicitly selected)
 * ```
 *
 * Algorithm: Iterative Upward Traversal
 * --------------------------------------
 * - Uses a while loop instead of recursion (more efficient for this case)
 * - Walks up the tree until reaching root (parentId = null)
 * - Each iteration moves one level higher
 *
 * @param menuKeys - Array of menu keys that admin selected
 * @returns Array of menu IDs (includes selected menus + all their ancestors)
 */
export async function getMenuIdsWithParents(menuKeys: string[]): Promise<number[]> {
  // Set prevents duplicates (if multiple children have same parent)
  const menuIds = new Set<number>()

  // Process each selected menu
  for (const key of menuKeys) {
    const menu = await getMenuPermissionByKey(key)
    if (!menu) continue  // Skip if menu doesn't exist

    // Add this menu's ID to result
    menuIds.add(menu.id)

    // WALK UP THE TREE: Add all parent IDs recursively
    let currentMenu = menu
    while (currentMenu.parentId !== null) {
      // Fetch the parent menu
      const parent = await prisma.menuPermission.findUnique({
        where: { id: currentMenu.parentId },
      })

      if (!parent) break  // Parent not found (shouldn't happen)

      // Add parent ID to result set
      menuIds.add(parent.id)

      // Move up one level (parent becomes current menu)
      // Convert Prisma model to MenuPermissionNode for next iteration
      currentMenu = {
        id: parent.id,
        key: parent.key,
        name: parent.name,
        href: parent.href,
        icon: parent.icon,
        order: parent.order,
        parentId: parent.parentId,
      }

      // Loop continues if parent has a parent (grandparent exists)
      // Loop stops when parentId is null (reached root menu)
    }
  }

  // Convert Set to Array and return
  // Set ensures no duplicate IDs even if multiple children share same parent
  return Array.from(menuIds)
}

/**
 * Get all descendant menu keys for a given parent key
 *
 * When admin unchecks a parent menu in settings, this function finds
 * ALL children and grandchildren to uncheck them too. This prevents
 * orphaned child menus appearing without their parent.
 *
 * Why Auto-Uncheck Children?
 * ---------------------------
 * - If parent is unchecked, children become orphaned
 * - "Product Categories" shouldn't exist if "Products" is unchecked
 * - This maintains hierarchical integrity (inverse of auto-selecting parents)
 * - Common pattern in tree-based UIs (checkbox trees, folder structures)
 *
 * How It Works:
 * -------------
 * 1. Find all immediate children of the parent
 * 2. For each child, recursively find ITS children (grandchildren)
 * 3. Continue until no more descendants exist (leaf menus)
 * 4. Return flat array of ALL descendant keys (children + grandchildren + ...)
 *
 * Example:
 * ```typescript
 * // Menu structure:
 * // Products
 * //   ├── Product List
 * //   ├── Categories
 * //   └── Brands
 * //       └── Brand Details
 *
 * const descendants = await getDescendantMenuKeys('menu.products')
 * // Returns: [
 * //   'menu.products.list',
 * //   'menu.products.categories',
 * //   'menu.products.brands',
 * //   'menu.products.brands.details'  // Grandchild
 * // ]
 *
 * // Admin unchecks "Products" → All these get unchecked too
 * ```
 *
 * Algorithm: Recursive Depth-First Traversal
 * -------------------------------------------
 * - Uses recursion to walk DOWN the tree (parent → children → grandchildren)
 * - Depth-first means it fully explores one branch before moving to next
 * - Each recursive call processes one level of the tree
 *
 * Recursion Pattern Explained:
 * ----------------------------
 * This is a classic recursive tree traversal. Here's how it works:
 *
 * 1. Base Case: If menu has no children, recursion stops
 * 2. Recursive Case: For each child, call function again with child as parent
 * 3. Each call adds child keys to shared `descendants` array
 * 4. Call stack unwinds when all branches fully explored
 *
 * Call Stack Example:
 * ```
 * getDescendantMenuKeys('menu.products')
 *   → collectDescendants(1)  // Products ID
 *     → Find children: [Product List, Categories, Brands]
 *     → Add 'menu.products.list' to array
 *     → collectDescendants(2)  // Product List ID
 *       → No children → return
 *     → Add 'menu.products.categories' to array
 *     → collectDescendants(3)  // Categories ID
 *       → No children → return
 *     → Add 'menu.products.brands' to array
 *     → collectDescendants(4)  // Brands ID
 *       → Find children: [Brand Details]
 *       → Add 'menu.products.brands.details' to array
 *       → collectDescendants(5)  // Brand Details ID
 *         → No children → return
 * ```
 *
 * @param parentKey - The parent menu key to find descendants for
 * @returns Array of all descendant menu keys (children, grandchildren, etc.)
 */
export async function getDescendantMenuKeys(parentKey: string): Promise<string[]> {
  // Get the parent menu details
  const parentMenu = await getMenuPermissionByKey(parentKey)
  if (!parentMenu) return []  // Parent doesn't exist

  // Array to collect all descendant keys
  // Shared across all recursive calls (closure variable)
  const descendants: string[] = []

  /**
   * Recursive helper function to collect all descendants
   *
   * This is a nested async function that captures the `descendants` array
   * from the outer scope (JavaScript closure pattern).
   *
   * @param parentId - The parent menu ID to find children for
   */
  async function collectDescendants(parentId: number) {
    // Find all immediate children of this parent
    const children = await prisma.menuPermission.findMany({
      where: { parentId },  // Match menus whose parentId equals this ID
    })

    // Process each child
    for (const child of children) {
      // Add child's key to results array
      descendants.push(child.key)

      // RECURSIVE CALL: Find this child's children (grandchildren)
      // This call repeats the entire function for the child as parent
      // Recursion stops when child has no children (findMany returns empty array)
      await collectDescendants(child.id)
    }
    // Base case: If children array is empty, loop doesn't run and function returns
  }

  // Start the recursive collection from the parent menu
  await collectDescendants(parentMenu.id)

  // Return all collected descendant keys
  // Array includes children, grandchildren, great-grandchildren, etc.
  return descendants
}
