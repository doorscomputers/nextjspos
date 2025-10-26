'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'

interface MenuPermission {
  id: number
  key: string
  name: string
  href: string | null
  icon: string | null
  order: number
  parentId: number | null
  children?: MenuPermission[]
}

interface Role {
  id: number
  name: string
}

interface User {
  id: number
  username: string
  firstName: string
  surname: string
}

export default function MenuPermissionsPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'role' | 'user'>('role')
  const [menuStructure, setMenuStructure] = useState<MenuPermission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Check permissions
  const canViewRoles = can(PERMISSIONS.ROLE_VIEW)
  const canUpdateRoles = can(PERMISSIONS.ROLE_UPDATE)
  const canViewUsers = can(PERMISSIONS.USER_VIEW)
  const canUpdateUsers = can(PERMISSIONS.USER_UPDATE)

  // Fetch menu structure on mount
  useEffect(() => {
    fetchMenuStructure()
    if (canViewRoles) fetchRoles()
    if (canViewUsers) fetchUsers()
  }, [])

  // Load menu permissions when selection changes
  useEffect(() => {
    if (activeTab === 'role' && selectedRoleId) {
      loadRoleMenuPermissions(selectedRoleId)
    }
  }, [activeTab, selectedRoleId])

  useEffect(() => {
    if (activeTab === 'user' && selectedUserId) {
      loadUserMenuPermissions(selectedUserId)
    }
  }, [activeTab, selectedUserId])

  const fetchMenuStructure = async () => {
    try {
      const res = await fetch('/api/settings/menu-permissions?format=tree')
      const data = await res.json()
      if (data.success) {
        setMenuStructure(data.data)
      }
    } catch (err) {
      console.error('Error fetching menu structure:', err)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles')
      const data = await res.json()
      if (data.success) {
        setRoles(data.data)
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const loadRoleMenuPermissions = async (roleId: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/menu-permissions/role/${roleId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedMenuKeys(new Set(data.data.menuKeys))
      } else {
        setError(data.error || 'Failed to load role menu permissions')
      }
    } catch (err) {
      setError('Error loading role menu permissions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserMenuPermissions = async (userId: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/menu-permissions/user/${userId}?type=all`)
      const data = await res.json()
      if (data.success) {
        setSelectedMenuKeys(new Set(data.data.menuKeys))
      } else {
        setError(data.error || 'Failed to load user menu permissions')
      }
    } catch (err) {
      setError('Error loading user menu permissions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMenuToggle = (menuKey: string, checked: boolean, menu: MenuPermission) => {
    const newSelection = new Set(selectedMenuKeys)

    if (checked) {
      // Add this menu
      newSelection.add(menuKey)
      // Add all parent menus
      addParentMenus(menuKey, newSelection)
    } else {
      // Remove this menu
      newSelection.delete(menuKey)
      // Remove all descendant menus
      removeDescendantMenus(menu, newSelection)
    }

    setSelectedMenuKeys(newSelection)
  }

  const addParentMenus = (menuKey: string, selection: Set<string>) => {
    // Find the menu and add all its parents
    const findAndAddParents = (menus: MenuPermission[], targetKey: string): boolean => {
      for (const menu of menus) {
        if (menu.key === targetKey) {
          return true
        }
        if (menu.children && menu.children.length > 0) {
          if (findAndAddParents(menu.children, targetKey)) {
            selection.add(menu.key) // Add this parent
            return true
          }
        }
      }
      return false
    }

    findAndAddParents(menuStructure, menuKey)
  }

  const removeDescendantMenus = (menu: MenuPermission, selection: Set<string>) => {
    if (menu.children && menu.children.length > 0) {
      for (const child of menu.children) {
        selection.delete(child.key)
        removeDescendantMenus(child, selection)
      }
    }
  }

  const handleSave = async () => {
    if (activeTab === 'role' && !selectedRoleId) {
      setError('Please select a role')
      return
    }
    if (activeTab === 'user' && !selectedUserId) {
      setError('Please select a user')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const endpoint =
        activeTab === 'role'
          ? `/api/settings/menu-permissions/role/${selectedRoleId}`
          : `/api/settings/menu-permissions/user/${selectedUserId}`

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuKeys: Array.from(selectedMenuKeys),
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccessMessage('Menu permissions updated successfully!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to update menu permissions')
      }
    } catch (err) {
      setError('Error saving menu permissions')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const renderMenuTree = (menus: MenuPermission[], level: number = 0) => {
    return menus.map((menu) => {
      const isChecked = selectedMenuKeys.has(menu.key)
      const hasChildren = menu.children && menu.children.length > 0

      return (
        <div key={menu.key} style={{ marginLeft: `${level * 24}px` }}>
          <div className="flex items-center py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2">
            <input
              type="checkbox"
              id={menu.key}
              checked={isChecked}
              onChange={(e) => handleMenuToggle(menu.key, e.target.checked, menu)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              htmlFor={menu.key}
              className={`ml-2 text-sm ${
                hasChildren ? 'font-semibold text-gray-900 dark:text-white' : 'font-normal text-gray-700 dark:text-gray-300'
              } cursor-pointer select-none`}
            >
              {menu.name}
              {menu.href && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({menu.href})
                </span>
              )}
            </label>
          </div>
          {hasChildren && (
            <div className="ml-2 border-l-2 border-gray-200 dark:border-gray-700">
              {renderMenuTree(menu.children!, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  if (!canViewRoles && !canViewUsers) {
    return (
      <div className="p-6">
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view menu permissions.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Menu Permissions</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure which menu items are visible to roles and users. User permissions override role permissions.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {canViewRoles && (
            <button
              onClick={() => setActiveTab('role')}
              className={`${
                activeTab === 'role'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Role Permissions
            </button>
          )}
          {canViewUsers && (
            <button
              onClick={() => setActiveTab('user')}
              className={`${
                activeTab === 'user'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              User Permissions
            </button>
          )}
        </nav>
      </div>

      {/* Selection Dropdown */}
      <div className="mb-6">
        {activeTab === 'role' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Role
            </label>
            <select
              value={selectedRoleId || ''}
              onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="">-- Select a role --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'user' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select User
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="">-- Select a user --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} - {user.firstName} {user.surname}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Menu Tree */}
      {((activeTab === 'role' && selectedRoleId) || (activeTab === 'user' && selectedUserId)) && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading menu permissions...</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 max-h-[600px] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Available Menus ({selectedMenuKeys.size} selected)
                </h3>
                <div className="space-y-1">{renderMenuTree(menuStructure)}</div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.back()}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    (activeTab === 'role' && !canUpdateRoles) ||
                    (activeTab === 'user' && !canUpdateUsers)
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Menu Permissions'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {!selectedRoleId && !selectedUserId && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Please select a {activeTab} to configure menu permissions.</p>
        </div>
      )}
    </div>
  )
}
