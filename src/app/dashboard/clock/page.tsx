"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ClockIcon, CheckCircleIcon, XCircleIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline'

interface ActiveAttendance {
  id: number
  clockIn: string
  location: {
    id: number
    name: string
  }
  scheduledStart: string
  scheduledEnd: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClockInOutPage() {
  const { can, user } = usePermissions()
  const [activeAttendance, setActiveAttendance] = useState<ActiveAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    checkActiveAttendance()

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const checkActiveAttendance = async () => {
    try {
      setLoading(true)
      // Fetch attendance records to check if user is already clocked in
      const response = await fetch('/api/attendance')
      if (response.ok) {
        const data = await response.json()
        // Find user's active attendance (no clock out)
        const active = data.attendanceRecords?.find((r: any) =>
          r.userId === parseInt(user?.id || '0') && !r.clockOut
        )
        setActiveAttendance(active || null)
      }
    } catch (error) {
      console.error('Failed to check active attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    try {
      setProcessing(true)

      const response = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Clocked in successfully')
        setActiveAttendance({
          id: data.attendance.id,
          clockIn: data.attendance.clockIn,
          location: data.attendance.location,
          scheduledStart: data.attendance.scheduledStart,
          scheduledEnd: data.attendance.scheduledEnd,
        })
        setNotes('')
      } else {
        toast.error(data.error || 'Failed to clock in')
      }
    } catch (error) {
      console.error('Failed to clock in:', error)
      toast.error('Failed to clock in')
    } finally {
      setProcessing(false)
    }
  }

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to clock out?')) {
      return
    }

    try {
      setProcessing(true)

      const response = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Clocked out successfully')
        setActiveAttendance(null)
        setNotes('')
      } else {
        toast.error(data.error || 'Failed to clock out')
      }
    } catch (error) {
      console.error('Failed to clock out:', error)
      toast.error('Failed to clock out')
    } finally {
      setProcessing(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calculateWorkDuration = (clockIn: string) => {
    const duration = currentTime.getTime() - new Date(clockIn).getTime()
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((duration % (1000 * 60)) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const formatScheduleTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Check permissions
  if (!can(PERMISSIONS.ATTENDANCE_CLOCK_IN) && !can(PERMISSIONS.ATTENDANCE_CLOCK_OUT)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to clock in/out.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Time Clock
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome, {user?.firstName || user?.username}
          </p>
        </div>

        {/* Current Time Display */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
              <div className="text-lg text-gray-600 dark:text-gray-400">
                {formatDate(currentTime)}
              </div>
            </div>
            <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-2 font-mono">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {DAY_NAMES[currentTime.getDay()]}
            </div>
          </div>
        </div>

        {activeAttendance ? (
          /* Already Clocked In */
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-center mb-6">
                <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
                You are Clocked In
              </h2>

              {/* Work Details */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-600 dark:text-gray-400">Location:</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {activeAttendance.location.name}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-600 dark:text-gray-400">Clocked In:</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(activeAttendance.clockIn).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>

                {activeAttendance.scheduledStart && activeAttendance.scheduledEnd && (
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-gray-600 dark:text-gray-400">Scheduled Shift:</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatScheduleTime(activeAttendance.scheduledStart)} - {formatScheduleTime(activeAttendance.scheduledEnd)}
                    </span>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Working Time</div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {calculateWorkDuration(activeAttendance.clockIn)}
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes about your shift..."
                />
              </div>

              {/* Clock Out Button */}
              <Button
                onClick={handleClockOut}
                disabled={processing || !can(PERMISSIONS.ATTENDANCE_CLOCK_OUT)}
                className="w-full h-16 text-xl font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transform transition hover:scale-105"
              >
                {processing ? (
                  'Clocking Out...'
                ) : (
                  <>
                    <XCircleIcon className="w-8 h-8 mr-3" />
                    Clock Out
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Not Clocked In */
          <div className="space-y-6">
            {/* Clock In Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <ClockIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                Ready to Start Your Shift?
              </h2>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                Click the button below to clock in
              </p>

              {/* Notes Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes..."
                />
              </div>

              {/* Clock In Button */}
              <Button
                onClick={handleClockIn}
                disabled={processing || !can(PERMISSIONS.ATTENDANCE_CLOCK_IN)}
                className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg transform transition hover:scale-105"
              >
                {processing ? (
                  'Clocking In...'
                ) : (
                  <>
                    <CheckCircleIcon className="w-8 h-8 mr-3" />
                    Clock In
                  </>
                )}
              </Button>

              <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Your location will be automatically assigned based on your schedule
              </div>
            </div>

            {/* Help Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                If you're having trouble clocking in, make sure you have a schedule set up for today.
                Contact your manager if you need assistance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
