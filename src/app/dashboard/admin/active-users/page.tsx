"use client"

import { useState, useEffect, useCallback } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { useRouter } from "next/navigation"
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  HeaderFilter,
  GroupPanel,
  Grouping,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { Button } from "devextreme-react/button"
import { AlertCircle, RefreshCw, Users, MapPin, User, UserCheck, Clock, AlertTriangle } from "lucide-react"
import { Workbook } from "exceljs"
import { saveAs } from "file-saver-es"
import { exportDataGrid } from "devextreme/excel_exporter"

interface OpenShift {
  id: number
  shiftNumber: string
  openedAt: string
  beginningCash: string
  durationHours: number
  durationMinutes: number
  locationId: number
  locationName: string
  locationCode: string | null
  runningTransactions: number
  runningGrossSales: string
  isLongRunning: boolean
}

interface ActiveUser {
  id: number
  username: string
  fullName: string
  surname: string
  roles: string[]
  isCashier: boolean
  lastSeenAt: string
  email: string | null
  locationName?: string
  locationId?: number
  ipAddress?: string | null
  deviceType?: string | null
  browser?: string | null
  currentUrl?: string | null
  openShift?: OpenShift | null // ✅ NEW
}

interface LocationData {
  locationId: number
  locationName: string
  locationCode: string | null
  isActive: boolean
  totalUsers: number
  totalCashiers: number
  users: ActiveUser[]
  cashiers: ActiveUser[]
}

interface ActiveUsersResponse {
  locations: LocationData[]
  unassignedUsers: ActiveUser[]
  summary: {
    totalActiveUsers: number
    totalLocations: number
    totalUnassignedUsers: number
    totalCashiers: number // ✅ NEW
    totalOpenShifts: number // ✅ NEW
    totalLongRunningShifts: number // ✅ NEW
  }
}

