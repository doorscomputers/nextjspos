"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from "@heroicons/react/24/outline"

interface TransferReportData {
  transfers: any[]
  summary: {
    totalTransfers: number
    byStatus: Record<string, number>
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export default function TransfersReportPage() {
  const [reportData, setReportData] = useState<TransferReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(true)

  // Filter states
  const [fromLocationId, setFromLocationId] = useState("all")
  const [toLocationId, setToLocationId] = useState("all")
  const [status, setStatus] = useState("all")
  const [transferNumber, setTransferNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Dropdown data
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => {
    fetchLocations()
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

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())

      if (fromLocationId !== "all") params.append("fromLocationId", fromLocationId)
      if (toLocationId !== "all") params.append("toLocationId", toLocationId)
      if (status !== "all") params.append("status", status)
      if (transferNumber) params.append("transferNumber", transferNumber)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const response = await fetch(`/api/reports/transfers?${params.toString()}`)
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
    setFromLocationId("all")
    setToLocationId("all")
    setStatus("all")
    setTransferNumber("")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const exportToCSV = () => {
    if (!reportData) return

    const headers = [
      "Transfer Number",
      "From Location",
      "To Location",
      "Status",
      "Created Date",
      "Submitted At",
      "Checked At",
      "Approved At",
      "Sent At",
      "Arrived At",
      "Verified At",
      "Completed At",
      "Origin Checker",
      "Destination Receiver",
      "Items",
      "Total Quantity",
      "Stock Deducted"
    ]

    const rows = reportData.transfers.map((transfer) => [
      transfer.transferNumber,
      transfer.fromLocation,
      transfer.toLocation,
      transfer.status,
      transfer.createdAt,
      transfer.submittedAt || "N/A",
      transfer.checkedAt || "N/A",
      transfer.approvedAt || "N/A",
      transfer.sentAt || "N/A",
      transfer.arrivedAt || "N/A",
      transfer.verifiedAt || "N/A",
      transfer.completedAt || "N/A",
      transfer.originChecker || "N/A",
      transfer.destinationReceiver || "N/A",
      transfer.itemCount,
      transfer.totalQuantity,
      transfer.stockDeducted ? "Yes" : "No"
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transfers-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      SUBMITTED: "bg-blue-100 text-blue-800",
      CHECKED: "bg-cyan-100 text-cyan-800",
      APPROVED: "bg-green-100 text-green-800",
      SENT: "bg-yellow-100 text-yellow-800",
      IN_TRANSIT: "bg-orange-100 text-orange-800",
      ARRIVED: "bg-indigo-100 text-indigo-800",
      VERIFIED: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Transfers Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive view of all stock transfers between locations
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={!reportData || reportData.transfers.length === 0}>
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* From Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">From Location</label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
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

              {/* To Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">To Location</label>
                <Select value={toLocationId} onValueChange={setToLocationId}>
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
                    <SelectItem value="CHECKED">Checked</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                    <SelectItem value="ARRIVED">Arrived</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transfer Number */}
              <div>
                <label className="block text-sm font-medium mb-2">Transfer Number</label>
                <Input
                  type="text"
                  placeholder="Search transfer number..."
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
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
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch}>Apply Filters</Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reportData.summary.totalTransfers}</p>
            </CardContent>
          </Card>

          {Object.entries(reportData.summary.byStatus).slice(0, 4).map(([status, count]) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {status.replace(/_/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reportData && reportData.transfers.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Transfer #</th>
                      <th className="text-left p-3 font-medium">From</th>
                      <th className="text-left p-3 font-medium">To</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-right p-3 font-medium">Items</th>
                      <th className="text-right p-3 font-medium">Qty</th>
                      <th className="text-center p-3 font-medium">Stock Deducted</th>
                      <th className="text-center p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.transfers.map((transfer) => (
                      <>
                        <tr key={transfer.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{transfer.transferNumber}</td>
                          <td className="p-3">{transfer.fromLocation}</td>
                          <td className="p-3">{transfer.toLocation}</td>
                          <td className="p-3">
                            <Badge className={getStatusColor(transfer.status)}>
                              {transfer.status}
                            </Badge>
                          </td>
                          <td className="p-3">{transfer.createdAt}</td>
                          <td className="p-3 text-right">{transfer.itemCount}</td>
                          <td className="p-3 text-right">{transfer.totalQuantity}</td>
                          <td className="p-3 text-center">
                            <Badge className={transfer.stockDeducted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {transfer.stockDeducted ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(transfer.id)}
                            >
                              {expandedRows.has(transfer.id) ? (
                                <ChevronUpIcon className="w-4 h-4" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        {expandedRows.has(transfer.id) && (
                          <tr>
                            <td colSpan={9} className="p-4 bg-muted/30">
                              <div className="space-y-4">
                                {/* Transfer Timeline */}
                                <div>
                                  <h4 className="font-semibold mb-2">Transfer Timeline</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Submitted:</span>
                                      <p className="font-medium">{transfer.submittedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Checked:</span>
                                      <p className="font-medium">{transfer.checkedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Approved:</span>
                                      <p className="font-medium">{transfer.approvedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Sent:</span>
                                      <p className="font-medium">{transfer.sentAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Arrived:</span>
                                      <p className="font-medium">{transfer.arrivedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Verified:</span>
                                      <p className="font-medium">{transfer.verifiedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Completed:</span>
                                      <p className="font-medium">{transfer.completedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Origin Checker:</span>
                                      <p className="font-medium">{transfer.originChecker || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Destination Receiver:</span>
                                      <p className="font-medium">{transfer.destinationReceiver || "N/A"}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Transfer Items */}
                                <div>
                                  <h4 className="font-semibold mb-2">Transfer Items</h4>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-2">Product</th>
                                        <th className="text-left p-2">Variation</th>
                                        <th className="text-left p-2">SKU</th>
                                        <th className="text-right p-2">Quantity</th>
                                        <th className="text-right p-2">Unit Cost</th>
                                        <th className="text-right p-2">Total Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {transfer.items.map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b">
                                          <td className="p-2">{item.productName}</td>
                                          <td className="p-2">{item.variationName}</td>
                                          <td className="p-2">{item.sku}</td>
                                          <td className="p-2 text-right">{item.quantity}</td>
                                          <td className="p-2 text-right">${item.unitCost.toFixed(2)}</td>
                                          <td className="p-2 text-right">${item.totalValue.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Notes */}
                                {transfer.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-muted-foreground">{transfer.notes}</p>
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
                    {reportData.pagination.totalCount} transfers
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        Page {page} of {reportData.pagination.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transfers found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
