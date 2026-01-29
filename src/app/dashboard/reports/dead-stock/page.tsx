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
  ArchiveBoxXMarkIcon,
} from "@heroicons/react/24/outline"
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface DeadStockItem {
  id: number
  productId: number
  variationId: number
  productName: string
  variationName: string
  sku: string
  category: string
  categoryId: number | null
  supplierId: number | null
  supplierName: string
  locationId: number
  locationName: string
  currentStock: number
  unitCost: number
  tiedUpCapital: number
  lastSaleDate: string | null
  daysSinceSale: number | null
  suggestion: string
  suggestionColor: string
}

interface DeadStockData {
  summary: {
    totalItems: number
    neverSold: number
    over30Days: number
    over60Days: number
    over90Days: number
    totalTiedUpCapital: number
    percentOfInventory: number
  }
  items: DeadStockItem[]
}

export default function DeadStockReportPage() {
  const { toast } = useToast()
  const [data, setData] = useState<DeadStockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Filters
  const [locationFilter, setLocationFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [minDaysFilter, setMinDaysFilter] = useState("30")

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

  // Fetch dead stock data
  const fetchDeadStock = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (locationFilter !== "all") params.append("locationId", locationFilter)
      if (categoryFilter !== "all") params.append("categoryId", categoryFilter)
      params.append("minDays", minDaysFilter)

      const response = await fetch(`/api/reports/dead-stock?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch dead stock data")
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [locationFilter, categoryFilter, minDaysFilter])

  useEffect(() => {
    fetchDeadStock()
  }, [fetchDeadStock])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Pagination
  const paginatedItems = data?.items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || []
  const totalPages = Math.ceil((data?.items.length || 0) / itemsPerPage)

  // Get suggestion badge color
  const getSuggestionBadge = (suggestion: string, color: string) => {
    const colorClasses: Record<string, string> = {
      red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    }
    return (
      <Badge className={colorClasses[color] || colorClasses.yellow}>
        {suggestion}
      </Badge>
    )
  }

  // Export to Excel
  const handleExportExcel = async () => {
    if (!data) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Dead Stock Report')

    // Add title
    worksheet.mergeCells('A1:I1')
    worksheet.getCell('A1').value = 'Dead Stock & Slow-Moving Inventory Report'
    worksheet.getCell('A1').font = { bold: true, size: 16 }
    worksheet.getCell('A1').alignment = { horizontal: 'center' }

    // Add summary
    worksheet.getCell('A3').value = 'Summary'
    worksheet.getCell('A3').font = { bold: true }
    worksheet.getCell('A4').value = `Total Items: ${data.summary.totalItems}`
    worksheet.getCell('A5').value = `Never Sold: ${data.summary.neverSold}`
    worksheet.getCell('A6').value = `Over 60 Days: ${data.summary.over60Days}`
    worksheet.getCell('A7').value = `Over 90 Days: ${data.summary.over90Days}`
    worksheet.getCell('A8').value = `Total Tied-Up Capital: ${formatCurrency(data.summary.totalTiedUpCapital)}`
    worksheet.getCell('A9').value = `% of Total Inventory: ${data.summary.percentOfInventory}%`

    // Add headers
    const headerRow = worksheet.addRow([
      'SKU', 'Product', 'Category', 'Location', 'Stock', 'Unit Cost',
      'Tied-Up Capital', 'Last Sale', 'Days', 'Suggestion'
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
    data.items.forEach((item) => {
      const row = worksheet.addRow([
        item.sku,
        item.productName,
        item.category,
        item.locationName,
        item.currentStock,
        item.unitCost,
        item.tiedUpCapital,
        item.lastSaleDate || 'Never',
        item.daysSinceSale ?? 'N/A',
        item.suggestion
      ])

      // Highlight rows based on severity
      if (item.daysSinceSale === null || item.daysSinceSale >= 90) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFD7D7' }
          }
        })
      } else if (item.daysSinceSale >= 60) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF0D7' }
          }
        })
      }
    })

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `dead-stock-report-${new Date().toISOString().split('T')[0]}.xlsx`)

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
    doc.text('Dead Stock & Slow-Moving Inventory Report', 14, 20)

    // Summary
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
    doc.text(`Total Items: ${data.summary.totalItems}`, 14, 38)
    doc.text(`Never Sold: ${data.summary.neverSold}`, 14, 44)
    doc.text(`Over 90 Days: ${data.summary.over90Days}`, 14, 50)
    doc.text(`Tied-Up Capital: ${formatCurrency(data.summary.totalTiedUpCapital)}`, 14, 56)
    doc.text(`% of Inventory: ${data.summary.percentOfInventory}%`, 14, 62)

    // Table
    autoTable(doc, {
      startY: 70,
      head: [['SKU', 'Product', 'Category', 'Stock', 'Tied-Up', 'Last Sale', 'Days', 'Action']],
      body: data.items.map((item) => [
        item.sku,
        item.productName.substring(0, 20),
        item.category.substring(0, 15),
        item.currentStock.toString(),
        formatCurrency(item.tiedUpCapital),
        item.lastSaleDate || 'Never',
        item.daysSinceSale?.toString() || 'N/A',
        item.suggestion
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [66, 66, 66] },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const item = data.row.raw as string[]
          const days = item[6]
          if (days === 'N/A' || (parseInt(days) >= 90)) {
            data.cell.styles.fillColor = [255, 215, 215]
          } else if (parseInt(days) >= 60) {
            data.cell.styles.fillColor = [255, 240, 215]
          }
        }
      }
    })

    doc.save(`dead-stock-report-${new Date().toISOString().split('T')[0]}.pdf`)

    toast({
      title: "Export successful",
      description: "PDF file downloaded",
    })
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return

    const headers = ['SKU', 'Product', 'Category', 'Location', 'Stock', 'Unit Cost', 'Tied-Up Capital', 'Last Sale', 'Days Since Sale', 'Suggestion']
    const rows = data.items.map((item) => [
      item.sku,
      `"${item.productName}"`,
      `"${item.category}"`,
      `"${item.locationName}"`,
      item.currentStock,
      item.unitCost,
      item.tiedUpCapital,
      item.lastSaleDate || 'Never',
      item.daysSinceSale ?? 'N/A',
      item.suggestion
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    saveAs(blob, `dead-stock-report-${new Date().toISOString().split('T')[0]}.csv`)

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
            <Button onClick={fetchDeadStock} className="mt-4" variant="outline">
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
          <ArchiveBoxXMarkIcon className="h-8 w-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold">Dead Stock & Slow-Moving Inventory</h1>
            <p className="text-muted-foreground">Identify products that haven&apos;t sold and free up tied-up capital</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Dead Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? "..." : data?.summary.totalItems || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Never Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {loading ? "..." : data?.summary.neverSold || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tied-Up Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loading ? "..." : formatCurrency(data?.summary.totalTiedUpCapital || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% of Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? "..." : `${data?.summary.percentOfInventory || 0}%`}
            </div>
          </CardContent>
        </Card>
      </div>

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
              <span className="text-sm font-medium">Min Days:</span>
              <Select value={minDaysFilter} onValueChange={setMinDaysFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="30 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7+ days</SelectItem>
                  <SelectItem value="14">14+ days</SelectItem>
                  <SelectItem value="30">30+ days</SelectItem>
                  <SelectItem value="60">60+ days</SelectItem>
                  <SelectItem value="90">90+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={fetchDeadStock} disabled={loading}>
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArchiveBoxXMarkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No dead stock items found matching your criteria.</p>
              <p className="text-sm mt-2">This is good news - your inventory is moving!</p>
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
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Tied-Up Capital</TableHead>
                      <TableHead>Last Sale</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Suggestion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={`${item.variationId}-${item.locationId}`}>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          {item.variationName !== "Default" && (
                            <div className="text-xs text-muted-foreground">{item.variationName}</div>
                          )}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.locationName}</TableCell>
                        <TableCell className="text-right">{item.currentStock}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(item.tiedUpCapital)}
                        </TableCell>
                        <TableCell>
                          {item.lastSaleDate || (
                            <span className="text-red-500 font-medium">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.daysSinceSale !== null ? (
                            <span className={item.daysSinceSale >= 90 ? "text-red-600 font-medium" : ""}>
                              {item.daysSinceSale}
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{getSuggestionBadge(item.suggestion, item.suggestionColor)}</TableCell>
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
                    {Math.min(currentPage * itemsPerPage, data?.items.length || 0)} of{" "}
                    {data?.items.length || 0} items
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
