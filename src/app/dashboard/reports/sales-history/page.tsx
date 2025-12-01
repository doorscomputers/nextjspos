"use client"

import { useState, useEffect, useMemo, useRef, ElementRef } from "react"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ReportFilterPanel from "@/components/reports/ReportFilterPanel"
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Pager,
  Export,
  Summary,
  TotalItem,
  StateStoring,
  ColumnChooser,
  Grouping,
  GroupPanel,
  Toolbar,
  Item,
  MasterDetail,
  Sorting,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'

// Import DevExtreme CSS
import 'devextreme/dist/css/dx.light.css'

interface SaleItem {
  productName: string
  variationName: string
  sku: string
  quantity: number
  unitPrice: number
  unitCost: number
  total: number
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  saleDateTime: string
  customer: string
  customerId: number | null
  customerEmail: string | null
  customerMobile: string | null
  location: string
  locationId: number
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  discountType: string | null
  notes: string | null
  itemCount: number
  items: SaleItem[]
  payments: Array<{
    method: string
    amount: number
    referenceNumber: string | null
    paidAt: string
  }>
}

interface SalesHistoryData {
  sales: Sale[]
  summary: {
    totalSales: number
    totalRevenue: number
    totalSubtotal: number
    totalTax: number
    totalDiscount: number
    totalCOGS: number
    grossProfit: number
  }
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export default function SalesHistoryPage() {
  const { can } = usePermissions()
  const pathname = usePathname()
  const isCashierMode = pathname?.includes('/dashboard/cashier-reports/') ?? false
  const dataGridRef = useRef<ElementRef<typeof DataGrid>>(null)

  // ALL hooks must be called BEFORE any early returns
  const [reportData, setReportData] = useState<SalesHistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [customerId, setCustomerId] = useState("all")
  const [status, setStatus] = useState("all")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("all")
  const [dateRange, setDateRange] = useState("today")

  // Sorting states
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Data for dropdowns
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([])
  const [enforcedLocationName, setEnforcedLocationName] = useState<string>("")

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (locationId !== "all") count += 1
    if (customerId !== "all") count += 1
    if (status !== "all") count += 1
    if (paymentMethod !== "all") count += 1
    if (invoiceNumber.trim() !== "") count += 1
    if (productSearch.trim() !== "") count += 1
    if (dateRange !== "custom") count += 1
    if (!dateRange && startDate) count += 1
    if (!dateRange && endDate) count += 1
    if (sortBy !== "createdAt" || sortOrder !== "desc") count += 1
    return count
  }, [
    locationId,
    customerId,
    status,
    paymentMethod,
    invoiceNumber,
    productSearch,
    dateRange,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [page, sortBy, sortOrder])

