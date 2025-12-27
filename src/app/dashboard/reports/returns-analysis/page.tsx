'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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

export default function ReturnsAnalysisReport() {
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
    returnType: 'all', // 'all', 'supplier', 'customer'
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

  const returnTypes = [
    { id: 'all', name: 'All Returns' },
    { id: 'supplier', name: 'Supplier Returns Only' },
    { id: 'customer', name: 'Customer Returns Only' },
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
  }, [filters.startDate, filters.endDate])

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
      if (filters.returnType) params.append('returnType', filters.returnType)

      const response = await fetch(`/api/reports/returns?${params}`)
      const result = await response.json()

      if (response.ok) {
        setReportData(result.returns)
        setSummary(result.summary)
        toast.success(`Report generated: ${result.returns.length} records found`)
      } else {
        toast.error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Returns Analysis')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (gridCell.column.dataField === 'quantity' || gridCell.column.dataField === 'totalAmount') {
            excelCell.numFmt = '#,##0.00'
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Returns_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
  }

  const onToolbarPreparing = (e: any) => {
    e.toolbarOptions.items.unshift(
      {
        location: 'after',
        widget: 'dxButton',
        options: {
          icon: 'refresh',
          text: 'Refresh',
          onClick: () => generateReport(),
        },
      },
      {
        location: 'after',
        widget: 'dxButton',
        options: {
          icon: 'print',
          text: 'Print',
          onClick: () => window.print(),
        },
      }
    )
  }

  if (!can(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">
          You do not have permission to view this report
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Returns Analysis Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive view of supplier and customer returns per item
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Preset */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <SelectBox
                dataSource={datePresets}
                displayExpr="name"
                valueExpr="id"
                value={dateRangePreset}
                onValueChanged={handleDateRangePresetChange}
                stylingMode="outlined"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DateBox
                value={filters.startDate}
                onValueChanged={(e) => {
                  setFilters({ ...filters, startDate: e.value?.toISOString().split('T')[0] || '' })
                  setDateRangePreset('custom')
                }}
                type="date"
                displayFormat="MMM dd, yyyy"
                stylingMode="outlined"
                disabled={dateRangePreset !== 'custom'}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <DateBox
                value={filters.endDate}
                onValueChanged={(e) => {
                  setFilters({ ...filters, endDate: e.value?.toISOString().split('T')[0] || '' })
                  setDateRangePreset('custom')
                }}
                type="date"
                displayFormat="MMM dd, yyyy"
                stylingMode="outlined"
                disabled={dateRangePreset !== 'custom'}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location</Label>
              <SelectBox
                dataSource={locations}
                displayExpr="name"
                valueExpr="id"
                value={filters.locationId}
                onValueChanged={(e) => {
                  setFilters({ ...filters, locationId: e.value })
                  if (filters.startDate && filters.endDate) {
                    setTimeout(() => generateReport(), 100)
                  }
                }}
                searchEnabled={true}
                stylingMode="outlined"
              />
            </div>

            {/* Return Type */}
            <div className="space-y-2">
              <Label>Return Type</Label>
              <SelectBox
                dataSource={returnTypes}
                displayExpr="name"
                valueExpr="id"
                value={filters.returnType}
                onValueChanged={(e) => {
                  setFilters({ ...filters, returnType: e.value })
                  if (filters.startDate && filters.endDate) {
                    setTimeout(() => generateReport(), 100)
                  }
                }}
                stylingMode="outlined"
              />
            </div>

            {/* Generate Button */}
            <div className="space-y-2 flex items-end">
              <Button
                onClick={generateReport}
                disabled={loading || !filters.startDate || !filters.endDate}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalReturns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Supplier Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {summary.totalSupplierReturns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Customer Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {summary.totalCustomerReturns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Quantity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {summary.totalQuantity.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataGrid */}
      <Card>
        <CardContent className="pt-6">
          <DataGrid
            dataSource={reportData}
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            onExporting={onExporting}
            onToolbarPreparing={onToolbarPreparing}
            height="calc(100vh - 550px)"
          >
            <StateStoring enabled={true} type="localStorage" storageKey="returnsAnalysisGrid" />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} highlightCaseSensitive={false} width={240} />
            <GroupPanel visible={true} />
            <Grouping autoExpandAll={false} />
            <ColumnChooser enabled={true} mode="select" />
            <ColumnFixing enabled={true} />
            <Sorting mode="multiple" />
            <Export enabled={true} allowExportSelectedData={false} />

            <Paging defaultPageSize={50} />
            <Pager
              visible={true}
              displayMode="full"
              showPageSizeSelector={true}
              allowedPageSizes={[20, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Column
              dataField="returnType"
              caption="Type"
              width={150}
              alignment="center"
              cellRender={(data) => {
                const isSupplier = data.value === 'Supplier Return'
                return (
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      isSupplier
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}
                  >
                    {data.value}
                  </span>
                )
              }}
            />

            <Column dataField="returnNumber" caption="Return #" width={150} />

            <Column
              dataField="returnDate"
              caption="Return Date"
              dataType="date"
              format="MMM dd, yyyy"
              width={130}
            />

            <Column
              dataField="approvedAt"
              caption="Approved At"
              dataType="datetime"
              format="MMM dd, yyyy h:mm a"
              width={170}
            />

            <Column dataField="location" caption="Location" width={150} />
            <Column dataField="customerSupplier" caption="Customer/Supplier" width={180} />
            <Column dataField="productName" caption="Product" width={200} />
            <Column dataField="productSku" caption="SKU" width={120} />
            <Column dataField="variationName" caption="Variation" width={150} />

            <Column
              dataField="quantity"
              caption="Quantity"
              dataType="number"
              format="#,##0.00"
              width={100}
              alignment="right"
            />

            <Column
              dataField="unitCost"
              caption="Unit Cost"
              dataType="number"
              format="#,##0.00"
              width={120}
              alignment="right"
              customizeText={(cellInfo) => formatCurrency(cellInfo.value)}
            />

            <Column
              dataField="totalAmount"
              caption="Total Amount"
              dataType="number"
              format="#,##0.00"
              width={140}
              alignment="right"
              customizeText={(cellInfo) => formatCurrency(cellInfo.value)}
            />

            <Column dataField="condition" caption="Condition" width={120} />
            <Column dataField="returnReason" caption="Return Reason" width={200} />
            <Column dataField="notes" caption="Notes" width={200} visible={false} />

            <Summary>
              <TotalItem column="returnNumber" summaryType="count" displayFormat="Total: {0}" />
              <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem
                column="totalAmount"
                summaryType="sum"
                valueFormat="#,##0.00"
                customizeText={(data) => formatCurrency(data.value)}
              />

              <GroupItem column="quantity" summaryType="sum" valueFormat="#,##0.00" alignByColumn={true} />
              <GroupItem
                column="totalAmount"
                summaryType="sum"
                valueFormat="#,##0.00"
                alignByColumn={true}
                customizeText={(data) => formatCurrency(data.value)}
              />
            </Summary>

            <Toolbar>
              <ToolbarItem name="groupPanel" />
              <ToolbarItem name="exportButton" />
              <ToolbarItem name="columnChooserButton" />
              <ToolbarItem name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  )
}
