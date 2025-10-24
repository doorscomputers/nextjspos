"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline'
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
  LoadPanel,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import { Button as DxButton } from 'devextreme-react/button'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import 'devextreme/dist/css/dx.light.css'

interface AttendanceRecord {
  id: number
  userId: number
  locationId: number
  date: string
  clockIn: string | null
  clockOut: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
  status: string
  notes: string | null
  switchedToLocationId: number | null
  switchTime: string | null
  switchReason: string | null
  xReadingPrinted: boolean
  cashCountSubmitted: boolean
  totalHoursWorked: string | null
  scheduledHours: string | null
  overtimeHours: string | null
  isOvertime: boolean
  overtimeApproved: boolean | null
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
  switchedToLocation?: {
    id: number
    name: string
  } | null
  switchApprover?: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
  locationChangeRequests?: Array<{
    id: number
    fromLocationId: number
    toLocationId: number
    requestedAt: string
    status: string
    fromLocation: {
      id: number
      name: string
    }
    toLocation: {
      id: number
      name: string
    }
  }>
}

interface Employee {
  id: number
  name: string
}

interface Location {
  id: number
  name: string
}

interface StatusOption {
  value: string
  label: string
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'on_time', label: 'On Time' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'early', label: 'Early Departure' },
  { value: 'emergency_change', label: 'Emergency Change' },
  { value: 'location_switch', label: 'Location Switch' },
]

