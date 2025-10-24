"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ChartBarIcon, ArrowPathIcon, CalendarIcon } from '@heroicons/react/24/outline'
import DataGrid, {
  Column,
  Summary,
  TotalItem,
  Paging,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  ColumnChooser,
  StateStoring,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'
import PieChart, {
  Series,
  Label,
  Connector,
  Size,
  Legend,
} from 'devextreme-react/pie-chart'

interface AttendanceRecord {
  id: number
  userId: number
  clockInTime: string
  clockOutTime: string | null
  totalHoursWorked: string | null
  status: string
  user: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  }
  location: {
    id: number
    name: string
  }
}

interface AttendanceSummary {
  totalEmployees: number
  presentToday: number
  lateToday: number
  earlyDepartures: number
  currentlyWorking: number
  averageHoursWorked: number
  totalHoursWorked: number
}

export default function AttendanceReportPage() {
  const { can } = usePermissions()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    earlyDepartures: 0,
    currentlyWorking: 0,
    averageHoursWorked: 0,
    totalHoursWorked: 0
  })

  useEffect(() => {
    if (can(PERMISSIONS.ATTENDANCE_REPORT) || can(PERMISSIONS.ATTENDANCE_VIEW) || can(PERMISSIONS.ATTENDANCE_MANAGE)) {
      fetchAttendanceReport()
    }
  }, [dateRange])

  const fetchAttendanceReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/attendance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      )
      if (response.ok) {
        const data = await response.json()
        const records = data.attendanceRecords || []
        setAttendanceRecords(records)
        calculateSummary(records)
      } else {
        toast.error('Failed to fetch attendance report')
      }
    } catch (error) {
      console.error('Failed to fetch attendance report:', error)
      toast.error('Failed to fetch attendance report')
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (records: AttendanceRecord[]) => {
    const uniqueEmployees = new Set(records.map(r => r.userId)).size
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length
    const late = records.filter(r => r.status === 'late').length
    const earlyDepartures = records.filter(r => r.status === 'early_departure').length
    const currentlyWorking = records.filter(r => !r.clockOutTime).length

    const totalHours = records.reduce((sum, r) => {
      if (r.totalHoursWorked) {
        return sum + parseFloat(r.totalHoursWorked)
      }
      return sum
    }, 0)

    const avgHours = records.length > 0 ? totalHours / records.length : 0

    setSummary({
      totalEmployees: uniqueEmployees,
      presentToday: present,
      lateToday: late,
      earlyDepartures,
      currentlyWorking,
      averageHoursWorked: avgHours,
      totalHoursWorked: totalHours
    })
  }

  const getEmployeeName = (record: AttendanceRecord) => {
    if (record.user.firstName || record.user.lastName) {
      return `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim()
    }
    return record.user.username
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 'In Progress'
    const duration = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
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

  // Prepare chart data
  const statusChartData = [
    { status: 'Present', count: summary.presentToday },
    { status: 'Late', count: summary.lateToday },
    { status: 'Early Departure', count: summary.earlyDepartures },
  ].filter(item => item.count > 0)

  // Check permissions
  if (!can(PERMISSIONS.ATTENDANCE_REPORT) && !can(PERMISSIONS.ATTENDANCE_VIEW) && !can(PERMISSIONS.ATTENDANCE_MANAGE)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view attendance reports.
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
            <ChartBarIcon className="w-8 h-8" />
            Attendance Report
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Employee attendance analytics and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchAttendanceReport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                setDateRange({ startDate: today, endDate: today })
              }}
              variant="outline"
              size="sm"
            >
              Today
            </Button>
            <Button
              onClick={() => {
                const today = new Date()
                const weekAgo = new Date(today)
                weekAgo.setDate(today.getDate() - 7)
                setDateRange({
                  startDate: weekAgo.toISOString().split('T')[0],
                  endDate: today.toISOString().split('T')[0]
                })
              }}
              variant="outline"
              size="sm"
            >
              Last 7 Days
            </Button>
            <Button
              onClick={() => {
                const today = new Date()
                const monthAgo = new Date(today)
                monthAgo.setDate(today.getDate() - 30)
                setDateRange({
                  startDate: monthAgo.toISOString().split('T')[0],
                  endDate: today.toISOString().split('T')[0]
                })
              }}
              variant="outline"
              size="sm"
            >
              Last 30 Days
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Employees</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.totalEmployees}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Present</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.presentToday}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Late Arrivals</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.lateToday}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Currently Working</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.currentlyWorking}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        {statusChartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Attendance Status Distribution
            </h3>
            <PieChart
              dataSource={statusChartData}
              palette="Soft Pastel"
            >
              <Series
                argumentField="status"
                valueField="count"
              >
                <Label visible={true} format="fixedPoint">
                  <Connector visible={true} width={1} />
                </Label>
              </Series>
              <Size height={300} />
              <Legend
                orientation="horizontal"
                itemTextPosition="right"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
            </PieChart>
          </div>
        )}

        {/* Hours Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Work Hours Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Total Hours Worked</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalHoursWorked.toFixed(2)} hrs
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Average Hours/Employee</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.averageHoursWorked.toFixed(2)} hrs
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Early Departures</span>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {summary.earlyDepartures}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Data Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Detailed Attendance Records
          </h3>
        </div>
        <DataGrid
          dataSource={attendanceRecords}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnAutoWidth={true}
          className="dark:bg-gray-800"
        >
          <StateStoring enabled={true} type="localStorage" storageKey="attendance-report-grid" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} />
          <ColumnChooser enabled={true} mode="select" />
          <Export enabled={true} fileName="Attendance_Report" />
          <Paging enabled={true} defaultPageSize={20} />

          <Column
            caption="Employee"
            calculateCellValue={(data: AttendanceRecord) => getEmployeeName(data)}
            cellRender={(data) => (
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {getEmployeeName(data.data)}
              </div>
            )}
          />

          <Column
            dataField="location.name"
            caption="Location"
          />

          <Column
            dataField="clockInTime"
            caption="Clock In"
            dataType="datetime"
            format="MMM dd, hh:mm a"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100 text-sm">
                {formatDateTime(data.data.clockInTime)}
              </span>
            )}
          />

          <Column
            dataField="clockOutTime"
            caption="Clock Out"
            dataType="datetime"
            format="MMM dd, hh:mm a"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100 text-sm">
                {data.data.clockOutTime ? formatDateTime(data.data.clockOutTime) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    Active
                  </span>
                )}
              </span>
            )}
          />

          <Column
            caption="Duration"
            calculateCellValue={(data: AttendanceRecord) =>
              data.totalHoursWorked ? parseFloat(data.totalHoursWorked).toFixed(2) : null
            }
            cellRender={(data) => (
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {data.data.totalHoursWorked
                  ? `${parseFloat(data.data.totalHoursWorked).toFixed(2)} hrs`
                  : calculateDuration(data.data.clockInTime, data.data.clockOutTime)}
              </span>
            )}
          />

          <Column
            dataField="status"
            caption="Status"
            cellRender={(data) => getStatusBadge(data.data.status)}
          />

          <Summary>
            <TotalItem
              column="Employee"
              summaryType="count"
              customizeText={(data) => `Total Records: ${data.value}`}
            />
            <TotalItem
              column="Duration"
              summaryType="sum"
              valueFormat="fixedPoint"
              customizeText={(data) => `Total: ${data.value?.toFixed(2) || 0} hrs`}
            />
          </Summary>

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>
        </DataGrid>
      </div>
    </div>
  )
}
