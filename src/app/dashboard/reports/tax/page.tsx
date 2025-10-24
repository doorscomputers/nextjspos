"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { formatCurrency } from '@/lib/currencyUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrinterIcon, DocumentArrowDownIcon, CalendarIcon } from '@heroicons/react/24/outline'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  LoadPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
  Paging,
  SearchPanel,
  ColumnChooser,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'
import 'devextreme/dist/css/dx.light.css'

interface Location {
  id: number
  name: string
}

interface TaxReportData {
  date: string
  referenceNo: string
  supplier: string
  taxNumber: string
  totalAmount: number
  paymentMethod: string
  discount: number
  vat: number
  taxExempt: number
  type: 'purchase' | 'sale' | 'expense'
}

interface TaxSummary {
  inputTax: number
  outputTax: number
  expenseTax: number
  netTax: number
}

export default function TaxReportPage() {
  const { can } = usePermissions()
  const inputTaxGridRef = useRef<DataGrid>(null)
  const outputTaxGridRef = useRef<DataGrid>(null)
  const expenseTaxGridRef = useRef<DataGrid>(null)

  const [loading, setLoading] = useState(false)
  const [inputTaxData, setInputTaxData] = useState<TaxReportData[]>([])
  const [outputTaxData, setOutputTaxData] = useState<TaxReportData[]>([])
  const [expenseTaxData, setExpenseTaxData] = useState<TaxReportData[]>([])
  const [taxSummary, setTaxSummary] = useState<TaxSummary>({
    inputTax: 0,
    outputTax: 0,
    expenseTax: 0,
    netTax: 0,
  })
  const [activeTab, setActiveTab] = useState('input-tax')

  // Filters
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }, [])
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [locationId, setLocationId] = useState<string>('all')
  const [locations, setLocations] = useState<Location[]>([])
  const [showFilters, setShowFilters] = useState(true)

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const locData = Array.isArray(data?.locations)
            ? data.locations
            : Array.isArray(data)
            ? data
            : []
          setLocations(locData)
        } else {
          setLocations([])
        }
      } catch (error) {
        console.error('Error fetching locations:', error)
        setLocations([])
      }
    }
    fetchLocations()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      if (locationId !== 'all') {
        params.append('locationId', locationId)
      }

      const res = await fetch(`/api/reports/tax?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        console.error('Tax Report API error:', error)
        throw new Error(error.error || error.details || 'Failed to fetch report')
      }

      const reportData = await res.json()

      setInputTaxData(reportData.inputTax || [])
      setOutputTaxData(reportData.outputTax || [])
      setExpenseTaxData(reportData.expenseTax || [])
      setTaxSummary(reportData.summary || {
        inputTax: 0,
        outputTax: 0,
        expenseTax: 0,
        netTax: 0,
      })

      toast.success('Tax report loaded successfully')
    } catch (error: any) {
      console.error('Error fetching tax report:', error)
      toast.error(error.message || 'Failed to load tax report')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchReport()
  }, [])

  const handleResetFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLocationId('all')
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const activeFilterCount = useMemo(() => {
    return [
      startDate !== defaultStartDate || endDate !== defaultEndDate,
      locationId !== 'all',
    ].filter(Boolean).length
  }, [startDate, endDate, defaultStartDate, defaultEndDate, locationId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const onExportingGrid = (e: any, tabName: string, data: TaxReportData[]) => {
    if (!data || data.length === 0) {
      toast.error('No data to export')
      e.cancel = true
      return
    }

    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet(`${tabName} Tax Report`)

      // Add header
      worksheet.addRow(['Tax Report'])
      worksheet.addRow([`Type: ${tabName}`])
      worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`])
      worksheet.addRow([])

      exportToExcel({
        component: e.component,
        worksheet,
        topLeftCell: { row: 5, column: 1 },
        autoFilterEnabled: true,
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `Tax_Report_${tabName}_${startDate}_to_${endDate}.xlsx`
          )
          toast.success('Excel exported successfully')
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('l', 'mm', 'a4')

      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('TAX REPORT', 148, 15, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Type: ${tabName}`, 148, 23, { align: 'center' })
      doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 148, 29, { align: 'center' })

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        topLeft: { x: 10, y: 35 },
      }).then(() => {
        doc.save(`Tax_Report_${tabName}_${startDate}_to_${endDate}.pdf`)
        toast.success('PDF exported successfully')
      })
      e.cancel = true
    }
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view reports.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 print:p-0 print:bg-white">
      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">TAX REPORT</h1>
          <div className="text-sm">
            <div>Period: {formatDate(startDate)} to {formatDate(endDate)}</div>
            <div className="mt-2">Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="print:hidden mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tax Report</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Input Tax (Purchase), Output Tax (Sales), and Expense Tax Analysis
        </p>
      </div>

      {/* Filters */}
      <div className="print:hidden mb-6">
        <ReportFilterPanel
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
          activeCount={activeFilterCount}
          onClearAll={handleResetFilters}
          clearLabel="Reset Filters"
          description="Select date range and location to filter tax data."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate" className="mb-2 block">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>

            <div>
              <Label htmlFor="endDate" className="mb-2 block">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>

            <div>
              <Label htmlFor="location" className="mb-2 block">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
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

            <div className="flex items-end">
              <Button
                onClick={fetchReport}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </ReportFilterPanel>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:mb-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Input Tax (Purchase)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(taxSummary.inputTax)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Tax on purchases
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Output Tax (Sales)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(taxSummary.outputTax)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Tax on sales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Expense Tax
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(taxSummary.expenseTax)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Tax on expenses
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${
          taxSummary.netTax >= 0
            ? 'from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700'
            : 'from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 border-red-200 dark:border-red-700'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Net Tax Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              taxSummary.netTax >= 0
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {formatCurrency(taxSummary.netTax)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Output - Input - Expense
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different tax types */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between print:hidden">
          <CardTitle className="text-gray-900 dark:text-white">Tax Details</CardTitle>
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="border-gray-300 dark:border-gray-600"
          >
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 dark:bg-gray-700">
              <TabsTrigger
                value="input-tax"
                className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
              >
                Input Tax (Purchase)
              </TabsTrigger>
              <TabsTrigger
                value="output-tax"
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
              >
                Output Tax (Sales)
              </TabsTrigger>
              <TabsTrigger
                value="expense-tax"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                Expense Tax
              </TabsTrigger>
            </TabsList>

            {/* Input Tax Tab */}
            <TabsContent value="input-tax">
              <DataGrid
                ref={inputTaxGridRef}
                dataSource={inputTaxData}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                onExporting={(e) => onExportingGrid(e, 'Input', inputTaxData)}
                height={500}
              >
                <LoadPanel enabled={true} />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <SearchPanel visible={true} highlightCaseSensitive={false} />
                <ColumnChooser enabled={true} mode="select" />
                <Paging defaultPageSize={25} />

                <Toolbar>
                  <ToolbarItem name="searchPanel" />
                  <ToolbarItem name="columnChooserButton" />
                  <ToolbarItem name="exportButton" />
                </Toolbar>

                <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={false} />

                <Column dataField="date" caption="Date" dataType="date" format="MMM dd, yyyy" width={120} />
                <Column dataField="referenceNo" caption="Reference No" width={150} />
                <Column dataField="supplier" caption="Supplier" minWidth={180} />
                <Column dataField="taxNumber" caption="Tax Number" width={150} />
                <Column dataField="paymentMethod" caption="Payment Method" width={150} />
                <Column dataField="totalAmount" caption="Total Amount" dataType="number" format="₱#,##0.00" alignment="right" width={140} />
                <Column dataField="discount" caption="Discount" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="vat" caption="VAT" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="taxExempt" caption="Tax Exempt" dataType="number" format="₱#,##0.00" alignment="right" width={130} />

                <Summary>
                  <TotalItem column="totalAmount" summaryType="sum" displayFormat="Total: ₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="discount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="vat" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="taxExempt" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                </Summary>
              </DataGrid>
            </TabsContent>

            {/* Output Tax Tab */}
            <TabsContent value="output-tax">
              <DataGrid
                ref={outputTaxGridRef}
                dataSource={outputTaxData}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                onExporting={(e) => onExportingGrid(e, 'Output', outputTaxData)}
                height={500}
              >
                <LoadPanel enabled={true} />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <SearchPanel visible={true} highlightCaseSensitive={false} />
                <ColumnChooser enabled={true} mode="select" />
                <Paging defaultPageSize={25} />

                <Toolbar>
                  <ToolbarItem name="searchPanel" />
                  <ToolbarItem name="columnChooserButton" />
                  <ToolbarItem name="exportButton" />
                </Toolbar>

                <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={false} />

                <Column dataField="date" caption="Date" dataType="date" format="MMM dd, yyyy" width={120} />
                <Column dataField="referenceNo" caption="Invoice No" width={150} />
                <Column dataField="supplier" caption="Customer" minWidth={180} />
                <Column dataField="taxNumber" caption="Tax Number" width={150} />
                <Column dataField="paymentMethod" caption="Payment Method" width={150} />
                <Column dataField="totalAmount" caption="Total Amount" dataType="number" format="₱#,##0.00" alignment="right" width={140} />
                <Column dataField="discount" caption="Discount" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="vat" caption="VAT" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="taxExempt" caption="Tax Exempt" dataType="number" format="₱#,##0.00" alignment="right" width={130} />

                <Summary>
                  <TotalItem column="totalAmount" summaryType="sum" displayFormat="Total: ₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="discount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="vat" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="taxExempt" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                </Summary>
              </DataGrid>
            </TabsContent>

            {/* Expense Tax Tab */}
            <TabsContent value="expense-tax">
              <DataGrid
                ref={expenseTaxGridRef}
                dataSource={expenseTaxData}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                onExporting={(e) => onExportingGrid(e, 'Expense', expenseTaxData)}
                height={500}
              >
                <LoadPanel enabled={true} />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <SearchPanel visible={true} highlightCaseSensitive={false} />
                <ColumnChooser enabled={true} mode="select" />
                <Paging defaultPageSize={25} />

                <Toolbar>
                  <ToolbarItem name="searchPanel" />
                  <ToolbarItem name="columnChooserButton" />
                  <ToolbarItem name="exportButton" />
                </Toolbar>

                <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={false} />

                <Column dataField="date" caption="Date" dataType="date" format="MMM dd, yyyy" width={120} />
                <Column dataField="referenceNo" caption="Reference No" width={150} />
                <Column dataField="supplier" caption="Description" minWidth={180} />
                <Column dataField="taxNumber" caption="Tax Number" width={150} />
                <Column dataField="paymentMethod" caption="Payment Method" width={150} />
                <Column dataField="totalAmount" caption="Total Amount" dataType="number" format="₱#,##0.00" alignment="right" width={140} />
                <Column dataField="discount" caption="Discount" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="vat" caption="VAT" dataType="number" format="₱#,##0.00" alignment="right" width={120} />
                <Column dataField="taxExempt" caption="Tax Exempt" dataType="number" format="₱#,##0.00" alignment="right" width={130} />

                <Summary>
                  <TotalItem column="totalAmount" summaryType="sum" displayFormat="Total: ₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="discount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="vat" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                  <TotalItem column="taxExempt" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
                </Summary>
              </DataGrid>
            </TabsContent>
          </Tabs>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="ml-4 text-gray-600 dark:text-gray-300">Loading tax data...</p>
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
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 1.5cm;
            size: landscape;
          }
        }
      `}</style>
    </div>
  )
}
