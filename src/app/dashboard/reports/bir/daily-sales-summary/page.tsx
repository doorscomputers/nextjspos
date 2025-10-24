"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { formatCurrency } from '@/lib/currencyUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import 'devextreme/dist/css/dx.light.css'

interface Location {
  id: number
  name: string
}

interface User {
  id: number
  username: string
  firstName: string | null
  lastName: string | null
}

interface DailySalesSummary {
  reportDate: string
  businessName: string
  businessTIN: string
  businessAddress: string
  location: string
  locationAddress: string
  cashier: string
  beginningInvoice: string
  endingInvoice: string
  totalInvoices: number
  grossSales: number
  totalDiscount: number
  netSales: number
  vatableSales: number
  vatAmount: number
  vatExemptSales: number
  zeroRatedSales: number
  cashSales: number
  creditSales: number
  digitalSales: number
  totalCollections: number
  seniorDiscount: number
  seniorCount: number
  pwdDiscount: number
  pwdCount: number
  regularDiscount: number
  totalTransactions: number
  voidTransactions: number
  voidAmount: number
  outputVAT: number
  netVATableSales: number
  beginningBalance: number
  endingBalance: number
  resetCounter: number
  zCounter: number
  lastZReadingDate: string | null
}

interface GridDataItem {
  label: string
  value: string | number
  category: string
}

