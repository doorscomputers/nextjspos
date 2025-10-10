'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string

  const [roles, setRoles] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    password: '', // Optional for edit
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
      const [rolesRes, locationsRes, userRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/locations'),
        fetch(`/api/users/${userId}`),
      ])

      if (rolesRes.ok) setRoles(await rolesRes.json())

      if (locationsRes.ok) {
        const locData = await locationsRes.json()
        setLocations(locData.locations || locData || [])
      }

      if (userRes.ok) {
        const userData = await userRes.json()
        setFormData({
          username: userData.username || '',
          password: '',
          email: userData.email || '',
          surname: userData.surname || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          roleIds: userData.roleIds || [],
          locationIds: userData.locationIds || [],
          allowLogin: userData.allowLogin !== undefined ? userData.allowLogin : true,
        })
      }
    } catch (err) {
      console.error(err)
      alert('Error loading user data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const payload = { ...formData }
      // Only send password if it's been changed
      if (!payload.password) {
        delete (payload as any).password
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        alert('User updated successfully')
        router.push('/dashboard/users')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to update user')
      }
    } catch (err) {
      alert('Error updating user')
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

  const toggleAllLocations = () => {
    setFormData(prev => ({
      ...prev,
      locationIds: prev.locationIds.length === locations.length
        ? []
        : locations.map(loc => loc.id)
    }))
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit User</h1>
        <p className="text-gray-600 mt-1">Update user account details</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Surname *</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">First Name *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Password
              <span className="text-xs text-gray-500 ml-2">(leave empty to keep current)</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength={6}
              placeholder="Enter new password to change"
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
          <div className="border rounded p-4 space-y-2 max-h-48 overflow-y-auto">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={formData.roleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium">{role.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({role.permissionCount} permissions)</span>
                  {role.locations && role.locations.length > 0 && (
                    <span className="text-xs text-blue-600 ml-2">
                      • {role.locations.length} branch(es) assigned to role
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
          {formData.roleIds.length === 0 && (
            <p className="text-sm text-red-500 mt-1">Please select at least one role</p>
          )}
        </div>

        <div className="border-t pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">📍 Direct Branch Assignment (Optional Override)</h4>
            <p className="text-xs text-blue-800 mb-2">
              <strong>Leave empty</strong> to inherit branches from assigned roles above.<br/>
              <strong>Select specific branches</strong> to override role-based access for this user only.
            </p>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>If user has <strong>ACCESS_ALL_LOCATIONS</strong> permission → Ignores this setting</li>
              <li>If direct branches selected → User accesses <strong>ONLY</strong> these branches (overrides role)</li>
              <li>If empty → User inherits branches from their assigned roles</li>
            </ul>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Assign Locations (Branches) - Direct User Access</h3>
            <button
              type="button"
              onClick={toggleAllLocations}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {formData.locationIds.length === locations.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="border rounded p-4 space-y-2 max-h-64 overflow-y-auto">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={formData.locationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                  className="w-4 h-4"
                />
                <span className="font-medium">{location.name}</span>
                <span className="text-xs text-gray-500">({location.city}, {location.state})</span>
              </label>
            ))}
            {locations.length === 0 && (
              <p className="text-sm text-gray-500">No locations available</p>
            )}
          </div>

          {formData.locationIds.length > 0 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              ⚠️ This user will access ONLY {formData.locationIds.length} selected branch(es), overriding role-based access.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={submitting || formData.roleIds.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Updating...' : 'Update User'}
          </button>
          <Link
            href="/dashboard/users"
            className="px-6 py-2 border rounded hover:bg-gray-50 flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