export default function ActiveUsersPage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [data, setData] = useState<ActiveUsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [timeWindow, setTimeWindow] = useState(5) // Minutes - default 5 minutes

  // Permission check
  useEffect(() => {
    if (!can(PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS)) {
      router.push("/dashboard")
    }
  }, [can, router])

  // Fetch active users
  const fetchActiveUsers = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/active-users-v2?minutesAgo=${timeWindow}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch active users")
      }

      const responseData = await response.json()
      setData(responseData)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("Error fetching active users:", err)
    } finally {
      setLoading(false)
    }
  }, [timeWindow])

  // Initial fetch
  useEffect(() => {
    fetchActiveUsers()
  }, [fetchActiveUsers])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchActiveUsers()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, fetchActiveUsers])

  // Flatten data for DataGrid
  const flattenedUsers = data
    ? [
        ...data.locations.flatMap((location) =>
          location.users.map((user) => ({
            ...user,
            locationName: location.locationName,
            locationId: location.locationId,
            locationCode: location.locationCode,
            isActive: location.isActive,
          }))
        ),
        ...data.unassignedUsers.map((user) => ({
          ...user,
          locationName: "Unassigned",
          locationId: 0,
          locationCode: null,
          isActive: false,
        })),
      ]
    : []

  // Export to Excel
  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Active Users")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `active-users-${new Date().toISOString().split("T")[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  // Cell render for cashier highlighting
  const renderRolesCell = (cellData: any) => {
    const roles = cellData.data.roles
    const isCashier = cellData.data.isCashier

    if (isCashier) {
      return (
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-300">
              {roles.join(", ")}
            </div>
            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md font-semibold">
              CASHIER
            </span>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span>{roles.join(", ")}</span>
      </div>
    )
  }

  // Cell render for location
  const renderLocationCell = (cellData: any) => {
    const locationName = cellData.data.locationName
    const isUnassigned = cellData.data.locationId === 0

    if (isUnassigned) {
      return (
        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold">{locationName}</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <MapPin className="w-4 h-4" />
        <span>{locationName}</span>
      </div>
    )
  }

  // Row styling for cashiers
  const rowPrepared = (e: any) => {
    if (e.rowType === "data" && e.data.isCashier) {
      e.rowElement.style.backgroundColor = "rgba(34, 197, 94, 0.05)"
      e.rowElement.style.borderLeft = "3px solid rgb(34, 197, 94)"
    }
  }

  if (!can(PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS)) {
    return null
  }

  const totalCashiers = flattenedUsers.filter((u) => u.isCashier).length
  const totalUsers = flattenedUsers.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Active Users Monitor
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring of active users by location and activity time
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            icon="refresh"
            text="Refresh"
            onClick={fetchActiveUsers}
            disabled={loading}
            type="default"
          />
          <Button
            icon={autoRefresh ? "clock" : "clock"}
            text={autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            type={autoRefresh ? "success" : "normal"}
          />
        </div>
      </div>

      {/* Time Window Filter */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Activity Time Window
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Show users active within the selected time period
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              text="Last 5 min"
              onClick={() => setTimeWindow(5)}
              type={timeWindow === 5 ? "default" : "normal"}
            />
            <Button
              text="Last 15 min"
              onClick={() => setTimeWindow(15)}
              type={timeWindow === 15 ? "default" : "normal"}
            />
            <Button
              text="Last 30 min"
              onClick={() => setTimeWindow(30)}
              type={timeWindow === 30 ? "default" : "normal"}
            />
            <Button
              text="Last 1 hour"
              onClick={() => setTimeWindow(60)}
              type={timeWindow === 60 ? "default" : "normal"}
            />
            <Button
              text="Last 4 hours"
              onClick={() => setTimeWindow(240)}
              type={timeWindow === 240 ? "default" : "normal"}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Active Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Cashiers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCashiers}</p>
            </div>
          </div>
        </div>

        <div className="bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Open Shifts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.totalOpenShifts || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Long Shifts (&gt;12h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.totalLongRunningShifts || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Locations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.totalLocations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unassigned Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.totalUnassignedUsers || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Open Shifts Section - CRITICAL FOR MONITORING */}
      {data && flattenedUsers.filter(u => u.openShift).length > 0 && (
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-2 border-cyan-300 dark:border-cyan-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Cashiers with Open Shifts
            </h2>
            <span className="px-3 py-1 bg-cyan-600 text-white rounded-full text-sm font-semibold">
              {flattenedUsers.filter(u => u.openShift).length} Active
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Monitor open shifts to prevent closing reading problems. Shifts open &gt; 12 hours are highlighted in red.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {flattenedUsers
              .filter(u => u.openShift)
              .map((user) => {
                const shift = user.openShift!
                const isLongRunning = shift.isLongRunning
                const shiftDate = new Date(shift.openedAt)

                return (
                  <div
                    key={user.id}
                    className={`rounded-lg p-4 border-2 ${
                      isLongRunning
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Header with warning if long-running */}
                    {isLongRunning && (
                      <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-400 font-semibold">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm">SHIFT OPEN &gt; 12 HOURS!</span>
                      </div>
                    )}

                    {/* Cashier Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-lg text-gray-900 dark:text-white">
                          {user.fullName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          @{user.username}
                        </p>
                      </div>
                      <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {shift.locationName}
                        {shift.locationCode && ` (${shift.locationCode})`}
                      </span>
                    </div>

                    {/* Shift Details */}
                    <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Shift Number:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {shift.shiftNumber}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Opened:</span>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {shiftDate.toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {shiftDate.toLocaleTimeString('en-PH', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                        <span className={`font-bold ${
                          isLongRunning
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {shift.durationHours}h {shift.durationMinutes}m
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Beginning Cash:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ₱{parseFloat(shift.beginningCash).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {shift.runningTransactions}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Gross Sales:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          ₱{parseFloat(shift.runningGrossSales).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Location-wise breakdown (Collapsible cards) */}
      {data && data.locations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.locations.map((location) => (
            <div
              key={location.locationId}
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {location.locationName}
                  </h3>
                </div>
                {location.locationCode && (
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md">
                    {location.locationCode}
                  </span>
                )}
              </div>

              <div className="flex gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {location.totalUsers} users
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400">
                    {location.totalCashiers} cashiers
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {location.users.map((user) => (
                  <div
                    key={user.id}
                    className={`p-2 rounded-md border ${
                      user.isCashier
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          @{user.username}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {user.roles.map((role, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-2 py-0.5 rounded-md ${
                                user.isCashier
                                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-semibold"
                                  : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DataGrid - Detailed View */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detailed User List
        </h3>
        <DataGrid
          dataSource={flattenedUsers}
          showBorders={true}
          columnAutoWidth={true}
          wordWrapEnabled={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          onRowPrepared={rowPrepared}
          onExporting={onExporting}
        >
          <GroupPanel visible={true} />
          <Grouping autoExpandAll={false} />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search users..." />
          <Export enabled={true} allowExportSelectedData={false} />

          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo={true}
          />

          <Column
            dataField="locationName"
            caption="Location"
            cellRender={renderLocationCell}
            groupIndex={0}
            width={250}
          />

          <Column dataField="username" caption="Username" width={150} />

          <Column dataField="fullName" caption="Full Name" width={200} />

          <Column dataField="surname" caption="Surname" width={150} />

          <Column
            dataField="roles"
            caption="Role(s)"
            cellRender={renderRolesCell}
            width={250}
            calculateCellValue={(rowData) => rowData.roles.join(", ")}
          />

          <Column
            dataField="isCashier"
            caption="Cashier"
            width={100}
            dataType="boolean"
            trueText="Yes"
            falseText="No"
          />

          <Column dataField="email" caption="Email" width={200} />

          <Column
            dataField="lastSeenAt"
            caption="Last Seen"
            dataType="datetime"
            format="MMM dd, yyyy hh:mm a"
            width={180}
          />

          <Column dataField="deviceType" caption="Device" width={100} />

          <Column dataField="browser" caption="Browser" width={100} />

          <Column dataField="ipAddress" caption="IP Address" width={140} />

          <Column
            caption="Shift Number"
            width={150}
            calculateCellValue={(rowData) => rowData.openShift?.shiftNumber || 'N/A'}
            cellRender={(cellData) => {
              if (!cellData.data.openShift) {
                return <span className="text-gray-400">-</span>
              }
              return (
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                  {cellData.data.openShift.shiftNumber}
                </span>
              )
            }}
          />

          <Column
            caption="Shift Opened"
            width={180}
            dataType="datetime"
            format="MMM dd, yyyy hh:mm a"
            calculateCellValue={(rowData) => rowData.openShift?.openedAt || null}
            cellRender={(cellData) => {
              if (!cellData.data.openShift) {
                return <span className="text-gray-400">-</span>
              }
              const openedAt = new Date(cellData.data.openShift.openedAt)
              return (
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {openedAt.toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {openedAt.toLocaleTimeString('en-PH', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )
            }}
          />

          <Column
            caption="Shift Duration"
            width={120}
            calculateCellValue={(rowData) => {
              if (!rowData.openShift) return null
              return `${rowData.openShift.durationHours}h ${rowData.openShift.durationMinutes}m`
            }}
            cellRender={(cellData) => {
              if (!cellData.data.openShift) {
                return <span className="text-gray-400">-</span>
              }
              const isLongRunning = cellData.data.openShift.isLongRunning
              return (
                <span className={`font-bold ${
                  isLongRunning
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {cellData.value}
                  {isLongRunning && ' ⚠️'}
                </span>
              )
            }}
          />

          <Column dataField="currentUrl" caption="Current Page" width={250} />

          <Toolbar>
            <Item name="groupPanel" />
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item location="after">
              <Button icon="refresh" onClick={fetchActiveUsers} hint="Refresh data" />
            </Item>
          </Toolbar>
        </DataGrid>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900 border-2 border-green-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Sale Cashier / Cashier roles (highlighted in green)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 dark:bg-orange-900 border-2 border-orange-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Unassigned users (not assigned to any location)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-700 dark:text-gray-300">
              Auto-refresh enabled: Updates every 60 seconds
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              Sessions shown are active (not expired)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
