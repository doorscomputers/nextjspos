"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/currencyUtils"
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Summary,
  TotalItem,
  StateStoring,
  ColumnChooser,
  Grouping,
  GroupPanel,
  Toolbar,
  Item,
  Sorting,
  MasterDetail,
} from "devextreme-react/data-grid"
import { Workbook } from "exceljs"
import { saveAs } from "file-saver-es"
import { exportDataGrid } from "devextreme/excel_exporter"
import "devextreme/dist/css/dx.light.css"

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisQuarter", label: "This Quarter" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
]

const getDateInputValue = (date: Date) => date.toISOString().split("T")[0]

export default function PaymentMethodPage() {
  const dataGridRef = useRef<DataGrid>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])

  const [datePreset, setDatePreset] = useState<string>("thisMonth")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => getDateInputValue(new Date()))
  const [locationId, setLocationId] = useState<string>("all")

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate, locationId])

  const loadLocations = async () => {
    try {
      const response = await fetch("/api/user-locations")
      if (response.ok) {
        const data = await response.json()
        const userLocations = Array.isArray(data.locations) ? data.locations : []
        const filteredLocations = userLocations.filter(
          (loc: any) => loc?.name && !loc.name.toLowerCase().includes("warehouse")
        )
        setLocations(filteredLocations)
      }
    } catch (err) {
      console.error("Failed to load locations:", err)
    }
  }

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    if (preset === "custom") return

    const today = new Date()
    let rangeStart = new Date(today)
    let rangeEnd = new Date(today)

    switch (preset) {
      case "today":
        break
      case "yesterday":
        rangeStart.setDate(rangeStart.getDate() - 1)
        rangeEnd = new Date(rangeStart)
        break
      case "thisWeek": {
        const day = today.getDay()
        rangeStart.setDate(today.getDate() - day)
        break
      }
      case "lastWeek": {
        const day = today.getDay()
        rangeEnd.setDate(today.getDate() - day - 1)
        rangeStart = new Date(rangeEnd)
        rangeStart.setDate(rangeEnd.getDate() - 6)
        break
      }
      case "thisMonth":
        rangeStart = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "lastMonth":
        rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        rangeEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case "thisQuarter": {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
        rangeStart = new Date(today.getFullYear(), quarterStartMonth, 1)
        break
      }
      case "thisYear":
        rangeStart = new Date(today.getFullYear(), 0, 1)
        break
      case "lastYear":
        rangeStart = new Date(today.getFullYear() - 1, 0, 1)
        rangeEnd = new Date(today.getFullYear() - 1, 11, 31)
        break
      default:
        break
    }

    setStartDate(getDateInputValue(rangeStart))
    setEndDate(getDateInputValue(rangeEnd))
  }

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (locationId && locationId !== "all") params.set("locationId", locationId)

      const response = await fetch(`/api/reports/payment-method?${params.toString()}`)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || "Failed to fetch payment method report")
      }

      const data = await response.json()
      setReportData(data)
    } catch (err: any) {
      console.error("Payment method error:", err)
      setError(err.message || "Unable to load report data")
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setDatePreset("thisMonth")
    const today = new Date()
    setStartDate(getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)))
    setEndDate(getDateInputValue(new Date()))
    setLocationId("all")
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Payment Methods")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          const currencyFields = ["totalAmount", "averageTransactionValue"]
          if (currencyFields.includes(gridCell.column.dataField)) {
            excelCell.numFmt = "₱#,##0.00"
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `payment-methods-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const MasterDetailTemplate = (props: any) => {
    const payment = props.data?.data || props.data

    if (!payment) {
      return (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
          <p className="text-yellow-800 dark:text-yellow-200">No breakdown data available</p>
        </div>
      )
    }

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 space-y-4">
        {/* Location Breakdown */}
        {payment.locationBreakdown && payment.locationBreakdown.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Location Breakdown ({payment.locationBreakdown.length} locations)
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Location
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Transactions
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      % of Method
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {payment.locationBreakdown.map((loc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loc.location}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                        {loc.transactionCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(loc.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                        {loc.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Cashiers */}
        {payment.cashierBreakdown && payment.cashierBreakdown.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Top Cashiers ({payment.cashierBreakdown.length} cashiers)
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Cashier
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Transactions
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {payment.cashierBreakdown.map((cashier: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {cashier.cashierName}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                        {cashier.transactionCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(cashier.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    )
  }

  const summary = reportData?.summary || {}
  const paymentMethods = reportData?.paymentMethods || []

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Payment Method Report</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Sales analysis by payment method with location and cashier breakdown
          </p>
        </div>
        <Link href="/dashboard/reports">
          <Button variant="outline" size="sm">
            Back to Reports
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="datePreset">Date Preset</Label>
              <select
                id="datePreset"
                value={datePreset}
                onChange={(e) => applyDatePreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset("custom")
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset("custom")
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <select
                id="location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Locations</option>
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={fetchReport} disabled={loading} variant="default" size="sm">
              {loading ? "Loading..." : "Refresh Report"}
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {reportData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(summary.totalSales)}</div>
                <p className="text-xs opacity-80 mt-1">All payment methods</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.totalTransactions?.toLocaleString()}</div>
                <p className="text-xs opacity-80 mt-1">Total count</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.paymentMethodCount}</div>
                <p className="text-xs opacity-80 mt-1">Methods used</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Most Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{summary.mostUsedMethod?.method || "N/A"}</div>
                <p className="text-xs opacity-80 mt-1">
                  {summary.mostUsedMethod?.transactionCount.toLocaleString()} transactions (
                  {summary.mostUsedMethod?.percentage.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Data Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Payment Method Analysis</span>
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({paymentMethods.length} methods)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                ref={dataGridRef}
                dataSource={paymentMethods}
                keyExpr="method"
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                onExporting={onExporting}
              >
                <StateStoring enabled={true} type="localStorage" storageKey="payment-method-grid" />
                <SearchPanel visible={true} width={240} placeholder="Search payment methods..." />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <GroupPanel visible={true} />
                <Grouping autoExpandAll={false} />
                <ColumnChooser enabled={true} mode="select" />
                <Sorting mode="multiple" />

                <Column dataField="method" caption="Payment Method" minWidth={150} cssClass="font-medium" />
                <Column
                  dataField="transactionCount"
                  caption="Transactions"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={130}
                />
                <Column
                  dataField="totalAmount"
                  caption="Total Amount"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                  cssClass="font-semibold"
                />
                <Column
                  dataField="percentage"
                  caption="% of Revenue"
                  dataType="number"
                  format="#,##0.0'%'"
                  alignment="right"
                  width={130}
                />
                <Column
                  dataField="transactionPercentage"
                  caption="% of Transactions"
                  dataType="number"
                  format="#,##0.0'%'"
                  alignment="right"
                  width={160}
                />
                <Column
                  dataField="averageTransactionValue"
                  caption="Avg Transaction"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                />

                <Summary>
                  <TotalItem column="method" summaryType="count" displayFormat="Total: {0} methods" />
                  <TotalItem column="transactionCount" summaryType="sum" valueFormat="#,##0" />
                  <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                </Summary>

                <Export enabled={true} allowExportSelectedData={false} />
                <MasterDetail enabled={true} component={MasterDetailTemplate} />

                <Toolbar>
                  <Item name="groupPanel" />
                  <Item name="searchPanel" />
                  <Item name="exportButton" />
                  <Item name="columnChooserButton" />
                </Toolbar>
              </DataGrid>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
