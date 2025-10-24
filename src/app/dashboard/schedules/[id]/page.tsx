"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, CalendarIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

// DevExtreme Components
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import { CheckBox } from 'devextreme-react/check-box'
import { Button as DxButton } from 'devextreme-react/button'
import { LoadPanel } from 'devextreme-react/load-panel'
import { Validator, RequiredRule, CustomRule } from 'devextreme-react/validator'

// DevExtreme CSS
import 'devextreme/dist/css/dx.light.css'

interface Schedule {
  id: number
  userId: number
  locationId: number
  effectiveFrom: string
  effectiveTo: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface User {
  id: number
  username: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface Location {
  id: number
  name: string
}

interface DayOfWeek {
  value: number
  label: string
}

const DAY_NAMES: DayOfWeek[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function EditSchedulePage() {
  const { can } = usePermissions()
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string

  const [userSchedules, setUserSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [userId, setUserId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [endTime, setEndTime] = useState<Date | null>(null)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [userName, setUserName] = useState('')
  const [locationName, setLocationName] = useState('')

  useEffect(() => {
    fetchScheduleGroup()
  }, [scheduleId])

  const fetchScheduleGroup = async () => {
    try {
      setLoading(true)

      // First, fetch the initial schedule to get userId and locationId
      const response = await fetch(`/api/schedules/${scheduleId}`)
      if (!response.ok) {
        toast.error('Failed to fetch schedule')
        router.push('/dashboard/schedules')
        return
      }

      const data = await response.json()
      const firstSchedule = data.schedule

      // Now fetch ALL schedules for this user at this location
      const allSchedulesResponse = await fetch(`/api/schedules?userId=${firstSchedule.userId}`)
      if (!allSchedulesResponse.ok) {
        toast.error('Failed to fetch user schedules')
        return
      }

      const allSchedulesData = await allSchedulesResponse.json()
      const userLocationSchedules = allSchedulesData.schedules.filter(
        (s: Schedule) => s.userId === firstSchedule.userId && s.locationId === firstSchedule.locationId
      )

      setUserSchedules(userLocationSchedules)
      setUserId(firstSchedule.userId)
      setLocationId(firstSchedule.locationId)

      // Set user and location names for display
      setUserName(getUserName(firstSchedule.user))
      setLocationName(firstSchedule.location.name)

      // Extract selected days from all schedules
      const days = userLocationSchedules.map((s: Schedule) => s.dayOfWeek).sort()
      setSelectedDays(days)

      // Set times from first schedule (assuming all have same times)
      const startTimeParts = firstSchedule.startTime.split(':')
      const endTimeParts = firstSchedule.endTime.split(':')

      const start = new Date()
      start.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0, 0)
      setStartTime(start)

      const end = new Date()
      end.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0)
      setEndTime(end)

      setStartDate(new Date(firstSchedule.effectiveFrom))
      setEndDate(firstSchedule.effectiveTo ? new Date(firstSchedule.effectiveTo) : null)
      setIsActive(firstSchedule.isActive)

    } catch (error) {
      console.error('Failed to fetch schedule:', error)
      toast.error('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const getUserName = (user: any) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  const handleToggleDay = (dayValue: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayValue)) {
        // Remove day
        return prev.filter((d) => d !== dayValue)
      } else {
        // Add day and sort
        return [...prev, dayValue].sort()
      }
    })
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!userId || !locationId || selectedDays.length === 0 || !startTime || !endTime || !startDate) {
      toast.error('Please fill in all required fields and select at least one day')
      return
    }

    // Validate times
    if (startTime >= endTime) {
      toast.error('End time must be after start time')
      return
    }

    // Validate dates
    if (endDate && startDate > endDate) {
      toast.error('End date must be after start date')
      return
    }

    try {
      setSubmitting(true)

      // Format times to HH:MM
      const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        return `${hours}:${minutes}`
      }

      // Format dates to YYYY-MM-DD
      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0]
      }

      // Step 1: Delete all existing schedules for this user at this location
      const deletePromises = userSchedules.map(schedule =>
        fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' })
      )
      await Promise.all(deletePromises)

      // Step 2: Create new schedules for selected days
      const results = {
        successful: [] as number[],
        failed: [] as { day: number; error: string }[],
      }

