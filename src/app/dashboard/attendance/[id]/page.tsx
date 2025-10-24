"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeftIcon, ClockIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface AttendanceRecord {
  id: number
  userId: number
  locationId: number
  scheduleId: number | null
  clockInTime: string
  clockOutTime: string | null
  expectedStartTime: string
  expectedEndTime: string
  totalHoursWorked: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
    email: string
  }
  location: {
    id: number
    name: string
  }
  schedule: {
    id: number
    dayOfWeek: number
    startTime: string
    endTime: string
  } | null
  locationChanges: Array<{
    id: number
    fromLocationId: number
    toLocationId: number
    switchTime: string
    status: string
    reason: string
    fromLocation: {
      id: number
      name: string
    }
    toLocation: {
      id: number
      name: string
    }
    approvedByUser: {
      id: number
      username: string
      firstName: string | null
      lastName: string | null
    } | null
  }>
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AttendanceDetailPage() {
  const { can, user: currentUser } = usePermissions()
  const router = useRouter()
  const params = useParams()
  const attendanceId = params.id as string

  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Edit form fields
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchAttendance()
  }, [attendanceId])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/attendance/${attendanceId}`)
      if (response.ok) {
        const data = await response.json()
        setAttendance(data.attendance)
        // Populate edit fields
        setClockInTime(new Date(data.attendance.clockInTime).toISOString().slice(0, 16))
        setClockOutTime(data.attendance.clockOutTime ? new Date(data.attendance.clockOutTime).toISOString().slice(0, 16) : '')
        setStatus(data.attendance.status)
        setNotes(data.attendance.notes || '')
      } else {
        toast.error('Failed to fetch attendance record')
        router.push('/dashboard/attendance')
      }
    } catch (error) {
      console.error('Failed to fetch attendance record:', error)
      toast.error('Failed to load attendance record')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSubmitting(true)

      const response = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clockInTime,
          clockOutTime: clockOutTime || null,
          status,
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Attendance record updated successfully')
        setIsEditing(false)
        fetchAttendance()
      } else {
        toast.error(data.error || 'Failed to update attendance record')
      }
    } catch (error) {
      console.error('Failed to update attendance record:', error)
      toast.error('Failed to update attendance record')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this attendance record?')) {
      return
    }

    try {
      const response = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Attendance record deleted successfully')
        router.push('/dashboard/attendance')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete attendance record')
      }
    } catch (error) {
      console.error('Failed to delete attendance record:', error)
      toast.error('Failed to delete attendance record')
    }
  }

  const getEmployeeName = (user: { username: string; firstName: string | null; lastName: string | null }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'present': { color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200', label: 'Present' },
      'absent': { color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', label: 'Absent' },
      'late': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200', label: 'Late' },
      'early_departure': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200', label: 'Early Departure' },
      'on_leave': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200', label: 'On Leave' },
      'sick_leave': { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200', label: 'Sick Leave' },
    }
    const config = configs[status] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: status }
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return 'In Progress'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Check permissions
  const canViewAll = can(PERMISSIONS.ATTENDANCE_VIEW) || can(PERMISSIONS.ATTENDANCE_MANAGE)
  const canViewOwn = can(PERMISSIONS.ATTENDANCE_VIEW_OWN)
  const isOwnRecord = attendance?.userId === parseInt(currentUser?.id || '0')

  if (!canViewAll && (!canViewOwn || !isOwnRecord)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view this attendance record.
          </p>
        </div>
      </div>
    )
  }

  if (loading || !attendance) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading attendance record...</div>
        </div>
      </div>
    )
  }

  const canEdit = can(PERMISSIONS.ATTENDANCE_EDIT) || can(PERMISSIONS.ATTENDANCE_MANAGE)
  const canDelete = can(PERMISSIONS.ATTENDANCE_MANAGE)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/attendance">
          <Button variant="outline" className="mb-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Attendance
          </Button>
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClockIcon className="w-8 h-8" />
              Attendance Details
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Record ID: #{attendance.id}
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing && canEdit && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {isEditing ? (
        /* Edit Form */
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Clock In Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Clock Out Time <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={clockOutTime}
                  onChange={(e) => setClockOutTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="early_departure">Early Departure</option>
                <option value="on_leave">On Leave</option>
                <option value="sick_leave">Sick Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add notes about this attendance record..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditing(false)
                fetchAttendance()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Updating...' : 'Update Record'}
            </Button>
          </div>
        </form>
      ) : (
        /* View Mode */
        <div className="space-y-6">
          {/* Employee & Time Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Time Record
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Employee</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {getEmployeeName(attendance.user)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{attendance.user.email}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Location</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {attendance.location.name}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Clock In</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {formatDateTime(attendance.clockInTime)}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Clock Out</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {attendance.clockOutTime ? (
                    formatDateTime(attendance.clockOutTime)
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                      Still Clocked In
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Expected Shift</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {formatTime(attendance.expectedStartTime)} - {formatTime(attendance.expectedEndTime)}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Total Hours</label>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {attendance.totalHoursWorked
                    ? `${parseFloat(attendance.totalHoursWorked).toFixed(2)} hours`
                    : calculateDuration(attendance.clockInTime, attendance.clockOutTime)}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Status</label>
                <div className="mt-1">
                  {getStatusBadge(attendance.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Location Changes */}
          {attendance.locationChanges && attendance.locationChanges.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Location Changes ({attendance.locationChanges.length})
              </h2>
              <div className="space-y-4">
                {attendance.locationChanges.map((change, index) => (
                  <div key={change.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Change #{index + 1}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        change.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                          : change.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                      }`}>
                        {change.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">From:</span>
                        <div className="text-gray-900 dark:text-gray-100">{change.fromLocation.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">To:</span>
                        <div className="text-gray-900 dark:text-gray-100">{change.toLocation.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Switch Time:</span>
                        <div className="text-gray-900 dark:text-gray-100">{formatDateTime(change.switchTime)}</div>
                      </div>
                      {change.approvedByUser && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Approved By:</span>
                          <div className="text-gray-900 dark:text-gray-100">{getEmployeeName(change.approvedByUser)}</div>
                        </div>
                      )}
                    </div>
                    {change.reason && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Reason:</span>
                        <div className="text-gray-900 dark:text-gray-100 mt-1">{change.reason}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {attendance.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Notes
              </h2>
              <div className="text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {attendance.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
