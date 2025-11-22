"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/currencyUtils"
import DataGrid, {
  Column,
  Summary,
  TotalItem,
  Export,
  Toolbar,
  Item,
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
  { value: "lastQuarter", label: "Last Quarter" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
]

const COMPARE_OPTIONS = [
  { value: "none", label: "No Comparison" },
  { value: "previous-period", label: "Previous Period" },
  { value: "previous-year", label: "Previous Year" },
]

const getDateInputValue = (date: Date) => date.toISOString().split("T")[0]

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])

  const [datePreset, setDatePreset] = useState<string>("thisMonth")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => getDateInputValue(new Date()))
  const [locationId, setLocationId] = useState<string>("all")
  const [compareWith, setCompareWith] = useState<string>("none")

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate, locationId, compareWith])

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
      case "lastQuarter": {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
        rangeStart = new Date(today.getFullYear(), quarterStartMonth - 3, 1)
        rangeEnd = new Date(today.getFullYear(), quarterStartMonth, 0)
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
      if (compareWith && compareWith !== "none") params.set("compareWith", compareWith)

      const response = await fetch(`/api/reports/sales-analytics?${params.toString()}`)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || "Failed to fetch sales analytics report")
      }

      const data = await response.json()
      setAnalyticsData(data)
    } catch (err: any) {
      console.error("Sales analytics error:", err)
      setError(err.message || "Unable to load report data")
      setAnalyticsData(null)
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
    setCompareWith("none")
  }

  const onExportingCategories = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Category Sales")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data" && gridCell.column.dataField === "sales") {
          excelCell.numFmt = "₱#,##0.00"
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `category-sales-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingProducts = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Top Products")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data" && gridCell.column.dataField === "revenue") {
          excelCell.numFmt = "₱#,##0.00"
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `top-products-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingPayments = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Payment Methods")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data" && gridCell.column.dataField === "amount") {
          excelCell.numFmt = "₱#,##0.00"
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

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  const kpis = analyticsData?.kpis || {}
  const comparison = analyticsData?.comparison

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive sales analysis with trends, breakdowns, and insights
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

            <div>
              <Label htmlFor="compareWith">Compare With</Label>
              <select
                id="compareWith"
                value={compareWith}
                onChange={(e) => setCompareWith(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {COMPARE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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

      {/* KPI Cards */}
      {analyticsData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.totalSales)}</div>
                {comparison && (
                  <p className="text-xs opacity-80 mt-1">
                    {comparison.salesGrowth > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(comparison.salesGrowth).toFixed(1)}% vs {comparison.period}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.totalTransactions?.toLocaleString()}</div>
                {comparison && (
                  <p className="text-xs opacity-80 mt-1">
                    {comparison.transactionGrowth > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(comparison.transactionGrowth).toFixed(1)}% vs {comparison.period}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Avg Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatCurrency(kpis.averageTransactionValue)}
                </div>
                <p className="text-xs opacity-80 mt-1">Per transaction</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Items Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.totalItems?.toLocaleString()}</div>
                <p className="text-xs opacity-80 mt-1">
                  {kpis.averageItemsPerTransaction?.toFixed(1)} items/transaction
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={analyticsData.breakdown?.categories || []}
                keyExpr="category"
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                onExporting={onExportingCategories}
              >
                <Column dataField="category" caption="Category" minWidth={200} />
                <Column
                  dataField="sales"
                  caption="Sales"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                />
                <Column
                  dataField="quantity"
                  caption="Quantity"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={120}
                />

                <Summary>
                  <TotalItem column="sales" summaryType="sum" valueFormat="₱#,##0.00" />
                  <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0" />
                </Summary>

                <Export enabled={true} />
                <Toolbar>
                  <Item name="exportButton" />
                </Toolbar>
              </DataGrid>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Products</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={analyticsData.topProducts || []}
                keyExpr="productId"
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                onExporting={onExportingProducts}
              >
                <Column dataField="productName" caption="Product" minWidth={250} />
                <Column
                  dataField="quantity"
                  caption="Quantity Sold"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={130}
                />
                <Column
                  dataField="revenue"
                  caption="Revenue"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                />

                <Summary>
                  <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0" />
                  <TotalItem column="revenue" summaryType="sum" valueFormat="₱#,##0.00" />
                </Summary>

                <Export enabled={true} />
                <Toolbar>
                  <Item name="exportButton" />
                </Toolbar>
              </DataGrid>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={analyticsData.breakdown?.paymentMethods || []}
                keyExpr="method"
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                onExporting={onExportingPayments}
              >
                <Column dataField="method" caption="Payment Method" minWidth={150} />
                <Column
                  dataField="count"
                  caption="Transactions"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={130}
                />
                <Column
                  dataField="amount"
                  caption="Amount"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                />
                <Column
                  dataField="percentage"
                  caption="% of Total"
                  dataType="number"
                  format="#,##0.0'%'"
                  alignment="right"
                  width={120}
                />

                <Summary>
                  <TotalItem column="count" summaryType="sum" valueFormat="#,##0" />
                  <TotalItem column="amount" summaryType="sum" valueFormat="₱#,##0.00" />
                </Summary>

                <Export enabled={true} />
                <Toolbar>
                  <Item name="exportButton" />
                </Toolbar>
              </DataGrid>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
