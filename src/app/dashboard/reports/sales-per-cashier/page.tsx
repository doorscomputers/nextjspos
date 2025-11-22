"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  Paging,
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
} from "devextreme-react/data-grid"
import { Workbook } from "exceljs"
import { saveAs } from "file-saver-es"
import { exportDataGrid } from "devextreme/excel_exporter"
import "devextreme/dist/css/dx.light.css"

const PAYMENT_METHOD_OPTIONS = [
  { value: "all", label: "All Payment Methods" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit" },
  { value: "gcash", label: "GCash" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "VOIDED", label: "Voided" },
  { value: "REFUNDED", label: "Refunded" },
]

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

const VIEW_OPTIONS: Array<{ value: "invoice" | "item"; label: string }> = [
  { value: "invoice", label: "Invoice Summary" },
  { value: "item", label: "Item Breakdown" },
]

const getDateInputValue = (date: Date) => date.toISOString().split("T")[0]

const formatPercentage = (value?: number | null) => {
  if (value === undefined || value === null) return "0.0%"
  return `${value.toFixed(1)}%`
}

const formatNumber = (value?: number | null) => (value ?? 0).toLocaleString()

interface Summary {
  totalSales: number
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalCOGS: number
  grossProfit: number
  totalItems: number
}

export default function SalesPerCashierReport() {
  const dataGridRef = useRef<DataGrid>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [cashiers, setCashiers] = useState<any[]>([])

  const [datePreset, setDatePreset] = useState<string>("thisMonth")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => getDateInputValue(new Date()))
  const [cashierId, setCashierId] = useState<string>("all")
  const [locationId, setLocationId] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("all")
  const [viewMode, setViewMode] = useState<"invoice" | "item">("invoice")

  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load user-scoped locations first
        let list: any[] = []
        let accessAll = false
        let primary: string | null = null
        try {
          const ulRes = await fetch("/api/user-locations")
          if (ulRes.ok) {
            const ul = await ulRes.json()
            list = Array.isArray(ul.locations) ? ul.locations : []
            // Exclude warehouses for sales views
            list = list.filter((l: any) => l?.name && !l.name.toLowerCase().includes("warehouse"))
            accessAll = Boolean(ul.hasAccessToAll)
            primary = ul.primaryLocationId ? String(ul.primaryLocationId) : null
          }
        } catch (e) {
          // ignore and fallback
        }

        if (!list.length) {
          const res = await fetch("/api/locations")
          if (res.ok) {
            const data = await res.json()
            const raw = Array.isArray(data)
              ? data
              : Array.isArray(data.locations)
                ? data.locations
                : Array.isArray(data.data)
                  ? data.data
                  : []
            list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes("warehouse"))
            accessAll = true
          }
        }

        setLocations(list)
        setHasAccessToAll(accessAll)
        if (!accessAll) {
          const resolved = primary || (list[0]?.id ? String(list[0].id) : "all")
          setLocationId(resolved)
        }

        // Load cashiers
        const cashiersRes = await fetch("/api/users")
        if (cashiersRes.ok) {
          const cashiersData = await cashiersRes.json()
          const usersArray = Array.isArray(cashiersData) ? cashiersData : cashiersData.users || []
          setCashiers(usersArray)
        }
      } catch (err) {
        console.error("Failed to load filter data:", err)
      }
    }

    loadFilters()
  }, [])

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    if (preset === "custom") {
      return
    }

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

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("viewMode", viewMode)

      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (cashierId && cashierId !== "all") params.set("cashierId", cashierId)
      if (locationId && locationId !== "all") params.set("locationId", locationId)
      if (status && status !== "all") params.set("status", status)
      if (invoiceNumber) params.set("invoiceNumber", invoiceNumber.trim())
      if (productSearch) params.set("productSearch", productSearch.trim())
      if (paymentMethod && paymentMethod !== "all") params.set("paymentMethod", paymentMethod)
      if (datePreset && datePreset !== "custom") params.set("dateRange", datePreset)

      const res = await fetch(`/api/reports/sales-per-cashier?${params.toString()}`)

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || "Failed to fetch sales per cashier report.")
      }

      const data = await res.json()

      setSummary(data.summary || null)
      setPagination(data.pagination || null)

      if (viewMode === "invoice") {
        setSales(data.sales || [])
        setItems([])
      } else {
        setItems(data.items || [])
        setSales([])
      }
    } catch (err: any) {
      console.error("Sales per cashier report error:", err)
      setError(err.message || "Unable to load report data.")
      setSummary(null)
      setSales([])
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [
    viewMode,
    startDate,
    endDate,
    cashierId,
    locationId,
    status,
    invoiceNumber,
    productSearch,
    paymentMethod,
    datePreset,
  ])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleReset = () => {
    setDatePreset("thisMonth")
    const today = new Date()
    setStartDate(getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)))
    setEndDate(getDateInputValue(new Date()))
    setCashierId("all")
    setLocationId("all")
    setStatus("all")
    setInvoiceNumber("")
    setProductSearch("")
    setPaymentMethod("all")
    setViewMode("invoice")
  }

  const onExportingInvoice = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Sales Per Cashier - Invoices")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          const currencyFields = ["totalAmount", "subtotal", "taxAmount", "discountAmount"]
          if (currencyFields.includes(gridCell.column.dataField)) {
            excelCell.numFmt = "₱#,##0.00"
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `sales-per-cashier-invoices-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingItems = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet("Sales Per Cashier - Items")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          const currencyFields = ["unitPrice", "total", "profit"]
          if (currencyFields.includes(gridCell.column.dataField)) {
            excelCell.numFmt = "₱#,##0.00"
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `sales-per-cashier-items-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const renderStatusBadge = (cellData: any) => {
    const status = cellData.value
    let badgeClass = "px-2 py-1 rounded-full text-xs font-semibold"

    if (status === "COMPLETED") {
      badgeClass += " bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    } else if (status === "CANCELLED" || status === "VOIDED") {
      badgeClass += " bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
    } else if (status === "DRAFT" || status === "PENDING") {
      badgeClass += " bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
    } else if (status === "REFUNDED") {
      badgeClass += " bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
    } else {
      badgeClass += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
    }

    return <span className={badgeClass}>{status}</span>
  }

  if (loading && !sales.length && !items.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales Per Cashier</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track sales performance by cashier with invoice or item level detail
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
              <Label htmlFor="viewMode">View Mode</Label>
              <select
                id="viewMode"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as "invoice" | "item")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cashier">Cashier</Label>
              <select
                id="cashier"
                value={cashierId}
                onChange={(e) => setCashierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Cashiers</option>
                {cashiers.map((cashier: any) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.firstName
                      ? `${cashier.firstName} ${cashier.surname || ""}`.trim()
                      : cashier.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <select
                id="location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {hasAccessToAll && <option value="all">All Locations</option>}
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <input
                id="invoiceNumber"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Search invoice #"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="productSearch">Product Search</Label>
              <input
                id="productSearch"
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Product name or SKU"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm opacity-80">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.totalSales.toLocaleString()}</div>
              <p className="text-xs opacity-80 mt-1">Invoices matching filters</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm opacity-80">Gross Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
              <p className="text-xs opacity-80 mt-1">Includes tax and discounts</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm opacity-80">Gross Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(summary.grossProfit)}</div>
              <p className="text-xs opacity-80 mt-1">
                Margin{" "}
                {summary.totalRevenue > 0
                  ? formatPercentage((summary.grossProfit / summary.totalRevenue) * 100)
                  : "0.0%"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm opacity-80">Items Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatNumber(summary.totalItems)}</div>
              <p className="text-xs opacity-80 mt-1">Across all invoices</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Data Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{viewMode === "invoice" ? "Sales Invoices" : "Sale Items"}</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({viewMode === "invoice" ? sales.length : items.length} records)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === "invoice" ? (
            <DataGrid
              ref={dataGridRef}
              dataSource={sales}
              keyExpr="id"
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExportingInvoice}
            >
              <StateStoring enabled={true} type="localStorage" storageKey="sales-per-cashier-invoice-grid" />
              <SearchPanel visible={true} width={240} placeholder="Search invoices..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Sorting mode="multiple" />
              <Paging enabled={false} />
              <Export enabled={true} allowExportSelectedData={false} />

              <Column dataField="invoiceNumber" caption="Invoice #" minWidth={150} cssClass="font-medium" />
              <Column
                dataField="saleDate"
                caption="Date"
                dataType="date"
                format="MM/dd/yyyy"
                width={120}
              />
              <Column dataField="cashier" caption="Cashier" minWidth={150} />
              <Column dataField="cashierUsername" caption="Username" width={130} />
              <Column dataField="location" caption="Location" width={130} />
              <Column dataField="customer" caption="Customer" minWidth={150} />
              <Column
                dataField="itemCount"
                caption="Items"
                dataType="number"
                width={80}
                alignment="center"
              />
              <Column
                dataField="totalAmount"
                caption="Total"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cssClass="font-semibold"
              />
              <Column
                dataField="subtotal"
                caption="Subtotal"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={120}
              />
              <Column
                dataField="taxAmount"
                caption="Tax"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={100}
              />
              <Column
                dataField="discountAmount"
                caption="Discount"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={110}
              />
              <Column
                dataField="status"
                caption="Status"
                width={120}
                cellRender={renderStatusBadge}
              />

              <Summary>
                <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0} invoices" />
                <TotalItem column="itemCount" summaryType="sum" valueFormat="decimal" />
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="subtotal" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="taxAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="discountAmount" summaryType="sum" valueFormat="₱#,##0.00" />
              </Summary>

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="searchPanel" />
                <Item name="exportButton" />
                <Item name="columnChooserButton" />
              </Toolbar>
            </DataGrid>
          ) : (
            <DataGrid
              ref={dataGridRef}
              dataSource={items}
              keyExpr="id"
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExportingItems}
            >
              <StateStoring enabled={true} type="localStorage" storageKey="sales-per-cashier-items-grid" />
              <SearchPanel visible={true} width={240} placeholder="Search items..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Sorting mode="multiple" />
              <Paging enabled={false} />
              <Export enabled={true} allowExportSelectedData={false} />

              <Column dataField="invoiceNumber" caption="Invoice #" minWidth={150} cssClass="font-medium" />
              <Column
                dataField="saleDate"
                caption="Date"
                dataType="date"
                format="MM/dd/yyyy"
                width={120}
              />
              <Column dataField="cashier" caption="Cashier" minWidth={150} />
              <Column dataField="cashierUsername" caption="Username" width={130} />
              <Column dataField="location" caption="Location" width={130} />
              <Column dataField="productName" caption="Product" minWidth={200} />
              <Column dataField="sku" caption="SKU" width={130} />
              <Column
                dataField="quantity"
                caption="Qty"
                dataType="number"
                format="#,##0.##"
                width={80}
                alignment="center"
              />
              <Column
                dataField="unitPrice"
                caption="Unit Price"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={120}
              />
              <Column
                dataField="total"
                caption="Total"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={120}
                cssClass="font-semibold"
              />
              <Column
                dataField="profit"
                caption="Profit"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={110}
              />
              <Column
                dataField="status"
                caption="Status"
                width={120}
                cellRender={renderStatusBadge}
              />

              <Summary>
                <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0} items" />
                <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0.##" />
                <TotalItem column="total" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="profit" summaryType="sum" valueFormat="₱#,##0.00" />
              </Summary>

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="searchPanel" />
                <Item name="exportButton" />
                <Item name="columnChooserButton" />
              </Toolbar>
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
