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
  const [menuSearch, setMenuSearch] = useState('')

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
        console.log('📋 Fetched menus:', {
          total: data.data.allMenus?.length || 0,
          parents: data.data.allMenus?.filter((m: any) => m.parentId === null).length || 0,
          children: data.data.allMenus?.filter((m: any) => m.parentId !== null).length || 0,
          allMenus: data.data.allMenus
        })
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

  // Toggle all children of a parent menu
  const toggleParentAndChildren = (parentId: number, checked: boolean) => {
    const parent = allMenus.find(m => m.id === parentId)
    if (!parent) return

    const children = childMenusByParent[parentId] || []
    const allKeys = [parent.key, ...children.flatMap(child => {
      const grandchildren = childMenusByParent[child.id] || []
      return [child.key, ...grandchildren.map(gc => gc.key)]
    })]

    setEnabledMenuKeys(prev => {
      if (checked) {
        // Add all keys
        const newKeys = [...prev]
        allKeys.forEach(k => {
          if (!newKeys.includes(k)) {
            newKeys.push(k)
          }
        })
        return newKeys
      } else {
        // Remove all keys
        return prev.filter(k => !allKeys.includes(k))
      }
    })
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId)

  // Group menus by parent (support 3 levels: parent → child → grandchild)
  const allParentMenus = allMenus.filter(m => m.parentId === null)
  const childMenusByParent = allMenus.reduce((acc, menu) => {
    if (menu.parentId !== null) {
      if (!acc[menu.parentId]) {
        acc[menu.parentId] = []
      }
      acc[menu.parentId].push(menu)
    }
    return acc
  }, {} as Record<number, MenuPermission[]>)

  // Helper function to check if menu matches search
  const menuMatchesSearch = (menu: MenuPermission, searchLower: string) => {
    return menu.name.toLowerCase().includes(searchLower)
  }

  // Filter menus based on search query (searches parent, children, and grandchildren)
  const parentMenus = menuSearch
    ? allParentMenus.filter(parent => {
        const searchLower = menuSearch.toLowerCase()

        // Check parent name
        if (parent.name.toLowerCase().includes(searchLower)) return true

        // Check children
        const children = childMenusByParent[parent.id] || []
        const matchesChild = children.some(child => {
          if (child.name.toLowerCase().includes(searchLower)) return true

          // Check grandchildren
          const grandchildren = childMenusByParent[child.id] || []
          return grandchildren.some(gc => gc.name.toLowerCase().includes(searchLower))
        })

        return matchesChild
      })
    : allParentMenus

  // Get filtered children for a parent (only show children that match search or have matching grandchildren)
  const getFilteredChildren = (parentId: number) => {
    if (!menuSearch) return childMenusByParent[parentId] || []

    const searchLower = menuSearch.toLowerCase()
    const children = childMenusByParent[parentId] || []

    // Check if parent itself matches - if so, show all children
    const parent = allMenus.find(m => m.id === parentId)
    if (parent && menuMatchesSearch(parent, searchLower)) {
      return children
    }

    // Otherwise, filter to only show matching children or children with matching grandchildren
    return children.filter(child => {
      if (menuMatchesSearch(child, searchLower)) return true
      const grandchildren = childMenusByParent[child.id] || []
      return grandchildren.some(gc => menuMatchesSearch(gc, searchLower))
    })
  }

  // Get filtered grandchildren for a child (only show grandchildren that match search)
  const getFilteredGrandchildren = (childId: number) => {
    if (!menuSearch) return childMenusByParent[childId] || []

    const searchLower = menuSearch.toLowerCase()
    const grandchildren = childMenusByParent[childId] || []

    // Check if parent (child) matches - if so, show all grandchildren
    const child = allMenus.find(m => m.id === childId)
    if (child && menuMatchesSearch(child, searchLower)) {
      return grandchildren
    }

    // Otherwise, filter to only show matching grandchildren
    return grandchildren.filter(gc => menuMatchesSearch(gc, searchLower))
  }

  // Get total count of all matching menus (parents + children + grandchildren)
  const getMatchingMenuCount = () => {
    if (!menuSearch) return 0
    const searchLower = menuSearch.toLowerCase()
    return allMenus.filter(m => m.name.toLowerCase().includes(searchLower)).length
  }

  // Check if a menu has children
  const hasChildren = (menuId: number) => {
    return (childMenusByParent[menuId] || []).length > 0
  }

  // Check if parent has partial selection (some children checked, some not)
  const getParentSelectionState = (parentId: number): 'none' | 'partial' | 'full' => {
    const parent = allMenus.find(m => m.id === parentId)
    const children = childMenusByParent[parentId] || []

    if (!parent) return 'none'

    const allDescendantKeys: string[] = []
    children.forEach(child => {
      allDescendantKeys.push(child.key)
      const grandchildren = childMenusByParent[child.id] || []
      grandchildren.forEach(gc => allDescendantKeys.push(gc.key))
    })

    const allKeysIncludingParent = [parent.key, ...allDescendantKeys]
    const checkedCount = allKeysIncludingParent.filter(k => enabledMenuKeys.includes(k)).length

    if (checkedCount === 0) return 'none'
    if (checkedCount === allKeysIncludingParent.length) return 'full'
    return 'partial'
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
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                    <p>{enabledMenuKeys.length} of {allMenus.length} menus enabled</p>
                    <p className="text-xs">
                      {parentMenus.length} parent menus · {allMenus.length - parentMenus.length} child menus
                    </p>
                  </div>
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
              <>
                {/* Search Box */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search menus... (e.g., 'transfer', 'accounting', 'sales')"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <svg
                      className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {menuSearch && (
                      <button
                        onClick={() => setMenuSearch('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {menuSearch && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Found {getMatchingMenuCount()} menu{getMatchingMenuCount() !== 1 ? 's' : ''} matching "{menuSearch}"
                    </p>
                  )}
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {parentMenus.map(parent => {
                  const children = getFilteredChildren(parent.id)
                  const isParentChecked = enabledMenuKeys.includes(parent.key)
                  const selectionState = getParentSelectionState(parent.id)

                  return (
                    <div key={parent.id} className={`border rounded-lg p-4 ${
                      selectionState === 'full' ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10' :
                      selectionState === 'partial' ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10' :
                      'border-gray-300 dark:border-gray-700'
                    }`}>
                      <div className="flex items-start gap-3 mb-3">
                        <CheckBox
                          value={isParentChecked}
                          onValueChanged={(e) => toggleMenuKey(parent.key, e.value)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {parent.name}
                            </span>
                            {children.length > 0 && (
                              <>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  selectionState === 'full' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                  selectionState === 'partial' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                  {selectionState === 'full' ? 'All Selected' :
                                   selectionState === 'partial' ? 'Partial' :
                                   'None Selected'}
                                </span>
                                <button
                                  onClick={() => toggleParentAndChildren(parent.id, selectionState !== 'full')}
                                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                >
                                  {selectionState === 'full' ? 'Deselect All' : 'Select All'}
                                </button>
                              </>
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

                            // Get filtered grandchildren for display
                            const displayGrandchildren = getFilteredGrandchildren(child.id)
                            const hasDisplayGrandchildren = displayGrandchildren.length > 0

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

                                {/* Grandchildren (3rd level) - filtered when searching */}
                                {hasDisplayGrandchildren && (
                                  <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                                    {displayGrandchildren.map(grandchild => {
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
              </>
            )}
          </div>

          {/* Help Guide */}
          {selectedRole && (
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Flexible Menu Control:</h3>
              <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li><strong>Independent Control:</strong> Each menu item has its own checkbox - check/uncheck any combination</li>
                <li><strong>Example:</strong> You can enable "Purchases" menu but hide "Add Purchase" - only "List Purchases" will show</li>
                <li><strong>Visual Indicators:</strong></li>
                <ul className="list-none ml-6 mt-1 space-y-1">
                  <li><span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">All Selected</span> - All children enabled</li>
                  <li><span className="inline-block bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">Partial</span> - Some children enabled, some disabled</li>
                  <li><span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">None Selected</span> - No children enabled</li>
                </ul>
                <li><strong>Quick Actions:</strong> Use "Select All" / "Deselect All" buttons to quickly toggle all children of a parent</li>
                <li><strong>Users must logout/login</strong> after menu permission changes to see updates</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
