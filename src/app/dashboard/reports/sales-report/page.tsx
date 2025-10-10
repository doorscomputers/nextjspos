"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
    totalCOGS: number
    grossProfit: number
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
  const [customerId, setCustomerId] = useState("all")
  const [status, setStatus] = useState("all")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Data for dropdowns
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [page])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || data)
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers")
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || data)
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

      if (locationId !== "all") params.append("locationId", locationId)
      if (customerId !== "all") params.append("customerId", customerId)
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
    setCustomerId("all")
    setStatus("all")
    setInvoiceNumber("")
    setStartDate("")
    setEndDate("")
    setMinAmount("")
    setMaxAmount("")
    setPage(1)
    fetchReport()
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive sales analysis with filtering
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
          <Button onClick={exportToCSV} disabled={!reportData}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
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

              <div>
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

              <div>
                <Label>Status</Label>
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
                <Label>Invoice Number</Label>
                <Input
                  placeholder="Search invoice..."
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Min Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              <div>
                <Label>Max Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSearch}>
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total COGS</div>
              <div className="text-2xl font-bold">
                {formatCurrency(reportData.summary.totalCOGS)}
              </div>
            </CardContent>
          </Card>
          <Card>
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
                            {sale.invoiceNumber}
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
                              <div className="p-4">
                                <h4 className="font-semibold mb-2">Sale Items</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Product</TableHead>
                                      <TableHead>SKU</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Price</TableHead>
                                      <TableHead className="text-right">Cost</TableHead>
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
                                          {formatCurrency(item.unitCost)}
                                        </TableCell>
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
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages}
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
