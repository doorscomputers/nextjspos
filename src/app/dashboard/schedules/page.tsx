"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  ColumnChooser,
  StateStoring,
  Selection,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'

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
  createdByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SchedulesPage() {
  const { can } = usePermissions()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (can(PERMISSIONS.SCHEDULE_VIEW) || can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      fetchSchedules()
    }
  }, [])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/schedules')
      if (response.ok) {
        const data = await response.json()
        setSchedules(data.schedules || [])
      } else {
        toast.error('Failed to fetch schedules')
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
      toast.error('Failed to fetch schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Schedule deleted successfully')
        fetchSchedules()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete schedule')
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      toast.error('Failed to delete schedule')
    }
  }

  const getEmployeeName = (schedule: Schedule) => {
    if (schedule.user.firstName || schedule.user.lastName) {
      return `${schedule.user.firstName || ''} ${schedule.user.lastName || ''}`.trim()
    }
    return schedule.user.username
  }

  const getDayName = (dayOfWeek: number) => {
    return DAY_NAMES[dayOfWeek] || 'Unknown'
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        Inactive
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Check permissions
  if (!can(PERMISSIONS.SCHEDULE_VIEW) && !can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view schedules.
          </p>
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
            <CalendarIcon className="w-8 h-8" />
            Employee Schedules
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage employee work schedules and shifts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSchedules}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </Button>
          {(can(PERMISSIONS.SCHEDULE_CREATE) || can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) && (
            <Link href="/dashboard/schedules/create">
              <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <PlusIcon className="w-4 h-4" />
                New Schedule
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <DataGrid
          dataSource={schedules}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          className="dark:bg-gray-800"
        >
          <StateStoring enabled={true} type="localStorage" storageKey="schedules-grid-state" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search schedules..." />
          <ColumnChooser enabled={true} mode="select" />
          <Export enabled={true} allowExportSelectedData={true} />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Paging enabled={true} defaultPageSize={20} />

          <Column
            dataField="id"
            caption="ID"
            width={80}
            alignment="center"
          />

          <Column
            caption="Employee"
            calculateCellValue={(data: Schedule) => getEmployeeName(data)}
            cellRender={(data) => (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {getEmployeeName(data.data)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {data.data.user.email}
                </div>
              </div>
            )}
          />

          <Column
            dataField="location.name"
            caption="Location"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100">
                {data.data.location.name}
              </span>
            )}
          />

          <Column
            dataField="dayOfWeek"
            caption="Day"
            width={120}
            calculateCellValue={(data: Schedule) => getDayName(data.dayOfWeek)}
            cellRender={(data) => (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {getDayName(data.data.dayOfWeek)}
              </span>
            )}
          />

          <Column
            caption="Shift Time"
            width={160}
            calculateCellValue={(data: Schedule) =>
              `${formatTime(data.startTime)} - ${formatTime(data.endTime)}`
            }
            cellRender={(data) => (
              <div className="text-sm">
                <div className="text-gray-900 dark:text-gray-100">
                  {formatTime(data.data.startTime)} - {formatTime(data.data.endTime)}
                </div>
              </div>
            )}
          />

          <Column
            dataField="effectiveFrom"
            caption="Start Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
          />

          <Column
            dataField="effectiveTo"
            caption="End Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100">
                {data.data.effectiveTo ? formatDate(data.data.effectiveTo) : 'Ongoing'}
              </span>
            )}
          />

          <Column
            dataField="isActive"
            caption="Status"
            width={100}
            alignment="center"
            cellRender={(data) => getStatusBadge(data.data.isActive)}
          />

          <Column
            caption="Actions"
            width={150}
            alignment="center"
            cellRender={(data) => (
              <div className="flex items-center justify-center gap-2">
                <Link href={`/dashboard/schedules/${data.data.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                  >
                    View
                  </Button>
                </Link>
                {(can(PERMISSIONS.SCHEDULE_DELETE) || can(PERMISSIONS.SCHEDULE_MANAGE_ALL)) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => handleDelete(data.data.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>
        </DataGrid>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Schedules</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {schedules.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Schedules</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {schedules.filter(s => s.isActive).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Inactive Schedules</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {schedules.filter(s => !s.isActive).length}
          </div>
        </div>
      </div>
    </div>
  )
}
