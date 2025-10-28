'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DataGrid, {
  Column,
  Selection,
  Paging,
  Scrolling,
  SearchPanel,
  HeaderFilter
} from 'devextreme-react/data-grid'
import CheckBox from 'devextreme-react/check-box'
import Button from 'devextreme-react/button'
import LoadPanel from 'devextreme-react/load-panel'
import notify from 'devextreme/ui/notify'

interface Role {
  id: number
  name: string
  displayName: string
  menuPermissionCount: number
}

interface MenuPermission {
  id: number
  key: string
  name: string
  href: string | null
  parentId: number | null
  order: number
}

export default function MenuPermissionsPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [allMenus, setAllMenus] = useState<MenuPermission[]>([])
  const [enabledMenuKeys, setEnabledMenuKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch roles on mount
  useEffect(() => {
    fetchRoles()
  }, [])

  // Fetch menu permissions when role is selected
  useEffect(() => {
    if (selectedRoleId) {
      fetchRoleMenuPermissions(selectedRoleId)
    }
  }, [selectedRoleId])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/menu-permissions/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(data.data || [])
      } else {
        notify('Failed to load roles', 'error', 3000)
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      notify('Error loading roles', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoleMenuPermissions = async (roleId: number) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/settings/menu-permissions/role/${roleId}`)
      if (res.ok) {
        const data = await res.json()
        setAllMenus(data.data.allMenus || [])
        setEnabledMenuKeys(data.data.enabledMenuKeys || [])
      } else {
        notify('Failed to load menu permissions', 'error', 3000)
      }
    } catch (error) {
      console.error('Error fetching menu permissions:', error)
      notify('Error loading menu permissions', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedRoleId) {
      notify('Please select a role first', 'warning', 3000)
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/settings/menu-permissions/role/${selectedRoleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuKeys: enabledMenuKeys })
      })

      if (res.ok) {
        notify('Menu permissions saved successfully!', 'success', 3000)
        // Refresh role data to update counts
        fetchRoles()
      } else {
        const data = await res.json()
        notify(data.error || 'Failed to save menu permissions', 'error', 3000)
      }
    } catch (error) {
      console.error('Error saving menu permissions:', error)
      notify('Error saving menu permissions', 'error', 3000)
    } finally {
      setSaving(false)
    }
  }

  const toggleMenuKey = (menuKey: string, checked: boolean) => {
    setEnabledMenuKeys(prev => {
      if (checked) {
        // Add if not already present
        if (!prev.includes(menuKey)) {
          return [...prev, menuKey]
        }
        return prev
      } else {
        // Remove if present
        return prev.filter(k => k !== menuKey)
      }
    })
  }

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setEnabledMenuKeys(allMenus.map(m => m.key))
    } else {
      setEnabledMenuKeys([])
    }
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId)

  // Group menus by parent (support 3 levels: parent → child → grandchild)
  const parentMenus = allMenus.filter(m => m.parentId === null)
  const childMenusByParent = allMenus.reduce((acc, menu) => {
    if (menu.parentId !== null) {
      if (!acc[menu.parentId]) {
        acc[menu.parentId] = []
      }
      acc[menu.parentId].push(menu)
    }
    return acc
  }, {} as Record<number, MenuPermission[]>)

  // Check if a menu has children
  const hasChildren = (menuId: number) => {
    return (childMenusByParent[menuId] || []).length > 0
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <LoadPanel visible={loading} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Menu Permissions</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Control which menu items are visible to each role
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Role Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Select Role</h2>

            <DataGrid
              dataSource={roles}
              keyExpr="id"
              selection={{ mode: 'single' }}
              hoverStateEnabled={true}
              onSelectionChanged={(e) => {
                if (e.selectedRowsData.length > 0) {
                  setSelectedRoleId(e.selectedRowsData[0].id)
                }
              }}
              height={500}
              showBorders={true}
            >
              <SearchPanel visible={true} placeholder="Search roles..." />
              <Scrolling mode="virtual" />
              <Column dataField="displayName" caption="Role Name" />
              <Column
                dataField="menuPermissionCount"
                caption="Menus"
                width={80}
                alignment="center"
              />
            </DataGrid>
          </div>
        </div>

        {/* Right: Menu Permissions */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedRole ? `${selectedRole.displayName} - Menu Access` : 'Menu Access'}
                </h2>
                {selectedRole && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {enabledMenuKeys.length} of {allMenus.length} menus enabled
                  </p>
                )}
              </div>
              {selectedRole && (
                <div className="flex gap-2">
                  <Button
                    text="Select All"
                    type="default"
                    onClick={() => toggleAll(true)}
                    disabled={saving}
                  />
                  <Button
                    text="Deselect All"
                    type="normal"
                    onClick={() => toggleAll(false)}
                    disabled={saving}
                  />
                  <Button
                    text="Save Changes"
                    type="success"
                    icon="save"
                    onClick={handleSave}
                    disabled={saving || !selectedRole}
                  />
                </div>
              )}
            </div>

            {!selectedRole && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-lg">Select a role to manage menu permissions</p>
              </div>
            )}

            {selectedRole && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {parentMenus.map(parent => {
                  const children = childMenusByParent[parent.id] || []
                  const isParentChecked = enabledMenuKeys.includes(parent.key)

                  return (
                    <div key={parent.id} className="border dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <CheckBox
                          value={isParentChecked}
                          onValueChanged={(e) => toggleMenuKey(parent.key, e.value)}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {parent.name}
                            {children.length > 0 && (
                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">#</span>
                            )}
                          </div>
                          {parent.href && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {parent.href}
                            </div>
                          )}
                        </div>
                      </div>

                      {children.length > 0 && (
                        <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                          {children.map(child => {
                            const isChildChecked = enabledMenuKeys.includes(child.key)
                            const grandchildren = childMenusByParent[child.id] || []
                            const hasGrandchildren = grandchildren.length > 0

                            return (
                              <div key={child.id} className="space-y-2">
                                <div className="flex items-start gap-3">
                                  <CheckBox
                                    value={isChildChecked}
                                    onValueChanged={(e) => toggleMenuKey(child.key, e.value)}
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm text-gray-800 dark:text-gray-200">
                                      {child.name}
                                      {hasGrandchildren && (
                                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">#</span>
                                      )}
                                    </div>
                                    {child.href && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {child.href}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Grandchildren (3rd level) */}
                                {hasGrandchildren && (
                                  <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                                    {grandchildren.map(grandchild => {
                                      const isGrandchildChecked = enabledMenuKeys.includes(grandchild.key)
                                      return (
                                        <div key={grandchild.id} className="flex items-start gap-3">
                                          <CheckBox
                                            value={isGrandchildChecked}
                                            onValueChanged={(e) => toggleMenuKey(grandchild.key, e.value)}
                                          />
                                          <div className="flex-1">
                                            <div className="text-xs text-gray-700 dark:text-gray-300">
                                              {grandchild.name}
                                            </div>
                                            {grandchild.href && (
                                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {grandchild.href}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
