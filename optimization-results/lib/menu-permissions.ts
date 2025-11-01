/**
 * Menu Permissions Utility Functions
 *
 * Handles menu-level access control for users and roles.
 * Provides functions to check if users can access specific menus.
 */

import { prisma } from '@/lib/prisma'

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
 */
export async function getMenuStructure(): Promise<MenuPermissionNode[]> {
  const allMenus = await prisma.menuPermission.findMany({
    orderBy: {
      order: 'asc',
    },
  })

  // Build tree structure
  const menuMap = new Map<number, MenuPermissionNode>()
  const rootMenus: MenuPermissionNode[] = []

  // First pass: create nodes
  allMenus.forEach((menu) => {
    menuMap.set(menu.id, {
      id: menu.id,
      key: menu.key,
      name: menu.name,
      href: menu.href,
      icon: menu.icon,
      order: menu.order,
      parentId: menu.parentId,
      children: [],
    })
  })

  // Second pass: build hierarchy
  allMenus.forEach((menu) => {
    const node = menuMap.get(menu.id)!
    if (menu.parentId === null) {
      rootMenus.push(node)
    } else {
      const parent = menuMap.get(menu.parentId)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(node)
      }
    }
  })

  return rootMenus
}

/**
 * Get flat list of all menu permissions
 */
export async function getAllMenuPermissions(): Promise<MenuPermissionNode[]> {
  const menus = await prisma.menuPermission.findMany({
    orderBy: [{ order: 'asc' }],
  })

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
    select: {
      menuPermission: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
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
    select: {
      menuPermission: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
    },
  })

  return userMenus.map((um) => um.menuPermission.key)
}

/**
 * Get all menu keys that a user can access (combines role + user permissions)
 * Priority: User-specific permissions override role permissions
 */
export async function getUserAccessibleMenuKeys(userId: number): Promise<string[]> {
  // Get user's direct menu permissions (overrides)
  const userMenus = await getUserMenuPermissions(userId)

  // Get user's roles
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: { select: { id: true, name: true } } },
  })

  if (userRoles.length === 0 && userMenus.length === 0) {
    // User has no roles and no direct permissions - no access
    return []
  }

  // Get all menu keys from all user's roles
  const roleMenuKeys = new Set<string>()
  for (const userRole of userRoles) {
    const roleMenus = await getRoleMenuPermissions(userRole.roleId)
    roleMenus.forEach((key) => roleMenuKeys.add(key))
  }

  // Combine role menus with user-specific overrides
  const allMenuKeys = new Set<string>([...roleMenuKeys, ...userMenus])

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
 * If a user doesn't have access to parent, child menus shouldn't be visible
 */
export async function hasMenuAccessWithParentCheck(
  userId: number,
  menuKey: string
): Promise<boolean> {
  // Get the menu item
  const menu = await getMenuPermissionByKey(menuKey)
  if (!menu) return false

  // Check if user has access to this menu
  const hasAccess = await hasMenuAccess(userId, menuKey)
  if (!hasAccess) return false

  // If menu has a parent, recursively check parent access
  if (menu.parentId !== null) {
    const parentMenu = await prisma.menuPermission.findUnique({
      where: { id: menu.parentId },
    })

    if (parentMenu) {
      const hasParentAccess = await hasMenuAccessWithParentCheck(userId, parentMenu.key)
      if (!hasParentAccess) return false
    }
  }

  return true
}

/**
 * Update role menu permissions
 * Replaces all existing menu permissions for a role with new ones
 */
export async function updateRoleMenuPermissions(
  roleId: number,
  menuKeys: string[]
): Promise<void> {
  // Get menu IDs from keys
  const menus = await prisma.menuPermission.findMany({
    where: {
      key: {
        in: menuKeys,
      },
    },
    select: { id: { select: { id: true, name: true } } },
  })

  const menuIds = menus.map((m) => m.id)

  // Delete existing role menu permissions
  await prisma.roleMenuPermission.deleteMany({
    where: { roleId },
  })

  // Create new role menu permissions
  await prisma.roleMenuPermission.createMany({
    data: menuIds.map((menuId) => ({
      roleId,
      menuPermissionId: menuId,
    })),
  })
}

/**
 * Update user menu permissions (overrides)
 * Replaces all existing menu permissions for a user with new ones
 */
export async function updateUserMenuPermissions(
  userId: number,
  menuKeys: string[]
): Promise<void> {
  // Get menu IDs from keys
  const menus = await prisma.menuPermission.findMany({
    where: {
      key: {
        in: menuKeys,
      },
    },
    select: { id: { select: { id: true, name: true } } },
  })

  const menuIds = menus.map((m) => m.id)

  // Delete existing user menu permissions
  await prisma.userMenuPermission.deleteMany({
    where: { userId },
  })

  // Create new user menu permissions
  await prisma.userMenuPermission.createMany({
    data: menuIds.map((menuId) => ({
      userId,
      menuPermissionId: menuId,
    })),
  })
}

/**
 * Get menu IDs for a list of menu keys (including parent menus recursively)
 * Used when selecting child menus to auto-select parent menus
 */
export async function getMenuIdsWithParents(menuKeys: string[]): Promise<number[]> {
  const menuIds = new Set<number>()

  for (const key of menuKeys) {
    const menu = await getMenuPermissionByKey(key)
    if (!menu) continue

    menuIds.add(menu.id)

    // Recursively add parent IDs
    let currentMenu = menu
    while (currentMenu.parentId !== null) {
      const parent = await prisma.menuPermission.findUnique({
        where: { id: currentMenu.parentId },
      })

      if (!parent) break

      menuIds.add(parent.id)
      currentMenu = {
        id: parent.id,
        key: parent.key,
        name: parent.name,
        href: parent.href,
        icon: parent.icon,
        order: parent.order,
        parentId: parent.parentId,
      }
    }
  }

  return Array.from(menuIds)
}

/**
 * Get all descendant menu keys for a given parent key
 * Used when unchecking a parent to automatically uncheck all children
 */
export async function getDescendantMenuKeys(parentKey: string): Promise<string[]> {
  const parentMenu = await getMenuPermissionByKey(parentKey)
  if (!parentMenu) return []

  const descendants: string[] = []

  async function collectDescendants(parentId: number) {
    const children = await prisma.menuPermission.findMany({
      where: { parentId },
    })

    for (const child of children) {
      descendants.push(child.key)
      // Recursively collect grandchildren
      await collectDescendants(child.id)
    }
  }

  await collectDescendants(parentMenu.id)
  return descendants
}
