'use client'

import { useEffect, useState } from 'react'

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

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [allPermissions, setAllPermissions] = useState<Record<string, string[]>>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: '', permissions: [] as string[], locations: [] as number[] })

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
      const url = modalMode === 'create' ? '/api/roles' : `/api/roles/${selectedRole?.id}`
      const method = modalMode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        alert(`Role ${modalMode === 'create' ? 'created' : 'updated'}`)
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

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">Manage user roles and their permissions</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Role
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{role.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${role.isDefault ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {role.isDefault ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{role.permissionCount}</td>
                <td className="px-6 py-4 text-gray-500">{role.userCount}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(role)}
                      disabled={role.isDefault}
                      className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      disabled={role.isDefault || role.userCount > 0}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-lg w-full h-full m-0 flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">{modalMode === 'create' ? 'Create' : 'Edit'} Role</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Role Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Permissions</h3>
                  <div className="space-y-4 border rounded p-4">
                  {Object.entries(allPermissions).map(([category, perms]) => (
                    <div key={category} className="border-b pb-3 last:border-b-0">
                      <label className="flex items-center gap-2 font-medium mb-2 cursor-pointer">
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
                              <span className="text-gray-700">{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Branch/Location Access</h3>
                  <div className="border rounded p-4">
                    <label className="flex items-center gap-2 font-medium mb-3 cursor-pointer">
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
                          <span className="text-gray-700">{location.name}</span>
                        </label>
                      ))}
                    </div>
                    {locations.length === 0 && (
                      <p className="text-gray-500 text-sm">No locations available</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t p-6 bg-gray-50">
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {modalMode === 'create' ? 'Create' : 'Update'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
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
