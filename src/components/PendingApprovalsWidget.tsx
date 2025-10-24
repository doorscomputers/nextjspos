"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import {
  BellAlertIcon,
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

export default function PendingApprovalsWidget() {
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

      // Refresh every 60 seconds
      const interval = setInterval(fetchPendingApprovals, 60000)
      return () => clearInterval(interval)
    }
  }, [canApprove])

  const fetchPendingApprovals = async () => {
    try {
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

  // Don't show widget if user cannot approve anything
  if (!canApprove) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data || data.counts.total === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <BellAlertIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              No Pending Approvals
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All caught up! No pending items require your attention.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const approvalItems = [
    {
      name: 'Leave Requests',
      count: data.counts.leaveRequests,
      icon: CalendarDaysIcon,
      color: 'blue',
      href: '/dashboard/leave-requests?status=pending',
      permission: PERMISSIONS.LEAVE_REQUEST_APPROVE,
    },
    {
      name: 'Location Changes',
      count: data.counts.locationChanges,
      icon: TruckIcon,
      color: 'purple',
      href: '/dashboard/location-changes?status=pending',
      permission: PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE,
    },
    {
      name: 'Transfers',
      count: data.counts.transfers,
      icon: ArrowsRightLeftIcon,
      color: 'yellow',
      href: '/dashboard/transfers?status=pending_approval',
      permission: PERMISSIONS.TRANSFER_APPROVE,
    },
    {
      name: 'Supplier Returns',
      count: data.counts.supplierReturns,
      icon: ArrowUturnLeftIcon,
      color: 'red',
      href: '/dashboard/supplier-returns?status=pending',
      permission: PERMISSIONS.SUPPLIER_RETURN_APPROVE,
    },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-900/40',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-500'
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-900/40',
        text: 'text-purple-800 dark:text-purple-200',
        border: 'border-purple-500'
      },
      yellow: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/40',
        text: 'text-yellow-800 dark:text-yellow-200',
        border: 'border-yellow-500'
      },
      red: {
        bg: 'bg-red-100 dark:bg-red-900/40',
        text: 'text-red-800 dark:text-red-200',
        border: 'border-red-500'
      },
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellAlertIcon className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pending Approvals
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data.counts.total} {data.counts.total === 1 ? 'item' : 'items'} awaiting your review
              </p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full ${getColorClasses('red').bg}`}>
            <span className={`text-2xl font-bold ${getColorClasses('red').text}`}>
              {data.counts.total}
            </span>
          </div>
        </div>
      </div>

      {/* Approval Items */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {approvalItems.map((item) => {
          if (item.count === 0 || !can(item.permission)) return null

          const colors = getColorClasses(item.color)
          const Icon = item.icon

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.href)}
              className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${colors.bg}`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {item.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.count} pending {item.count === 1 ? 'approval' : 'approvals'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors.bg} ${colors.text}`}>
                    {item.count}
                  </span>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer with timestamp */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Last updated: {new Date(data.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  )
}
