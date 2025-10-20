"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ExportButtons } from "@/components/reports/ExportButtons"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"
import ReportFilterPanel from "@/components/reports/ReportFilterPanel"
import { countActiveFilters } from "@/lib/reportFilterUtils"

interface PurchaseReportData {
  purchases: any[]
  summary: {
    totalPurchases: number
    totalAmount: number
    totalSubtotal: number
    totalTax: number
    totalDiscount: number
    totalShipping: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export default function PurchasesReportPage() {
  const [reportData, setReportData] = useState<PurchaseReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(true)

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [supplierId, setSupplierId] = useState("all")
  const [status, setStatus] = useState("all")
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Dropdown data
  const [locations, setLocations] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  useEffect(() => {
    fetchLocations()
    fetchSuppliers()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [page])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      const data = await response.json()
      setLocations(data.locations || data)
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      const data = await response.json()
      setSuppliers(data.suppliers || data)
    } catch (error) {
      console.error("Failed to fetch suppliers:", error)
      setSuppliers([])
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())

      if (locationId !== "all") params.append("locationId", locationId)
      if (supplierId !== "all") params.append("supplierId", supplierId)
      if (status !== "all") params.append("status", status)
      if (purchaseOrderNumber) params.append("purchaseOrderNumber", purchaseOrderNumber)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (minAmount) params.append("minAmount", minAmount)
      if (maxAmount) params.append("maxAmount", maxAmount)

      const response = await fetch(`/api/reports/purchases?${params.toString()}`)
      const data = await response.json()
      setReportData(data)
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
    setSupplierId("all")
    setStatus("all")
    setPurchaseOrderNumber("")
    setStartDate("")
    setEndDate("")
    setMinAmount("")
    setMaxAmount("")
    setPage(1)
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const activeFilterCount = useMemo(
    () =>
      countActiveFilters([
        () => locationId !== "all",
        () => supplierId !== "all",
        () => status !== "all",
        () => purchaseOrderNumber.trim() !== "",
        () => Boolean(startDate || endDate),
        () => Boolean(minAmount || maxAmount),
      ]),
    [locationId, supplierId, status, purchaseOrderNumber, startDate, endDate, minAmount, maxAmount]
  )

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const getExportData = () => {
    if (!reportData) return { headers: [], data: [] }

    const headers = [
      "PO Number",
      "Date",
      "Expected Delivery",
      "Supplier",
      "Contact Person",
      "Status",
      "Items",
      "Qty Ordered",
      "Qty Received",
      "Subtotal",
      "Tax",
      "Discount",
      "Shipping",
      "Total",
      "Receipts"
    ]

    const data = reportData.purchases.map((purchase) => [
      purchase.purchaseOrderNumber,
      purchase.purchaseDate,
      purchase.expectedDeliveryDate || "N/A",
      purchase.supplier,
      purchase.contactPerson || "N/A",
      purchase.status,
      purchase.itemCount,
      purchase.totalOrdered,
      purchase.totalReceived,
      purchase.subtotal.toFixed(2),
      purchase.taxAmount.toFixed(2),
      purchase.discountAmount.toFixed(2),
      purchase.shippingCost.toFixed(2),
      purchase.totalAmount.toFixed(2),
      purchase.receiptCount
    ])

    return { headers, data }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      SUBMITTED: "bg-blue-100 text-blue-800",
      APPROVED: "bg-green-100 text-green-800",
      PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-800",
      RECEIVED: "bg-green-100 text-green-800",
      COMPLETED: "bg-purple-100 text-purple-800",
      CANCELLED: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchases Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive view of all purchase orders with filtering and export
          </p>
        </div>
        <ExportButtons
          data={getExportData().data}
          headers={getExportData().headers}
          filename={`purchases-report-${new Date().toISOString().split("T")[0]}`}
          title="Purchases Report"
          disabled={!reportData || reportData.purchases.length === 0}
        />
      </div>

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleReset}
        clearLabel="Reset Filters"
        description="Narrow purchase orders by location, supplier, status, PO number, date range, and amount limits."
        contentClassName="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Supplier</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue />
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

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium mb-2">PO Number</label>
                <Input
                  type="text"
                  placeholder="Search PO number..."
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">Min Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">Max Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            size="default"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                Apply Filters
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
            className="border-gray-300 hover:bg-gray-50"
            size="default"
          >
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            Reset Filters
          </Button>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Purchases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reportData.summary.totalPurchases}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Subtotal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalSubtotal)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tax
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalTax)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Discount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatNumber(reportData.summary.totalDiscount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Shipping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalShipping)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reportData && reportData.purchases.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">PO Number</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Expected Delivery</th>
                      <th className="text-left p-3 font-medium">Supplier</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Items</th>
                      <th className="text-right p-3 font-medium">Qty Ordered</th>
                      <th className="text-right p-3 font-medium">Qty Received</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Receipts</th>
                      <th className="text-center p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.purchases.map((purchase) => (
                      <>
                        <tr key={purchase.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">
                            <Link
                              href={`/dashboard/purchases/${purchase.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {purchase.purchaseOrderNumber}
                            </Link>
                          </td>
                          <td className="p-3">{purchase.purchaseDate}</td>
                          <td className="p-3">{purchase.expectedDeliveryDate || "N/A"}</td>
                          <td className="p-3">{purchase.supplier}</td>
                          <td className="p-3">
                            <Badge className={getStatusColor(purchase.status)}>
                              {purchase.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">{purchase.itemCount}</td>
                          <td className="p-3 text-right">{purchase.totalOrdered}</td>
                          <td className="p-3 text-right">{purchase.totalReceived}</td>
                          <td className="p-3 text-right font-medium">
                            {formatNumber(purchase.totalAmount)}
                          </td>
                          <td className="p-3 text-right">{purchase.receiptCount}</td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(purchase.id)}
                            >
                              {expandedRows.has(purchase.id) ? (
                                <ChevronUpIcon className="w-4 h-4" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        {expandedRows.has(purchase.id) && (
                          <tr>
                            <td colSpan={11} className="p-4 bg-muted/30">
                              <div className="space-y-4">
                                {/* Purchase Items */}
                                <div>
                                  <h4 className="font-semibold mb-2">Purchase Items</h4>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-2">Product</th>
                                        <th className="text-left p-2">Variation</th>
                                        <th className="text-left p-2">SKU</th>
                                        <th className="text-right p-2">Ordered</th>
                                        <th className="text-right p-2">Received</th>
                                        <th className="text-right p-2">Unit Cost</th>
                                        <th className="text-right p-2">Total</th>
                                        <th className="text-center p-2">Serial?</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {purchase.items.map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b">
                                          <td className="p-2">{item.productName}</td>
                                          <td className="p-2">{item.variationName}</td>
                                          <td className="p-2">{item.sku}</td>
                                          <td className="p-2 text-right">{item.quantity}</td>
                                          <td className="p-2 text-right">{item.quantityReceived}</td>
                                          <td className="p-2 text-right">{formatNumber(item.unitCost)}</td>
                                          <td className="p-2 text-right">{formatNumber(item.total)}</td>
                                          <td className="p-2 text-center">
                                            {item.requiresSerial ? "Yes" : "No"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Receipts */}
                                {purchase.receipts.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Goods Received Notes (GRN)</h4>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left p-2">Receipt Number</th>
                                          <th className="text-left p-2">Status</th>
                                          <th className="text-left p-2">Received At</th>
                                          <th className="text-left p-2">Approved At</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {purchase.receipts.map((receipt: any, idx: number) => (
                                          <tr key={idx} className="border-b">
                                            <td className="p-2">{receipt.receiptNumber}</td>
                                            <td className="p-2">
                                              <Badge className={getStatusColor(receipt.status)}>
                                                {receipt.status}
                                              </Badge>
                                            </td>
                                            <td className="p-2">{receipt.receivedAt}</td>
                                            <td className="p-2">{receipt.approvedAt || "N/A"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Notes */}
                                {purchase.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-muted-foreground">{purchase.notes}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {reportData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, reportData.pagination.totalCount)} of{" "}
                    {reportData.pagination.totalCount} purchases
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1 || loading}
                      className="border-gray-300 hover:bg-gray-50 shadow-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <span className="text-sm font-medium text-gray-700">
                        Page {page} of {reportData.pagination.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages || loading}
                      className="border-gray-300 hover:bg-gray-50 shadow-sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No purchases found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
