"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import {
  BellAlertIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  TruckIcon,
  ArrowsRightLeftIcon,
  ArrowUturnLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface PendingCounts {
  leaveRequests: number
  locationChanges: number
  transfers: number
  supplierReturns: number
  purchaseOrders: number
  total: number
}

interface PendingApproval {
  counts: PendingCounts
  details: any
  timestamp: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [data, setData] = useState<PendingApproval | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user has any approval permissions
  const canApprove = can(PERMISSIONS.LEAVE_REQUEST_APPROVE) ||
                     can(PERMISSIONS.LEAVE_REQUEST_MANAGE) ||
                     can(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE) ||
                     can(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE) ||
                     can(PERMISSIONS.TRANSFER_APPROVE) ||
                     can(PERMISSIONS.TRANSFER_MANAGE) ||
                     can(PERMISSIONS.SUPPLIER_RETURN_APPROVE) ||
                     can(PERMISSIONS.SUPPLIER_RETURN_MANAGE)

  useEffect(() => {
    if (canApprove) {
      fetchPendingApprovals()
    }
  }, [canApprove])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/pending-approvals')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEmployeeName = (user: { username: string; firstName: string | null; lastName: string | null }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Check permissions
  if (!canApprove) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            You do not have permission to view pending approvals.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BellAlertIcon className="w-8 h-8" />
            Notifications & Approvals
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage all pending approvals across the system
          </p>
        </div>
        <Button
          onClick={fetchPendingApprovals}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow p-4 text-white">
          <div className="text-sm font-medium opacity-90">Total Pending</div>
          <div className="text-3xl font-bold mt-1">{data?.counts.total || 0}</div>
          <div className="text-xs opacity-75 mt-1">Requires your review</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Leave Requests</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data?.counts.leaveRequests || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Location Changes</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data?.counts.locationChanges || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Transfers</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data?.counts.transfers || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Supplier Returns</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data?.counts.supplierReturns || 0}
          </div>
        </div>
      </div>

      {/* No Pending Items Message */}
      {data && data.counts.total === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <BellAlertIcon className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No pending items require your attention at this time.
          </p>
        </div>
      )}

      {/* Leave Requests */}
      {data?.details.leaveRequests && data.details.leaveRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pending Leave Requests
              </h2>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded-full">
                {data.details.leaveRequests.length}
              </span>
            </div>
            <Button
              onClick={() => router.push('/dashboard/leave-requests?status=pending')}
              variant="outline"
              size="sm"
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.details.leaveRequests.map((request: any) => (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => router.push(`/dashboard/leave-requests/${request.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {getEmployeeName(request.user)}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {request.leaveType.replace('_', ' ')} • {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.totalDays} days)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Requested {formatDateTime(request.requestedAt)}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location Change Requests */}
      {data?.details.locationChanges && data.details.locationChanges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TruckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pending Location Changes
              </h2>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs font-semibold rounded-full">
                {data.details.locationChanges.length}
              </span>
            </div>
            <Button
              onClick={() => router.push('/dashboard/location-changes?status=pending')}
              variant="outline"
              size="sm"
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.details.locationChanges.map((request: any) => (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => router.push(`/dashboard/location-changes`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {getEmployeeName(request.requestedByUser)}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {request.fromLocation.name} → {request.toLocation.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Requested {formatDateTime(request.requestedAt)}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfers */}
      {data?.details.transfers && data.details.transfers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowsRightLeftIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pending Transfers
              </h2>
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 text-xs font-semibold rounded-full">
                {data.details.transfers.length}
              </span>
            </div>
            <Button
              onClick={() => router.push('/dashboard/transfers?status=pending_approval')}
              variant="outline"
              size="sm"
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.details.transfers.map((transfer: any) => (
              <div
                key={transfer.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => router.push(`/dashboard/transfers/${transfer.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      Transfer #{transfer.referenceNumber}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {transfer.fromLocation.name} → {transfer.toLocation.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Created by {getEmployeeName(transfer.createdByUser)} • {formatDateTime(transfer.createdAt)}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplier Returns */}
      {data?.details.supplierReturns && data.details.supplierReturns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowUturnLeftIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pending Supplier Returns
              </h2>
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-xs font-semibold rounded-full">
                {data.details.supplierReturns.length}
              </span>
            </div>
            <Button
              onClick={() => router.push('/dashboard/supplier-returns?status=pending')}
              variant="outline"
              size="sm"
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.details.supplierReturns.map((returnItem: any) => (
              <div
                key={returnItem.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => router.push(`/dashboard/supplier-returns/${returnItem.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {returnItem.supplier.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Return #{returnItem.referenceNumber || returnItem.id}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Created by {getEmployeeName(returnItem.createdByUser)} • {formatDateTime(returnItem.createdAt)}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
