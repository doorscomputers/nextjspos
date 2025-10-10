'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewUserPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    surname: '',
    firstName: '',
    lastName: '',
    roleIds: [] as number[],
    locationIds: [] as number[],
    allowLogin: true,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [rolesRes, locationsRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/locations'),
      ])

      if (rolesRes.ok) setRoles(await rolesRes.json())

      if (locationsRes.ok) {
        const locData = await locationsRes.json()
        setLocations(locData.locations || locData || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        alert('User created successfully')
        router.push('/dashboard/users')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create user')
      }
    } catch (err) {
      alert('Error creating user')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleRole = (roleId: number) => {
    setFormData(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId]
    }))
  }

  const toggleLocation = (locationId: number) => {
    setFormData(prev => ({
      ...prev,
      locationIds: prev.locationIds.includes(locationId)
        ? prev.locationIds.filter(id => id !== locationId)
        : [...prev.locationIds, locationId]
    }))
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add New User</h1>
        <p className="text-gray-600 mt-1">Create a new user account</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Surname *</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">First Name *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.allowLogin}
              onChange={(e) => setFormData({ ...formData, allowLogin: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Allow Login</span>
          </label>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Assign Roles *</h3>
          <div className="border rounded p-4 space-y-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.roleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="w-4 h-4"
                />
                <span>{role.name}</span>
                <span className="text-xs text-gray-500">({role.permissionCount} permissions)</span>
              </label>
            ))}
          </div>
          {formData.roleIds.length === 0 && (
            <p className="text-sm text-red-500 mt-1">Please select at least one role</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Assign Locations (Branches)</h3>
          <p className="text-xs text-gray-500 mb-2">
            Leave empty if user has ACCESS_ALL_LOCATIONS permission
          </p>
          <div className="border rounded p-4 space-y-2 max-h-64 overflow-y-auto">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.locationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                  className="w-4 h-4"
                />
                <span>{location.name}</span>
                <span className="text-xs text-gray-500">({location.city}, {location.state})</span>
              </label>
            ))}
            {locations.length === 0 && (
              <p className="text-sm text-gray-500">No locations available</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={submitting || formData.roleIds.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
          <Link
            href="/dashboard/users"
            className="px-6 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
