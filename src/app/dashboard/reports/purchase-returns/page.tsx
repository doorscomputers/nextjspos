"use client"

import React, { useState, useEffect, useMemo } from "react"
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
  EyeIcon,
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
import { toast } from "sonner"
import Link from "next/link"

interface ReturnItem {
  productName: string
  variationName: string
  sku: string
  quantity: number
  unitCost: number
  condition: string
  serialNumbers: any
  notes: string | null
  total: number
}

interface PurchaseReturn {
  id: number
  returnNumber: string
  returnDate: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  location: string
  locationId: number
  status: string
  returnReason: string
  totalAmount: number
  notes: string | null
  itemCount: number
  createdAt: string
  approvedAt: string | null
  items: ReturnItem[]
}

interface PurchaseReturnsData {
  returns: PurchaseReturn[]
  summary: {
    totalReturns: number
    totalAmount: number
    totalItems: number
    pendingReturns: number
    approvedReturns: number
  }
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export default function PurchaseReturnsReportPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have permission to view this report</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<PurchaseReturnsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [supplierId, setSupplierId] = useState("all")
  const [status, setStatus] = useState("all")
  const [returnReason, setReturnReason] = useState("all")
  const [returnNumber, setReturnNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [dateRange, setDateRange] = useState("allTime") // Default to all time to show all data

  // Sorting states
  const [sortBy, setSortBy] = useState("returnDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Data for dropdowns
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    fetchLocations()
    fetchSuppliers()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [page, sortBy, sortOrder])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        const locationsList = data.locations || data
        setLocations(locationsList)
        // Don't auto-select first location - keep it as "all"
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      if (response.ok) {
        const data = await response.json()
        const suppliersList = data.suppliers || data || []
        setSuppliers(Array.isArray(suppliersList) ? suppliersList : [])
      } else {
        console.warn("Failed to fetch suppliers:", response.statusText)
        setSuppliers([])
      }
    } catch (error) {
      console.error("Failed to fetch suppliers:", error)
      setSuppliers([])
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())
      params.append("sortBy", sortBy)
      params.append("sortOrder", sortOrder)

      if (locationId !== "all") params.append("locationId", locationId)
      if (supplierId !== "all") params.append("supplierId", supplierId)
      if (status !== "all") params.append("status", status)
      if (returnReason !== "all") params.append("returnReason", returnReason)
      if (returnNumber) params.append("returnNumber", returnNumber)
      if (productSearch) params.append("productSearch", productSearch)

      if (dateRange && dateRange !== "custom" && dateRange !== "allTime") {
        params.append("dateRange", dateRange)
      } else if (dateRange === "custom") {
        if (startDate) params.append("startDate", startDate)
        if (endDate) params.append("endDate", endDate)
      }
      // If dateRange is "allTime", don't add any date params to fetch all data

      const response = await fetch(`/api/reports/purchase-returns?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load report' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()
      setReportData(data)
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch report:", err)
      const errorMessage = err.message || "Failed to load purchase returns report"
      setError(errorMessage)
      toast.error(errorMessage)

      // Set empty data to prevent rendering issues
      setReportData({
        returns: [],
        summary: {
          totalReturns: 0,
          totalAmount: 0,
          totalItems: 0,
          pendingReturns: 0,
          approvedReturns: 0,
        },
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
      })
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
    setSupplierId("all")
    setStatus("all")
    setReturnReason("all")
    setReturnNumber("")
    setStartDate("")
    setEndDate("")
    setProductSearch("")
    setDateRange("allTime") // Reset to show all data
    setSortBy("returnDate")
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

  const toggleRowExpansion = (returnId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(returnId)) {
      newExpanded.delete(returnId)
    } else {
      newExpanded.add(returnId)
    }
    setExpandedRows(newExpanded)
  }

  const exportToCSV = () => {
    if (!reportData) return

    const headers = [
      "Return #",
      "Date",
      "Supplier",
      "Location",
      "Reason",
      "Status",
      "Items",
      "Total Amount",
    ]

    const rows = reportData.returns.map((ret) => [
      ret.returnNumber,
      ret.returnDate,
      ret.supplier.name,
      ret.location,
      ret.returnReason,
      ret.status,
      ret.itemCount,
      ret.totalAmount,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `purchase-returns-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
    }

    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const getReasonBadge = (reason: string) => {
    const variants: Record<string, string> = {
      warranty: "bg-blue-100 text-blue-800",
      defective: "bg-red-100 text-red-800",
      damaged: "bg-orange-100 text-orange-800",
    }

    return (
      <Badge className={variants[reason] || "bg-gray-100 text-gray-800"}>
        {reason.toUpperCase()}
      </Badge>
    )
  }