      for (const dayOfWeek of selectedDays) {
        try {
          const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userId,
              locationId: locationId,
              dayOfWeek: dayOfWeek,
              startTime: formatTime(startTime),
              endTime: formatTime(endTime),
              startDate: formatDate(startDate),
              endDate: endDate ? formatDate(endDate) : null,
              isActive,
            }),
          })

          const data = await response.json()

          if (response.ok) {
            results.successful.push(dayOfWeek)
          } else {
            results.failed.push({
              day: dayOfWeek,
              error: data.error || 'Failed to update schedule',
            })
          }
        } catch (error) {
          console.error(`Failed to update schedule for day ${dayOfWeek}:`, error)
          results.failed.push({
            day: dayOfWeek,
            error: 'Network error',
          })
        }
      }

      // Show results
      if (results.successful.length > 0 && results.failed.length === 0) {
        toast.success(`Updated schedule successfully for ${results.successful.length} day(s)`)
        router.push('/dashboard/schedules')
      } else if (results.successful.length > 0 && results.failed.length > 0) {
        const failedDayNames = results.failed
          .map((f) => DAY_NAMES.find((d) => d.value === f.day)?.label)
          .join(', ')
        toast.warning(
          `Updated ${results.successful.length} days. Failed for: ${failedDayNames}`
        )
        router.push('/dashboard/schedules')
      } else {
        toast.error('Failed to update schedule. Please try again.')
      }
    } catch (error) {
      console.error('Failed to update schedule:', error)
      toast.error('Failed to update schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this entire schedule? This will remove all days.')) {
      return
    }

    try {
      setSubmitting(true)

      // Delete all schedules for this user
      const deletePromises = userSchedules.map(schedule =>
        fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' })
      )

      const results = await Promise.all(deletePromises)
      const allSuccess = results.every(r => r.ok)

      if (allSuccess) {
        toast.success('Schedule deleted successfully')
        router.push('/dashboard/schedules')
      } else {
        toast.error('Failed to delete some schedules')
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      toast.error('Failed to delete schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/schedules')
  }

  // Custom validation rules
  const validateEndTime = () => {
    if (!startTime || !endTime) return true
    return endTime > startTime
  }

  const validateEndDate = () => {
    if (!startDate || !endDate) return true
    return endDate >= startDate
  }

  // Check permissions
  if (!can(PERMISSIONS.SCHEDULE_UPDATE) && !can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to edit schedules.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <LoadPanel
        visible={loading}
        message="Loading schedule..."
        showIndicator={true}
        showPane={true}
        shading={true}
        shadingColor="rgba(0,0,0,0.4)"
      />

      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/schedules">
          <button className="mb-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors inline-flex items-center gap-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Schedules
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CalendarIcon className="w-8 h-8" />
          Edit Employee Schedule
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Edit schedule for {userName} at {locationName}
        </p>
      </div>

      {!loading && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            {/* Employee and Location (Read-only display) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employee
                </label>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {userName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {locationName}
                </div>
              </div>
            </div>

            {/* Days of Week - Multi-Select with Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days of Week <span className="text-red-500">*</span>
              </label>

              {/* Checkbox Grid */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {DAY_NAMES.map((day) => (
                    <div
                      key={day.value}
                      className={`
                        flex items-center gap-2 p-3 rounded-md border transition-all
                        ${
                          selectedDays.includes(day.value)
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }
                      `}
                    >
                      <CheckBox
                        value={selectedDays.includes(day.value)}
                        onValueChanged={() => handleToggleDay(day.value)}
                        disabled={submitting}
                        text={day.label}
                      />
                    </div>
                  ))}
                </div>

                {/* Validation Message */}
                {selectedDays.length === 0 && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Please select at least one day
                  </div>
                )}

                {/* Selected Days Summary */}
                {selectedDays.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Selected {selectedDays.length} day{selectedDays.length > 1 ? 's' : ''}: {' '}
                      {selectedDays
                        .map((d) => DAY_NAMES.find((day) => day.value === d)?.label)
                        .join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <DateBox
                  type="time"
                  value={startTime}
                  onValueChanged={(e) => setStartTime(e.value)}
                  displayFormat="hh:mm a"
                  pickerType="rollers"
                  width="100%"
                  stylingMode="outlined"
                  showClearButton={true}
                >
                  <Validator>
                    <RequiredRule message="Start time is required" />
                  </Validator>
                </DateBox>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time <span className="text-red-500">*</span>
                </label>
                <DateBox
                  type="time"
                  value={endTime}
                  onValueChanged={(e) => setEndTime(e.value)}
                  displayFormat="hh:mm a"
                  pickerType="rollers"
                  width="100%"
                  stylingMode="outlined"
                  showClearButton={true}
                >
                  <Validator>
                    <RequiredRule message="End time is required" />
                    <CustomRule
                      message="End time must be after start time"
                      validationCallback={validateEndTime}
                    />
                  </Validator>
                </DateBox>
              </div>
            </div>

            {/* Schedule Period */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <DateBox
                  type="date"
                  value={startDate}
                  onValueChanged={(e) => setStartDate(e.value)}
                  displayFormat="MM/dd/yyyy"
                  width="100%"
                  stylingMode="outlined"
                  showClearButton={true}
                  useMaskBehavior={true}
                >
                  <Validator>
                    <RequiredRule message="Start date is required" />
                  </Validator>
                </DateBox>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date <span className="text-gray-500">(Optional - leave blank for ongoing)</span>
                </label>
                <DateBox
                  type="date"
                  value={endDate}
                  onValueChanged={(e) => setEndDate(e.value)}
                  displayFormat="MM/dd/yyyy"
                  width="100%"
                  stylingMode="outlined"
                  showClearButton={true}
                  useMaskBehavior={true}
                  min={startDate || undefined}
                >
                  <Validator>
                    <CustomRule
                      message="End date must be after start date"
                      validationCallback={validateEndDate}
                    />
                  </Validator>
                </DateBox>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <CheckBox
                value={isActive}
                onValueChanged={(e) => setIsActive(e.value)}
                text="Active Schedule"
              />
              <div className="mt-0.5">
                <span className="text-xs text-gray-600 dark:text-gray-400 block mt-1">
                  Inactive schedules will not be used for login or scheduling purposes
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <DxButton
              text="Delete Schedule"
              type="danger"
              stylingMode="outlined"
              onClick={handleDelete}
              disabled={submitting || loading}
              icon="trash"
              width={180}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <DxButton
                text="Cancel"
                type="normal"
                stylingMode="outlined"
                onClick={handleCancel}
                disabled={submitting}
                width={150}
              />
              <DxButton
                text={submitting ? 'Saving...' : 'Save Changes'}
                type="default"
                stylingMode="contained"
                onClick={handleSubmit}
                disabled={submitting || loading}
                width={150}
              />
            </div>
          </div>

          {/* Info card */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> Editing this schedule will update all working days for {userName} at {locationName}.
              Unselected days mean the employee is not scheduled to work and will not be able to login on those days.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
