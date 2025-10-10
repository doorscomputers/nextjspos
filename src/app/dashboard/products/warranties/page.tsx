"use client"

import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

interface Warranty {
  id: number
  name: string
  description: string | null
  duration: number
  durationType: string
  createdAt: string
}

export default function WarrantiesPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: '',
    durationType: 'months',
  })

  useEffect(() => {
    fetchWarranties()
  }, [])

  const fetchWarranties = async () => {
    try {
      const response = await fetch('/api/warranties')
      const data = await response.json()
      if (response.ok) {
        setWarranties(data.warranties)
      }
    } catch (error) {
      console.error('Error fetching warranties:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingWarranty ? `/api/warranties/${editingWarranty.id}` : '/api/warranties'
      const method = editingWarranty ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        setEditingWarranty(null)
        resetForm()
        fetchWarranties()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save warranty')
      }
    } catch (error) {
      console.error('Error saving warranty:', error)
      alert('An error occurred')
    }
  }

  const handleEdit = (warranty: Warranty) => {
    setEditingWarranty(warranty)
    setFormData({
      name: warranty.name,
      description: warranty.description || '',
      duration: warranty.duration.toString(),
      durationType: warranty.durationType,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this warranty?')) return

    try {
      const response = await fetch(`/api/warranties/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchWarranties()
      }
    } catch (error) {
      console.error('Error deleting warranty:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration: '',
      durationType: 'months',
    })
  }

  const openCreateModal = () => {
    setEditingWarranty(null)
    resetForm()
    setShowModal(true)
  }

  const formatDuration = (duration: number, type: string) => {
    const typeLabel = type === 'months' ? 'Month(s)' : type === 'years' ? 'Year(s)' : 'Day(s)'
    return `${duration} ${typeLabel}`
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Warranties</h1>
          <p className="text-gray-600 mt-1">Manage product warranties</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Warranty
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading warranties...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {warranties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No warranties found. Click "Add Warranty" to create one.
                  </td>
                </tr>
              ) : (
                warranties.map((warranty) => (
                  <tr key={warranty.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{warranty.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDuration(warranty.duration, warranty.durationType)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{warranty.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(warranty)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(warranty.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingWarranty ? 'Edit Warranty' : 'Add New Warranty'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Warranty Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="1 Year Warranty, Lifetime Warranty, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      required
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration Type
                    </label>
                    <select
                      value={formData.durationType}
                      onChange={(e) => setFormData({ ...formData, durationType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="Warranty description and terms"
                  />
                </div>

                <div className="flex space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingWarranty(null)
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
                    {editingWarranty ? 'Update' : 'Create'} Warranty
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
