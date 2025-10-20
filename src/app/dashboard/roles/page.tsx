'use client'

import { useEffect, useState, useMemo } from 'react'
import { MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

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
  }

  const handleEdit = (role: Role) => {
    setModalMode('edit')
    setFormData({ name: role.name, permissions: role.permissions, locations: role.locations || [] })
    setSelectedRole(role)
    setShowModal(true)
  }

  const handleDuplicate = (role: Role) => {
    setModalMode('duplicate')
    setFormData({ name: `${role.name} (Copy)`, permissions: role.permissions, locations: [] })
    setSelectedRole(role)
    setShowModal(true)
  }

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return

    try {
      const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Role deleted')
        fetchRoles()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
      }
    } catch (err) {
      alert('Error deleting role')
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
        const data = await res.json()
        alert(data.message || `Role ${modalMode === 'create' ? 'created' : modalMode === 'edit' ? 'updated' : 'duplicated'}`)
        setShowModal(false)
        fetchRoles()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed')
      }
    } catch (err) {
      alert('Error saving role')
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

  // Filter and sort roles
  const filteredAndSortedRoles = useMemo(() => {
    let filtered = roles.filter((role) => {
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

  if (loading) return <div className="p-8 text-gray-900 dark:text-gray-100">Loading...</div>

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage user roles and their permissions</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Add Role
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
          Showing {filteredAndSortedRoles.length} of {roles.length} roles
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Role Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center gap-2">
                  Type
                  <SortIcon field="type" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('permissions')}
              >
                <div className="flex items-center gap-2">
                  Permissions
                  <SortIcon field="permissions" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
            {filteredAndSortedRoles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{role.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${role.isDefault ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                    {role.isDefault ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-300">{role.permissionCount}</td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-300">{role.userCount}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(role)}
                      disabled={role.isDefault}
                      className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(role)}
                      className="px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      disabled={role.isDefault || role.userCount > 0}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed rounded-md font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full h-full m-0 flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'Duplicate'} Role
              </h2>
              {modalMode === 'duplicate' && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Creating a copy of &quot;{selectedRole?.name}&quot; with all its permissions. Change the name and select locations.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Role Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    required
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Permissions</h3>
                  <div className="space-y-4 border border-gray-300 dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-800/50">
                  {Object.entries(allPermissions).map(([category, perms]) => (
                    <div key={category} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-b-0">
                      <label className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perms.every(p => formData.permissions.includes(p))}
                          onChange={() => toggleCategory(category)}
                          className="w-4 h-4"
                        />
                        <span className="capitalize">{category}</span>
                      </label>
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {perms.map(perm => {
                          // For permissions like "purchase.receipt.approve", show "receipt approve"
                          // For permissions like "product.view", show "view"
                          const parts = perm.split('.')
                          const label = parts.length === 3
                            ? `${parts[1]} ${parts[2]}`
                            : parts[parts.length - 1]

                          return (
                            <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="w-4 h-4"
                              />
                              <span className="text-gray-700 dark:text-gray-300">{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Branch/Location Access</h3>
                  <div className="border border-gray-300 dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-800/50">
                    <label className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={locations.length > 0 && locations.every(loc => formData.locations.includes(loc.id))}
                        onChange={toggleAllLocations}
                        className="w-4 h-4"
                      />
                      <span>Access All Locations</span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {locations.map(location => (
                        <label key={location.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.locations.includes(location.id)}
                            onChange={() => toggleLocation(location.id)}
                            className="w-4 h-4"
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

              <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700">
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Update' : 'Duplicate Role'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
