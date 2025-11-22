'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  CalendarIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BIRReadingDisplay } from '@/components/BIRReadingDisplay'
import DataGrid, {
  Column,
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

export default function ZReadingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shiftId = searchParams.get('shiftId')
  const printMode = searchParams.get('print') === 'true'

  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // State for individual reading view
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
  const [selectedReading, setSelectedReading] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (shiftId) {
      // If shiftId parameter exists, fetch and display that specific reading
      fetchIndividualReading(parseInt(shiftId))
    } else {
      // Otherwise show the list
      fetchReadings()
    }
  }, [shiftId])

  const fetchReadings = async () => {
    try {
      setLoading(true)
      setViewMode('list')
      // Filter by type=Z to only get Z Readings
      const params = new URLSearchParams({ limit: '500', type: 'Z' })
      const response = await fetch(`/api/readings/history?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch Z readings')

      const data = await response.json()
      setReadings(Array.isArray(data.readings) ? data.readings : [])
    } catch (error: any) {
      console.error('Error fetching Z readings:', error)
      toast.error('Failed to load Z readings')
    } finally {
      setLoading(false)
    }
  }

  const fetchIndividualReading = async (shiftIdNum: number) => {
    try {
      setLoadingDetail(true)
      setViewMode('detail')

      // Fetch the Z Reading data for this specific shift (viewOnly mode to retrieve existing reading)
      const response = await fetch(`/api/readings/z-reading?shiftId=${shiftIdNum}&viewOnly=true`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch Z reading details')
      }

      const data = await response.json()
      // API returns the reading payload directly
      setSelectedReading(data)

      // Auto-print if print mode is enabled
      if (printMode) {
        setTimeout(() => window.print(), 500)
      }
    } catch (error: any) {
      console.error('Error fetching Z reading details:', error)
      toast.error('Failed to load Z reading details')
      // Go back to list view on error
      router.push('/dashboard/readings/z-reading')
    } finally {
      setLoadingDetail(false)
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
      <Badge className="bg-purple-600 text-white">
        Z-{data.value}
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

  // View/Print individual reading
  const handleViewReading = (reading: Reading) => {
    router.push(`/dashboard/readings/z-reading?shiftId=${reading.shiftId}`)
  }

  const handlePrintReading = (reading: Reading) => {
    router.push(`/dashboard/readings/z-reading?shiftId=${reading.shiftId}&print=true`)
  }

  const handleBackToList = () => {
    router.push('/dashboard/readings/z-reading')
  }

  // Export to Excel
  const handleExportExcel = () => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Z Readings')

    // Add title
    worksheet.mergeCells('A1:K1')
    const titleRow = worksheet.getCell('A1')
    titleRow.value = 'Z READINGS REPORT (END-OF-DAY)'
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
        fgColor: { argb: 'FF9333EA' }
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
      saveAs(new Blob([buffer]), `Z_Readings_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    })

    toast.success('Excel file exported successfully')
  }

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Z READINGS REPORT (END-OF-DAY)', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })

    // Add date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' })

    // Prepare table data
    const tableData = filteredReadings.map(reading => [
      `Z-${reading.readingNumber}`,
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
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'center' }
      }
    })

    doc.save(`Z_Readings_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully')
  }

  // If in detail view mode, show the individual reading
  if (viewMode === 'detail') {
    if (loadingDetail) {
      return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading Z Reading...</p>
          </div>
        </div>
      )
    }

    if (!selectedReading) {
      return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">Z Reading not found</p>
              <Button onClick={handleBackToList} className="mt-4 gap-2">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to List
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Back button */}
        <div className="mb-6 print:hidden">
          <Button onClick={handleBackToList} variant="outline" className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Z Readings List
          </Button>
        </div>

        {/* Display the reading in BIR format */}
        <BIRReadingDisplay
          zReading={selectedReading}
          onClose={handleBackToList}
        />
      </div>
    )
  }

  // Otherwise show the list view
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 dark:text-gray-100">Z Readings (End-of-Day Reports)</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View all Z readings for your assigned location(s). Z Readings are end-of-day reports generated when closing shifts.
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
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Z Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{filteredReadings.length}</div>
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
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
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
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading Z readings...</p>
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
                  ? 'No Z readings found. Try adjusting your filters.'
                  : 'No Z readings have been generated yet for your location(s).'
              }
            >
              <Paging defaultPageSize={20} />
              <Pager
                visible={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector={true}
                showInfo={true}
                showNavigationButtons={true}
              />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel visible={true} width={240} placeholder="Search all columns..." />

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
              <Column
                caption="Actions"
                width={180}
                alignment="center"
                cellRender={(data: any) => {
                  const reading = data.data as Reading
                  return (
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewReading(reading)}
                        className="gap-1 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintReading(reading)}
                        className="gap-1 hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-400"
                      >
                        <PrinterIcon className="h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  )
                }}
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
      <Card className="mt-6 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">About Z Readings</h4>
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
            <li>• Z Readings are end-of-day reports generated when closing a cashier shift</li>
            <li>• They reset counters and mark the official end of a shift</li>
            <li>• Z Readings are required for BIR compliance and must be kept with daily records</li>
            <li>• Only readings from your assigned location(s) are displayed</li>
            <li>• Each shift can only have ONE Z Reading (generated at shift close)</li>
            <li>• For mid-shift reports without resetting counters, use X Readings instead</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
