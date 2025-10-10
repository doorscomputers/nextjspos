"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline'

interface Location {
  id: number
  name: string
  landmark: string | null
  country: string
  state: string
  city: string
  zipCode: string
  mobile: string | null
  alternateNumber: string | null
  email: string | null
  createdAt: string
}

export default function LocationsPage() {
  const { can } = usePermissions()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    landmark: '',
    country: '',
    state: '',
    city: '',
    zipCode: '',
    mobile: '',
    alternateNumber: '',
    email: '',
  })

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingLocation ? `/api/locations/${editingLocation.id}` : '/api/locations'
      const method = editingLocation ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        setEditingLocation(null)
        resetForm()
        fetchLocations()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save location')
      }
    } catch (error) {
      console.error('Error saving location:', error)
      alert('An error occurred')
    }
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      landmark: location.landmark || '',
      country: location.country,
      state: location.state,
      city: location.city,
      zipCode: location.zipCode,
      mobile: location.mobile || '',
      alternateNumber: location.alternateNumber || '',
      email: location.email || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this location?')) return

    try {
      const response = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchLocations()
      }
    } catch (error) {
      console.error('Error deleting location:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      landmark: '',
      country: '',
      state: '',
      city: '',
      zipCode: '',
      mobile: '',
      alternateNumber: '',
      email: '',
    })
  }

  const openCreateModal = () => {
    setEditingLocation(null)
    resetForm()
    setShowModal(true)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Locations</h1>
          <p className="text-gray-600 mt-1">Manage your business branches</p>
        </div>
        {can(PERMISSIONS.LOCATION_CREATE) && (
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Location
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading locations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location) => (
            <div key={location.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <MapPinIcon className="w-8 h-8 text-blue-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">{location.name}</h3>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {location.landmark && <p>{location.landmark}</p>}
                <p>{location.city}, {location.state}</p>
                <p>{location.country} {location.zipCode}</p>
                {location.mobile && <p className="font-medium">📞 {location.mobile}</p>}
                {location.email && <p className="font-medium">✉ {location.email}</p>}
              </div>

              <div className="flex space-x-2 pt-4 border-t">
                {can(PERMISSIONS.LOCATION_UPDATE) && (
                  <button
                    onClick={() => handleEdit(location)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                  >
                    <PencilIcon className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
                {can(PERMISSIONS.LOCATION_DELETE) && (
                  <button
                    onClick={() => handleDelete(location.id)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="Main Store, Downtown Branch, etc."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Landmark</label>
                    <input
                      type="text"
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="Near City Mall"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      required
                      maxLength={7}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alternate Number</label>
                    <input
                      type="tel"
                      value={formData.alternateNumber}
                      onChange={(e) => setFormData({ ...formData, alternateNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingLocation(null)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingLocation ? 'Update' : 'Create'} Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
