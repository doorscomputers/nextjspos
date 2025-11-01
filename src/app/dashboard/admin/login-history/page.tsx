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
  Selection,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { Button } from "devextreme-react/button"
import { SelectBox } from "devextreme-react/select-box"
import { DateBox } from "devextreme-react/date-box"
import { AlertCircle, RefreshCw, Download, Users, MapPin } from "lucide-react"
import { Workbook } from "exceljs"
import { saveAs } from "file-saver-es"
import { exportDataGrid } from "devextreme/excel_exporter"

interface LoginLog {
  id: number
  userId: number
  username: string
  fullName: string
  roles: string
  selectedLocation: string
  assignedLocations: string[]
  isMismatch: boolean
  timestamp: string
  ipAddress: string
  description: string
}

interface FilterData {
  users: Array<{ id: number; username: string; firstName: string; lastName: string }>
  locations: Array<{ id: number; name: string }>
}

export default function LoginHistoryPage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [logs, setLogs] = useState<LoginLog[]>([])
  const [filterData, setFilterData] = useState<FilterData>({ users: [], locations: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filters
  const [selectedUserId, setSelectedUserId] = useState<number | "all">("all")
  const [selectedLocationId, setSelectedLocationId] = useState<number | "all">("all")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [days, setDays] = useState(30)

  // Permission check
  useEffect(() => {
    if (!can(PERMISSIONS.AUDIT_LOG_VIEW)) {
      router.push("/dashboard")
    }
  }, [can, router])

  // Fetch login history
  const fetchLoginHistory = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams()

      if (selectedUserId !== "all") {
        params.append("userId", selectedUserId.toString())
      }

      if (selectedLocationId !== "all") {
        params.append("locationId", selectedLocationId.toString())
      }

      if (startDate && endDate) {
        params.append("startDate", startDate.toISOString())
        params.append("endDate", endDate.toISOString())
      } else {
        params.append("days", days.toString())
      }

      const response = await fetch(`/api/admin/login-history?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch login history")
      }

      const data = await response.json()
      setLogs(data.logs || [])
      setFilterData({ users: data.users || [], locations: data.locations || [] })
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("Error fetching login history:", err)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, selectedLocationId, startDate, endDate, days])

  // Initial fetch
  useEffect(() => {
    fetchLoginHistory()
  }, [fetchLoginHistory])

  // Cell render for location mismatch highlighting
  const renderLocationCell = (cellData: any) => {
    const isMismatch = cellData.data.isMismatch
    const selectedLocation = cellData.data.selectedLocation
    const assignedLocations = cellData.data.assignedLocations

    if (isMismatch) {
      return (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
          <AlertCircle className="w-4 h-4" />
          <div>
            <div>{selectedLocation}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Expected: {assignedLocations.join(", ")}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <MapPin className="w-4 h-4" />
        {selectedLocation}
      </div>
    )
  }

  // Row styling for mismatches
  const rowPrepared = (e: any) => {
    if (e.rowType === "data" && e.data.isMismatch) {
      e.rowElement.style.backgroundColor = "rgba(239, 68, 68, 0.1)"
    }
  }

  // Export to Excel
  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Login History")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: "application/octet-stream" }), "login-history.xlsx")
      })
    })
    e.cancel = true
  }

  // Quick date filters
  const setQuickDateFilter = (daysAgo: number) => {
    setDays(daysAgo)
    setStartDate(null)
    setEndDate(null)
  }

  if (!can(PERMISSIONS.AUDIT_LOG_VIEW)) {
    return null
  }

  const mismatchCount = logs.filter((log) => log.isMismatch).length
  const totalLogins = logs.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Login History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor user login activity and detect location mismatches
          </p>
        </div>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={fetchLoginHistory}
          disabled={loading}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Logins</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Valid Logins</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalLogins - mismatchCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Location Mismatches</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{mismatchCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User
            </label>
            <SelectBox
              dataSource={[
                { id: "all", name: "All Users" },
                ...filterData.users.map((u) => ({
                  id: u.id,
                  name: `${u.firstName} ${u.lastName} (${u.username})`.trim(),
                })),
              ]}
              displayExpr="name"
              valueExpr="id"
              value={selectedUserId}
              onValueChanged={(e) => setSelectedUserId(e.value)}
              searchEnabled={true}
            />
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <SelectBox
              dataSource={[
                { id: "all", name: "All Locations" },
                ...filterData.locations.map((l) => ({ id: l.id, name: l.name })),
              ]}
              displayExpr="name"
              valueExpr="id"
              value={selectedLocationId}
              onValueChanged={(e) => setSelectedLocationId(e.value)}
              searchEnabled={true}
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <DateBox
              value={startDate}
              onValueChanged={(e) => setStartDate(e.value)}
              type="date"
              displayFormat="MMM dd, yyyy"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <DateBox
              value={endDate}
              onValueChanged={(e) => setEndDate(e.value)}
              type="date"
              displayFormat="MMM dd, yyyy"
            />
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button
            text="Last 7 Days"
            onClick={() => setQuickDateFilter(7)}
            type={days === 7 && !startDate ? "default" : "normal"}
          />
          <Button
            text="Last 30 Days"
            onClick={() => setQuickDateFilter(30)}
            type={days === 30 && !startDate ? "default" : "normal"}
          />
          <Button
            text="Last 90 Days"
            onClick={() => setQuickDateFilter(90)}
            type={days === 90 && !startDate ? "default" : "normal"}
          />
          <Button
            text="Clear Dates"
            onClick={() => {
              setStartDate(null)
              setEndDate(null)
              setDays(30)
            }}
            type="normal"
          />
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

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <DataGrid
          dataSource={logs}
          showBorders={true}
          columnAutoWidth={true}
          wordWrapEnabled={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          onRowPrepared={rowPrepared}
          onExporting={onExporting}
        >
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search..." />
          <Export enabled={true} allowExportSelectedData={false} />
          <Selection mode="multiple" showCheckBoxesMode="always" />

          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo={true}
          />

          <Column
            dataField="timestamp"
            caption="Date & Time"
            dataType="datetime"
            format="MMM dd, yyyy hh:mm a"
            width={180}
            sortOrder="desc"
          />

          <Column dataField="username" caption="Username" width={150} />

          <Column dataField="fullName" caption="Full Name" width={200} />

          <Column dataField="roles" caption="Role(s)" width={180} />

          <Column
            dataField="selectedLocation"
            caption="Location"
            cellRender={renderLocationCell}
            width={250}
          />

          <Column
            dataField="isMismatch"
            caption="Status"
            width={100}
            cellRender={(cellData) => {
              if (cellData.value) {
                return (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-xs font-semibold">
                    MISMATCH
                  </span>
                )
              }
              return (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-xs font-semibold">
                  OK
                </span>
              )
            }}
          />

          <Column dataField="ipAddress" caption="IP Address" width={140} />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item location="after">
              <Button
                icon="refresh"
                onClick={fetchLoginHistory}
                hint="Refresh data"
              />
            </Item>
          </Toolbar>
        </DataGrid>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Legend</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Location Mismatch - User logged in at a location they are not assigned to
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Valid Login - User logged in at their assigned location
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
