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
  ChartBarSquareIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline"
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ProductMetrics {
  productId: number
  variationId: number
  productName: string
  variationName: string
  sku: string
  category: string
  totalRevenue: number
  totalQuantity: number
  grossProfit: number
  marginPercent: number
  unitsSold: number
  transactionCount: number
  avgDailySales: number
  coefficientOfVariation: number
  abcClass: 'A' | 'B' | 'C'
  xyzClass: 'X' | 'Y' | 'Z'
  recommendation: string
}

interface ScorecardData {
  summary: {
    totalProducts: number
    totalRevenue: number
    avgMargin: number
    periodDays: number
    aClassCount: number
    bClassCount: number
    cClassCount: number
    xClassCount: number
    yClassCount: number
    zClassCount: number
    matrixCounts: {
      AX: number; AY: number; AZ: number
      BX: number; BY: number; BZ: number
      CX: number; CY: number; CZ: number
    }
    dataAccuracyNote: string | null
  }
  products: ProductMetrics[]
}

export default function ProductScorecardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const itemsPerPage = 15

  // Filters
  const [locationFilter, setLocationFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("60")

  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])

  // Fetch locations and categories for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [locationsRes, categoriesRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/categories"),
        ])

        if (locationsRes.ok) {
          const locationsData = await locationsRes.json()
          setLocations(locationsData.data || [])
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(categoriesData.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error)
      }
    }

    fetchFilters()
  }, [])

  // Fetch scorecard data
  const fetchScorecard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (locationFilter !== "all") params.append("locationId", locationFilter)
      if (categoryFilter !== "all") params.append("categoryId", categoryFilter)
      params.append("periodDays", periodFilter)

      const response = await fetch(`/api/reports/product-scorecard?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch product scorecard")
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [locationFilter, categoryFilter, periodFilter])

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

  // Filter products by selected matrix cell
  const filteredProducts = selectedCell
    ? data?.products.filter(p => `${p.abcClass}${p.xyzClass}` === selectedCell) || []
    : data?.products || []

  // Pagination
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCell])

  // Get ABC class badge
  const getAbcBadge = (abcClass: string) => {
    const colors: Record<string, string> = {
      A: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      B: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      C: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    }
    return <Badge className={colors[abcClass]}>{abcClass}</Badge>
  }

  // Get XYZ class badge
  const getXyzBadge = (xyzClass: string) => {
    const colors: Record<string, string> = {
      X: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      Y: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      Z: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }
    return <Badge className={colors[xyzClass]}>{xyzClass}</Badge>
  }

  // Matrix cell styling
  const getMatrixCellStyle = (cell: string) => {
    const isSelected = selectedCell === cell
    const baseClasses = "cursor-pointer transition-all duration-200 hover:scale-105"

    const cellColors: Record<string, string> = {
      AX: "bg-green-500 text-white",
      AY: "bg-green-400 text-white",
      AZ: "bg-green-300 text-green-900",
      BX: "bg-blue-400 text-white",
      BY: "bg-blue-300 text-blue-900",
      BZ: "bg-blue-200 text-blue-900",
      CX: "bg-gray-300 text-gray-900",
      CY: "bg-gray-200 text-gray-900",
      CZ: "bg-red-200 text-red-900",
    }

    return `${baseClasses} ${cellColors[cell]} ${isSelected ? "ring-4 ring-offset-2 ring-blue-500" : ""}`
  }

  // Export to Excel
  const handleExportExcel = async () => {
    if (!data) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Product Scorecard')

    // Add title
    worksheet.mergeCells('A1:I1')
    worksheet.getCell('A1').value = 'Product Profitability Scorecard (ABC-XYZ Analysis)'
    worksheet.getCell('A1').font = { bold: true, size: 16 }
    worksheet.getCell('A1').alignment = { horizontal: 'center' }

    // Add summary
    worksheet.getCell('A3').value = 'Summary'
    worksheet.getCell('A3').font = { bold: true }
    worksheet.getCell('A4').value = `Period: Last ${data.summary.periodDays} days`
    worksheet.getCell('A5').value = `Total Products: ${data.summary.totalProducts}`
    worksheet.getCell('A6').value = `Total Revenue: ${formatCurrency(data.summary.totalRevenue)}`
    worksheet.getCell('A7').value = `Average Margin: ${data.summary.avgMargin}%`

    // Add headers
    worksheet.addRow([])
    const headerRow = worksheet.addRow([
      'SKU', 'Product', 'Category', 'Revenue', 'Margin %', 'Units Sold',
      'ABC', 'XYZ', 'Recommendation'
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
    data.products.forEach((product) => {
      const row = worksheet.addRow([
        product.sku,
        product.productName,
        product.category,
        product.totalRevenue,
        product.marginPercent,
        product.unitsSold,
        product.abcClass,
        product.xyzClass,
        product.recommendation
      ])

      // Color code by ABC class
      const abcColors: Record<string, string> = {
        A: 'FFD4EDDA',
        B: 'FFD1ECF1',
        C: 'FFF8F9FA',
      }
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: abcColors[product.abcClass] || 'FFFFFFFF' }
        }
      })
    })

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `product-scorecard-${new Date().toISOString().split('T')[0]}.xlsx`)

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
    doc.text('Product Profitability Scorecard', 14, 20)

    // Summary
    doc.setFontSize(10)
    doc.text(`Period: Last ${data.summary.periodDays} days`, 14, 30)
    doc.text(`Total Products: ${data.summary.totalProducts}`, 14, 36)
    doc.text(`Total Revenue: ${formatCurrency(data.summary.totalRevenue)}`, 14, 42)
    doc.text(`Average Margin: ${data.summary.avgMargin}%`, 14, 48)

    // Matrix summary
    doc.text('ABC-XYZ Matrix:', 14, 58)
    doc.text(`A Class: ${data.summary.aClassCount} | B Class: ${data.summary.bClassCount} | C Class: ${data.summary.cClassCount}`, 14, 64)

    // Table
    autoTable(doc, {
      startY: 72,
      head: [['SKU', 'Product', 'Revenue', 'Margin', 'ABC', 'XYZ', 'Action']],
      body: data.products.map((p) => [
        p.sku,
        p.productName.substring(0, 25),
        formatCurrency(p.totalRevenue),
        `${p.marginPercent}%`,
        p.abcClass,
        p.xyzClass,
        p.recommendation.substring(0, 20)
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [66, 66, 66] },
    })

    doc.save(`product-scorecard-${new Date().toISOString().split('T')[0]}.pdf`)

    toast({
      title: "Export successful",
      description: "PDF file downloaded",
    })
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return

    const headers = ['SKU', 'Product', 'Category', 'Revenue', 'Cost', 'Profit', 'Margin %', 'Units', 'ABC', 'XYZ', 'Recommendation']
    const rows = data.products.map((p) => [
      p.sku,
      `"${p.productName}"`,
      `"${p.category}"`,
      p.totalRevenue,
      p.totalRevenue - p.grossProfit,
      p.grossProfit,
      p.marginPercent,
      p.unitsSold,
      p.abcClass,
      p.xyzClass,
      `"${p.recommendation}"`
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    saveAs(blob, `product-scorecard-${new Date().toISOString().split('T')[0]}.csv`)

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
          <ChartBarSquareIcon className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Product Profitability Scorecard</h1>
            <p className="text-muted-foreground">ABC-XYZ Analysis - Know which products matter most</p>
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

      {/* Data accuracy note */}
      {data?.summary.dataAccuracyNote && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <InformationCircleIcon className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {data.summary.dataAccuracyNote}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : data?.summary.totalProducts || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? "..." : formatCurrency(data?.summary.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "..." : `${data?.summary.avgMargin || 0}%`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {loading ? "..." : `${data?.summary.periodDays || 0} days`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ABC-XYZ Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ABC-XYZ Matrix
            <span className="text-sm font-normal text-muted-foreground">
              (Click a cell to filter products)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Matrix Grid */}
            <div className="flex-shrink-0">
              <div className="grid grid-cols-4 gap-1 text-center text-sm">
                {/* Header row */}
                <div className="p-2"></div>
                <div className="p-2 font-bold">X (Stable)</div>
                <div className="p-2 font-bold">Y (Variable)</div>
                <div className="p-2 font-bold">Z (Erratic)</div>

                {/* A row */}
                <div className="p-2 font-bold flex items-center justify-center">
                  A (80%)
                </div>
                {['AX', 'AY', 'AZ'].map(cell => (
                  <div
                    key={cell}
                    onClick={() => setSelectedCell(selectedCell === cell ? null : cell)}
                    className={`p-3 rounded-lg ${getMatrixCellStyle(cell)}`}
                  >
                    <div className="text-2xl font-bold">
                      {loading ? "..." : data?.summary.matrixCounts[cell as keyof typeof data.summary.matrixCounts] || 0}
                    </div>
                    <div className="text-xs opacity-80">{cell}</div>
                  </div>
                ))}

                {/* B row */}
                <div className="p-2 font-bold flex items-center justify-center">
                  B (15%)
                </div>
                {['BX', 'BY', 'BZ'].map(cell => (
                  <div
                    key={cell}
                    onClick={() => setSelectedCell(selectedCell === cell ? null : cell)}
                    className={`p-3 rounded-lg ${getMatrixCellStyle(cell)}`}
                  >
                    <div className="text-2xl font-bold">
                      {loading ? "..." : data?.summary.matrixCounts[cell as keyof typeof data.summary.matrixCounts] || 0}
                    </div>
                    <div className="text-xs opacity-80">{cell}</div>
                  </div>
                ))}

                {/* C row */}
                <div className="p-2 font-bold flex items-center justify-center">
                  C (5%)
                </div>
                {['CX', 'CY', 'CZ'].map(cell => (
                  <div
                    key={cell}
                    onClick={() => setSelectedCell(selectedCell === cell ? null : cell)}
                    className={`p-3 rounded-lg ${getMatrixCellStyle(cell)}`}
                  >
                    <div className="text-2xl font-bold">
                      {loading ? "..." : data?.summary.matrixCounts[cell as keyof typeof data.summary.matrixCounts] || 0}
                    </div>
                    <div className="text-xs opacity-80">{cell}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex-grow">
              <h4 className="font-semibold mb-3">Classification Guide</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-green-600 mb-1">ABC (Revenue Contribution)</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong>A:</strong> Top products = 80% of revenue</li>
                    <li><strong>B:</strong> Next products = 15% of revenue</li>
                    <li><strong>C:</strong> Remaining = 5% of revenue</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-600 mb-1">XYZ (Demand Variability)</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong>X:</strong> Stable, predictable demand</li>
                    <li><strong>Y:</strong> Moderate variability</li>
                    <li><strong>Z:</strong> Erratic, unpredictable</li>
                  </ul>
                </div>
              </div>
              {selectedCell && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm">
                    <strong>Showing:</strong> {selectedCell} products ({filteredProducts.length} items)
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCell(null)}
                      className="ml-2 h-6 px-2"
                    >
                      Clear filter
                    </Button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Location:</span>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[180px]">
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

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Category:</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Period:</span>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="60 days" />
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

            <Button variant="outline" size="sm" onClick={fetchScorecard} disabled={loading}>
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Product Details
            {selectedCell && (
              <Badge variant="outline" className="ml-2">
                Filtered: {selectedCell}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ChartBarSquareIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found matching your criteria.</p>
              <p className="text-sm mt-2">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-center">ABC</TableHead>
                      <TableHead className="text-center">XYZ</TableHead>
                      <TableHead>Recommendation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.variationId}>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium">{product.productName}</div>
                          {product.variationName !== "Default" && (
                            <div className="text-xs text-muted-foreground">{product.variationName}</div>
                          )}
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(product.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={product.marginPercent < 10 ? "text-red-600" : ""}>
                            {product.marginPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{product.unitsSold}</TableCell>
                        <TableCell className="text-center">{getAbcBadge(product.abcClass)}</TableCell>
                        <TableCell className="text-center">{getXyzBadge(product.xyzClass)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{product.recommendation}</span>
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
                    {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of{" "}
                    {filteredProducts.length} products
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
    </div>
  )
}
