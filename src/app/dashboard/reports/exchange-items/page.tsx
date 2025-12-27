'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Grouping,
  GroupPanel,
  Pager,
  Paging,
  SearchPanel,
  Summary,
  TotalItem,
  GroupItem,
  Sorting,
  HeaderFilter,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import { formatCurrency } from '@/lib/currencyUtils'

export default function ExchangeItemsReport() {
  const { can } = usePermissions()
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<any[]>([])

  // Filter state
  const [dateRangePreset, setDateRangePreset] = useState('this_month')
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    locationId: '',
  })

  // Date range presets
  const datePresets = [
    { id: 'today', name: 'Today' },
    { id: 'yesterday', name: 'Yesterday' },
    { id: 'this_week', name: 'This Week' },
    { id: 'this_month', name: 'This Month' },
    { id: 'last_month', name: 'Last Month' },
    { id: 'custom', name: 'Custom Range' },
  ]

  const getDateRange = (preset: string) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    switch (preset) {
      case 'today':
        return { startDate: formatDate(today), endDate: formatDate(today) }
      case 'yesterday':
        return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) }
      case 'this_week':
        return { startDate: formatDate(startOfWeek), endDate: formatDate(today) }
      case 'this_month':
        return { startDate: formatDate(startOfMonth), endDate: formatDate(today) }
      case 'last_month':
        return { startDate: formatDate(startOfLastMonth), endDate: formatDate(endOfLastMonth) }
      case 'custom':
      default:
        return { startDate: filters.startDate, endDate: filters.endDate }
    }
  }

  const handleDateRangePresetChange = (e: any) => {
    const preset = e.value
    setDateRangePreset(preset)
    if (preset !== 'custom') {
      const { startDate, endDate } = getDateRange(preset)
      setFilters({ ...filters, startDate, endDate })
    }
  }

  useEffect(() => {
    fetchLocations()
    // Set default date range to this month
    const { startDate, endDate } = getDateRange('this_month')
    setFilters({ ...filters, startDate, endDate })
  }, [])

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      generateReport()
    }
  }, [filters.startDate, filters.endDate, filters.locationId])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations([{ id: '', name: 'All Locations' }, ...(data.locations || [])])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const generateReport = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.locationId) params.append('locationId', filters.locationId)

      const response = await fetch(`/api/reports/exchange-items?${params}`)
      const result = await response.json()

      if (response.ok) {
        setReportData(result.exchanges)
        setSummary(result.summary)
      } else {
        toast.error('Failed to generate report', { description: result.error })
      }
    } catch (error: any) {
      toast.error('Report Error', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Exchange Items Report')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          // Apply currency formatting for amount columns
          if (['returnItemTotal', 'exchangeItemTotal', 'priceDifference'].includes(gridCell.column.dataField)) {
            excelCell.numFmt = '#,##0.00'
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Exchange_Items_Report.xlsx')
      })
    })
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">You do not have permission to view this report.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exchange & Return Items Report</h1>
          <p className="text-muted-foreground">
            Detailed breakdown of items returned and replaced in exchange transactions
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Date Range Preset */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Date Range</label>
              <SelectBox
                dataSource={datePresets}
                displayExpr="name"
                valueExpr="id"
                value={dateRangePreset}
                onValueChanged={handleDateRangePresetChange}
                placeholder="Select date range"
              />
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Start Date</label>
              <DateBox
                value={filters.startDate}
                onValueChanged={(e) => setFilters({ ...filters, startDate: e.value })}
                type="date"
                displayFormat="yyyy-MM-dd"
                disabled={dateRangePreset !== 'custom'}
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">End Date</label>
              <DateBox
                value={filters.endDate}
                onValueChanged={(e) => setFilters({ ...filters, endDate: e.value })}
                type="date"
                displayFormat="yyyy-MM-dd"
                disabled={dateRangePreset !== 'custom'}
              />
            </div>

            {/* Location */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Location</label>
              <SelectBox
                dataSource={locations}
                displayExpr="name"
                valueExpr="id"
                value={filters.locationId}
                onValueChanged={(e) => setFilters({ ...filters, locationId: e.value })}
                placeholder="All Locations"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={generateReport} disabled={loading} variant="default" size="sm">
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Exchange Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Exchanges</p>
                <p className="text-2xl font-bold">{summary.totalExchanges}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Items Returned</p>
                <p className="text-2xl font-bold">{summary.totalItemsReturned}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Items Issued</p>
                <p className="text-2xl font-bold">{summary.totalItemsIssued}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Value Impact</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.netValueImpact)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Exchange Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DataGrid
            dataSource={reportData}
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            onExporting={onExporting}
          >
            <StateStoring enabled={true} type="localStorage" storageKey="exchangeItemsReportGrid" />
            <ColumnChooser enabled={true} mode="select" />
            <ColumnFixing enabled={true} />
            <Export enabled={true} allowExportSelectedData={false} />
            <Grouping contextMenuEnabled={true} />
            <GroupPanel visible={true} emptyPanelText="Drag column headers here to group" />
            <SearchPanel visible={true} width={240} placeholder="Search..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Paging defaultPageSize={50} />
            <Pager
              visible={true}
              displayMode="full"
              showPageSizeSelector={true}
              allowedPageSizes={[25, 50, 100, 200]}
              showNavigationButtons={true}
              showInfo={true}
            />
            <Sorting mode="multiple" />

            <Toolbar>
              <ToolbarItem name="groupPanel" />
              <ToolbarItem name="exportButton" />
              <ToolbarItem name="columnChooserButton" />
              <ToolbarItem name="searchPanel" />
            </Toolbar>

            {/* Exchange Information */}
            <Column dataField="exchangeNumber" caption="Exchange #" width={150} />
            <Column dataField="exchangeDate" caption="Exchange Date" dataType="date" format="MM/dd/yyyy" width={120} />
            <Column dataField="originalInvoice" caption="Original Invoice" width={150} />
            <Column dataField="locationName" caption="Location" width={150} />
            <Column dataField="customerName" caption="Customer" width={150} />
            <Column dataField="exchangeReason" caption="Reason" width={200} />

            {/* Returned Item */}
            <Column caption="RETURNED ITEM" alignment="center">
              <Column dataField="returnedProductName" caption="Product Name" width={200} />
              <Column dataField="returnedVariationName" caption="Variation" width={120} />
              <Column dataField="returnedQuantity" caption="Qty" dataType="number" width={80} alignment="right" />
              <Column dataField="returnedUnitPrice" caption="Unit Price" dataType="number" format="#,##0.00" width={100} alignment="right" />
              <Column dataField="returnItemTotal" caption="Total" dataType="number" format="#,##0.00" width={120} alignment="right" />
            </Column>

            {/* Exchange Item */}
            <Column caption="REPLACEMENT ITEM" alignment="center">
              <Column dataField="exchangedProductName" caption="Product Name" width={200} />
              <Column dataField="exchangedVariationName" caption="Variation" width={120} />
              <Column dataField="exchangedQuantity" caption="Qty" dataType="number" width={80} alignment="right" />
              <Column dataField="exchangedUnitPrice" caption="Unit Price" dataType="number" format="#,##0.00" width={100} alignment="right" />
              <Column dataField="exchangeItemTotal" caption="Total" dataType="number" format="#,##0.00" width={120} alignment="right" />
            </Column>

            {/* Price Difference */}
            <Column
              dataField="priceDifference"
              caption="Price Difference"
              dataType="number"
              format="#,##0.00"
              width={130}
              alignment="right"
              cellRender={(cellData: any) => {
                const value = cellData.value
                const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600'
                return <span className={color}>{formatCurrency(value)}</span>
              }}
            />

            <Column dataField="paymentMethod" caption="Payment Method" width={130} />

            <Summary>
              <GroupItem column="returnedQuantity" summaryType="sum" displayFormat="{0}" alignByColumn={true} />
              <GroupItem column="returnItemTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" alignByColumn={true} />
              <GroupItem column="exchangedQuantity" summaryType="sum" displayFormat="{0}" alignByColumn={true} />
              <GroupItem column="exchangeItemTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" alignByColumn={true} />
              <GroupItem column="priceDifference" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" alignByColumn={true} />

              <TotalItem column="exchangeNumber" summaryType="count" displayFormat="Total: {0} exchanges" />
              <TotalItem column="returnedQuantity" summaryType="sum" displayFormat="{0}" />
              <TotalItem column="returnItemTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
              <TotalItem column="exchangedQuantity" summaryType="sum" displayFormat="{0}" />
              <TotalItem column="exchangeItemTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
              <TotalItem column="priceDifference" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            </Summary>
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  )
}
