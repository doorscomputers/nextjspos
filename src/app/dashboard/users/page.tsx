'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {  ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface User {
  id: number
  username: string
  email: string | null
  surname: string
  firstName: string
  lastName: string | null
  allowLogin: boolean
  roles: string[]
  locations: string[]
  createdAt: string
}

type SortField = 'name' | 'username' | 'email' | 'status' | 'created'
type SortDirection = 'asc' | 'desc'

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<{id: number, username: string} | null>(null)
  const [resetResult, setResetResult] = useState<{username: string, password: string} | null>(null)

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users')

      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId: number) => {
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      setDeleteConfirm(null)
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleResetPassword = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reset password')
      }

      const result = await res.json()
      if (result.temporaryPassword) {
        setResetResult({
          username: result.username,
          password: result.temporaryPassword
        })
      } else {
        alert('Password reset successfully!')
      }
      setResetPasswordUser(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password')
    }
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

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      const searchLower = searchQuery.toLowerCase()
      const fullName = `${user.surname} ${user.firstName} ${user.lastName || ''}`.toLowerCase()
      const username = user.username.toLowerCase()
      const email = (user.email || '').toLowerCase()
      const roles = user.roles.join(' ').toLowerCase()

      return (
        fullName.includes(searchLower) ||
        username.includes(searchLower) ||
        email.includes(searchLower) ||
        roles.includes(searchLower)
      )
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = `${a.surname} ${a.firstName} ${a.lastName || ''}`.toLowerCase()
          bValue = `${b.surname} ${b.firstName} ${b.lastName || ''}`.toLowerCase()
          break
        case 'username':
          aValue = a.username.toLowerCase()
          bValue = b.username.toLowerCase()
          break
        case 'email':
          aValue = (a.email || '').toLowerCase()
          bValue = (b.email || '').toLowerCase()
          break
        case 'status':
          aValue = a.allowLogin ? 1 : 0
          bValue = b.allowLogin ? 1 : 0
          break
        case 'created':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [users, searchQuery, sortField, sortDirection])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">User Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">User Management</h1>
        <p className="text-red-500 dark:text-red-400">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage system users and their access</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/users/new')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Add User
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, username, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Showing {filteredAndSortedUsers.length} of {users.length} users
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">All Users</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('username')}
                >
                  <div className="flex items-center gap-2">
                    Username
                    <SortIcon field="username" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-2">
                    Email
                    <SortIcon field="email" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Roles
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('created')}
                >
                  <div className="flex items-center gap-2">
                    Created
                    <SortIcon field="created" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.surname} {user.firstName} {user.lastName || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-300">{user.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        user.allowLogin
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.allowLogin ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => router.push(`/dashboard/users/${user.id}/edit`)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium hover:underline transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setResetPasswordUser({id: user.id, username: user.username})}
                        className="text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300 font-medium hover:underline transition-all"
                      >
                        Reset Password
                      </button>
                      {deleteConfirm === user.id ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold shadow-md hover:shadow-lg transition-all"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 shadow-sm hover:shadow-md transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(user.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-medium hover:underline transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedUsers.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No users found matching your search' : 'No users found'}
          </div>
        )}
      </div>

      {/* Reset Password Confirmation Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Reset Password</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to reset the password for user <strong className="text-gray-900 dark:text-gray-100">{resetPasswordUser.username}</strong>?
              <br /><br />
              A new temporary password will be generated and displayed to you.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResetPasswordUser(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetPassword(resetPasswordUser.id)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {resetResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400">Password Reset Successful!</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                ⚠️ Important: Copy this password now!
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                This temporary password will only be shown once. Save it securely.
              </p>
            </div>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-900 dark:text-gray-100">
                  {resetResult.username}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                  {resetResult.password}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Username: ${resetResult.username}\nPassword: ${resetResult.password}`)
                  alert('Copied to clipboard!')
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-md hover:shadow-lg transition-all"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setResetResult(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
