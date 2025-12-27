'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import {
  CalendarIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Toolbar,
  Item,
  Summary,
  TotalItem
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { exportDataGrid as exportDataGridToPdf } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import 'devextreme/dist/css/dx.light.css'

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatCurrencyValue = (value: unknown) => {
  if (value === null || value === undefined) return '₱0.00'
  const numeric = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(numeric)) return '₱0.00'
  return pesoFormatter.format(numeric)
}

interface Reading {
  id: number
  shiftNumber: string
  shiftId: number
  type: 'X' | 'Z'
  readingNumber: number
  readingTime: string
  cashierName: string
  locationName: string
  grossSales: number
  netSales: number
  totalDiscounts: number
  expectedCash: number | null
  transactionCount: number
  reportNumber?: string | null
}

export default function XReadingPage() {
  const { data: session } = useSession()
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchReadings()
  }, [])

  const fetchReadings = async () => {
    try {
      setLoading(true)
      // Filter by type=X to only get X Readings
      const params = new URLSearchParams({ limit: '500', type: 'X' })
      const response = await fetch(`/api/readings/history?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch X readings')

      const data = await response.json()
      setReadings(Array.isArray(data.readings) ? data.readings : [])
    } catch (error: any) {
      console.error('Error fetching X readings:', error)
      toast.error('Failed to load X readings')
    } finally {
      setLoading(false)
    }
  }

  const filteredReadings = readings.filter(reading => {
    // Filter by search term
    if (
      searchTerm &&
      ![
        reading.shiftNumber,
        reading.cashierName,
        reading.locationName,
        reading.reportNumber || '',
      ]
        .some(value => value.toLowerCase().includes(searchTerm.toLowerCase()))
    ) {
      return false
    }

    // Filter by date range
    if (dateFrom && new Date(reading.readingTime) < new Date(dateFrom)) return false
    if (dateTo && new Date(reading.readingTime) > new Date(dateTo + 'T23:59:59')) return false

    return true
  })

  // Render badge for reading number
  const renderReadingNumber = (data: any) => {
    return (
      <Badge className="bg-blue-600 text-white">
        X-{data.value}
      </Badge>
    )
  }

  // Render formatted date
  const renderDate = (data: any) => {
    return format(new Date(data.value), 'MMM dd, yyyy hh:mm a')
  }

  // Render currency values
  const renderCurrency = (data: any) => {
    return <span className="font-medium dark:text-gray-200">{formatCurrencyValue(data.value)}</span>
  }

  // Render gross sales with color
  const renderGrossSales = (data: any) => {
    return <span className="font-bold text-green-600 dark:text-green-400">{formatCurrencyValue(data.value)}</span>
  }

  // Render net sales with color
  const renderNetSales = (data: any) => {
    return <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrencyValue(data.value)}</span>
  }

  const renderReportNumber = (data: any) => {
    return data.value
      ? <span className="font-medium dark:text-gray-200">{data.value}</span>
      : <span className="text-muted-foreground">—</span>
  }

  // Print individual reading
  const handlePrint = (reading: Reading) => {
    window.print()
  }

  // Export to Excel
  const handleExportExcel = () => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('X Readings')

    // Add title
    worksheet.mergeCells('A1:K1')
    const titleRow = worksheet.getCell('A1')
    titleRow.value = 'X READINGS REPORT'
    titleRow.font = { size: 16, bold: true }
    titleRow.alignment = { horizontal: 'center' }

    // Add headers
    const headerRow = worksheet.addRow([
      'Reading #',
      'Shift #',
      'Report #',
      'Date & Time',
      'Cashier',
      'Location',
      'Gross Sales',
      'Discounts',
      'Net Sales',
      'Expected Cash',
      'Transactions'
    ])
    headerRow.font = { bold: true }
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      }
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    })

    // Add data
    filteredReadings.forEach(reading => {
      worksheet.addRow([
        reading.readingNumber,
        reading.shiftNumber,
        reading.reportNumber || '—',
        format(new Date(reading.readingTime), 'MMM dd, yyyy hh:mm a'),
        reading.cashierName,
        reading.locationName,
        reading.grossSales,
        reading.totalDiscounts,
        reading.netSales,
        reading.expectedCash || 0,
        reading.transactionCount
      ])
    })

    // Format currency columns
    worksheet.getColumn(7).numFmt = '₱#,##0.00'
    worksheet.getColumn(8).numFmt = '₱#,##0.00'
    worksheet.getColumn(9).numFmt = '₱#,##0.00'
    worksheet.getColumn(10).numFmt = '₱#,##0.00'

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15
    })

    // Generate and save file
    workbook.xlsx.writeBuffer().then(buffer => {
      saveAs(new Blob([buffer]), `X_Readings_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    })

    toast.success('Excel file exported successfully')
  }

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('X READINGS REPORT', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })

    // Add date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' })

    // Prepare table data
    const tableData = filteredReadings.map(reading => [
      `X-${reading.readingNumber}`,
      reading.shiftNumber,
      reading.reportNumber || '—',
      format(new Date(reading.readingTime), 'MMM dd, yyyy hh:mm a'),
      reading.cashierName,
      reading.locationName,
      formatCurrencyValue(reading.grossSales),
      formatCurrencyValue(reading.totalDiscounts),
      formatCurrencyValue(reading.netSales),
      reading.transactionCount.toString()
    ])

    // Add table
    ;(doc as any).autoTable({
      startY: 28,
      head: [['Reading', 'Shift', 'Report #', 'Date & Time', 'Cashier', 'Location', 'Gross Sales', 'Discounts', 'Net Sales', 'Trans.']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'center' }
      }
    })

    doc.save(`X_Readings_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully')
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 dark:text-gray-100">X Readings (Mid-Shift Reports)</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View all X readings for your assigned location(s). X Readings are mid-shift reports that don't reset counters.
        </p>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg dark:text-gray-100">Filters & Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Shift #, cashier, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">From Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">To Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setDateFrom('')
                setDateTo('')
              }}
              className="gap-2"
            >
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReadings}
              className="gap-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
            >
              <DocumentTextIcon className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total X Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredReadings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Gross Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrencyValue(filteredReadings.reduce((sum, r) => sum + r.grossSales, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Net Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrencyValue(filteredReadings.reduce((sum, r) => sum + r.netSales, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {filteredReadings.reduce((sum, r) => sum + r.transactionCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DataGrid */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading X readings...</p>
            </div>
          ) : (
            <DataGrid
              dataSource={filteredReadings}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              keyExpr="id"
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              noDataText={
                searchTerm || dateFrom || dateTo
                  ? 'No X readings found. Try adjusting your filters.'
                  : 'No X readings have been generated yet for your location(s).'
              }
            >
              <Paging defaultPageSize={20} />
              <Pager
                visible={true}
                displayMode="full"
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector={true}
                showInfo={true}
                showNavigationButtons={true}
              />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel visible={true} width={240} placeholder="Search all columns..." />
              <ColumnChooser enabled={true} mode="select" height={400}>
                <ColumnChooserSearch enabled={true} />
                <ColumnChooserSelection allowSelectAll={true} />
              </ColumnChooser>
              <Toolbar>
                <Item name="searchPanel" />
                <Item name="columnChooserButton" />
              </Toolbar>

              <Column
                dataField="readingNumber"
                caption="Reading #"
                width={110}
                alignment="center"
                cellRender={renderReadingNumber}
              />
              <Column
                dataField="shiftNumber"
                caption="Shift #"
                width={120}
              />
              <Column
                dataField="reportNumber"
                caption="Report #"
                width={120}
                cellRender={renderReportNumber}
              />
              <Column
                dataField="readingTime"
                caption="Date & Time"
                width={180}
                cellRender={renderDate}
                dataType="datetime"
              />
              <Column
                dataField="cashierName"
                caption="Cashier"
                width={140}
              />
              <Column
                dataField="locationName"
                caption="Location"
                width={150}
              />
              <Column
                dataField="grossSales"
                caption="Gross Sales"
                width={130}
                cellRender={renderGrossSales}
                dataType="number"
                format={{ type: 'currency', currency: 'PHP', precision: 2 }}
              />
              <Column
                dataField="totalDiscounts"
                caption="Discounts"
                width={120}
                cellRender={renderCurrency}
                dataType="number"
                format={{ type: 'currency', currency: 'PHP', precision: 2 }}
              />
              <Column
                dataField="netSales"
                caption="Net Sales"
                width={130}
                cellRender={renderNetSales}
                dataType="number"
                format={{ type: 'currency', currency: 'PHP', precision: 2 }}
              />
              <Column
                dataField="expectedCash"
                caption="Expected Cash"
                width={130}
                cellRender={renderCurrency}
                dataType="number"
                format={{ type: 'currency', currency: 'PHP', precision: 2 }}
              />
              <Column
                dataField="transactionCount"
                caption="Transactions"
                width={110}
                alignment="center"
                dataType="number"
              />

              <Summary>
                <TotalItem
                  column="readingNumber"
                  summaryType="count"
                  displayFormat="Total: {0}"
                />
                <TotalItem
                  column="grossSales"
                  summaryType="sum"
                  valueFormat={{ type: 'currency', currency: 'PHP', precision: 2 }}
                  displayFormat="{0}"
                />
                <TotalItem
                  column="totalDiscounts"
                  summaryType="sum"
                  valueFormat={{ type: 'currency', currency: 'PHP', precision: 2 }}
                  displayFormat="{0}"
                />
                <TotalItem
                  column="netSales"
                  summaryType="sum"
                  valueFormat={{ type: 'currency', currency: 'PHP', precision: 2 }}
                  displayFormat="{0}"
                />
                <TotalItem
                  column="transactionCount"
                  summaryType="sum"
                  displayFormat="{0}"
                />
              </Summary>

              <Export enabled={false} />
            </DataGrid>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">About X Readings</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• X Readings are mid-shift reports that show current sales totals</li>
            <li>• They do NOT reset counters and can be generated multiple times per shift</li>
            <li>• Use X Readings to check sales performance during a shift</li>
            <li>• Only readings from your assigned location(s) are displayed</li>
            <li>• Z Readings (end-of-shift) are generated when closing a shift</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
