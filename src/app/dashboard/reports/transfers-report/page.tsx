"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  PrinterIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentChartBarIcon
} from "@heroicons/react/24/outline"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

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

type SortField = 'transferNumber' | 'fromLocation' | 'toLocation' | 'status' | 'createdAt' | 'itemCount' | 'totalQuantity'
type SortDirection = 'asc' | 'desc'

export default function TransfersReportPage() {
  const [reportData, setReportData] = useState<TransferReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(true)

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Filter states
  const [fromLocationId, setFromLocationId] = useState("all")
  const [toLocationId, setToLocationId] = useState("all")
  const [status, setStatus] = useState("all")
  const [transferNumber, setTransferNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [activeDateFilter, setActiveDateFilter] = useState<string>("")

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
  }, [page, startDate, endDate])

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
    setActiveDateFilter("")
    setPage(1)
  }

  const setDateFilter = (filter: string) => {
    const today = new Date()
    let start = ""
    let end = ""

    switch (filter) {
      case 'today':
        start = end = format(today, 'yyyy-MM-dd')
        break
      case 'yesterday':
        const yesterday = subDays(today, 1)
        start = end = format(yesterday, 'yyyy-MM-dd')
        break
      case 'this-week':
        start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'last-week':
        const lastWeek = subDays(today, 7)
        start = format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        end = format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'this-month':
        start = format(startOfMonth(today), 'yyyy-MM-dd')
        end = format(endOfMonth(today), 'yyyy-MM-dd')
        break
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        break
      case 'this-year':
        start = format(startOfYear(today), 'yyyy-MM-dd')
        end = format(endOfYear(today), 'yyyy-MM-dd')
        break
      case 'last-7-days':
        start = format(subDays(today, 6), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
      case 'last-30-days':
        start = format(subDays(today, 29), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
      case 'last-90-days':
        start = format(subDays(today, 89), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
    }

    setStartDate(start)
    setEndDate(end)
    setActiveDateFilter(filter)
    setPage(1)
    // useEffect will automatically fetch when startDate/endDate changes
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="w-4 h-4 text-gray-400 opacity-50 inline-block ml-1" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 text-blue-600 inline-block ml-1" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 text-blue-600 inline-block ml-1" />
    )
  }

  // Sorted and filtered data
  const sortedTransfers = useMemo(() => {
    if (!reportData?.transfers) return []

    const sorted = [...reportData.transfers].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'transferNumber':
          aValue = a.transferNumber.toLowerCase()
          bValue = b.transferNumber.toLowerCase()
          break
        case 'fromLocation':
          aValue = a.fromLocation.toLowerCase()
          bValue = b.fromLocation.toLowerCase()
          break
        case 'toLocation':
          aValue = a.toLocation.toLowerCase()
          bValue = b.toLocation.toLowerCase()
          break
        case 'status':
          aValue = a.status.toLowerCase()
          bValue = b.status.toLowerCase()
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'itemCount':
          aValue = a.itemCount
          bValue = b.itemCount
          break
        case 'totalQuantity':
          aValue = a.totalQuantity
          bValue = b.totalQuantity
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [reportData, sortField, sortDirection])

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
    if (!sortedTransfers.length) return

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

    const rows = sortedTransfers.map((transfer) => [
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
      ...rows.map((row) => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transfers-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportToExcel = () => {
    if (!sortedTransfers.length) return

    const worksheetData = [
      ["Transfer Number", "From Location", "To Location", "Status", "Created Date", "Submitted At", "Checked At", "Approved At", "Sent At", "Arrived At", "Verified At", "Completed At", "Origin Checker", "Destination Receiver", "Items", "Total Quantity", "Stock Deducted"],
      ...sortedTransfers.map((transfer) => [
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
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transfers Report")
    XLSX.writeFile(workbook, `transfers-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportToPDF = () => {
    if (!sortedTransfers.length) return

    const doc = new jsPDF('l', 'mm', 'a4')

    // Title
    doc.setFontSize(18)
    doc.text('Stock Transfers Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22)

    if (startDate && endDate) {
      doc.text(`Period: ${startDate} to ${endDate}`, 14, 27)
    }

    // Summary
    if (reportData) {
      doc.setFontSize(11)
      doc.text(`Total Transfers: ${reportData.summary.totalTransfers}`, 14, 35)
    }

    // Table
    autoTable(doc, {
      startY: 40,
      head: [['Transfer #', 'From', 'To', 'Status', 'Created', 'Items', 'Qty', 'Stock Deducted']],
      body: sortedTransfers.map(t => [
        t.transferNumber,
        t.fromLocation,
        t.toLocation,
        t.status,
        t.createdAt,
        t.itemCount,
        t.totalQuantity,
        t.stockDeducted ? 'Yes' : 'No'
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    })

    doc.save(`transfers-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const handlePrint = () => {
    window.print()
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
      VERIFYING: "bg-purple-100 text-purple-800",
      VERIFIED: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="p-6 space-y-6">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #print-area table {
            width: 100%;
            border-collapse: collapse;
          }
          #print-area th, #print-area td {
            border: 1px solid #ddd;
            padding: 4px;
            font-size: 10px;
          }
          #print-area th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Transfers Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive view of all stock transfers between locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} disabled={!sortedTransfers.length} className="bg-green-600 hover:bg-green-700 text-white">
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            CSV
          </Button>
          <Button onClick={exportToExcel} disabled={!sortedTransfers.length} className="bg-blue-600 hover:bg-blue-700 text-white">
            <TableCellsIcon className="w-5 h-5 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} disabled={!sortedTransfers.length} className="bg-red-600 hover:bg-red-700 text-white">
            <DocumentChartBarIcon className="w-5 h-5 mr-2" />
            PDF
          </Button>
          <Button onClick={handlePrint} disabled={!sortedTransfers.length} className="bg-gray-700 hover:bg-gray-800 text-white">
            <PrinterIcon className="w-5 h-5 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
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
            {/* Quick Date Filters */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Quick Date Filters</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeDateFilter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('today')}
                  className={activeDateFilter === 'today' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Today
                </Button>
                <Button
                  variant={activeDateFilter === 'yesterday' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('yesterday')}
                  className={activeDateFilter === 'yesterday' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Yesterday
                </Button>
                <Button
                  variant={activeDateFilter === 'this-week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('this-week')}
                  className={activeDateFilter === 'this-week' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  This Week
                </Button>
                <Button
                  variant={activeDateFilter === 'last-week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('last-week')}
                  className={activeDateFilter === 'last-week' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Last Week
                </Button>
                <Button
                  variant={activeDateFilter === 'this-month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('this-month')}
                  className={activeDateFilter === 'this-month' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  This Month
                </Button>
                <Button
                  variant={activeDateFilter === 'last-month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('last-month')}
                  className={activeDateFilter === 'last-month' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Last Month
                </Button>
                <Button
                  variant={activeDateFilter === 'this-year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('this-year')}
                  className={activeDateFilter === 'this-year' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  This Year
                </Button>
                <Button
                  variant={activeDateFilter === 'last-7-days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('last-7-days')}
                  className={activeDateFilter === 'last-7-days' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant={activeDateFilter === 'last-30-days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('last-30-days')}
                  className={activeDateFilter === 'last-30-days' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant={activeDateFilter === 'last-90-days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('last-90-days')}
                  className={activeDateFilter === 'last-90-days' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50'}
                >
                  Last 90 Days
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* From Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">From Location</label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
                  <SelectTrigger className="bg-white border-gray-300">
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
                <label className="block text-sm font-medium mb-2 text-gray-700">To Location</label>
                <Select value={toLocationId} onValueChange={setToLocationId}>
                  <SelectTrigger className="bg-white border-gray-300">
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
                <label className="block text-sm font-medium mb-2 text-gray-700">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="checked">Checked</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="verifying">Verifying</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transfer Number */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Transfer Number</label>
                <Input
                  type="text"
                  placeholder="Search transfer number..."
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  className="bg-white border-gray-300"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setActiveDateFilter("") // Clear active filter when manually changing date
                  }}
                  className="bg-white border-gray-300"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setActiveDateFilter("") // Clear active filter when manually changing date
                  }}
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
                Apply Filters
              </Button>
              <Button variant="outline" onClick={handleReset} className="border-gray-300 hover:bg-gray-50 font-medium px-6">
                Reset
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">
                Total Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-900">{reportData.summary.totalTransfers}</p>
            </CardContent>
          </Card>

          {Object.entries(reportData.summary.byStatus).slice(0, 4).map(([status, count]) => (
            <Card key={status} className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  {status.replace(/_/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Table */}
      <Card id="print-area">
        <CardHeader className="no-print">
          <CardTitle>Stock Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : sortedTransfers.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-50">
                      <th
                        className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('transferNumber')}
                      >
                        Transfer # <SortIcon field="transferNumber" />
                      </th>
                      <th
                        className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('fromLocation')}
                      >
                        From <SortIcon field="fromLocation" />
                      </th>
                      <th
                        className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('toLocation')}
                      >
                        To <SortIcon field="toLocation" />
                      </th>
                      <th
                        className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th
                        className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('createdAt')}
                      >
                        Created <SortIcon field="createdAt" />
                      </th>
                      <th
                        className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('itemCount')}
                      >
                        Items <SortIcon field="itemCount" />
                      </th>
                      <th
                        className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('totalQuantity')}
                      >
                        Qty <SortIcon field="totalQuantity" />
                      </th>
                      <th className="text-center p-3 font-semibold text-gray-700">Stock Deducted</th>
                      <th className="text-center p-3 font-semibold text-gray-700 no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransfers.map((transfer) => (
                      <>
                        <tr key={transfer.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium text-blue-600">{transfer.transferNumber}</td>
                          <td className="p-3 text-gray-800">{transfer.fromLocation}</td>
                          <td className="p-3 text-gray-800">{transfer.toLocation}</td>
                          <td className="p-3">
                            <Badge className={getStatusColor(transfer.status)}>
                              {transfer.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-700">{transfer.createdAt}</td>
                          <td className="p-3 text-right font-medium text-gray-800">{transfer.itemCount}</td>
                          <td className="p-3 text-right font-medium text-gray-800">{transfer.totalQuantity}</td>
                          <td className="p-3 text-center">
                            <Badge className={transfer.stockDeducted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {transfer.stockDeducted ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center no-print">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(transfer.id)}
                              className="hover:bg-blue-50"
                            >
                              {expandedRows.has(transfer.id) ? (
                                <ChevronUpIcon className="w-5 h-5 text-blue-600" />
                              ) : (
                                <ChevronDownIcon className="w-5 h-5 text-blue-600" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        {expandedRows.has(transfer.id) && (
                          <tr className="no-print">
                            <td colSpan={9} className="p-4 bg-gray-50">
                              <div className="space-y-4">
                                {/* Transfer Timeline */}
                                <div>
                                  <h4 className="font-semibold mb-2 text-gray-900">Transfer Timeline</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">Submitted:</span>
                                      <p className="font-medium text-gray-900">{transfer.submittedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Checked:</span>
                                      <p className="font-medium text-gray-900">{transfer.checkedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Approved:</span>
                                      <p className="font-medium text-gray-900">{transfer.approvedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Sent:</span>
                                      <p className="font-medium text-gray-900">{transfer.sentAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Arrived:</span>
                                      <p className="font-medium text-gray-900">{transfer.arrivedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Verified:</span>
                                      <p className="font-medium text-gray-900">{transfer.verifiedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Completed:</span>
                                      <p className="font-medium text-gray-900">{transfer.completedAt || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Origin Checker:</span>
                                      <p className="font-medium text-gray-900">{transfer.originChecker || "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Destination Receiver:</span>
                                      <p className="font-medium text-gray-900">{transfer.destinationReceiver || "N/A"}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Transfer Items */}
                                <div>
                                  <h4 className="font-semibold mb-2 text-gray-900">Transfer Items</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200">
                                      <thead>
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                          <th className="text-left p-2 font-semibold text-gray-700">Product</th>
                                          <th className="text-left p-2 font-semibold text-gray-700">Variation</th>
                                          <th className="text-left p-2 font-semibold text-gray-700">SKU</th>
                                          <th className="text-right p-2 font-semibold text-gray-700">Quantity</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {transfer.items.map((item: any, idx: number) => (
                                          <tr key={idx} className="border-b border-gray-200">
                                            <td className="p-2 text-gray-800">{item.productName}</td>
                                            <td className="p-2 text-gray-800">{item.variationName}</td>
                                            <td className="p-2 text-gray-700">{item.sku}</td>
                                            <td className="p-2 text-right font-medium text-gray-900">{item.quantity}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Notes */}
                                {transfer.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1 text-gray-900">Notes</h4>
                                    <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">{transfer.notes}</p>
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
              {reportData && reportData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between no-print">
                  <p className="text-sm text-gray-600">
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
                      className="border-gray-300 hover:bg-gray-50 font-medium"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-medium">
                        Page {page} of {reportData.pagination.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === reportData.pagination.totalPages}
                      className="border-gray-300 hover:bg-gray-50 font-medium"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No transfers found. Try adjusting your filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
