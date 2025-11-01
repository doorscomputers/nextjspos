"use client"

import { useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
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

  if (!can(PERMISSIONS.REPORT_SALES_HISTORY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have permission to view reports</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesHistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [customerId, setCustomerId] = useState("all")
  const [status, setStatus] = useState("all")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("all")
  const [dateRange, setDateRange] = useState("custom")

  // Sorting states
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Data for dropdowns
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
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
    try {
      let list: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      // Role-aware: try user-locations first
      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          const raw = Array.isArray(ul.locations) ? ul.locations : []
          list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
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
          const locs = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          list = locs.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = true
        }
      }

      setLocations(list)
      setHasAccessToAll(accessAll)

      // For restricted users, auto-select assigned/first location
      if (!accessAll) {
        const resolved = primaryLocationId || (list[0]?.id ? String(list[0].id) : 'all')
        setLocationId(resolved)
        const found = list.find((l: any) => String(l.id) === String(resolved))
        if (found) setEnforcedLocationName(found.name)
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
      setLocations([])
      setHasAccessToAll(false)
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
    setDateRange("custom")
    setSortBy("createdAt")
    setSortOrder("desc")
    setPage(1)
    fetchReport()
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
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

  const exportToCSV = () => {
    if (!reportData) return

    const headers = [
      "Invoice",
      "Date",
      "Customer",
      "Location",
      "Status",
      "Subtotal",
      "Tax",
      "Discount",
      "Shipping",
      "Total",
      "Payment Methods",
    ]

    const rows = reportData.sales.map((sale) => [
      sale.invoiceNumber,
      sale.saleDate,
      sale.customer,
      sale.location,
      sale.status,
      sale.subtotal,
      sale.taxAmount,
      sale.discountAmount,
      sale.shippingCost,
      sale.totalAmount,
      sale.payments.map((p) => `${p.method}:${p.amount}`).join("; "),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-history-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      draft: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
      voided: "bg-red-100 text-red-800",
    }

    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null
    return sortOrder === "asc" ? (
      <ArrowUpIcon className="h-4 w-4 inline ml-1" />
    ) : (
      <ArrowDownIcon className="h-4 w-4 inline ml-1" />
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales History per Location</h1>
          <p className="text-sm text-gray-600 mt-1">
            Complete sales transaction history filtered by your assigned location(s)
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="shadow-sm"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
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
            <Label>Quick Date Range</Label>
            <Select value={dateRange} onValueChange={(val) => {
              setDateRange(val)
              if (val !== "custom") {
                setStartDate("")
                setEndDate("")
              }
            }}>
              <SelectTrigger>
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
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value) setDateRange("custom")
              }}
              disabled={dateRange !== "custom"}
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                if (e.target.value) setDateRange("custom")
              }}
              disabled={dateRange !== "custom"}
            />
          </div>
          {/* Location (hidden and enforced in cashier mode) */}
          {isCashierMode ? (
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <div className="px-3 py-2 bg-blue-50 rounded-md border border-blue-200 text-sm font-semibold text-blue-900">
                {enforcedLocationName || 'Assigned Location'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
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
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
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
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
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
            <Label>Invoice Number</Label>
            <Input
              placeholder="Search invoice..."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          {/* Product Search */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <Label>Product Name / SKU</Label>
            <Input
              placeholder="Search by product name or SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
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
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Sales</div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalSales}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(reportData.summary.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total COGS</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(reportData.summary.totalCOGS)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Gross Profit</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(reportData.summary.grossProfit)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
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
            <div className="text-center py-8 text-gray-500">No sales found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("invoiceNumber")}
                      >
                        Invoice <SortIcon column="invoiceNumber" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("saleDate")}
                      >
                        Date <SortIcon column="saleDate" />
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("totalAmount")}
                      >
                        Total <SortIcon column="totalAmount" />
                      </TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.sales.map((sale) => (
                      <>
                        <TableRow key={sale.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {sale.invoiceNumber}
                          </TableCell>
                          <TableCell>{sale.saleDate}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{sale.customer}</span>
                              {sale.customerMobile && (
                                <span className="text-xs text-gray-500">
                                  {sale.customerMobile}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{sale.location}</TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          <TableCell className="text-right">{sale.itemCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {sale.payments.map((payment, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {payment.method}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(sale.id)}
                            >
                              {expandedRows.has(sale.id) ? "Hide" : "Show"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(sale.id) && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-gray-50">
                              <div className="p-4 space-y-4">
                                {/* Sale Items */}
                                <div>
                                  <h4 className="font-semibold mb-2">Sale Items</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
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
                                          <TableCell className="text-right">
                                            {formatCurrency(item.total)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Payment Details */}
                                <div>
                                  <h4 className="font-semibold mb-2">Payment Details</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {sale.payments.map((payment, idx) => (
                                      <div key={idx} className="p-2 bg-white rounded border">
                                        <div className="text-sm font-medium">
                                          {payment.method.toUpperCase()}
                                        </div>
                                        <div className="text-lg font-bold">
                                          {formatCurrency(payment.amount)}
                                        </div>
                                        {payment.referenceNumber && (
                                          <div className="text-xs text-gray-500">
                                            Ref: {payment.referenceNumber}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Notes */}
                                {sale.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-gray-600">{sale.notes}</p>
                                  </div>
                                )}
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
                    {" "}({reportData.pagination.total} total records)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages}
                    >
                      Next
                      <ChevronRightIcon className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
