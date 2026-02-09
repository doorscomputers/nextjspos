"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

interface FieldChange {
  field: string
  oldValue: string | number | boolean | null
  newValue: string | number | boolean | null
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'null'
}

interface AuditLogMetadata {
  changes?: FieldChange[]
  changeCount?: number
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  changedFields?: string[]
  [key: string]: unknown
}

interface AuditLog {
  id: number
  businessId: number
  userId: number
  username: string
  action: string
  entityType: string
  entityIds: number[]
  description: string
  metadata: AuditLogMetadata
  ipAddress: string
  userAgent: string
  createdAt: string
}

export default function AuditLogsPage() {
  const { can, user } = usePermissions()
  const router = useRouter()

  // Check permission
  useEffect(() => {
    if (!can(PERMISSIONS.AUDIT_LOG_VIEW)) {
      router.push('/dashboard')
    }
  }, [can, router])

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Toggle row expansion
  const toggleRowExpansion = (logId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 50

  useEffect(() => {
    fetchLogs()
  }, [currentPage, actionFilter, entityFilter, userFilter, dateFrom, dateTo])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(actionFilter && { action: actionFilter }),
        ...(entityFilter && { entityType: entityFilter }),
        ...(userFilter && { userId: userFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })

      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotalPages(Math.ceil(data.total / pageSize))
      } else {
        console.error('Failed to fetch audit logs')
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    const params = new URLSearchParams({
      ...(actionFilter && { action: actionFilter }),
      ...(entityFilter && { entityType: entityFilter }),
      ...(userFilter && { userId: userFilter }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      export: 'true',
    })

    window.open(`/api/audit-logs?${params}`, '_blank')
  }

  const filteredLogs = logs.filter(log =>
    searchTerm === '' ||
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('login')) return 'text-green-600 bg-green-50'
    if (action.includes('update')) return 'text-blue-600 bg-blue-50'
    if (action.includes('delete') || action.includes('logout')) return 'text-red-600 bg-red-50'
    if (action.includes('approve') || action.includes('complete')) return 'text-purple-600 bg-purple-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Complete activity trail of all user actions in the system
        </p>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, action, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FunnelIcon className="h-5 w-5" />
              Filters
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Actions</option>
                <optgroup label="User Actions">
                  <option value="user_login">User Login</option>
                  <option value="user_logout">User Logout</option>
                  <option value="user_update">User Updated</option>
                  <option value="user_create">User Created</option>
                </optgroup>
                <optgroup label="Product Actions">
                  <option value="product_create">Product Created</option>
                  <option value="product_update">Product Updated</option>
                  <option value="product_delete">Product Deleted</option>
                  <option value="price_change">Price Changed</option>
                </optgroup>
                <optgroup label="Sales Actions">
                  <option value="sale_create">Sale Created</option>
                  <option value="sale_update">Sale Updated</option>
                  <option value="sale_void">Sale Voided</option>
                  <option value="sale_refund">Sale Refunded</option>
                  <option value="sale_return">Sale Returned</option>
                </optgroup>
                <optgroup label="Inventory Actions">
                  <option value="stock_transfer_create">Transfer Created</option>
                  <option value="stock_transfer_send">Transfer Sent</option>
                  <option value="stock_transfer_receive">Transfer Received</option>
                  <option value="inventory_correction_create">Inventory Correction</option>
                  <option value="inventory_correction_approve">Correction Approved</option>
                </optgroup>
                <optgroup label="Purchase Actions">
                  <option value="purchase_order_create">Purchase Order Created</option>
                  <option value="purchase_receipt_create">Purchase Receipt Created</option>
                </optgroup>
                <optgroup label="Bulk Actions">
                  <option value="bulk_delete">Bulk Delete</option>
                  <option value="bulk_activate">Bulk Activate</option>
                  <option value="bulk_deactivate">Bulk Deactivate</option>
                </optgroup>
                <optgroup label="POS Actions">
                  <option value="shift_open">Shift Opened</option>
                  <option value="shift_close">Shift Closed</option>
                  <option value="discount_applied">Discount Applied</option>
                  <option value="price_override">Price Override</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entity Type
              </label>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Entities</option>
                <option value="user">User</option>
                <option value="sale">Sale</option>
                <option value="purchase">Purchase</option>
                <option value="stock_transfer">Stock Transfer</option>
                <option value="payment">Payment</option>
                <option value="product">Product</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setActionFilter('')
                  setEntityFilter('')
                  setUserFilter('')
                  setDateFrom('')
                  setDateTo('')
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {logs.length}
              </p>
            </div>
            <DocumentTextIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {new Set(logs.map(l => l.userId)).size}
              </p>
            </div>
            <UserIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Today's Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
              </p>
            </div>
            <ClockIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Page</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentPage} / {totalPages}
              </p>
            </div>
            <DocumentTextIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedRows.has(log.id)
                  const hasChanges = log.metadata?.changes && Array.isArray(log.metadata.changes) && log.metadata.changes.length > 0

                  return (
                    <>
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">{log.username}</div>
                          <div className="text-xs text-gray-500">ID: {log.userId}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md">
                          <div className="line-clamp-2" title={log.description}>
                            {log.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {log.ipAddress}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {hasChanges && (
                            <button
                              onClick={() => toggleRowExpansion(log.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title={isExpanded ? 'Hide changes' : 'View changes'}
                            >
                              <EyeIcon className="h-4 w-4" />
                              {isExpanded ? (
                                <ChevronUpIcon className="h-3 w-3" />
                              ) : (
                                <ChevronDownIcon className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {isExpanded && hasChanges && (
                        <tr key={`${log.id}-details`} className="bg-blue-50/50 dark:bg-blue-900/20">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Changes Details ({log.metadata.changeCount || log.metadata.changes.length} field{(log.metadata.changeCount || log.metadata.changes.length) > 1 ? 's' : ''} changed)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {log.metadata.changes.map((change: FieldChange, idx: number) => (
                                  <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                      {change.field.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded max-w-[120px] truncate" title={String(change.oldValue)}>
                                        {change.oldValue === null || change.oldValue === undefined || change.oldValue === ''
                                          ? '(empty)'
                                          : String(change.oldValue)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded max-w-[120px] truncate" title={String(change.newValue)}>
                                        {change.newValue === null || change.newValue === undefined || change.newValue === ''
                                          ? '(empty)'
                                          : String(change.newValue)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Additional metadata info */}
                              {log.userAgent && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">Device:</span> {log.userAgent.substring(0, 100)}...
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
