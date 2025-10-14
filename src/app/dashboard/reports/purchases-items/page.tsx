"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ExportButtons } from "@/components/reports/ExportButtons"
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"

interface PurchaseItemsReportData {
  items: any[]
  summary: {
    totalItems: number
    totalQuantityOrdered: number
    totalQuantityReceived: number
    totalValue: number
    totalReceivedValue: number
    averageUnitCost: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export default function PurchaseItemsReportPage() {
  const [reportData, setReportData] = useState<PurchaseItemsReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [supplierId, setSupplierId] = useState("all")
  const [status, setStatus] = useState("all")
  const [productName, setProductName] = useState("")
  const [sku, setSku] = useState("")
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
      if (productName) params.append("productName", productName)
      if (sku) params.append("sku", sku)
      if (purchaseOrderNumber) params.append("purchaseOrderNumber", purchaseOrderNumber)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (minAmount) params.append("minAmount", minAmount)
      if (maxAmount) params.append("maxAmount", maxAmount)

      const response = await fetch(`/api/reports/purchases/items?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.items) {
        setReportData(data)
      } else {
        console.error("API Error:", data.error || data.details || "Unknown error")
        setReportData(null)
      }
    } catch (error) {
      console.error("Failed to fetch report:", error)
      setReportData(null)
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
    setProductName("")
    setSku("")
    setPurchaseOrderNumber("")
    setStartDate("")
    setEndDate("")
    setMinAmount("")
    setMaxAmount("")
    setPage(1)
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
      "Product",
      "Variation",
      "SKU",
      "PO Number",
      "PO Date",
      "Expected Delivery",
      "Supplier",
      "Location",
      "Status",
      "Qty Ordered",
      "Qty Received",
      "Unit Cost",
      "Item Total",
      "Received Total",
      "Serial?"
    ]

    const data = reportData.items.map((item) => [
      item.productName,
      item.variationName,
      item.sku,
      item.purchaseOrderNumber,
      item.purchaseDate,
      item.expectedDeliveryDate || "N/A",
      item.supplier,
      item.location,
      item.status,
      item.quantityOrdered.toFixed(2),
      item.quantityReceived.toFixed(2),
      item.unitCost.toFixed(2),
      item.itemTotal.toFixed(2),
      item.receivedTotal.toFixed(2),
      item.requiresSerial ? "Yes" : "No"
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
          <h1 className="text-3xl font-bold text-foreground">Purchase Items Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed view of all purchased items across purchase orders
          </p>
        </div>
        <ExportButtons
          data={getExportData().data}
          headers={getExportData().headers}
          filename={`purchase-items-report-${new Date().toISOString().split("T")[0]}`}
          title="Purchase Items Report"
          disabled={!reportData || reportData.items.length === 0}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="hover:bg-gray-100"
            >
              <FunnelIcon className="w-5 h-5 mr-2" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
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

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Product Name</label>
                <Input
                  type="text"
                  placeholder="Search product..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium mb-2">SKU</label>
                <Input
                  type="text"
                  placeholder="Search SKU..."
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
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
                <label className="block text-sm font-medium mb-2">Min Item Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">Max Item Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
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
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reportData.summary.totalItems}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Qty Ordered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalQuantityOrdered)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Qty Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalQuantityReceived)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Received Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalReceivedValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Unit Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.averageUnitCost)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reportData && reportData.items.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Product</th>
                      <th className="text-left p-3 font-medium">Variation</th>
                      <th className="text-left p-3 font-medium">SKU</th>
                      <th className="text-left p-3 font-medium">PO Number</th>
                      <th className="text-left p-3 font-medium">PO Date</th>
                      <th className="text-left p-3 font-medium">Supplier</th>
                      <th className="text-left p-3 font-medium">Location</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Qty Ordered</th>
                      <th className="text-right p-3 font-medium">Qty Received</th>
                      <th className="text-right p-3 font-medium">Unit Cost</th>
                      <th className="text-right p-3 font-medium">Item Total</th>
                      <th className="text-center p-3 font-medium">Serial?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{item.productName}</td>
                        <td className="p-3">{item.variationName}</td>
                        <td className="p-3">{item.sku}</td>
                        <td className="p-3">{item.purchaseOrderNumber}</td>
                        <td className="p-3">{item.purchaseDate}</td>
                        <td className="p-3">{item.supplier}</td>
                        <td className="p-3">{item.location}</td>
                        <td className="p-3">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">{formatNumber(item.quantityOrdered)}</td>
                        <td className="p-3 text-right">{formatNumber(item.quantityReceived)}</td>
                        <td className="p-3 text-right">{formatNumber(item.unitCost)}</td>
                        <td className="p-3 text-right font-medium">
                          {formatNumber(item.itemTotal)}
                        </td>
                        <td className="p-3 text-center">
                          {item.requiresSerial ? "Yes" : "No"}
                        </td>
                      </tr>
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
                    {reportData.pagination.totalCount} items
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
              No purchase items found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
