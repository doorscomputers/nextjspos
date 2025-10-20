'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PivotGrid, {
  FieldChooser,
  Export,
  FieldPanel,
  StateStoring,
  Scrolling,
} from 'devextreme-react/pivot-grid'
import PivotGridDataSource from 'devextreme/ui/pivot_grid/data_source'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportPivotGrid } from 'devextreme/excel_exporter'

export default function TransfersPerItemPivotReport() {
  const { can } = usePermissions()
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const pivotGridRef = useRef<PivotGrid>(null)

  // Filter state
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    fromLocationId: '',
    toLocationId: '',
    status: 'all',
  })

  // PivotGrid data source configuration
  const [dataSource, setDataSource] = useState<PivotGridDataSource | null>(null)

  useEffect(() => {
    fetchLocations()
    fetchProducts()
    generateReport()
  }, [])

  useEffect(() => {
    if (reportData.length > 0) {
      const pivotDataSource = new PivotGridDataSource({
        fields: [
          // Row fields
          {
            caption: 'Product Name',
            dataField: 'productName',
            area: 'row',
            expanded: true,
            sortBySummaryField: 'Total Quantity Sent',
            sortOrder: 'desc',
          },
          {
            caption: 'Variation',
            dataField: 'variationName',
            area: 'row',
            expanded: false,
          },
          {
            caption: 'Product SKU',
            dataField: 'productSku',
            area: 'row',
            visible: false,
          },

          // Column fields
          {
            caption: 'Status',
            dataField: 'statusLabel',
            area: 'column',
            expanded: true,
          },
          {
            caption: 'From Location',
            dataField: 'fromLocationName',
            area: 'column',
            visible: false,
          },
          {
            caption: 'To Location',
            dataField: 'toLocationName',
            area: 'column',
            visible: false,
          },
          {
            caption: 'Transfer Month',
            dataField: 'transferDate',
            area: 'column',
            dataType: 'date',
            groupInterval: 'month',
            visible: false,
          },
          {
            caption: 'Transfer Year',
            dataField: 'transferDate',
            area: 'column',
            dataType: 'date',
            groupInterval: 'year',
            visible: false,
          },

          // Data fields (measures)
          {
            caption: 'Total Quantity Sent',
            dataField: 'quantitySent',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: '#,##0.##',
          },
          {
            caption: 'Total Quantity Received',
            dataField: 'quantityReceived',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: '#,##0.##',
          },
          {
            caption: 'Total Variance',
            dataField: 'quantityVariance',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: '#,##0.##',
            visible: false,
          },
          {
            caption: 'Transfer Count',
            dataField: 'transferNumber',
            dataType: 'string',
            summaryType: 'count',
            area: 'data',
          },

          // Filter fields
          {
            caption: 'Created By ID',
            dataField: 'createdById',
            dataType: 'number',
            area: 'filter',
          },
          {
            caption: 'Sent By ID',
            dataField: 'sentById',
            dataType: 'number',
            area: 'filter',
          },
          {
            caption: 'Completed By ID',
            dataField: 'completedById',
            dataType: 'number',
            area: 'filter',
          },
          {
            caption: 'Has Discrepancy',
            dataField: 'hasDiscrepancy',
            dataType: 'boolean',
            area: 'filter',
          },
          {
            caption: 'Stock Deducted',
            dataField: 'stockDeducted',
            dataType: 'boolean',
            area: 'filter',
          },
          {
            caption: 'Verified',
            dataField: 'verified',
            dataType: 'boolean',
            area: 'filter',
          },
        ],
        store: reportData,
      })

      setDataSource(pivotDataSource)
    }
  }, [reportData])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      if (response.ok) {
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const generateReport = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.productId) params.append('productId', filters.productId)
      if (filters.fromLocationId) params.append('fromLocationId', filters.fromLocationId)
      if (filters.toLocationId) params.append('toLocationId', filters.toLocationId)
      if (filters.status) params.append('status', filters.status)

      const response = await fetch(`/api/reports/transfers-per-item?${params}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setReportData(result.data)
        toast.success(`Report generated: ${result.data.length} records found`)
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

  const onExporting = useCallback(() => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Transfers per Item Pivot')

    exportPivotGrid({
      component: pivotGridRef.current?.instance,
      worksheet,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Transfers_per_Item_Pivot_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
  }, [])

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view transfer reports.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Transfers per Item - Pivot Analysis
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Multi-dimensional analysis of stock transfers with drag-and-drop fields
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product
            </label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Location
            </label>
            <select
              value={filters.fromLocationId}
              onChange={(e) => setFilters({ ...filters, fromLocationId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Location
            </label>
            <select
              value={filters.toLocationId}
              onChange={(e) => setFilters({ ...filters, toLocationId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_check">Pending Check</option>
              <option value="checked">Checked</option>
              <option value="in_transit">In Transit</option>
              <option value="arrived">Arrived</option>
              <option value="verifying">Verifying</option>
              <option value="verified">Verified</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>

          <Button
            onClick={() => {
              setFilters({
                startDate: '',
                endDate: '',
                productId: '',
                fromLocationId: '',
                toLocationId: '',
                status: 'all',
              })
            }}
            variant="outline"
          >
            Clear Filters
          </Button>

          <Button
            onClick={onExporting}
            disabled={!dataSource}
            variant="outline"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          How to use the Pivot Grid:
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• <strong>Drag fields</strong> from the Field Chooser to Row, Column, or Data areas</li>
          <li>• <strong>Rearrange fields</strong> to change the analysis perspective</li>
          <li>• <strong>Expand/collapse</strong> row and column groups by clicking on them</li>
          <li>• <strong>Filter data</strong> using the filter fields or right-click on values</li>
          <li>• <strong>Sort data</strong> by clicking on column headers</li>
          <li>• <strong>Export to Excel</strong> to save your customized view</li>
        </ul>
      </div>

      {/* PivotGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        {dataSource && (
          <PivotGrid
            ref={pivotGridRef}
            dataSource={dataSource}
            allowSortingBySummary={true}
            allowFiltering={true}
            allowSorting={true}
            allowExpandAll={true}
            showBorders={true}
            showColumnGrandTotals={true}
            showRowGrandTotals={true}
            showRowTotals={true}
            showColumnTotals={true}
            showTotalsPrior="both"
            height={700}
            wordWrapEnabled={true}
          >
            <FieldChooser enabled={true} height={400} />
            <FieldPanel
              showColumnFields={true}
              showDataFields={true}
              showFilterFields={true}
              showRowFields={true}
              allowFieldDragging={true}
              visible={true}
            />
            <StateStoring enabled={true} type="localStorage" storageKey="transfersPerItemPivot" />
            <Export enabled={true} />
            <Scrolling mode="virtual" />
          </PivotGrid>
        )}

        {!dataSource && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Generate a report to view the pivot analysis
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 rounded-lg">
        <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
          💡 Analysis Tips:
        </h3>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <li>• <strong>By Location Flow</strong>: Add "From Location" to Rows and "To Location" to Columns to see transfer flows</li>
          <li>• <strong>By Time Period</strong>: Add "Transfer Month" or "Transfer Year" to Columns for trend analysis</li>
          <li>• <strong>By Status</strong>: Keep "Status" in Columns to see progression of transfers</li>
          <li>• <strong>By User</strong>: Add "Created By" or "Completed By" to Filter area to analyze by user</li>
          <li>• <strong>Identify Discrepancies</strong>: Enable "Has Discrepancy" filter to find problem transfers</li>
        </ul>
      </div>
    </div>
  )
}
