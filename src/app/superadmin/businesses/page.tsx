"use client"

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'

interface Business {
  id: number
  name: string
  owner: {
    id: number
    username: string
    email: string | null
    firstName: string
    surname: string
  }
  currency: {
    id: number
    code: string
    symbol: string
  }
  subscriptions: Array<{
    id: number
    status: string
    endDate: string | null
    package: {
      name: string
    }
  }>
  _count: {
    users: number
    locations: number
  }
  createdAt: string
}

export default function BusinessManagementPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchBusinesses()
  }, [page, search])

  const fetchBusinesses = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/superadmin/businesses?page=${page}&search=${search}`)
      const data = await response.json()

      if (response.ok) {
        setBusinesses(data.businesses)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching businesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/superadmin/businesses/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchBusinesses()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete business')
      }
    } catch (error) {
      console.error('Error deleting business:', error)
      alert('An error occurred while deleting the business')
    }
  }

  const getSubscriptionStatus = (business: Business) => {
    const latestSub = business.subscriptions[0]
    if (!latestSub) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800">No Subscription</span>
    }

    if (latestSub.status === 'approved') {
      if (!latestSub.endDate || new Date(latestSub.endDate) > new Date()) {
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>
      }
    }

    return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Expired</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Management</h2>
          <p className="text-gray-600 mt-1">Manage all businesses on the platform</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Business
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by business name, owner username or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading businesses...</div>
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-600 mb-4">No businesses found</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-purple-600 hover:text-purple-700"
            >
              Create your first business
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Locations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{business.name}</div>
                        <div className="text-sm text-gray-500">
                          {business.currency.code} ({business.currency.symbol})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {business.owner.firstName} {business.owner.surname}
                        </div>
                        <div className="text-sm text-gray-500">@{business.owner.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {business.subscriptions[0]?.package.name || 'None'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getSubscriptionStatus(business)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {business._count.users}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {business._count.locations}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(business.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <a
                            href={`/superadmin/businesses/${business.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </a>
                          <a
                            href={`/superadmin/businesses/${business.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </a>
                          <button
                            onClick={() => handleDelete(business.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Create Business</h3>
            <p className="text-gray-600 mb-4">Business creation form coming soon...</p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
