'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Warranty {
  id: number
  name: string
  description: string | null
  duration: number
  durationType: string
  createdAt: string
}

export default function WarrantiesPage() {
  const { can } = usePermissions()
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(12)
  const [durationType, setDurationType] = useState('months')

  useEffect(() => {
    fetchWarranties()
  }, [])

  const fetchWarranties = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/warranties')
      const data = await response.json()

      if (response.ok) {
        setWarranties(data.warranties || [])
      } else {
        toast.error(data.error || 'Failed to fetch warranties')
      }
    } catch (error) {
      console.error('Error fetching warranties:', error)
      toast.error('Failed to fetch warranties')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter a warranty name')
      return
    }

    if (duration <= 0) {
      toast.error('Duration must be greater than 0')
      return
    }

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        duration,
        durationType,
      }

      const url = editingId ? `/api/warranties/${editingId}` : '/api/warranties'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingId ? 'Warranty updated' : 'Warranty created')
        resetForm()
        fetchWarranties()
      } else {
        toast.error(data.error || 'Failed to save warranty')
      }
    } catch (error) {
      console.error('Error saving warranty:', error)
      toast.error('Failed to save warranty')
    }
  }

  const handleEdit = (warranty: Warranty) => {
    setEditingId(warranty.id)
    setName(warranty.name)
    setDescription(warranty.description || '')
    setDuration(warranty.duration)
    setDurationType(warranty.durationType)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this warranty? Products using this warranty will no longer have automatic warranty calculation.')) {
      return
    }

    try {
      const response = await fetch(`/api/warranties/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Warranty deleted')
        fetchWarranties()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete warranty')
      }
    } catch (error) {
      console.error('Error deleting warranty:', error)
      toast.error('Failed to delete warranty')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setDuration(12)
    setDurationType('months')
    setShowForm(false)
  }

  const formatDuration = (warranty: Warranty) => {
    const { duration, durationType } = warranty
    if (durationType === 'months') {
      return `${duration} ${duration === 1 ? 'Month' : 'Months'}`
    } else if (durationType === 'years') {
      return `${duration} ${duration === 1 ? 'Year' : 'Years'}`
    } else {
      return `${duration} ${duration === 1 ? 'Day' : 'Days'}`
    }
  }

  if (!can(PERMISSIONS.SETTINGS_UPDATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to manage warranty settings.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Warranty Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create warranty templates to assign to products
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            New Warranty
          </Button>
        )}
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                How Warranty Works
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>Create warranty templates here (e.g., &quot;1 Year Standard&quot;, &quot;2 Years Extended&quot;)</li>
                <li>Assign warranties to products in the product management page</li>
                <li>When goods are received (GRN approved), warranty dates are auto-calculated</li>
                <li>Use Serial Lookup to check warranty status and create returns</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card className="mb-6 border-2 border-blue-500">
          <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
            <CardTitle className="text-blue-900 dark:text-blue-100">
              {editingId ? 'Edit Warranty' : 'Create New Warranty'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Warranty Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., 1 Year Standard Warranty"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duration Type <span className="text-red-500">*</span>
                  </label>
                  <Select value={durationType} onValueChange={setDurationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingId ? 'Update' : 'Create'} Warranty
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Warranties List */}
      <Card>
        <CardHeader>
          <CardTitle>Warranty Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading warranties...</div>
          ) : warranties.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📋</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Warranties Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first warranty template to get started
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create First Warranty
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {warranties.map((warranty) => (
                    <tr key={warranty.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {warranty.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {warranty.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="secondary">
                          {formatDuration(warranty)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(warranty)}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(warranty.id)}
                            className="text-red-600 hover:text-red-700 hover:border-red-600"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
