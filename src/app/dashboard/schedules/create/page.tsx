"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, CalendarIcon } from '@heroicons/react/24/outline'
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

interface User {
  id: number
  username: string
  firstName: string | null
  lastName: string | null
  email: string
  locationAssignments?: { id: number; name: string }[]
  locations?: string[]
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

const DEFAULT_START_HOUR = 7
const DEFAULT_END_HOUR = 19

export default function CreateSchedulePage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [userId, setUserId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [locationLocked, setLocationLocked] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([]) // Changed from single dayOfWeek to array
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [endTime, setEndTime] = useState<Date | null>(null)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    // Set default start date to today
    setStartDate(new Date())

    // Set default times (7:00 AM and 7:00 PM)
    const defaultStartTime = new Date()
    defaultStartTime.setHours(DEFAULT_START_HOUR, 0, 0, 0)
    setStartTime(defaultStartTime)

    const defaultEndTime = new Date()
    defaultEndTime.setHours(DEFAULT_END_HOUR, 0, 0, 0)
    setEndTime(defaultEndTime)

    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!userId) {
      setLocationLocked(false)
      setLocationId(null)
      return
    }

    const selectedUser = users.find((user) => user.id === userId)
    const assignedLocation = selectedUser?.locationAssignments?.[0]

    if (assignedLocation) {
      // Verify the assigned location exists in the available locations
      const locationExists = locations.some((loc) => loc.id === assignedLocation.id)

      if (locationExists) {
        setLocationId(assignedLocation.id)
        setLocationLocked(true)
      } else {
        // Location assigned but not available - show warning and allow manual selection
        console.warn(`Employee's assigned location (ID: ${assignedLocation.id}) not found in available locations`)
        toast.warning(`Employee's assigned location "${assignedLocation.name}" is not available. Please select a location manually.`)
        setLocationLocked(false)
        setLocationId(null)
      }
    } else {
      setLocationLocked(false)
      setLocationId(null)
    }
  }, [userId, users, locations])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch users
      const usersResponse = await fetch('/api/users')
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        console.log('Users data:', usersData)
        setUsers(usersData.data || [])
      } else {
        const errorData = await usersResponse.json()
        console.error('Failed to fetch users:', errorData)
        toast.error(`Failed to fetch users: ${errorData.error || 'Unknown error'}`)
      }

      // Fetch locations
      const locationsResponse = await fetch('/api/locations')
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json()
        console.log('Locations data:', locationsData)
        // API returns { success: true, data: [...] }
        const locationsList = locationsData.data || locationsData.locations || []
        setLocations(locationsList)

        if (locationsList.length === 0) {
          toast.warning('No locations found. Please create a location first.')
        }
      } else {
        const errorData = await locationsResponse.json()
        console.error('Failed to fetch locations:', errorData)
        toast.error(`Failed to fetch locations: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
      toast.error('Failed to load data. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!userId || !locationId || selectedDays.length === 0 || !startTime || !endTime || !startDate) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate that at least one day is selected
    if (selectedDays.length === 0) {
      toast.error('Please select at least one day')
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

      // Create schedules for all selected days
      const results = {
        successful: [] as number[],
        failed: [] as { day: number; error: string }[],
      }

      // Loop through each selected day and create a schedule
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
              error: data.error || 'Failed to create schedule',
            })
          }
        } catch (error) {
          console.error(`Failed to create schedule for day ${dayOfWeek}:`, error)
          results.failed.push({
            day: dayOfWeek,
            error: 'Network error',
          })
        }
      }

      // Show results
      if (results.successful.length > 0 && results.failed.length === 0) {
        // All successful
        toast.success(
          `Created ${results.successful.length} schedule${results.successful.length > 1 ? 's' : ''} successfully`
        )
        router.push('/dashboard/schedules')
      } else if (results.successful.length > 0 && results.failed.length > 0) {
        // Partial success
        const failedDayNames = results.failed
          .map((f) => DAY_NAMES.find((d) => d.value === f.day)?.label)
          .join(', ')
        toast.warning(
          `Created ${results.successful.length} schedules. Failed to create schedules for: ${failedDayNames}`
        )
        // Still redirect to list page to see successful ones
        router.push('/dashboard/schedules')
      } else {
        // All failed
        toast.error('Failed to create any schedules. Please try again.')
      }
    } catch (error) {
      console.error('Failed to create schedules:', error)
      toast.error('Failed to create schedules')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/schedules')
  }

  const getUserName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  // Helper function for day selection
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
  if (!can(PERMISSIONS.SCHEDULE_CREATE) && !can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to create schedules.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <LoadPanel
        visible={loading}
        message="Loading data..."
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
          Create Employee Schedule
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create recurring schedules for multiple days at once - perfect for setting up weekly shifts
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Employee <span className="text-red-500">*</span>
            </label>
            <SelectBox
              dataSource={users}
              displayExpr={(item: User) => {
                if (!item) return ''
                const name = getUserName(item)
                return `${name} (${item.email})`
              }}
              valueExpr="id"
              value={userId}
              onValueChanged={(e) => setUserId(e.value)}
              searchEnabled={true}
              searchMode="contains"
              searchExpr={['firstName', 'lastName', 'username', 'email']}
              placeholder="Select employee"
              showClearButton={true}
              width="100%"
              stylingMode="outlined"
              itemRender={(item: User) => {
                return (
                  <div className="py-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{getUserName(item)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.email}</div>
                  </div>
                )
              }}
            >
              <Validator>
                <RequiredRule message="Employee is required" />
              </Validator>
            </SelectBox>
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            {locations.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  No locations available. Please{' '}
                  <Link
                    href="/dashboard/locations"
                    className="font-semibold underline hover:text-yellow-900 dark:hover:text-yellow-100"
                  >
                    create a location
                  </Link>{' '}
                  first before creating schedules.
                </p>
              </div>
            ) : (
              <>
                <SelectBox
                  dataSource={locations}
                  displayExpr="name"
                  valueExpr="id"
                  value={locationId}
                  onValueChanged={(e) => setLocationId(e.value)}
                  searchEnabled={!locationLocked}
                  placeholder={locationLocked ? "Loading location..." : "Select location"}
                  showClearButton={!locationLocked}
                  width="100%"
                  stylingMode="outlined"
                  readOnly={locationLocked}
                  hoverStateEnabled={!locationLocked}
                  noDataText="No locations available"
                >
                  <Validator>
                    <RequiredRule message="Location is required" />
                  </Validator>
                </SelectBox>
                {locationLocked && locationId && (
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Location automatically assigned based on employee&apos;s assignment
                  </p>
                )}
                {!locationLocked && userId && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    This employee has no location assignment. Please select a location manually.
                  </p>
                )}
              </>
            )}
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
                Inactive schedules will not be used for auto clock-in or scheduling purposes
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <DxButton
            text="Cancel"
            type="normal"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={submitting}
            width={150}
          />
          <DxButton
            text={submitting ? 'Creating...' : 'Create Schedule'}
            type="default"
            stylingMode="contained"
            onClick={handleSubmit}
            disabled={submitting || loading}
            width={150}
          />
        </div>
      </div>

      {/* Mobile-friendly info card */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Time-Saving Tip:</strong> Select multiple days to create schedules for all of them at once! For example, select Monday through Friday to create a full week schedule with the same shift times. Each selected day will create a separate schedule entry that repeats weekly.
        </p>
      </div>
    </div>
  )
}
