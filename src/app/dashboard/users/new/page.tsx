'use client'

import { useEffect, useState, useMemo } from 'react'
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
    locationId: null as number | null, // Changed to single location
    allowLogin: true,
  })

  // Check if selected roles require location assignment
  const locationRequired = useMemo(() => {
    if (formData.roleIds.length === 0) return true

    const selectedRoles = roles.filter(r => formData.roleIds.includes(r.id))
    const selectedRoleNames = selectedRoles.map(r => r.name)

    // If user has ANY admin role (Super Admin or Branch Admin), location is NOT required
    const adminRoles = ['Super Admin', 'Branch Admin', 'All Branch Admin']
    const hasAdminRole = selectedRoleNames.some(name => adminRoles.includes(name))

    return !hasAdminRole
  }, [formData.roleIds, roles])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [rolesRes, locationsRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/locations'),
      ])

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        // Sort roles alphabetically by name for easier finding
        const rolesArray = rolesData.data || rolesData
        const sortedRoles = rolesArray.sort((a: any, b: any) => a.name.localeCompare(b.name))
        setRoles(sortedRoles)
      }

      if (locationsRes.ok) {
        const locData = await locationsRes.json()
        setLocations(locData.data || locData.locations || [])
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

  // Removed toggleLocation - now using single select

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
          <h3 className="text-sm font-medium mb-3">
            Assign Location (Branch) {locationRequired && '*'}
            {!locationRequired && (
              <span className="text-xs font-normal text-blue-600 ml-2">
                (Optional for Admin roles - user can access all locations)
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            {locationRequired
              ? 'Select the primary location for this user. Transactional roles (Cashier, Manager, Staff) require a specific location assignment.'
              : 'Admin users can work across all locations. Leave empty to grant access to all locations, or select a specific location if needed.'
            }
          </p>
          <select
            value={formData.locationId || ''}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={locationRequired}
          >
            <option value="">
              {locationRequired ? '-- Select Location --' : '-- All Locations (No Restriction) --'}
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.city}, {location.state})
              </option>
            ))}
          </select>
          {locationRequired && !formData.locationId && (
            <p className="text-sm text-red-500 mt-1">Please select a location for transactional roles</p>
          )}
          {!locationRequired && !formData.locationId && (
            <p className="text-sm text-blue-600 mt-1">User will have access to all locations within the business</p>
          )}
          {locations.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No locations available</p>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={submitting || formData.roleIds.length === 0 || (locationRequired && !formData.locationId)}
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