export default function BIRDailySalesSummaryPage() {
  const { can } = usePermissions()
  const dataGridRef = useRef<any>(null)

  const [summary, setSummary] = useState<DailySalesSummary | null>(null)
  const [gridData, setGridData] = useState<GridDataItem[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [locations, setLocations] = useState<Location[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [selectedCashierId, setSelectedCashierId] = useState<number | null>(null)

  useEffect(() => {
    fetchLocations()
    fetchUsers()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok && data.locations) {
        setLocations(data.locations)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast.error('Failed to load locations')
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (response.ok && data.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load cashiers')
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('date', selectedDate.toISOString().split('T')[0])
      if (selectedLocationId) params.append('locationId', selectedLocationId.toString())
      if (selectedCashierId) params.append('cashierId', selectedCashierId.toString())

      const response = await fetch(`/api/reports/bir/daily-sales-summary?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.summary) {
        setSummary(data.summary)
        transformDataForGrid(data.summary)
        toast.success('Report generated successfully')
      } else {
        toast.error(data.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const transformDataForGrid = (data: DailySalesSummary) => {
    const gridItems: GridDataItem[] = [
      // Invoice Information
      { label: 'Beginning Invoice Number', value: data.beginningInvoice, category: 'Invoice Range' },
      { label: 'Ending Invoice Number', value: data.endingInvoice, category: 'Invoice Range' },
      { label: 'Total Invoices', value: data.totalInvoices, category: 'Invoice Range' },

      // Sales Breakdown
      { label: 'Gross Sales', value: formatCurrency(data.grossSales), category: 'Sales' },
      { label: 'VATable Sales (Base)', value: formatCurrency(data.vatableSales), category: 'Sales' },
      { label: 'VAT Amount (12%)', value: formatCurrency(data.vatAmount), category: 'Sales' },
      { label: 'VAT-Exempt Sales', value: formatCurrency(data.vatExemptSales), category: 'Sales' },
      { label: 'Zero-Rated Sales', value: formatCurrency(data.zeroRatedSales), category: 'Sales' },
      { label: 'Total Discounts', value: formatCurrency(data.totalDiscount), category: 'Sales' },
      { label: 'Net Sales', value: formatCurrency(data.netSales), category: 'Sales' },

      // Discount Breakdown
      { label: 'Senior Citizen Discount', value: formatCurrency(data.seniorDiscount), category: 'Discounts' },
      { label: 'Senior Citizen Count', value: data.seniorCount, category: 'Discounts' },
      { label: 'PWD Discount', value: formatCurrency(data.pwdDiscount), category: 'Discounts' },
      { label: 'PWD Count', value: data.pwdCount, category: 'Discounts' },
      { label: 'Regular Discount', value: formatCurrency(data.regularDiscount), category: 'Discounts' },

      // Payment Methods
      { label: 'Cash Sales', value: formatCurrency(data.cashSales), category: 'Payment Methods' },
      { label: 'Credit Sales', value: formatCurrency(data.creditSales), category: 'Payment Methods' },
      { label: 'Digital Sales', value: formatCurrency(data.digitalSales), category: 'Payment Methods' },
      { label: 'Total Collections', value: formatCurrency(data.totalCollections), category: 'Payment Methods' },

      // Transactions
      { label: 'Total Transactions', value: data.totalTransactions, category: 'Transactions' },
      { label: 'Void Transactions', value: data.voidTransactions, category: 'Transactions' },
      { label: 'Void Amount', value: formatCurrency(data.voidAmount), category: 'Transactions' },

      // BIR Compliance Fields
      { label: 'Beginning Balance (Accumulated Grand Total)', value: formatCurrency(data.beginningBalance), category: 'BIR Compliance' },
      { label: 'Ending Balance (New Grand Total)', value: formatCurrency(data.endingBalance), category: 'BIR Compliance' },
      { label: 'Reset Counter', value: data.resetCounter, category: 'BIR Compliance' },
      { label: 'Z-Counter', value: data.zCounter, category: 'BIR Compliance' },
      { label: 'Last Z-Reading Date', value: data.lastZReadingDate ? new Date(data.lastZReadingDate).toLocaleString() : 'N/A', category: 'BIR Compliance' },
    ]

    setGridData(gridItems)
  }

  const handlePrint = () => {
    window.print()
  }

  const onExporting = (e: any) => {
    if (!summary) return

    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Daily Sales Summary')

      // Add header
      worksheet.addRow([summary.businessName])
      worksheet.addRow([`TIN: ${summary.businessTIN}`])
      worksheet.addRow([summary.businessAddress])
      worksheet.addRow([`Location: ${summary.location}`])
      worksheet.addRow([`Report Date: ${new Date(summary.reportDate).toLocaleDateString()}`])
      worksheet.addRow([`Cashier: ${summary.cashier}`])
      worksheet.addRow([])

      exportToExcel({
        component: e.component,
        worksheet,
        topLeftCell: { row: 8, column: 1 },
        autoFilterEnabled: true,
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `BIR_Daily_Sales_Summary_${summary.reportDate}.xlsx`
          )
          toast.success('Excel exported successfully')
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('p', 'mm', 'a4')

      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('BIR DAILY SALES SUMMARY REPORT', 105, 20, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(summary.businessName, 105, 28, { align: 'center' })
      doc.text(`TIN: ${summary.businessTIN}`, 105, 34, { align: 'center' })
      doc.text(summary.businessAddress, 105, 40, { align: 'center' })
      doc.text(`Location: ${summary.location}`, 15, 48)
      doc.text(`Date: ${new Date(summary.reportDate).toLocaleDateString()}`, 15, 54)
      doc.text(`Cashier: ${summary.cashier}`, 15, 60)

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        topLeft: { x: 10, y: 68 },
      }).then(() => {
        doc.save(`BIR_Daily_Sales_Summary_${summary.reportDate}.pdf`)
        toast.success('PDF exported successfully')
      })
      e.cancel = true
    }
  }

  const getUserDisplayName = (userId: number) => {
    const user = users.find(u => u.id === userId)
    if (!user) return 'Select Cashier'
    return user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view reports
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Print-Only Header */}
      <div className="hidden print:block print-header p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">BIR DAILY SALES SUMMARY REPORT</h1>
          {summary && (
            <>
              <div className="text-lg font-semibold">{summary.businessName}</div>
              <div className="text-sm">TIN: {summary.businessTIN}</div>
              <div className="text-sm">{summary.businessAddress}</div>
              <div className="mt-4 text-sm">
                <div>Location: {summary.location}</div>
                <div>Report Date: {new Date(summary.reportDate).toLocaleDateString()}</div>
                <div>Cashier: {summary.cashier}</div>
                <div className="mt-2 text-xs text-gray-600">
                  Generated: {new Date().toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Print Table */}
        {summary && (
          <table className="w-full border-collapse border border-gray-300 mt-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {gridData.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-4 py-2">{item.category}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.label}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>This is a computer-generated BIR-compliant report.</p>
          <p>Date Printed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Screen-Only Header */}
      <div className="print:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BIR Daily Sales Summary Report</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          BIR-Compliant Daily Sales Summary (RR 18-2012 & RR 11-2004)
        </p>
      </div>

      <div className="print:hidden p-6">
        {/* Filter Controls */}
        <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Date Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Report Date:
                </label>
                <DateBox
                  value={selectedDate}
                  onValueChanged={(e) => e.value && setSelectedDate(e.value)}
                  displayFormat="MMMM dd, yyyy"
                  type="date"
                  max={new Date()}
                  stylingMode="outlined"
                  width="100%"
                />
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Business Location:
                </label>
                <SelectBox
                  items={locations}
                  value={selectedLocationId}
                  onValueChanged={(e) => setSelectedLocationId(e.value)}
                  displayExpr="name"
                  valueExpr="id"
                  placeholder="All Locations"
                  showClearButton={true}
                  searchEnabled={true}
                  stylingMode="outlined"
                  width="100%"
                />
              </div>

              {/* Cashier Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Cashier:
                </label>
                <SelectBox
                  items={users}
                  value={selectedCashierId}
                  onValueChanged={(e) => setSelectedCashierId(e.value)}
                  displayExpr={(item: User) => {
                    if (!item) return 'All Cashiers'
                    return item.firstName && item.lastName
                      ? `${item.firstName} ${item.lastName}`
                      : item.username
                  }}
                  valueExpr="id"
                  placeholder="All Cashiers"
                  showClearButton={true}
                  searchEnabled={true}
                  stylingMode="outlined"
                  width="100%"
                />
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={fetchReport}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                {loading ? 'Generating Report...' : 'Generate Report'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Gross Sales</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.grossSales)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Net Sales</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.netSales)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">VAT Amount (12%)</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.vatAmount)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Invoices</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.totalInvoices}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Generating BIR report...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DataGrid Report */}
        {!loading && summary && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">Report Details</CardTitle>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="print:hidden"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Report
              </Button>
            </CardHeader>
            <CardContent>
              {/* Business Info */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">Business:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{summary.businessName}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">TIN:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{summary.businessTIN}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">Location:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{summary.location}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">Date:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">
                      {new Date(summary.reportDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* DevExtreme DataGrid */}
              <div className="overflow-x-auto">
                <DataGrid
                  ref={dataGridRef}
                  dataSource={gridData}
                  showBorders={true}
                  showRowLines={true}
                  showColumnLines={true}
                  rowAlternationEnabled={true}
                  allowColumnReordering={false}
                  allowColumnResizing={true}
                  columnAutoWidth={true}
                  wordWrapEnabled={true}
                  onExporting={onExporting}
                  className="dx-card"
                  width="100%"
                  height={600}
                >
                  <LoadPanel enabled={true} />
                  <FilterRow visible={true} />
                  <HeaderFilter visible={true} />

                  <Toolbar>
                    <ToolbarItem name="exportButton" />
                  </Toolbar>

                  <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={false} />

                  <Column
                    dataField="category"
                    caption="Category"
                    width={180}
                    groupIndex={0}
                  />
                  <Column
                    dataField="label"
                    caption="Description"
                    minWidth={250}
                  />
                  <Column
                    dataField="value"
                    caption="Value"
                    width={200}
                    alignment="right"
                    cellRender={(data) => (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {data.value}
                      </span>
                    )}
                  />
                </DataGrid>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>BIR Compliance Note:</strong> This report includes all required BIR fields
                  including Beginning/Ending Balance (Accumulated Grand Total), Reset Counter, and
                  Z-Counter as mandated by RR 18-2012 and RR 11-2004.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Data State */}
        {!loading && !summary && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12">
              <div className="text-center">
                <DocumentArrowDownIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">
                  Select filters and click "Generate Report" to view the BIR Daily Sales Summary
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
            size: portrait;
          }
        }
      `}</style>
    </div>
  )
}
