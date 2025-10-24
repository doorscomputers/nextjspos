"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeftIcon, CalendarDaysIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface LeaveRequest {
  id: number
  userId: number
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  isStartHalfDay: boolean
  isEndHalfDay: boolean
  reason: string
  status: string
  requestedAt: string
  approvedBy: number | null
  approvedAt: string | null
  approverNotes: string | null
  emergencyContact: string | null
  affectedSchedules: any
  user: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  }
  approvedByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
  replacementUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
}

export default function LeaveRequestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { can, user } = usePermissions()
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchLeaveRequest()
    }
  }, [params.id])

  const fetchLeaveRequest = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leave-requests/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setLeaveRequest(data.leaveRequest)
      } else {
        toast.error('Failed to fetch leave request')
        router.push('/dashboard/leave-requests')
      }
    } catch (error) {
      console.error('Failed to fetch leave request:', error)
      toast.error('Failed to fetch leave request')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this leave request?')) {
      return
    }

    try {
      const response = await fetch(`/api/leave-requests/${params.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Approved by manager',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Request approved successfully')
        fetchLeaveRequest()
      } else {
        toast.error(data.error || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Failed to approve request:', error)
      toast.error('Failed to approve request')
    }
  }

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) {
      toast.error('Rejection reason is required')
      return
    }

    try {
      const response = await fetch(`/api/leave-requests/${params.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Request rejected successfully')
        fetchLeaveRequest()
      } else {
        toast.error(data.error || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Failed to reject request:', error)
      toast.error('Failed to reject request')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
      return
    }

    try {
      const response = await fetch(`/api/leave-requests/${params.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Request cancelled successfully')
        router.push('/dashboard/leave-requests')
      } else {
        toast.error(data.error || 'Failed to cancel request')
      }
    } catch (error) {
      console.error('Failed to cancel request:', error)
      toast.error('Failed to cancel request')
    }
  }

  const getEmployeeName = (user: { username: string; firstName: string | null; lastName: string | null }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'sick': 'Sick Leave',
      'vacation': 'Vacation Leave',
      'personal': 'Personal Leave',
      'bereavement': 'Bereavement Leave',
      'emergency': 'Emergency Leave',
    }
    return labels[type] || type
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'pending': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200', label: 'Pending' },
      'approved': { color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200', label: 'Approved' },
      'rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', label: 'Rejected' },
      'cancelled': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Cancelled' },
    }
    const config = configs[status] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: status }
    return (
      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const canApprove = can(PERMISSIONS.LEAVE_REQUEST_APPROVE) || can(PERMISSIONS.LEAVE_REQUEST_MANAGE)
  const canReject = can(PERMISSIONS.LEAVE_REQUEST_REJECT) || can(PERMISSIONS.LEAVE_REQUEST_MANAGE)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!leaveRequest) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Leave request not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.push('/dashboard/leave-requests')}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Leave Requests
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarDaysIcon className="w-8 h-8" />
            Leave Request #{leaveRequest.id}
          </h1>
          {getStatusBadge(leaveRequest.status)}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* Request Details */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Employee</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{getEmployeeName(leaveRequest.user)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Leave Type</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{getLeaveTypeLabel(leaveRequest.leaveType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">
                {formatDate(leaveRequest.startDate)}
                {leaveRequest.isStartHalfDay && <span className="ml-2 text-sm text-gray-500">(Half Day)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">
                {formatDate(leaveRequest.endDate)}
                {leaveRequest.isEndHalfDay && <span className="ml-2 text-sm text-gray-500">(Half Day)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Total Days</label>
              <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{leaveRequest.totalDays} days</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Requested At</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{formatDateTime(leaveRequest.requestedAt)}</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Reason</label>
            <p className="mt-1 text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{leaveRequest.reason}</p>
          </div>

          {leaveRequest.replacementUser && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Replacement Employee</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{getEmployeeName(leaveRequest.replacementUser)}</p>
            </div>
          )}

          {leaveRequest.emergencyContact && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Emergency Contact</label>
              <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{leaveRequest.emergencyContact}</p>
            </div>
          )}
        </div>

        {/* Approval Information */}
        {(leaveRequest.status === 'approved' || leaveRequest.status === 'rejected') && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {leaveRequest.status === 'approved' ? 'Approval Information' : 'Rejection Information'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  {leaveRequest.status === 'approved' ? 'Approved By' : 'Rejected By'}
                </label>
                <p className="mt-1 text-base text-gray-900 dark:text-gray-100">
                  {leaveRequest.approvedByUser ? getEmployeeName(leaveRequest.approvedByUser) : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  {leaveRequest.status === 'approved' ? 'Approved At' : 'Rejected At'}
                </label>
                <p className="mt-1 text-base text-gray-900 dark:text-gray-100">
                  {leaveRequest.approvedAt ? formatDateTime(leaveRequest.approvedAt) : '-'}
                </p>
              </div>
            </div>
            {leaveRequest.approverNotes && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Notes</label>
                <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{leaveRequest.approverNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Affected Schedules */}
        {leaveRequest.affectedSchedules?.schedules && leaveRequest.affectedSchedules.schedules.length > 0 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Affected Schedules</h2>
            <div className="space-y-2">
              {leaveRequest.affectedSchedules.schedules.map((schedule: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.dayOfWeek]}
                  </span>
                  <span>at</span>
                  <span className="font-medium">{schedule.location}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {leaveRequest.status === 'pending' && (
        <div className="mt-6 flex justify-end gap-3">
          {leaveRequest.userId === parseInt(user?.id || '0') && (
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex items-center gap-2"
            >
              Cancel Request
            </Button>
          )}
          {canApprove && leaveRequest.userId !== parseInt(user?.id || '0') && (
            <>
              <Button
                onClick={handleApprove}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Approve
              </Button>
              {canReject && (
                <Button
                  onClick={handleReject}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Reject
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
