"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import ReportFilterPanel from "@/components/reports/ReportFilterPanel"
import { countActiveFilters } from "@/lib/reportFilterUtils"

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

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have permission to view reports</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

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

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
    // Default date range so results show immediately
    applyDatePreset("This Year")
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
    const today = new Date()
    const start = new Date()
    const end = new Date()

    const startOfWeek = (d: Date) => {
      const date = new Date(d)
      const day = date.getDay() || 7
      if (day !== 1) date.setHours(-24 * (day - 1))
      date.setHours(0, 0, 0, 0)
      return date
    }
    const endOfWeek = (d: Date) => {
      const date = startOfWeek(d)
      date.setDate(date.getDate() + 6)
      date.setHours(23, 59, 59, 999)
      return date
    }

    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    const endOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0)
    const startOfYear = (y: number) => new Date(y, 0, 1)
    const endOfYear = (y: number) => new Date(y, 11, 31)

    switch (preset) {
      case "Today":
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "Yesterday":
        start.setDate(today.getDate() - 1)
        end.setDate(today.getDate() - 1)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "This Week":
        start.setTime(startOfWeek(today).getTime())
        end.setTime(endOfWeek(today).getTime())
        break
      case "Last Week":
        const lw = new Date(today)
        lw.setDate(lw.getDate() - 7)
        start.setTime(startOfWeek(lw).getTime())
        end.setTime(endOfWeek(lw).getTime())
        break
      case "This Month":
        start.setTime(startOfMonth(today).getTime())
        end.setTime(endOfMonth(today).getTime())
        break
      case "Last Month":
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        start.setTime(startOfMonth(lm).getTime())
        end.setTime(endOfMonth(lm).getTime())
        break
      case "This Quarter":
        start.setTime(startOfQuarter(today).getTime())
        end.setTime(endOfQuarter(today).getTime())
        break
      case "Last Quarter":
        const lq = new Date(today.getFullYear(), today.getMonth() - 3, 1)
        start.setTime(startOfQuarter(lq).getTime())
        end.setTime(endOfQuarter(lq).getTime())
        break
      case "This Year":
        start.setTime(startOfYear(today.getFullYear()).getTime())
        end.setTime(endOfYear(today.getFullYear()).getTime())
        break
      case "Last Year":
        start.setTime(startOfYear(today.getFullYear() - 1).getTime())
        end.setTime(endOfYear(today.getFullYear() - 1).getTime())
        break
      case "Last 30 Days":
        start.setDate(today.getDate() - 29)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "Last 90 Days":
        start.setDate(today.getDate() - 89)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      default:
        return
    }

    const toISODate = (d: Date) => d.toISOString().slice(0, 10)
    setStartDate(toISODate(start))
    setEndDate(toISODate(end))
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

  const exportToCSV = () => {
    if (!reportData) return

    const headers = [
      "Invoice",
      "Date",
      "Customer",
      "Status",
      "Subtotal",
      "Tax",
      "Discount",
      "Shipping",
      "Total",
    ]

    const rows = reportData.sales.map((sale) => [
      sale.invoiceNumber,
      sale.saleDate,
      sale.customer,
      sale.status,
      sale.subtotal,
      sale.taxAmount,
      sale.discountAmount,
      sale.shippingCost,
      sale.totalAmount,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const toggleRowExpansion = (saleId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId)
    } else {
      newExpanded.add(saleId)
    }
    setExpandedRows(newExpanded)
  }

  const formatCurrency = (amount?: number) => {
    const n = Number(amount)
    if (!Number.isFinite(n)) return "—"
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  }

  const hasNumericValue = (value?: number) => Number.isFinite(Number(value))

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      draft: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
    }

    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Invoice Details</h1>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive sales analysis with filtering
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={exportToCSV}
            disabled={!reportData}
            className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
            <Label className="mb-2 block">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
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
            <Label className="mb-2 block">Date Range Preset</Label>
            <Select value={datePreset} onValueChange={applyDatePreset}>
              <SelectTrigger>
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
            <Label className="mb-2 block">Customer</Label>
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
            />
            {showCustomerSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {customerSuggestions.map((customer, index) => (
                  <div
                    key={customer.id || `walkin-${index}`}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="font-medium">{customer.name}</div>
                    {customer.mobile && customer.mobile !== 'N/A' && (
                      <div className="text-sm text-gray-500">{customer.mobile}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Invoice Number</Label>
            <Input
              placeholder="Search invoice..."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">Min Amount</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">Max Amount</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 flex-wrap">
          <Button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-6 rounded-lg"
          >
            <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button
            onClick={exportToCSV}
            disabled={!reportData}
            className="bg-green-600 hover:bg-green-700 text-white shadow-sm px-6 rounded-lg"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
          <Button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm px-6 rounded-lg"
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            Print Report
          </Button>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="shadow-sm px-6"
          >
            Reset All Filters
          </Button>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Sales</div>
              <div className="text-2xl font-bold">{reportData.summary.totalSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold">
                {formatCurrency(reportData.summary.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          {can(PERMISSIONS.SELL_VIEW_COST) && hasNumericValue(reportData.summary.totalCOGS) && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total COGS</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(reportData.summary.totalCOGS)}
                </div>
              </CardContent>
            </Card>
          )}
          {can(PERMISSIONS.SELL_VIEW_PROFIT) && hasNumericValue(reportData.summary.grossProfit) && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Gross Profit</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.summary.grossProfit)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
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
            <div className="text-center py-8 text-gray-500">No sales found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.sales.map((sale) => (
                      <>
                        <TableRow key={sale.id} className="cursor-pointer hover:bg-gray-50">
                          <TableCell className="font-medium">
                            <Link
                              href={`/dashboard/sales/${sale.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {sale.invoiceNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{sale.saleDate}</TableCell>
                          <TableCell>{sale.customer}</TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          <TableCell className="text-right">{sale.itemCount}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sale.subtotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sale.taxAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => toggleRowExpansion(sale.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 shadow-sm"
                            >
                              {expandedRows.has(sale.id) ? "Hide" : "Show"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(sale.id) && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-gray-50">
                              <div className="p-4">
                                <h4 className="font-semibold mb-2">Sale Items</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Product</TableHead>
                                      <TableHead>SKU</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Price</TableHead>
                                      {can(PERMISSIONS.SELL_VIEW_COST) && (
                                        <TableHead className="text-right">Cost</TableHead>
                                      )}
                                      <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sale.items.map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>
                                          {item.productName} ({item.variationName})
                                        </TableCell>
                                        <TableCell>{item.sku}</TableCell>
                                        <TableCell className="text-right">
                                          {item.quantity}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(item.unitPrice)}
                                        </TableCell>
                                        {can(PERMISSIONS.SELL_VIEW_COST) && (
                                          <TableCell className="text-right">
                                            {formatCurrency(item.unitCost)}
                                          </TableCell>
                                        )}
                                        <TableCell className="text-right">
                                          {formatCurrency(item.total)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {reportData && reportData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    Page {reportData.pagination.page} of {reportData.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium border-2 border-blue-700 hover:border-blue-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium border-2 border-blue-700 hover:border-blue-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