  const fetchLocations = async () => {
    type LocationItem = { id: number; name: string }
    try {
      let list: LocationItem[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      // Role-aware: try user-locations first
      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          const raw: LocationItem[] = Array.isArray(ul.locations) ? ul.locations : []
          list = raw.filter((l) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
          if (isCashierMode) {
            // Force restricted view in cashier mode
            accessAll = false
          }
        }
      } catch (e) {
        console.warn('Failed to load /api/user-locations, falling back to /api/locations', e)
      }

      // Fallback: business locations (admin-like)
      if (!list.length) {
        const response = await fetch('/api/locations')
        if (response.ok) {
          const data = await response.json()
          const locs: LocationItem[] = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          list = locs.filter((l) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = true
        }
      }

      setLocations(list)

      // For restricted users, auto-select assigned/first location
      if (!accessAll) {
        const resolved = primaryLocationId || (list[0]?.id ? String(list[0].id) : 'all')
        setLocationId(resolved)
        const found = list.find((l) => String(l.id) === String(resolved))
        if (found) setEnforcedLocationName(found.name)
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
      setLocations([])
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers")
      if (response.ok) {
        const data = await response.json()
        const customersList =
          Array.isArray(data)
            ? data
            : Array.isArray(data.customers)
              ? data.customers
              : Array.isArray(data.data)
                ? data.data
                : []
        setCustomers(customersList)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      setCustomers([])
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())
      params.append("sortBy", sortBy)
      params.append("sortOrder", sortOrder)

      if (locationId !== "all") params.append("locationId", locationId)
      if (customerId !== "all") params.append("customerId", customerId)
      if (status !== "all") params.append("status", status)
      if (invoiceNumber) params.append("invoiceNumber", invoiceNumber)
      if (productSearch) params.append("productSearch", productSearch)
      if (paymentMethod !== "all") params.append("paymentMethod", paymentMethod)

      if (dateRange && dateRange !== "custom") {
        params.append("dateRange", dateRange)
      } else {
        if (startDate) params.append("startDate", startDate)
        if (endDate) params.append("endDate", endDate)
      }

      const response = await fetch(`/api/reports/sales-history?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error("Failed to fetch report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchReport()
  }

  const handleReset = () => {
    setLocationId("all")
    setCustomerId("all")
    setStatus("all")
    setInvoiceNumber("")
    setStartDate("")
    setEndDate("")
    setProductSearch("")
    setPaymentMethod("all")
    setDateRange("today")
    setSortBy("createdAt")
    setSortOrder("desc")
    setPage(1)
    fetchReport()
  }

  const renderStatusBadge = (cellData: { value?: string }) => {
    const status = cellData.value?.toLowerCase() || ''
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variants[status] || "bg-gray-100 text-gray-800"}`}>
        {status.toUpperCase()}
      </span>
    )
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales History')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (
            gridCell.column.dataField === 'subtotal' ||
            gridCell.column.dataField === 'taxAmount' ||
            gridCell.column.dataField === 'discountAmount' ||
            gridCell.column.dataField === 'shippingCost' ||
            gridCell.column.dataField === 'totalAmount'
          ) {
            excelCell.numFmt = '₱#,##0.00'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `sales-history-${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Master detail template - DevExtreme passes complex props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MasterDetailTemplate = (props: any) => {
    const sale: Sale | undefined = props.data?.data || props.data

    if (!sale) {
      return (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
          <p className="text-yellow-800 dark:text-yellow-200">
            No details available for this sale.
          </p>
        </div>
      )
    }

    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950/50 space-y-4">
        {/* Sale Items */}
        {sale.items && sale.items.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-amber-900 dark:text-amber-100">Sale Items</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-amber-200 dark:border-amber-700">
                <thead className="bg-amber-100 dark:bg-amber-900/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-amber-800 dark:text-amber-200">Product</th>
                    <th className="px-4 py-2 text-left font-semibold text-amber-800 dark:text-amber-200">SKU</th>
                    <th className="px-4 py-2 text-right font-semibold text-amber-800 dark:text-amber-200">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold text-amber-800 dark:text-amber-200">Price</th>
                    <th className="px-4 py-2 text-right font-semibold text-amber-800 dark:text-amber-200">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-amber-900/30 divide-y divide-amber-200 dark:divide-amber-700">
                  {sale.items.map((item: SaleItem, idx: number) => (
                    <tr key={idx} className="hover:bg-amber-50 dark:hover:bg-amber-800/30">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                        {item.productName} ({item.variationName})
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{item.sku}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Details */}
        {sale.payments && sale.payments.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-amber-900 dark:text-amber-100">Payment Details</h4>
            <div className="grid grid-cols-2 gap-2">
              {sale.payments.map((payment: { method: string; amount: number; referenceNumber: string | null }, idx: number) => (
                <div key={idx} className="p-2 bg-white dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-700">
                  <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {payment.method.toUpperCase()}
                  </div>
                  <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                    {formatCurrency(payment.amount)}
                  </div>
                  {payment.referenceNumber && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      Ref: {payment.referenceNumber}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {sale.notes && (
          <div>
            <h4 className="font-semibold mb-1 text-amber-900 dark:text-amber-100">Notes</h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">{sale.notes}</p>
          </div>
        )}
      </div>
    )
  }

  // Permission check - AFTER all hooks
  if (!can(PERMISSIONS.REPORT_SALES_HISTORY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view reports</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 dark:from-amber-100 dark:via-orange-300 dark:to-amber-100 bg-clip-text text-transparent">Sales History per Location</h1>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Complete sales transaction history filtered by your assigned location(s)
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <FunnelIcon className="h-4 w-4" />
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleReset}
        clearLabel="Reset All Filters"
        description="Adjust quick date ranges and additional criteria to refine the sales dataset."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range Presets */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Quick Date Range</Label>
            <Select value={dateRange} onValueChange={(val) => {
              setDateRange(val)
              if (val !== "custom") {
                setStartDate("")
                setEndDate("")
              }
            }}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Range</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="lastWeek">Last Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value) setDateRange("custom")
              }}
              disabled={dateRange !== "custom"}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                if (e.target.value) setDateRange("custom")
              }}
              disabled={dateRange !== "custom"}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Location (hidden and enforced in cashier mode) */}
          {isCashierMode ? (
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 dark:text-gray-300">Location</Label>
              <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700 text-sm font-semibold text-blue-900 dark:text-blue-200">
                {enforcedLocationName || 'Assigned Location'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 dark:text-gray-300">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Customer */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_payment">Mobile Payment</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Number */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Invoice Number</Label>
            <Input
              placeholder="Search invoice..."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Product Search */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <Label className="text-gray-700 dark:text-gray-300">Product Name / SKU</Label>
            <Input
              placeholder="Search by product name or SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 flex-wrap">
          <Button
            onClick={handleSearch}
            variant="success"
            size="sm"
            className="gap-2"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Generate Report
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
          >
            <PrinterIcon className="h-4 w-4" />
            Print Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            Reset All Filters
          </Button>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-amber-900/30 border-amber-200 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="text-sm text-amber-700 dark:text-amber-300">Total Sales</div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                {reportData.summary.totalSales}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-amber-900/30 border-amber-200 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="text-sm text-amber-700 dark:text-amber-300">Total Revenue</div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                {formatCurrency(reportData.summary.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-amber-900/30 border-amber-200 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="text-sm text-amber-700 dark:text-amber-300">Total COGS</div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                {formatCurrency(reportData.summary.totalCOGS)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-amber-900/30 border-amber-200 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="text-sm text-amber-700 dark:text-amber-300">Gross Profit</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(reportData.summary.grossProfit)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Grid */}
      <Card className="bg-white dark:bg-amber-900/30 border-amber-200 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-100">
            Sales Transactions
            {reportData && ` (${reportData.pagination.total} total)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : reportData?.sales.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">No sales found</div>
          ) : (
            <DataGrid
              ref={dataGridRef}
              dataSource={reportData?.sales || []}
              keyExpr="id"
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
              <StateStoring enabled={true} type="localStorage" storageKey="sales-history-grid-v2" />
              <SearchPanel visible={true} width={240} placeholder="Search sales..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Sorting mode="multiple" />

              <Paging defaultPageSize={10} />
              <Pager
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 30, 40, 50]}
                showInfo={true}
                showNavigationButtons={true}
              />

              <Export enabled={true} allowExportSelectedData={false} />

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="searchPanel" />
                <Item name="exportButton" />
                <Item name="columnChooserButton" />
              </Toolbar>

              <Column
                dataField="invoiceNumber"
                caption="Invoice #"
                minWidth={150}
                cssClass="font-medium"
              />
              <Column
                dataField="saleDateTime"
                caption="Date & Time"
                dataType="datetime"
                format="MM/dd/yyyy hh:mm a"
                width={160}
              />
              <Column
                dataField="customer"
                caption="Customer"
                minWidth={150}
              />
              <Column
                dataField="location"
                caption="Location"
                width={130}
              />
              <Column
                dataField="status"
                caption="Status"
                width={120}
                cellRender={renderStatusBadge}
              />
              <Column
                dataField="itemCount"
                caption="Items"
                dataType="number"
                width={80}
                alignment="center"
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
                dataField="totalAmount"
                caption="Total"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cssClass="font-semibold"
              />

              <Summary>
                <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0} sales" />
                <TotalItem column="itemCount" summaryType="sum" valueFormat="decimal" />
                <TotalItem column="subtotal" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="taxAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="discountAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
              </Summary>

              <MasterDetail enabled={true} component={MasterDetailTemplate} />
            </DataGrid>
          )}

          {/* Custom Pagination */}
          {reportData && reportData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {reportData.pagination.page} of {reportData.pagination.totalPages}
                {" "}({reportData.pagination.total} total records)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === reportData.pagination.totalPages}
                  className="hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          button {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
