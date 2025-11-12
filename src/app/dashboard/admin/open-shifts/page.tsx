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
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { Button } from "devextreme-react/button"
import {
  Clock,
  DollarSign,
  MapPin,
  RefreshCw,
  ShoppingCart,
  User,
  Users,
  AlertTriangle,
} from "lucide-react"
import { Workbook } from "exceljs"
import { saveAs } from "file-saver-es"
import { exportDataGrid } from "devextreme/excel_exporter"

interface OpenShift {
  id: number
  shiftNumber: string
  status: string
  userId: number
  username: string
  userFullName: string
  userSurname: string
  userRoles: string[]
  locationId: number
  locationName: string
  locationCode: string | null
  locationActive: boolean
  openedAt: string
  duration: {
    hours: number
    minutes: number
    formatted: string
  }
  beginningCash: number
  currentSales: number
  transactionCount: number
  xReadingCount: number
  zReadingCount: number
  runningGrossSales: number
  runningNetSales: number
  runningTotalDiscounts: number
  runningVoidAmount: number
  runningCashInAmount: number
  runningCashOutAmount: number
}

interface Summary {
  totalOpenShifts: number
  totalLocationsWithOpenShifts: number
  totalUsers: number
  totalSales: number
  totalTransactions: number
}

interface OpenShiftsResponse {
  shifts: OpenShift[]
  summary: Summary
}

export default function OpenShiftsPage() {
  const { can, hasAnyPermission } = usePermissions()
  const router = useRouter()

  const [data, setData] = useState<OpenShiftsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Permission check
  useEffect(() => {
    if (
      !hasAnyPermission([
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
      ])
    ) {
      router.push("/dashboard")
    }
  }, [hasAnyPermission, router])

  // Fetch open shifts
  const fetchOpenShifts = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/open-shifts")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch open shifts")
      }

      const responseData = await response.json()
      setData(responseData)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("Error fetching open shifts:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchOpenShifts()
  }, [fetchOpenShifts])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchOpenShifts()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, fetchOpenShifts])

  // Cell render for duration with color coding
  const renderDurationCell = (cellData: any) => {
    const hours = cellData.data.duration.hours
    const formatted = cellData.data.duration.formatted

    let colorClass = "text-green-700 dark:text-green-300" // < 8 hours
    if (hours >= 12) {
      colorClass = "text-red-700 dark:text-red-300 font-bold" // >= 12 hours (alert!)
    } else if (hours >= 8) {
      colorClass = "text-orange-600 dark:text-orange-400" // 8-12 hours (warning)
    }

    return (
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <Clock className="w-4 h-4" />
        <span>{formatted}</span>
        {hours >= 12 && (
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
        )}
      </div>
    )
  }

  // Cell render for location
  const renderLocationCell = (cellData: any) => {
    const locationName = cellData.data.locationName
    const locationCode = cellData.data.locationCode
    const isActive = cellData.data.locationActive

    return (
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <div>
          <div className="font-semibold">{locationName}</div>
          {locationCode && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {locationCode}
            </div>
          )}
        </div>
        {!isActive && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-xs font-semibold">
            INACTIVE
          </span>
        )}
      </div>
    )
  }

  // Cell render for user with roles
  const renderUserCell = (cellData: any) => {
    const fullName = cellData.data.userFullName
    const username = cellData.data.username
    const roles = cellData.data.userRoles

    return (
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <div>
          <div className="font-semibold">{fullName}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            @{username}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400">
            {roles.join(", ")}
          </div>
        </div>
      </div>
    )
  }

  // Row styling for long-running shifts
  const rowPrepared = (e: any) => {
    if (e.rowType === "data" && e.data.duration.hours >= 12) {
      e.rowElement.style.backgroundColor = "rgba(239, 68, 68, 0.1)"
    }
  }

  // Export to Excel
  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Open Shifts")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `open-shifts-${new Date().toISOString().split("T")[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  if (
    !hasAnyPermission([
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
    ])
  ) {
    return null
  }

  const shifts = data?.shifts || []
  const summary = data?.summary || {
    totalOpenShifts: 0,
    totalLocationsWithOpenShifts: 0,
    totalUsers: 0,
    totalSales: 0,
    totalTransactions: 0,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Open Shifts Monitor
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor currently active cashier shifts across all locations
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
            onClick={fetchOpenShifts}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Open Shifts
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.totalOpenShifts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.totalUsers}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Locations
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.totalLocationsWithOpenShifts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Sales
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₱{summary.totalSales.toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transactions
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.totalTransactions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Open Shifts Details
        </h3>
        <DataGrid
          dataSource={shifts}
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
          <GroupPanel visible={true} />
          <Grouping autoExpandAll={false} />

          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo={true}
          />

          <Column dataField="shiftNumber" caption="Shift Number" width={150} />

          <Column
            dataField="userFullName"
            caption="Cashier"
            cellRender={renderUserCell}
            width={250}
          />

          <Column
            dataField="locationName"
            caption="Location"
            cellRender={renderLocationCell}
            width={200}
            groupIndex={0}
          />

          <Column
            dataField="openedAt"
            caption="Opened At"
            dataType="datetime"
            format="MMM dd, yyyy hh:mm a"
            width={180}
          />

          <Column
            dataField="duration.formatted"
            caption="Duration"
            cellRender={renderDurationCell}
            width={150}
            sortOrder="desc"
          />

          <Column
            dataField="beginningCash"
            caption="Beginning Cash"
            dataType="number"
            format="#,##0.00"
            width={150}
          />

          <Column
            dataField="currentSales"
            caption="Current Sales"
            dataType="number"
            format="₱#,##0.00"
            width={150}
          />

          <Column
            dataField="transactionCount"
            caption="Transactions"
            dataType="number"
            width={120}
          />

          <Column
            dataField="xReadingCount"
            caption="X Readings"
            dataType="number"
            width={110}
          />

          <Summary>
            <TotalItem column="shiftNumber" summaryType="count" />
            <TotalItem
              column="currentSales"
              summaryType="sum"
              valueFormat="₱#,##0.00"
            />
            <TotalItem column="transactionCount" summaryType="sum" />
          </Summary>

          <Toolbar>
            <Item name="groupPanel" />
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item location="after">
              <Button
                icon="refresh"
                onClick={fetchOpenShifts}
                hint="Refresh data"
              />
            </Item>
          </Toolbar>
        </DataGrid>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Duration Color Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900 border-2 border-green-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Normal (0-8 hours) - Standard shift length
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 dark:bg-orange-900 border-2 border-orange-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Warning (8-12 hours) - Long shift, consider closing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 dark:bg-red-900 border-2 border-red-600 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Alert (12+ hours) - Very long shift! Should be closed
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
