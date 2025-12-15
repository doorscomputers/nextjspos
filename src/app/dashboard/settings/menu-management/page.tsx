'use client'

import { useState, useEffect } from 'react'
import DataGrid, {
  Column,
  Editing,
  Paging,
  Scrolling,
  SearchPanel,
  Toolbar,
  Item,
  Lookup,
  ValidationRule
} from 'devextreme-react/data-grid'
import Button from 'devextreme-react/button'
import LoadPanel from 'devextreme-react/load-panel'
import notify from 'devextreme/ui/notify'

interface MenuPermission {
  id: number
  key: string
  name: string
  href: string | null
  parentId: number | null
  order: number
}

interface Role {
  id: number
  name: string
  displayName: string
}

export default function MenuManagementPage() {
  const [menus, setMenus] = useState<MenuPermission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchMenus()
    fetchRoles()
  }, [])

  const fetchMenus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/menu-management/menus')
      if (res.ok) {
        const data = await res.json()
        setMenus(data.data || [])
      } else {
        notify('Failed to load menus', 'error', 3000)
      }
    } catch (error) {
      console.error('Error fetching menus:', error)
      notify('Error loading menus', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/settings/menu-permissions/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const handleSaveMenu = async (e: any) => {
    try {
      const menu = e.data
      const method = e.key ? 'PUT' : 'POST'
      const url = e.key
        ? `/api/settings/menu-management/menus/${e.key}`
        : '/api/settings/menu-management/menus'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menu)
      })

      if (res.ok) {
        notify('Menu saved successfully!', 'success', 3000)
        fetchMenus()
      } else {
        const data = await res.json()
        notify(data.error || 'Failed to save menu', 'error', 3000)
      }
    } catch (error) {
      console.error('Error saving menu:', error)
      notify('Error saving menu', 'error', 3000)
    }
  }

  const handleDeleteMenu = async (e: any) => {
    try {
      const res = await fetch(`/api/settings/menu-management/menus/${e.key}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        notify('Menu deleted successfully!', 'success', 3000)
        fetchMenus()
      } else {
        const data = await res.json()
        notify(data.error || 'Failed to delete menu', 'error', 3000)
      }
    } catch (error) {
      console.error('Error deleting menu:', error)
      notify('Error deleting menu', 'error', 3000)
    }
  }

  const syncAllMenus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/menu-management/sync-all', {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        notify(`Synced ${data.data.added} menus successfully!`, 'success', 3000)
        fetchMenus()
      } else {
        notify('Failed to sync menus', 'error', 3000)
      }
    } catch (error) {
      console.error('Error syncing menus:', error)
      notify('Error syncing menus', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  // Add Package Template 2 menu only
  const addPackageTemplate2 = async () => {
    try {
      // Check if already exists
      const existingMenu = menus.find(m => m.key === 'menu.package_templates_2')
      if (existingMenu) {
        notify('Package Template 2 menu already exists!', 'warning', 3000)
        return
      }

      setLoading(true)
      const res = await fetch('/api/settings/menu-management/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'menu.package_templates_2',
          name: 'Package Template 2',
          href: '/dashboard/package-templates-2',
          icon: 'CubeIcon',
          order: 101,
          parentId: null
        })
      })

      if (res.ok) {
        notify('Package Template 2 menu added successfully!', 'success', 3000)
        fetchMenus()
      } else {
        const data = await res.json()
        notify(data.error || 'Failed to add Package Template 2', 'error', 3000)
      }
    } catch (error) {
      console.error('Error adding Package Template 2:', error)
      notify('Error adding Package Template 2', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  // Parent menu lookup data
  const parentMenus = menus.filter(m => m.parentId === null)

  return (
    <div className="p-8 max-w-full mx-auto">
      <LoadPanel visible={loading} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Menu Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Add, edit, or delete menu items. Changes will be reflected in the sidebar and menu permissions.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Menu Items</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {menus.length} menu items total
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              text="Add Package Template 2"
              type="default"
              icon="plus"
              onClick={addPackageTemplate2}
              disabled={menus.some(m => m.key === 'menu.package_templates_2')}
            />
            <Button
              text="Sync All from Sidebar"
              type="success"
              icon="refresh"
              onClick={syncAllMenus}
            />
          </div>
        </div>

        <DataGrid
          dataSource={menus}
          keyExpr="id"
          showBorders={true}
          columnAutoWidth={true}
          onRowInserted={handleSaveMenu}
          onRowUpdated={handleSaveMenu}
          onRowRemoved={handleDeleteMenu}
        >
          <Editing
            mode="popup"
            allowAdding={true}
            allowUpdating={true}
            allowDeleting={true}
            useIcons={true}
          />
          <Paging defaultPageSize={20} />
          <Scrolling mode="virtual" />
          <SearchPanel visible={true} placeholder="Search menus..." />

          <Toolbar>
            <Item name="addRowButton" />
            <Item name="searchPanel" />
          </Toolbar>

          <Column dataField="id" caption="ID" width={60} allowEditing={false} />

          <Column dataField="key" caption="Key" width={200}>
            <ValidationRule type="required" message="Key is required" />
            <ValidationRule type="pattern" pattern="^[a-z_]+$" message="Only lowercase letters and underscores" />
          </Column>

          <Column dataField="name" caption="Name" width={250}>
            <ValidationRule type="required" message="Name is required" />
          </Column>

          <Column dataField="href" caption="URL Path" width={300}>
            <ValidationRule type="required" message="URL path is required" />
          </Column>

          <Column
            dataField="parentId"
            caption="Parent Menu"
            width={200}
          >
            <Lookup
              dataSource={parentMenus}
              valueExpr="id"
              displayExpr="name"
              allowClearing={true}
            />
          </Column>

          <Column dataField="order" caption="Order" width={80} dataType="number">
            <ValidationRule type="required" message="Order is required" />
          </Column>
        </DataGrid>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Quick Guide:</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li><strong>Add Menu:</strong> Click the "+" button to add a new menu item</li>
          <li><strong>Edit Menu:</strong> Click the edit icon (pencil) to modify</li>
          <li><strong>Delete Menu:</strong> Click the delete icon (trash) to remove</li>
          <li><strong>Key Format:</strong> Use lowercase with underscores (e.g., "customer_reports")</li>
          <li><strong>Parent Menu:</strong> Leave empty for top-level menus, select a parent for sub-menus</li>
          <li><strong>After adding menus:</strong> Go to Menu Permissions to assign them to roles</li>
        </ul>
      </div>
    </div>
  )
}