  const getConditionBadge = (condition: string) => {
    const variants: Record<string, string> = {
      damaged: "bg-orange-100 text-orange-800",
      defective: "bg-red-100 text-red-800",
      warranty_claim: "bg-blue-100 text-blue-800",
    }

    const labels: Record<string, string> = {
      damaged: "Damaged",
      defective: "Defective",
      warranty_claim: "Warranty",
    }

    return (
      <Badge className={variants[condition] || "bg-gray-100 text-gray-800"}>
        {labels[condition] || condition}
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

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (locationId !== "all") count += 1
    if (supplierId !== "all") count += 1
    if (status !== "all") count += 1
    if (returnReason !== "all") count += 1
    if (returnNumber.trim() !== "") count += 1
    if (productSearch.trim() !== "") count += 1
    if (dateRange !== "custom" && dateRange !== "allTime") count += 1
    if (dateRange === "custom" && startDate) count += 1
    if (dateRange === "custom" && endDate) count += 1
    if (sortBy !== "returnDate" || sortOrder !== "desc") count += 1
    return count
  }, [
    locationId,
    supplierId,
    status,
    returnReason,
    returnNumber,
    productSearch,
    dateRange,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Purchase Returns Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Track supplier returns for damaged, defective, and warranty items
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="shadow-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">{showFilters ? "Hide" : "Show"} Filters</span>
          </Button>
          <Button
            onClick={exportToCSV}
            disabled={!reportData || reportData.returns.length === 0}
            className="shadow-sm bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="shadow-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 font-medium"
          >
            <PrinterIcon className="h-5 w-5 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Report</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <Button
                  onClick={fetchReport}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleReset}
        clearLabel="Reset All Filters"
        description="Refine purchase returns data by date ranges, supplier, location, status, and product filters."
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
                <SelectItem value="allTime">All Time</SelectItem>
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

          {/* Location */}
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

          {/* Supplier */}
          <div className="flex flex-col gap-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Return Reason */}
          <div className="flex flex-col gap-2">
            <Label>Return Reason</Label>
            <Select value={returnReason} onValueChange={setReturnReason}>
              <SelectTrigger>
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="warranty">Warranty</SelectItem>
                <SelectItem value="defective">Defective</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Return Number */}
          <div className="flex flex-col gap-2">
            <Label>Return Number</Label>
            <Input
              placeholder="Search return number..."
              value={returnNumber}
              onChange={(e) => setReturnNumber(e.target.value)}
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
            className="shadow-sm px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base h-11"
            disabled={loading}
          >
            <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="shadow-sm px-8 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 font-medium text-base h-11"
            disabled={loading}
          >
            Reset All Filters
          </Button>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Returns</div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalReturns}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Amount</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(reportData.summary.totalAmount)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Items</div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalItems}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">
                {reportData.summary.pendingReturns}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Approved</div>
              <div className="text-2xl font-bold text-green-600">
                {reportData.summary.approvedReturns}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Purchase Returns
            {reportData && ` (${reportData.pagination.total} total)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : reportData?.returns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No returns found</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("returnNumber")}
                      >
                        Return # <SortIcon column="returnNumber" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("returnDate")}
                      >
                        Date <SortIcon column="returnDate" />
                      </TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("totalAmount")}
                      >
                        Total <SortIcon column="totalAmount" />
                      </TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.returns.map((ret) => (
                      <React.Fragment key={ret.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {ret.returnNumber}
                          </TableCell>
                          <TableCell>{ret.returnDate}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{ret.supplier.name}</span>
                              {ret.supplier.mobile && (
                                <span className="text-xs text-gray-500">
                                  {ret.supplier.mobile}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{ret.location}</TableCell>
                          <TableCell>{getReasonBadge(ret.returnReason)}</TableCell>
                          <TableCell>{getStatusBadge(ret.status)}</TableCell>
                          <TableCell className="text-right">{ret.itemCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(ret.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Link href={`/dashboard/supplier-returns/${ret.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <EyeIcon className="h-4 w-4" />
                                View{ret.status === 'pending' ? ' / Approve' : ''}
                              </Button>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(ret.id)}
                            >
                              {expandedRows.has(ret.id) ? "Hide" : "Show"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(ret.id) && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-gray-50">
                              <div className="p-4 space-y-4">
                                {/* Return Items */}
                                <div>
                                  <h4 className="font-semibold mb-2">Return Items</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Condition</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {ret.items.map((item, idx) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            {item.productName} ({item.variationName})
                                          </TableCell>
                                          <TableCell>{item.sku}</TableCell>
                                          <TableCell>
                                            {getConditionBadge(item.condition)}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {item.quantity}
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

                                {/* Notes */}
                                {ret.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-gray-600">{ret.notes}</p>
                                  </div>
                                )}

                                {/* Approval Info */}
                                {ret.approvedAt && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Approval Information</h4>
                                    <p className="text-sm text-gray-600">
                                      Approved on: {new Date(ret.approvedAt).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
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
