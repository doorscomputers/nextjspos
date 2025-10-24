'use client'

import { useEffect, useState, useMemo } from 'react'
import { MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, QuestionMarkCircleIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { PERMISSION_DESCRIPTIONS, CATEGORY_DESCRIPTIONS } from '@/lib/permission-descriptions'

interface Role {
  id: number
  name: string
  isDefault: boolean
  permissionCount: number
  userCount: number
  permissions: string[]
  locations: number[]
  createdAt: string
}

interface Location {
  id: number
  name: string
}

type SortField = 'name' | 'type' | 'permissions' | 'users'
type SortDirection = 'asc' | 'desc'

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [allPermissions, setAllPermissions] = useState<Record<string, string[]>>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: '', permissions: [] as string[], locations: [] as number[] })

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Permissions modal state
  const [permissionSearch, setPermissionSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchRoles()
    fetchPermissions()
    fetchLocations()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/permissions')
      if (res.ok) {
        const data = await res.json()
        setAllPermissions(data.grouped || {})
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = () => {
    setModalMode('create')
    setFormData({ name: '', permissions: [], locations: [] })
    setSelectedRole(null)
    setShowModal(true)
    setPermissionSearch('')
    // Expand all categories by default
    const expanded: Record<string, boolean> = {}
    Object.keys(allPermissions).forEach(cat => expanded[cat] = false)
    setExpandedCategories(expanded)
  }

  const handleEdit = (role: Role) => {
    setModalMode('edit')
    setFormData({ name: role.name, permissions: role.permissions, locations: role.locations || [] })
    setSelectedRole(role)
    setShowModal(true)
    setPermissionSearch('')
    const expanded: Record<string, boolean> = {}
    Object.keys(allPermissions).forEach(cat => expanded[cat] = false)
    setExpandedCategories(expanded)
  }

  const handleDuplicate = (role: Role) => {
    setModalMode('duplicate')
    setFormData({ name: `${role.name} (Copy)`, permissions: role.permissions, locations: [] })
    setSelectedRole(role)
    setShowModal(true)
    setPermissionSearch('')
    const expanded: Record<string, boolean> = {}
    Object.keys(allPermissions).forEach(cat => expanded[cat] = false)
    setExpandedCategories(expanded)
  }

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"?\n\nThis action cannot be undone.`)) return

    try {
      const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('✅ Role deleted successfully')
        fetchRoles()
      } else {
        const data = await res.json()
        alert(`❌ ${data.error || 'Failed to delete'}`)
      }
    } catch (err) {
      alert('❌ Error deleting role')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      let url: string
      let method: string

      if (modalMode === 'create') {
        url = '/api/roles'
        method = 'POST'
      } else if (modalMode === 'edit') {
        url = `/api/roles/${selectedRole?.id}`
        method = 'PUT'
      } else {
        // duplicate mode
        url = `/api/roles/${selectedRole?.id}/duplicate`
        method = 'POST'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        alert(`✅ Role ${modalMode === 'create' ? 'created' : modalMode === 'edit' ? 'updated' : 'duplicated'} successfully`)
        setShowModal(false)
        fetchRoles()
      } else {
        const data = await res.json()
        alert(`❌ ${data.error || 'Failed'}`)
      }
    } catch (err) {
      alert('❌ Error saving role')
    }
  }

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }))
  }

  const toggleCategory = (category: string) => {
    const categoryPerms = allPermissions[category] || []
    const allSelected = categoryPerms.every(p => formData.permissions.includes(p))

    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.permissions, ...categoryPerms])]
    }))
  }

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const toggleLocation = (locationId: number) => {
    setFormData(prev => ({
      ...prev,
      locations: prev.locations.includes(locationId)
        ? prev.locations.filter(id => id !== locationId)
        : [...prev.locations, locationId]
    }))
  }

  const toggleAllLocations = () => {
    const allSelected = locations.every(loc => formData.locations.includes(loc.id))
    setFormData(prev => ({
      ...prev,
      locations: allSelected ? [] : locations.map(loc => loc.id)
    }))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-50" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    )
  }

  // Quick action functions
  const selectAllViewPermissions = () => {
    const allViewPerms = Object.values(allPermissions).flat().filter(p =>
      p.endsWith('.view') || p.endsWith('.view_own')
    )
    setFormData(prev => ({
      ...prev,
      permissions: [...new Set([...prev.permissions, ...allViewPerms])]
    }))
  }

  const selectAllCreatePermissions = () => {
    const allCreatePerms = Object.values(allPermissions).flat().filter(p =>
      p.endsWith('.create')
    )
    setFormData(prev => ({
      ...prev,
      permissions: [...new Set([...prev.permissions, ...allCreatePerms])]
    }))
  }

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }))
  }

  const expandAllCategories = () => {
    const expanded: Record<string, boolean> = {}
    Object.keys(allPermissions).forEach(cat => expanded[cat] = true)
    setExpandedCategories(expanded)
  }

  const collapseAllCategories = () => {
    const expanded: Record<string, boolean> = {}
    Object.keys(allPermissions).forEach(cat => expanded[cat] = false)
    setExpandedCategories(expanded)
  }

  // Filter permissions by search
  const filteredPermissions = useMemo(() => {
    if (!permissionSearch.trim()) return allPermissions

    const searchLower = permissionSearch.toLowerCase()
    const filtered: Record<string, string[]> = {}

    Object.entries(allPermissions).forEach(([category, perms]) => {
      const matchingPerms = perms.filter(perm => {
        const permLower = perm.toLowerCase()
        const description = PERMISSION_DESCRIPTIONS[perm]?.toLowerCase() || ''
        const categoryDesc = CATEGORY_DESCRIPTIONS[category]?.toLowerCase() || ''

        return permLower.includes(searchLower) ||
               description.includes(searchLower) ||
               categoryDesc.includes(searchLower)
      })

      if (matchingPerms.length > 0) {
        filtered[category] = matchingPerms
      }
    })

    return filtered
  }, [allPermissions, permissionSearch])

  // Filter and sort roles
  const filteredAndSortedRoles = useMemo(() => {
    const filtered = roles.filter((role) => {
      const searchLower = searchQuery.toLowerCase()
      const roleName = role.name.toLowerCase()
      return roleName.includes(searchLower)
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'type':
          aValue = a.isDefault ? 1 : 0
          bValue = b.isDefault ? 1 : 0
          break
        case 'permissions':
          aValue = a.permissionCount
          bValue = b.permissionCount
          break
        case 'users':
          aValue = a.userCount
          bValue = b.userCount
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [roles, searchQuery, sortField, sortDirection])

  if (loading) return (
    <div className="p-8 text-gray-900 dark:text-gray-100 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading roles...</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage user roles and their task-specific permissions</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          + Add Role
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search roles by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Showing <span className="font-semibold">{filteredAndSortedRoles.length}</span> of <span className="font-semibold">{roles.length}</span> roles
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Role Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center gap-2">
                  Type
                  <SortIcon field="type" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('permissions')}
              >
                <div className="flex items-center gap-2">
                  Permissions
                  <SortIcon field="permissions" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('users')}
              >
                <div className="flex items-center gap-2">
                  Users
                  <SortIcon field="users" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedRoles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No roles found matching your search
                </td>
              </tr>
            ) : (
              filteredAndSortedRoles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{role.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${role.isDefault ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                      {role.isDefault ? '🔒 System' : '✏️ Custom'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">{role.permissionCount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">{role.userCount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(role)}
                        disabled={role.isDefault}
                        title={role.isDefault ? 'System roles cannot be edited' : 'Edit this role'}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(role)}
                        title="Create a copy of this role"
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        disabled={role.isDefault || role.userCount > 0}
                        title={role.isDefault ? 'System roles cannot be deleted' : role.userCount > 0 ? 'Cannot delete role with users' : 'Delete this role'}
                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {modalMode === 'create' ? '➕ Create New Role' : modalMode === 'edit' ? '✏️ Edit Role' : '📋 Duplicate Role'}
              </h2>
              {modalMode === 'duplicate' && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Creating a copy of <span className="font-semibold">&quot;{selectedRole?.name}&quot;</span> with all its permissions
                </p>
              )}
              {modalMode === 'create' && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Create a task-specific role with granular permissions
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Role Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Transfer Creator, Sales Cashier, Inventory Counter"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Use descriptive names like &quot;Transfer Creator&quot; instead of generic names like &quot;Manager&quot;
                  </p>
                </div>

                {/* Permissions Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Permissions <span className="text-gray-500 dark:text-gray-400 font-normal">({formData.permissions.length} selected)</span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Select the specific tasks this role can perform
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={expandAllCategories}
                        className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Expand All
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllCategories}
                        className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>

                  {/* Permission Search */}
                  <div className="mb-3">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search permissions by name or description..."
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={selectAllViewPermissions}
                      className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 font-medium"
                    >
                      👁️ Select All View
                    </button>
                    <button
                      type="button"
                      onClick={selectAllCreatePermissions}
                      className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 font-medium"
                    >
                      ➕ Select All Create
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                    >
                      🗑️ Clear All
                    </button>
                  </div>

                  {/* Permissions Grid */}
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                    {Object.keys(filteredPermissions).length === 0 ? (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No permissions found matching &quot;{permissionSearch}&quot;
                      </div>
                    ) : (
                      Object.entries(filteredPermissions).map(([category, perms]) => {
                        const categoryDesc = CATEGORY_DESCRIPTIONS[category] || category
                        const allSelected = perms.every(p => formData.permissions.includes(p))
                        const someSelected = perms.some(p => formData.permissions.includes(p))
                        const isExpanded = expandedCategories[category]

                        return (
                          <div key={category} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                            <div className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggleCategoryExpansion(category)}
                                  className="mt-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-transform duration-200"
                                >
                                  <ChevronRightIcon className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                <label className="flex-1 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      ref={(el) => {
                                        if (el) {
                                          el.indeterminate = someSelected && !allSelected
                                        }
                                      }}
                                      onChange={() => toggleCategory(category)}
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                        {category.replace(/_/g, ' ')}
                                      </span>
                                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                        ({perms.filter(p => formData.permissions.includes(p)).length}/{perms.length})
                                      </span>
                                      {categoryDesc && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                          {categoryDesc}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              </div>

                              {/* Category Permissions */}
                              {isExpanded && (
                                <div className="ml-8 mt-3 space-y-2">
                                  {perms.map(perm => {
                                    const parts = perm.split('.')
                                    const label = parts.length === 3
                                      ? `${parts[1]} ${parts[2]}`
                                      : parts[parts.length - 1]
                                    const description = PERMISSION_DESCRIPTIONS[perm]

                                    return (
                                      <label key={perm} className="flex items-start gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group">
                                        <input
                                          type="checkbox"
                                          checked={formData.permissions.includes(perm)}
                                          onChange={() => togglePermission(perm)}
                                          className="w-4 h-4 mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                                              {label.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                              {perm}
                                            </span>
                                          </div>
                                          {description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                              {description}
                                            </p>
                                          )}
                                        </div>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Locations Section */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Branch/Location Access <span className="text-gray-500 dark:text-gray-400 font-normal">(Optional)</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Restrict this role to specific branches. Leave empty for admin roles that should access all locations.
                  </p>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <label className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100 mb-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                      <input
                        type="checkbox"
                        checked={locations.length > 0 && locations.every(loc => formData.locations.includes(loc.id))}
                        onChange={toggleAllLocations}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span>🏢 Access All Locations</span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {locations.map(location => (
                        <label key={location.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                          <input
                            type="checkbox"
                            checked={formData.locations.includes(location.id)}
                            onChange={() => toggleLocation(location.id)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{location.name}</span>
                        </label>
                      ))}
                    </div>
                    {locations.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No locations available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                  >
                    {modalMode === 'create' ? '✅ Create Role' : modalMode === 'edit' ? '💾 Update Role' : '📋 Duplicate Role'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all"
                  >
                    ❌ Cancel
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  💡 Tip: Assign only the minimum permissions needed for the role&apos;s specific tasks (Principle of Least Privilege)
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
