"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PrinterIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  StarIcon,
} from "@heroicons/react/24/outline"
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface SupplierMetrics {
  supplierId: number
  supplierName: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  totalPurchaseOrders: number
  totalPurchaseValue: number
  totalQuantityOrdered: number
  totalQuantityReceived: number
  onTimeDeliveryRate: number
  fillRate: number
  priceTrendScore: number
  qualityScore: number
  overallScore: number
  tier: 'Preferred' | 'Acceptable' | 'Review'
  tierColor: string
  avgLeadTimeDays: number
  lastPurchaseDate: string | null
  lastPriceChange: 'up' | 'down' | 'stable'
  priceChangePercent: number
}

interface ScorecardData {
  summary: {
    totalSuppliers: number
    preferredCount: number
    acceptableCount: number
    reviewCount: number
    avgOverallScore: number
    topPerformer: string | null
    totalPurchaseValue: number
    periodDays: number
    weightDescription: string
  }
  suppliers: SupplierMetrics[]
}

export default function SupplierScorecardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Filters
  const [periodFilter, setPeriodFilter] = useState("90")
  const [tierFilter, setTierFilter] = useState("all")

  // Fetch scorecard data
  const fetchScorecard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.append("periodDays", periodFilter)

      const response = await fetch(`/api/reports/supplier-scorecard?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch supplier scorecard")
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [periodFilter])

  useEffect(() => {
    fetchScorecard()
  }, [fetchScorecard])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Filter suppliers by tier
  const filteredSuppliers = tierFilter === 'all'
    ? data?.suppliers || []
    : data?.suppliers.filter(s => s.tier.toLowerCase() === tierFilter) || []

  // Pagination
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [tierFilter])

  // Get tier badge
  const getTierBadge = (tier: string, tierColor: string) => {
    const colors: Record<string, string> = {
      green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }
    return <Badge className={colors[tierColor]}>{tier}</Badge>
  }

  // Get price change icon
  const getPriceChangeIcon = (direction: string, percent: number) => {
    if (direction === 'down') {
      return (
        <span className="flex items-center text-green-600">
          <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
          {Math.abs(percent)}%
        </span>
      )
    } else if (direction === 'up') {
      return (
        <span className="flex items-center text-red-600">
          <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
          {percent}%
        </span>
      )
    }
    return (
      <span className="flex items-center text-gray-500">
        <MinusIcon className="h-4 w-4 mr-1" />
        Stable
      </span>
    )
  }

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-blue-600"
    return "text-red-600"
  }

  // Get progress color
  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-green-500"
    if (score >= 70) return "bg-blue-500"
    return "bg-red-500"
  }

  // Export to Excel
  const handleExportExcel = async () => {
    if (!data) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Supplier Scorecard')

    // Add title
    worksheet.mergeCells('A1:K1')
    worksheet.getCell('A1').value = 'Supplier Performance Scorecard'
    worksheet.getCell('A1').font = { bold: true, size: 16 }
    worksheet.getCell('A1').alignment = { horizontal: 'center' }

    // Add summary
    worksheet.getCell('A3').value = 'Summary'
    worksheet.getCell('A3').font = { bold: true }
    worksheet.getCell('A4').value = `Period: Last ${data.summary.periodDays} days`
    worksheet.getCell('A5').value = `Total Suppliers: ${data.summary.totalSuppliers}`
    worksheet.getCell('A6').value = `Preferred: ${data.summary.preferredCount}`
    worksheet.getCell('A7').value = `Acceptable: ${data.summary.acceptableCount}`
    worksheet.getCell('A8').value = `Needs Review: ${data.summary.reviewCount}`
    worksheet.getCell('A9').value = `Top Performer: ${data.summary.topPerformer || 'N/A'}`

    // Add headers
    worksheet.addRow([])
    const headerRow = worksheet.addRow([
      'Supplier', 'Score', 'Tier', 'On-Time %', 'Fill Rate %', 'Price Score',
      'Quality %', 'POs', 'Total Value', 'Avg Lead Time', 'Last Purchase'
    ])
    headerRow.font = { bold: true }
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
    })

    // Add data
    data.suppliers.forEach((supplier) => {
      const row = worksheet.addRow([
        supplier.supplierName,
        supplier.overallScore,
        supplier.tier,
        supplier.onTimeDeliveryRate,
        supplier.fillRate,
        supplier.priceTrendScore,
        supplier.qualityScore,
        supplier.totalPurchaseOrders,
        supplier.totalPurchaseValue,
        supplier.avgLeadTimeDays,
        supplier.lastPurchaseDate || 'N/A'
      ])

      // Color code by tier
      const tierColors: Record<string, string> = {
        Preferred: 'FFD4EDDA',
        Acceptable: 'FFD1ECF1',
        Review: 'FFFFD7D7',
      }
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: tierColors[supplier.tier] || 'FFFFFFFF' }
        }
      })
    })

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `supplier-scorecard-${new Date().toISOString().split('T')[0]}.xlsx`)

    toast({
      title: "Export successful",
      description: "Excel file downloaded",
    })
  }

  // Export to PDF
  const handleExportPDF = () => {
    if (!data) return

    const doc = new jsPDF()

    // Title
    doc.setFontSize(16)
    doc.text('Supplier Performance Scorecard', 14, 20)

    // Summary
    doc.setFontSize(10)
    doc.text(`Period: Last ${data.summary.periodDays} days`, 14, 30)
    doc.text(`Total Suppliers: ${data.summary.totalSuppliers}`, 14, 36)
    doc.text(`Preferred: ${data.summary.preferredCount} | Acceptable: ${data.summary.acceptableCount} | Review: ${data.summary.reviewCount}`, 14, 42)
    doc.text(`Weighting: ${data.summary.weightDescription}`, 14, 48)

    // Table
    autoTable(doc, {
      startY: 56,
      head: [['Supplier', 'Score', 'Tier', 'On-Time', 'Fill Rate', 'Price', 'Quality']],
      body: data.suppliers.map((s) => [
        s.supplierName.substring(0, 20),
        `${s.overallScore}%`,
        s.tier,
        `${s.onTimeDeliveryRate}%`,
        `${s.fillRate}%`,
        `${s.priceTrendScore}%`,
        `${s.qualityScore}%`
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const tier = data.cell.raw as string
          if (tier === 'Preferred') data.cell.styles.fillColor = [212, 237, 218]
          else if (tier === 'Acceptable') data.cell.styles.fillColor = [209, 236, 241]
          else data.cell.styles.fillColor = [255, 215, 215]
        }
      }
    })

    doc.save(`supplier-scorecard-${new Date().toISOString().split('T')[0]}.pdf`)

    toast({
      title: "Export successful",
      description: "PDF file downloaded",
    })
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return

    const headers = ['Supplier', 'Score', 'Tier', 'On-Time %', 'Fill Rate %', 'Price Score', 'Quality %', 'POs', 'Total Value', 'Avg Lead Time', 'Price Change', 'Last Purchase']
    const rows = data.suppliers.map((s) => [
      `"${s.supplierName}"`,
      s.overallScore,
      s.tier,
      s.onTimeDeliveryRate,
      s.fillRate,
      s.priceTrendScore,
      s.qualityScore,
      s.totalPurchaseOrders,
      s.totalPurchaseValue,
      s.avgLeadTimeDays,
      `${s.lastPriceChange} ${s.priceChangePercent}%`,
      s.lastPurchaseDate || 'N/A'
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    saveAs(blob, `supplier-scorecard-${new Date().toISOString().split('T')[0]}.csv`)

    toast({
      title: "Export successful",
      description: "CSV file downloaded",
    })
  }

  // Print
  const handlePrint = () => {
    window.print()
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span>Error: {error}</span>
            </div>
            <Button onClick={fetchScorecard} className="mt-4" variant="outline">
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <TruckIcon className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Supplier Performance Scorecard</h1>
            <p className="text-muted-foreground">Rate and compare your suppliers objectively</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
            <DocumentArrowDownIcon className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
            <DocumentArrowDownIcon className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}
            className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
            <DocumentTextIcon className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}
            className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
            <PrinterIcon className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : data?.summary.totalSuppliers || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Preferred (90%+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? "..." : data?.summary.preferredCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Acceptable (70-89%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "..." : data?.summary.acceptableCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Needs Review (&lt;70%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? "..." : data?.summary.reviewCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <StarIcon className="h-4 w-4 text-yellow-500" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {loading ? "..." : data?.summary.topPerformer || "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weighting Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <strong>Score Weighting:</strong> {data?.summary.weightDescription || "Loading..."}
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Period:</span>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="90 days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="60">Last 60 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="180">Last 6 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Tier:</span>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="preferred">Preferred</SelectItem>
                    <SelectItem value="acceptable">Acceptable</SelectItem>
                    <SelectItem value="review">Needs Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="sm" onClick={fetchScorecard} disabled={loading}>
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedSuppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TruckIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No suppliers found with purchase activity.</p>
              <p className="text-sm mt-2">Try adjusting your date range.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-center">Overall Score</TableHead>
                      <TableHead className="text-center">Tier</TableHead>
                      <TableHead className="text-center">On-Time</TableHead>
                      <TableHead className="text-center">Fill Rate</TableHead>
                      <TableHead className="text-center">Price Trend</TableHead>
                      <TableHead className="text-center">Quality</TableHead>
                      <TableHead className="text-right">Total POs</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead className="text-center">Price Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSuppliers.map((supplier) => (
                      <TableRow key={supplier.supplierId}>
                        <TableCell>
                          <div className="font-medium">{supplier.supplierName}</div>
                          {supplier.contactPerson && (
                            <div className="text-xs text-muted-foreground">{supplier.contactPerson}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xl font-bold ${getScoreColor(supplier.overallScore)}`}>
                              {supplier.overallScore}%
                            </span>
                            <div className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressColor(supplier.overallScore)}`}
                                style={{ width: `${supplier.overallScore}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getTierBadge(supplier.tier, supplier.tierColor)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getScoreColor(supplier.onTimeDeliveryRate)}>
                            {supplier.onTimeDeliveryRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getScoreColor(supplier.fillRate)}>
                            {supplier.fillRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getScoreColor(supplier.priceTrendScore)}>
                            {supplier.priceTrendScore}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getScoreColor(supplier.qualityScore)}>
                            {supplier.qualityScore}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{supplier.totalPurchaseOrders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(supplier.totalPurchaseValue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getPriceChangeIcon(supplier.lastPriceChange, supplier.priceChangePercent)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)} of{" "}
                    {filteredSuppliers.length} suppliers
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Metrics Explained</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-600 mb-1">On-Time Delivery (35%)</h4>
              <p className="text-muted-foreground">
                Percentage of orders delivered by the expected date. Higher is better.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-green-600 mb-1">Fill Rate (30%)</h4>
              <p className="text-muted-foreground">
                Percentage of ordered quantity that was actually received. 100% = perfect.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-600 mb-1">Price Trend (20%)</h4>
              <p className="text-muted-foreground">
                Score based on price changes vs previous period. Stable/lower prices = higher score.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-orange-600 mb-1">Quality (15%)</h4>
              <p className="text-muted-foreground">
                Percentage of items passing quality control inspection. Based on QC data if available.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
