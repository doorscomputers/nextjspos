'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getDatePresetRangePH, type DatePreset } from '@/lib/timezone'
import { RefreshCw, Users, TrendingUp, DollarSign, ShoppingCart, Trophy, FileSpreadsheet, FileText, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Pager,
  Export,
  Summary,
  TotalItem,
  GroupItem,
  ColumnChooser,
  Grouping,
  GroupPanel,
  Toolbar,
  Item as ToolbarItem,
  Sorting,
  MasterDetail,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import 'devextreme/dist/css/dx.light.css'
import { toast } from 'sonner'

const DATE_PRESETS: { value: DatePreset | 'Custom Range'; label: string }[] = [
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: 'This Week', label: 'This Week' },
  { value: 'Last Week', label: 'Last Week' },
  { value: 'This Month', label: 'This Month' },
  { value: 'Last Month', label: 'Last Month' },
  { value: 'This Quarter', label: 'This Quarter' },
  { value: 'Last Quarter', label: 'Last Quarter' },
  { value: 'This Year', label: 'This Year' },
  { value: 'Last Year', label: 'Last Year' },
  { value: 'Custom Range', label: 'Custom Range' },
]

export default function SalesByPersonnelReport() {
  const { can } = usePermissions()
  const dataGridRef = useRef<DataGrid>(null)

  // State
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [grandTotals, setGrandTotals] = useState<any>(null)
  const [topPerformer, setTopPerformer] = useState<any>(null)

  // Filters
  const [datePreset, setDatePreset] = useState<string>('This Month')
  const [startDate, setStartDate] = useState(() => {
    const range = getDatePresetRangePH('This Month')
    return range?.startDate || ''
  })
  const [endDate, setEndDate] = useState(() => {
    const range = getDatePresetRangePH('This Month')
    return range?.endDate || ''
  })
  const [salesPersonnelId, setSalesPersonnelId] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')

  // Dropdown data
  const [salesPersonnel, setSalesPersonnel] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Filter panel state
  const [showFilters, setShowFilters] = useState(true)

  // View mode: summary or detail
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary')

  // Load filter options
  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load sales personnel
        const personnelRes = await fetch('/api/sales-personnel?activeOnly=false')
        if (personnelRes.ok) {
          const data = await personnelRes.json()
          setSalesPersonnel(data.salesPersonnel || [])
        }

        // Load locations
        const locationsRes = await fetch('/api/user-locations')
        if (locationsRes.ok) {
          const data = await locationsRes.json()
          setLocations(data.locations || [])
        }
      } catch (error) {
        console.error('Error loading filter options:', error)
      }
    }
    loadFilters()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (salesPersonnelId && salesPersonnelId !== 'all') params.append('salesPersonnelId', salesPersonnelId)
      if (locationId && locationId !== 'all') params.append('locationId', locationId)

      const response = await fetch(`/api/reports/sales-by-personnel?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setSales(data.sales || [])
        setSummary(data.summary || [])
        setGrandTotals(data.grandTotals || null)
        setTopPerformer(data.topPerformer || null)
      } else {
        toast.error(data.error || 'Failed to fetch report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport()
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchReport()
    setRefreshing(false)
    toast.success('Report refreshed')
  }

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    if (preset === 'Custom Range') return

    const range = getDatePresetRangePH(preset as DatePreset)
    if (range) {
      setStartDate(range.startDate)
      setEndDate(range.endDate)
    }
  }

  // Export to Excel
  const handleExportExcel = () => {
    if (!dataGridRef.current) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales by Personnel')

    exportDataGrid({
      component: dataGridRef.current.instance,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.column?.dataField === 'totalAmount' ||
            gridCell.column?.dataField === 'subtotal' ||
            gridCell.column?.dataField === 'discountAmount' ||
            gridCell.column?.dataField === 'netAmount' ||
            gridCell.column?.dataField === 'lineTotal' ||
            gridCell.column?.dataField === 'unitPrice') {
          if (gridCell.rowType === 'data' || gridCell.rowType === 'group' || gridCell.rowType === 'groupFooter' || gridCell.rowType === 'totalFooter') {
            excelCell.numFmt = '₱#,##0.00'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Sales_by_Personnel_${startDate}_to_${endDate}.xlsx`
        )
      })
    })
  }

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    // Title
    doc.setFontSize(16)
    doc.text('Sales Report by Personnel', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 22)

    // Summary table
    const summaryData = summary.map(s => [
      s.name,
      s.code,
      s.salesCount.toString(),
      s.itemCount.toString(),
      `₱${s.netAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
    ])

    ;(doc as any).autoTable({
      startY: 28,
      head: [['Sales Personnel', 'Code', 'Sales Count', 'Items Sold', 'Total Revenue']],
      body: summaryData,
      foot: grandTotals ? [[
        'GRAND TOTAL',
        '',
        grandTotals.totalSales.toString(),
        grandTotals.totalItems.toString(),
        `₱${grandTotals.netAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      ]] : [],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`Sales_by_Personnel_${startDate}_to_${endDate}.pdf`)
  }

  // Print
  const handlePrint = () => {
    window.print()
  }

  // Currency cell render
  const currencyCellRender = (data: any) => {
    const value = data.value
    return (
      <span className="font-medium">
        ₱{value ? parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
      </span>
    )
  }

  // Detail row component
  const DetailRow = ({ data }: { data: any }) => {
    return (
      <div className="p-4 bg-slate-50 dark:bg-gray-900">
        <h4 className="text-sm font-semibold mb-2">Items Sold:</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Unit Price</th>
              <th className="text-right p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.data.items?.map((item: any, idx: number) => (
              <tr key={idx} className="border-b">
                <td className="p-2">{item.productName} {item.variationName && `(${item.variationName})`}</td>
                <td className="p-2">{item.sku || '-'}</td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">₱{parseFloat(item.unitPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-right font-medium">₱{parseFloat(item.lineTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!can(PERMISSIONS.REPORT_SALES_BY_PERSONNEL)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">You do not have permission to view this report.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white">
      {/* Header */}
      <div className="mb-6 print:mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 print:hidden" />
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white print:text-black">
                Sales by Personnel Report
              </h1>
            </div>
            <p className="text-slate-600 text-sm dark:text-gray-400 print:hidden">
              Track sales performance by individual sales personnel
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button onClick={handleRefresh} disabled={refreshing || loading} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExportExcel} disabled={sales.length === 0} variant="outline" size="sm" className="hover:border-green-500 hover:text-green-700">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={handleExportPDF} disabled={summary.length === 0} variant="outline" size="sm" className="hover:border-red-500 hover:text-red-700">
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm" className="hover:border-blue-500 hover:text-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <Card className="mb-6 print:hidden">
        <CardHeader className="py-3 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs">Date Range</Label>
                <Select value={datePreset} onValueChange={applyDatePreset}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset('Custom Range'); }}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset('Custom Range'); }}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Sales Personnel</Label>
                <Select value={salesPersonnelId} onValueChange={setSalesPersonnelId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Personnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Personnel</SelectItem>
                    {salesPersonnel.map(person => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.fullName} ({person.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={fetchReport} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Apply Filters'
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-gray-400">Total Sales</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {grandTotals?.totalSales?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-gray-400">Total Revenue</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  ₱{grandTotals?.netAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-gray-400">Items Sold</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {grandTotals?.totalItems?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-gray-400">Top Performer</div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate">
                  {topPerformer?.name || 'N/A'}
                </div>
                {topPerformer && (
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    ₱{topPerformer.netAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex gap-2 print:hidden">
        <Button
          variant={viewMode === 'summary' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('summary')}
        >
          Summary View
        </Button>
        <Button
          variant={viewMode === 'detail' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('detail')}
        >
          Detailed View
        </Button>
      </div>

      {/* Data Grid */}
      <Card className="shadow-xl border-slate-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          {viewMode === 'summary' ? (
            <DataGrid
              dataSource={summary}
              showBorders={true}
              showRowLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              keyExpr="id"
              className="dx-card"
            >
              <Paging defaultPageSize={20} />
              <Pager visible={true} showPageSizeSelector={true} allowedPageSizes={[10, 20, 50]} showInfo={true} />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <Sorting mode="multiple" />

              <Column dataField="code" caption="Code" width={100} />
              <Column dataField="name" caption="Sales Personnel" minWidth={180} />
              <Column dataField="salesCount" caption="Sales Count" width={110} alignment="right" />
              <Column dataField="itemCount" caption="Items Sold" width={110} alignment="right" />
              <Column dataField="totalRevenue" caption="Gross Revenue" width={140} alignment="right" cellRender={currencyCellRender} />
              <Column dataField="totalDiscount" caption="Discounts" width={120} alignment="right" cellRender={currencyCellRender} />
              <Column dataField="netAmount" caption="Net Revenue" width={140} alignment="right" cellRender={currencyCellRender} />

              <Summary>
                <TotalItem column="salesCount" summaryType="sum" displayFormat="Total: {0}" />
                <TotalItem column="itemCount" summaryType="sum" displayFormat="Total: {0}" />
                <TotalItem column="netAmount" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="Total: {0}" />
              </Summary>
            </DataGrid>
          ) : (
            <DataGrid
              ref={dataGridRef}
              dataSource={sales}
              showBorders={true}
              showRowLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              keyExpr="id"
              className="dx-card"
            >
              <Paging defaultPageSize={20} />
              <Pager visible={true} showPageSizeSelector={true} allowedPageSizes={[10, 20, 50, 100]} showInfo={true} />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel visible={true} width={250} placeholder="Search..." />
              <Sorting mode="multiple" />
              <Grouping autoExpandAll={false} />
              <GroupPanel visible={true} />
              <ColumnChooser enabled={true} mode="select" />
              <Export enabled={true} />

              <Toolbar>
                <ToolbarItem name="groupPanel" />
                <ToolbarItem name="searchPanel" />
                <ToolbarItem name="columnChooserButton" />
                <ToolbarItem name="exportButton" />
              </Toolbar>

              <Column dataField="salesPersonnelName" caption="Sales Personnel" groupIndex={0} />
              <Column dataField="salesPersonnelCode" caption="Code" width={80} />
              <Column dataField="invoiceNumber" caption="Invoice #" width={130} />
              <Column dataField="saleDate" caption="Date" width={110} dataType="date" format="MM/dd/yyyy" />
              <Column dataField="customerName" caption="Customer" minWidth={150} />
              <Column dataField="locationName" caption="Location" width={120} />
              <Column dataField="itemCount" caption="Items" width={80} alignment="right" />
              <Column dataField="subtotal" caption="Subtotal" width={120} alignment="right" cellRender={currencyCellRender} />
              <Column dataField="discountAmount" caption="Discount" width={100} alignment="right" cellRender={currencyCellRender} />
              <Column dataField="totalAmount" caption="Total" width={120} alignment="right" cellRender={currencyCellRender} />

              <Summary>
                <GroupItem column="invoiceNumber" summaryType="count" displayFormat="{0} invoices" />
                <GroupItem column="itemCount" summaryType="sum" displayFormat="{0} items" />
                <GroupItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="Total: {0}" />

                <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0} invoices" />
                <TotalItem column="itemCount" summaryType="sum" displayFormat="Total: {0} items" />
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="Grand Total: {0}" />
              </Summary>

              <MasterDetail enabled={true} component={DetailRow} />
            </DataGrid>
          )}
        </CardContent>
      </Card>

      {/* Print header - only visible when printing */}
      <div className="hidden print:block print:text-center print:mb-4">
        <h1 className="text-xl font-bold">Sales by Personnel Report</h1>
        <p className="text-sm">Period: {startDate} to {endDate}</p>
      </div>
    </div>
  )
}
