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
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisQuarter", label: "This Quarter" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom Range" },
]

const getDateInputValue = (date: Date) => date.toISOString().split("T")[0]

export default function CustomerSalesPage() {
  const dataGridRef = useRef<DataGrid>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)

  const [datePreset, setDatePreset] = useState<string>("allTime")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate])

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    if (preset === "allTime") {
      setStartDate("")
      setEndDate("")
      return
    }
    if (preset === "custom") return

    const today = new Date()
    let rangeStart = new Date(today)
    let rangeEnd = new Date(today)

    switch (preset) {
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

      const response = await fetch(`/api/reports/customer-sales?${params.toString()}`)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || "Failed to fetch customer sales report")
      }

      const data = await response.json()
      setReportData(data)
    } catch (err: any) {
      console.error("Customer sales error:", err)
      setError(err.message || "Unable to load report data")
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setDatePreset("allTime")
    setStartDate("")
    setEndDate("")
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Customer Sales")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          const currencyFields = ["totalSpent", "averagePurchaseValue"]
          if (currencyFields.includes(gridCell.column.dataField)) {
            excelCell.numFmt = "₱#,##0.00"
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `customer-sales-${new Date().toISOString().split("T")[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const MasterDetailTemplate = (props: any) => {
    const customer = props.data?.data || props.data

    if (!customer || !customer.purchases || !Array.isArray(customer.purchases)) {
      return (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
          <p className="text-yellow-800 dark:text-yellow-200">No purchase history available</p>
        </div>
      )
    }

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {customer.email || "N/A"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Contact</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {customer.contactNumber || "N/A"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">First Purchase</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {new Date(customer.firstPurchase).toLocaleDateString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Last Purchase</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {new Date(customer.lastPurchase).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
            Purchase History ({customer.purchases.length} transactions)
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                    Invoice
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customer.purchases.slice(0, 10).map((purchase: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {purchase.invoiceNumber}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(purchase.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customer.purchases.length > 10 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-4">
                Showing latest 10 of {customer.purchases.length} purchases
              </p>
            )}
          </div>
        </div>
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
  const segments = reportData?.segments || {}
  const customers = reportData?.customers || []

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Customer Sales Report</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customer lifetime value, purchase frequency, and segmentation
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <CardTitle className="text-sm opacity-80">Total Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.totalCustomers?.toLocaleString()}</div>
                <p className="text-xs opacity-80 mt-1">Active customers</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(summary.totalSales)}</div>
                <p className="text-xs opacity-80 mt-1">From all customers</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Avg Customer Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatCurrency(summary.averageCustomerValue)}
                </div>
                <p className="text-xs opacity-80 mt-1">Lifetime value</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-80">Avg Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {summary.averagePurchasesPerCustomer?.toFixed(1)}
                </div>
                <p className="text-xs opacity-80 mt-1">Per customer</p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Segments */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg">
                  <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    VIP Customers
                  </div>
                  <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-2">
                    {segments.vip || 0}
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    High lifetime value
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 rounded-lg">
                  <div className="text-sm font-medium text-green-800 dark:text-green-300">
                    Regular Customers
                  </div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
                    {segments.regular || 0}
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">Average lifetime value</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Occasional Customers
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                    {segments.occasional || 0}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Below average value
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Data Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Customer Purchase Analysis</span>
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({customers.length} customers)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                ref={dataGridRef}
                dataSource={customers}
                keyExpr="customerId"
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
                <StateStoring enabled={true} type="localStorage" storageKey="customer-sales-grid" />
                <SearchPanel visible={true} width={240} placeholder="Search customers..." />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <GroupPanel visible={true} />
                <Grouping autoExpandAll={false} />
                <ColumnChooser enabled={true} mode="select" />
                <Sorting mode="multiple" />

                <Column dataField="customerName" caption="Customer Name" minWidth={200} />
                <Column
                  dataField="purchaseCount"
                  caption="Purchases"
                  dataType="number"
                  width={110}
                  alignment="center"
                />
                <Column
                  dataField="totalSpent"
                  caption="Lifetime Value"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={150}
                  cssClass="font-semibold"
                />
                <Column
                  dataField="averagePurchaseValue"
                  caption="Avg Purchase"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={130}
                />
                <Column
                  dataField="totalItems"
                  caption="Items"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={100}
                />
                <Column
                  dataField="purchaseFrequency"
                  caption="Frequency"
                  dataType="number"
                  format="#,##0.0"
                  alignment="right"
                  width={110}
                  caption="Purchases/Month"
                />
                <Column
                  dataField="lifetimeDays"
                  caption="Lifetime (Days)"
                  dataType="number"
                  format="#,##0"
                  alignment="right"
                  width={130}
                />

                <Summary>
                  <TotalItem column="customerName" summaryType="count" displayFormat="Total: {0} customers" />
                  <TotalItem column="purchaseCount" summaryType="sum" valueFormat="#,##0" />
                  <TotalItem column="totalSpent" summaryType="sum" valueFormat="₱#,##0.00" />
                  <TotalItem column="totalItems" summaryType="sum" valueFormat="#,##0" />
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
