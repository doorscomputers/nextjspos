"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
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
import { Badge } from "@/components/ui/badge"
import ReportFilterPanel from "@/components/reports/ReportFilterPanel"
import { countActiveFilters } from "@/lib/reportFilterUtils"
import { getDatePresetRangePH, type DatePreset } from "@/lib/timezone"
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
  discountAmount: number
  total: number
  serialNumbers?: string
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  customer: string
  customerId: number | null
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  itemCount: number
  items: SaleItem[]
  notes: string | null
}

interface SalesReportData {
  sales: Sale[]
  summary: {
    totalSales: number
    totalRevenue: number
    totalSubtotal: number
    totalTax: number
    totalDiscount: number
    totalShipping: number
    // These may be omitted by the API when user lacks permissions
    totalCOGS?: number
    grossProfit?: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export default function SalesReportPage() {
  const { can } = usePermissions()
  const dataGridRef = useRef<DataGrid>(null)

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view reports</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [customerSearch, setCustomerSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [page, setPage] = useState(1)
  const [datePreset, setDatePreset] = useState<string>("Today")
  const [limit] = useState(50)

  // Data for dropdowns
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<Array<{ id: number | null; name: string; mobile?: string }>>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)

  // Set initial dates on client side to ensure Philippines timezone
  useEffect(() => {
    // Calculate date range in Philippines timezone on client
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const year = nowPH.getFullYear()
    const month = nowPH.getMonth()
    const day = nowPH.getDate()

    const formatDate = (y: number, m: number, d: number) =>
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    // Default to "Today" preset
    const todayStr = formatDate(year, month, day)
    setStartDate(todayStr)
    setEndDate(todayStr)
    setDatePreset("Today")
  }, [])

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [page])

  // Auto-fetch when location changes (helps cashier pages show data immediately)
  useEffect(() => {
    if (locations.length > 0) {
      setPage(1)
      fetchReport()
    }
  }, [locationId, locations.length])

  // Refetch when date range changes via preset
  useEffect(() => {
    if (startDate || endDate) {
      setPage(1)
      fetchReport()
    }
  }, [startDate, endDate])

  const fetchLocations = async () => {
    try {
      let list: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      // Try user-scoped endpoint first (role-aware)
      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          list = Array.isArray(ul.locations) ? ul.locations : []
          accessAll = Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
        }
      } catch (e) {
        console.warn('Failed to load /api/user-locations, falling back to /api/locations', e)
      }

      // Fallback to business-wide locations
      if (!list.length) {
        const response = await fetch('/api/locations')
        if (response.ok) {
          const data = await response.json()
          list = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          accessAll = true
        }
      }

      // Exclude warehouses defensively
      const filtered = list.filter((loc: any) => loc?.name && !loc.name.toLowerCase().includes('warehouse'))
      setLocations(filtered)
      setHasAccessToAll(accessAll)

      // For restricted users, auto-select a sensible default
      if (!accessAll) {
        const resolved = primaryLocationId || (filtered[0]?.id ? String(filtered[0].id) : 'all')
        setLocationId(resolved)
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchCustomers = async (searchTerm = "") => {
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(searchTerm)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const parsedCustomers =
          Array.isArray(data)
            ? data
            : Array.isArray(data.customers)
              ? data.customers
              : Array.isArray(data.data)
                ? data.data
                : []

        // Add "Walk-in Customer" as a special suggestion
        const suggestions = [...parsedCustomers]
        if (searchTerm.toLowerCase().includes('walk') || searchTerm === '') {
          suggestions.unshift({ id: null, name: 'Walk-in Customer', mobile: 'N/A' })
        }

        setCustomerSuggestions(suggestions)
      } else {
        console.error('Customer API error:', response.status, response.statusText)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      setCustomerSuggestions([])
    }
  }

  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value)
    if (value.length >= 1) {
      fetchCustomers(value)
      setShowCustomerSuggestions(true)
    } else {
      setCustomerSuggestions([])
      setShowCustomerSuggestions(false)
    }
  }

  const selectCustomer = (customer: { id: number | null; name: string }) => {
    setCustomerSearch(customer.name)
    setShowCustomerSuggestions(false)
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())

      if (locationId !== "all") params.append("locationId", locationId)
      if (customerSearch.trim()) params.append("customerSearch", customerSearch.trim())
      if (status !== "all") params.append("status", status)
      if (invoiceNumber) params.append("invoiceNumber", invoiceNumber)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (minAmount) params.append("minAmount", minAmount)
      if (maxAmount) params.append("maxAmount", maxAmount)

      const response = await fetch(`/api/reports/sales?${params.toString()}`)
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
    setCustomerSearch("")
    setStatus("all")
    setInvoiceNumber("")
    setStartDate("")
    setEndDate("")
    setMinAmount("")
    setMaxAmount("")
    setDatePreset("Today")
    setPage(1)
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const applyDatePreset = (preset: string) => {
    // Use the shared Philippines timezone utility for consistent date calculations
    const range = getDatePresetRangePH(preset as DatePreset)
    if (range) {
      setStartDate(range.startDate)
      setEndDate(range.endDate)
    }
    setDatePreset(preset)
  }

  const activeFilterCount = useMemo(
    () =>
      countActiveFilters([
        () => locationId !== "all",
        () => customerSearch.trim() !== "",
        () => status !== "all",
        () => invoiceNumber.trim() !== "",
        () => Boolean(startDate || endDate),
        () => Boolean(minAmount || maxAmount),
      ]),
    [locationId, customerSearch, status, invoiceNumber, startDate, endDate, minAmount, maxAmount]
  )

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Report')

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
          `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const formatCurrency = (amount?: number) => {
    const n = Number(amount)
    if (!Number.isFinite(n)) return "—"
    return `₱${n.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const hasNumericValue = (value?: number) => Number.isFinite(Number(value))

  const renderStatusBadge = (cellData: any) => {
    const status = cellData.value?.toLowerCase() || ''
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      voided: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variants[status] || "bg-gray-100 text-gray-800"}`}>
        {status.toUpperCase()}
      </span>
    )
  }

  // Master detail template - shows sale items
  const MasterDetailTemplate = (props: any) => {
    const sale = props.data?.data || props.data

    if (!sale || !sale.items || !Array.isArray(sale.items)) {
      return (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
          <p className="text-yellow-800 dark:text-yellow-200">
            No item details available for this sale.
          </p>
        </div>
      )
    }

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Sale Items ({sale.items.length} item{sale.items.length !== 1 ? 's' : ''})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Product
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  SKU
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Qty
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Price
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Discount
                </th>
                {can(PERMISSIONS.SELL_VIEW_COST) && (
                  <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                    Cost
                  </th>
                )}
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Total
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Serial Numbers
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sale.items.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                    {item.productName} ({item.variationName})
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {item.sku}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.discountAmount > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">
                        -{formatCurrency(item.discountAmount)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  {can(PERMISSIONS.SELL_VIEW_COST) && (
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(item.unitCost)}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 text-xs">
                    {item.serialNumbers || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Invoice Details</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive sales analysis with filtering
          </p>
        </div>
      </div>

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleReset}
        clearLabel="Reset Filters"
        description="Filter the sales dataset by location, customer, status, date range, and amount thresholds."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {hasAccessToAll && (
                  <SelectItem value="all">All Locations</SelectItem>
                )}
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Date Range Preset</Label>
            <Select value={datePreset} onValueChange={applyDatePreset}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="Today" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Today">Today</SelectItem>
                <SelectItem value="Yesterday">Yesterday</SelectItem>
                <SelectItem value="This Week">This Week</SelectItem>
                <SelectItem value="Last Week">Last Week</SelectItem>
                <SelectItem value="This Month">This Month</SelectItem>
                <SelectItem value="Last Month">Last Month</SelectItem>
                <SelectItem value="This Quarter">This Quarter</SelectItem>
                <SelectItem value="Last Quarter">Last Quarter</SelectItem>
                <SelectItem value="This Year">This Year</SelectItem>
                <SelectItem value="Last Year">Last Year</SelectItem>
                <SelectItem value="Last 30 Days">Last 30 Days</SelectItem>
                <SelectItem value="Last 90 Days">Last 90 Days</SelectItem>
                <SelectItem value="Custom Range">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Customer</Label>
            <Input
              placeholder="Search customer by name..."
              value={customerSearch}
              onChange={(e) => handleCustomerSearch(e.target.value)}
              onFocus={() => {
                if (customerSuggestions.length > 0) {
                  setShowCustomerSuggestions(true)
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow clicking on them
                setTimeout(() => setShowCustomerSuggestions(false), 200)
              }}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {showCustomerSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                {customerSuggestions.map((customer, index) => (
                  <div
                    key={customer.id || `walkin-${index}`}
                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                    {customer.mobile && customer.mobile !== 'N/A' && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">{customer.mobile}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Invoice Number</Label>
            <Input
              placeholder="Search invoice..."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Min Amount</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <Label className="mb-2 block text-gray-700 dark:text-gray-300">Max Amount</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
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
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Sales</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.summary.totalSales}</div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(reportData.summary.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          {can(PERMISSIONS.SELL_VIEW_COST) && hasNumericValue(reportData.summary.totalCOGS) && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total COGS</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(reportData.summary.totalCOGS)}
                </div>
              </CardContent>
            </Card>
          )}
          {can(PERMISSIONS.SELL_VIEW_PROFIT) && hasNumericValue(reportData.summary.grossProfit) && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Gross Profit</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(reportData.summary.grossProfit)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Data Grid */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">
            Sales Transactions
            {reportData && ` (${reportData.pagination.totalCount} total)`}
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
              <StateStoring enabled={true} type="localStorage" storageKey="sales-report-grid-v2" />
              <SearchPanel visible={true} width={240} placeholder="Search sales..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Sorting mode="multiple" />

              <Paging defaultPageSize={10} />
              <Pager
                visible={true}
                displayMode="full"
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
                dataField="notes"
                caption="Remarks"
                minWidth={150}
                cellRender={(cellData: any) => {
                  const notes = cellData.value
                  if (!notes) return <span className="text-gray-400">-</span>
                  return (
                    <span className="text-gray-700 dark:text-gray-300 text-sm" title={notes}>
                      {notes.length > 30 ? notes.substring(0, 30) + '...' : notes}
                    </span>
                  )
                }}
              />
              <Column
                dataField="saleDate"
                caption="Date"
                dataType="date"
                format="MM/dd/yyyy"
                width={120}
              />
              <Column
                dataField="customer"
                caption="Customer"
                minWidth={150}
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
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  variant="outline"
                  className="hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === reportData.pagination.totalPages}
                  variant="outline"
                  className="hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