export default function AttendancePage() {
  const { can } = usePermissions()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  useEffect(() => {
    if (can(PERMISSIONS.ATTENDANCE_VIEW) || can(PERMISSIONS.ATTENDANCE_MANAGE)) {
      fetchAttendance()
      fetchEmployees()
      fetchLocations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAttendance = async () => {
    try {
      setLoading(true)

      // Build query params
      const params = new URLSearchParams()
      if (selectedEmployee) params.append('userId', selectedEmployee.toString())
      if (selectedLocation) params.append('locationId', selectedLocation.toString())
      if (selectedStatus) params.append('status', selectedStatus)
      if (startDate) params.append('startDate', startDate.toISOString())
      if (endDate) params.append('endDate', endDate.toISOString())

      const response = await fetch(`/api/attendance?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAttendanceRecords(data.attendanceRecords || [])
        toast.success('Attendance records loaded')
      } else {
        toast.error('Failed to fetch attendance records')
      }
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
      toast.error('Failed to fetch attendance records')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        const employeeList = data.users?.map((user: any) => ({
          id: user.id,
          name: user.firstName || user.lastName
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
            : user.username
        })) || []
        setEmployees(employeeList)
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/business-locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
    }
  }

  const getEmployeeName = (record: AttendanceRecord) => {
    if (record.user.firstName || record.user.lastName) {
      return `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim()
    }
    return record.user.username
  }

  const getStatusBadgeColor = (status: string): string => {
    const configs: Record<string, string> = {
      'on_time': '#10b981', // green
      'late': '#f59e0b', // yellow
      'absent': '#ef4444', // red
      'early': '#f97316', // orange
      'emergency_change': '#3b82f6', // blue
      'location_switch': '#8b5cf6', // purple
    }
    return configs[status] || '#6b7280' // gray default
  }

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'on_time': 'On Time',
      'late': 'Late',
      'absent': 'Absent',
      'early': 'Early Departure',
      'emergency_change': 'Emergency Change',
      'location_switch': 'Location Switch',
    }
    return labels[status] || status
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A'
    return timeString
  }

  const calculateHoursWorked = (record: AttendanceRecord): string => {
    if (record.totalHoursWorked) {
      return `${parseFloat(record.totalHoursWorked).toFixed(2)} hrs`
    }
    if (!record.clockIn) return 'N/A'
    if (!record.clockOut) return 'In Progress'

    const hours = (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / (1000 * 60 * 60)
    return `${hours.toFixed(2)} hrs`
  }

  const handleClearFilters = () => {
    setSelectedEmployee(null)
    setSelectedLocation(null)
    setSelectedStatus('')
    setStartDate(null)
    setEndDate(null)
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Attendance Records')

    // Add header
    worksheet.mergeCells('A1:I1')
    const titleRow = worksheet.getCell('A1')
    titleRow.value = 'Attendance Records Report'
    titleRow.font = { size: 16, bold: true }
    titleRow.alignment = { horizontal: 'center' }

    // Add export date
    worksheet.mergeCells('A2:I2')
    const dateRow = worksheet.getCell('A2')
    dateRow.value = `Generated: ${new Date().toLocaleString()}`
    dateRow.font = { size: 10 }
    dateRow.alignment = { horizontal: 'center' }

    exportToExcel({
      component: e.component,
      worksheet,
      topLeftCell: { row: 4, column: 1 },
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          // Format numbers
          if (gridCell.column.dataField === 'totalHoursWorked') {
            excelCell.numFmt = '0.00'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `attendance_records_${new Date().toISOString().split('T')[0]}.xlsx`
        )
        toast.success('Excel exported successfully')
      })
    })
  }

  // Check permissions
  if (!can(PERMISSIONS.ATTENDANCE_VIEW) && !can(PERMISSIONS.ATTENDANCE_MANAGE) && !can(PERMISSIONS.ATTENDANCE_VIEW_OWN)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view attendance records.
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
            <ClockIcon className="w-8 h-8" />
            Attendance Records
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track employee clock in/out and work hours
          </p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Employee
            </label>
            <SelectBox
              dataSource={employees}
              displayExpr="name"
              valueExpr="id"
              value={selectedEmployee}
              onValueChanged={(e) => setSelectedEmployee(e.value)}
              placeholder="All Employees"
              searchEnabled={true}
              showClearButton={true}
              stylingMode="outlined"
            />
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <SelectBox
              dataSource={locations}
              displayExpr="name"
              valueExpr="id"
              value={selectedLocation}
              onValueChanged={(e) => setSelectedLocation(e.value)}
              placeholder="All Locations"
              searchEnabled={true}
              showClearButton={true}
              stylingMode="outlined"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <SelectBox
              dataSource={STATUS_OPTIONS}
              displayExpr="label"
              valueExpr="value"
              value={selectedStatus}
              onValueChanged={(e) => setSelectedStatus(e.value)}
              placeholder="All Statuses"
              showClearButton={true}
              stylingMode="outlined"
            />
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <DateBox
              value={startDate}
              onValueChanged={(e) => setStartDate(e.value)}
              placeholder="From date"
              type="date"
              displayFormat="MMM dd, yyyy"
              showClearButton={true}
              stylingMode="outlined"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <DateBox
              value={endDate}
              onValueChanged={(e) => setEndDate(e.value)}
              placeholder="To date"
              type="date"
              displayFormat="MMM dd, yyyy"
              showClearButton={true}
              stylingMode="outlined"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <DxButton
              text="Apply"
              icon="search"
              type="default"
              stylingMode="contained"
              onClick={fetchAttendance}
            />
            <DxButton
              text="Clear"
              icon="clearformat"
              stylingMode="outlined"
              onClick={handleClearFilters}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Records</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {attendanceRecords.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Currently Clocked In</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {attendanceRecords.filter(r => r.clockIn && !r.clockOut).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Late Today</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {attendanceRecords.filter(r => r.status === 'late').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Overtime Records</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {attendanceRecords.filter(r => r.isOvertime).length}
          </div>
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
          columnAutoWidth={false}
          wordWrapEnabled={false}
          onExporting={onExporting}
        >
          <LoadPanel enabled={true} />
          <StateStoring enabled={true} type="localStorage" storageKey="attendance-grid-state" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search attendance..." />
          <ColumnChooser enabled={true} mode="select" />
          <Export enabled={true} allowExportSelectedData={true} />
          <Selection mode="multiple" showCheckBoxesMode="onClick" />
          <Paging enabled={true} defaultPageSize={20} />
          <Grouping contextMenuEnabled={true} />
          <GroupPanel visible={true} />

          <Column
            dataField="id"
            caption="ID"
            width={80}
            alignment="center"
            allowFiltering={false}
          />

          <Column
            caption="Employee"
            calculateCellValue={getEmployeeName}
            cellRender={(cellData) => (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {getEmployeeName(cellData.data)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {cellData.data.user.email}
                </div>
              </div>
            )}
            minWidth={200}
          />

          <Column
            dataField="location.name"
            caption="Location"
            cellRender={(cellData) => (
              <div>
                <span className="text-gray-900 dark:text-gray-100">
                  {cellData.data.location.name}
                </span>
                {cellData.data.switchedToLocation && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Switched to: {cellData.data.switchedToLocation.name}
                  </div>
                )}
                {cellData.data.locationChangeRequests && cellData.data.locationChangeRequests.length > 0 && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {cellData.data.locationChangeRequests.length} location change request(s)
                  </div>
                )}
              </div>
            )}
            minWidth={180}
          />

          <Column
            dataField="date"
            caption="Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
          />

          <Column
            dataField="clockIn"
            caption="Clock In"
            dataType="datetime"
            format="hh:mm a"
            width={100}
            cellRender={(cellData) => (
              <span className="text-gray-900 dark:text-gray-100">
                {cellData.data.clockIn ? new Date(cellData.data.clockIn).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'N/A'}
              </span>
            )}
          />

          <Column
            dataField="clockOut"
            caption="Clock Out"
            dataType="datetime"
            format="hh:mm a"
            width={100}
            cellRender={(cellData) => (
              <span className="text-gray-900 dark:text-gray-100">
                {cellData.data.clockOut ? new Date(cellData.data.clockOut).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) : (
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    Active
                  </span>
                )}
              </span>
            )}
          />

          <Column
            dataField="scheduledStart"
            caption="Scheduled Start"
            width={120}
            cellRender={(cellData) => (
              <span className="text-gray-700 dark:text-gray-300">
                {formatTime(cellData.data.scheduledStart)}
              </span>
            )}
          />

          <Column
            dataField="scheduledEnd"
            caption="Scheduled End"
            width={120}
            cellRender={(cellData) => (
              <span className="text-gray-700 dark:text-gray-300">
                {formatTime(cellData.data.scheduledEnd)}
              </span>
            )}
          />

          <Column
            caption="Hours Worked"
            width={120}
            alignment="right"
            calculateCellValue={(data: AttendanceRecord) =>
              data.totalHoursWorked ? parseFloat(data.totalHoursWorked) : null
            }
            cellRender={(cellData) => {
              const hours = calculateHoursWorked(cellData.data)
              const isOvertime = cellData.data.isOvertime
              return (
                <div className="flex items-center justify-end gap-2">
                  <span className={`font-medium ${isOvertime ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {hours}
                  </span>
                  {isOvertime && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                      OT
                    </span>
                  )}
                </div>
              )
            }}
          />

          <Column
            dataField="status"
            caption="Status"
            width={140}
            alignment="center"
            cellRender={(cellData) => {
              const status = cellData.data.status
              const color = getStatusBadgeColor(status)
              const label = getStatusLabel(status)
              return (
                <span
                  className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color
                  }}
                >
                  {label}
                </span>
              )
            }}
          />

          <Column
            caption="Actions"
            width={100}
            alignment="center"
            cellRender={(cellData) => (
              <div className="flex items-center justify-center gap-2">
                <Link href={`/dashboard/attendance/${cellData.data.id}`}>
                  <DxButton
                    text="View"
                    type="default"
                    stylingMode="outlined"
                    height={32}
                  />
                </Link>
              </div>
            )}
            allowExporting={false}
          />

          <Summary>
            <TotalItem
              column="id"
              summaryType="count"
              displayFormat="Total Records: {0}"
            />
            <TotalItem
              column="totalHoursWorked"
              summaryType="sum"
              displayFormat="Total Hours: {0}"
              valueFormat="#,##0.00"
            />
          </Summary>

          <Toolbar>
            <Item location="before">
              <div className="flex items-center gap-2">
                <DxButton
                  icon="refresh"
                  text="Refresh"
                  onClick={fetchAttendance}
                  stylingMode="text"
                />
              </div>
            </Item>
            <Item name="groupPanel" />
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>
        </DataGrid>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Tips:</strong> Use the filters above to narrow down records. Click column headers to sort,
          right-click headers for additional options. Export to Excel for detailed reporting.
          The grid state (column order, filters) is automatically saved.
        </p>
      </div>
    </div>
  )
}
