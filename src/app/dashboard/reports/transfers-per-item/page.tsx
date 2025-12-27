'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
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
} from 'devextreme-react/data-grid'
import PivotGrid, {
  FieldChooser,
  Export as PivotExport,
  FieldPanel,
  StateStoring as PivotStateStoring,
} from 'devextreme-react/pivot-grid'
import PivotGridDataSource from 'devextreme/ui/pivot_grid/data_source'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { exportPivotGrid } from 'devextreme/excel_exporter'

export default function TransfersPerItemReport() {
  const { can } = usePermissions()
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productLoading, setProductLoading] = useState(false)
  const [showPivotView, setShowPivotView] = useState(false) // Toggle between Pivot and Detail view - Default to Detailed View

  // Filter state
  const [dateRangePreset, setDateRangePreset] = useState('today')
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    fromLocationId: '',
    toLocationId: '',
    status: 'all',
  })

  // Date range presets
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

  const handleDateRangePresetChange = (preset: string) => {
    setDateRangePreset(preset)
    if (preset !== 'custom') {
      const { startDate, endDate } = getDateRange(preset)
      setFilters({ ...filters, startDate, endDate })
    }
  }

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  // Filter locations to prevent selecting the same location for From and To
  const availableFromLocations = filters.toLocationId
    ? locations.filter(loc => loc.id.toString() !== filters.toLocationId)
    : locations

  const availableToLocations = filters.fromLocationId
    ? locations.filter(loc => loc.id.toString() !== filters.fromLocationId)
    : locations

  useEffect(() => {
    fetchLocations()
    // Load a small default product list for initial view
    fetchDefaultProducts()
    generateReport()
  }, [])

  // Debounced remote search for products (name or exact SKU)
  useEffect(() => {
    const controller = new AbortController()
    const handler = setTimeout(() => {
      if (productSearch && productSearch.trim().length > 0) {
        searchProducts(productSearch, controller.signal)
      } else {
        fetchDefaultProducts(controller.signal)
      }
    }, 350)

    return () => {
      controller.abort()
      clearTimeout(handler)
    }
  }, [productSearch])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const result = await response.json()
      if (response.ok && result.success) {
        setLocations(result.data || [])
      } else {
        console.error('Failed to fetch locations:', result.error)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchDefaultProducts = async (signal?: AbortSignal) => {
    try {
      setProductLoading(true)
      const response = await fetch('/api/products?forTransaction=true&limit=50&page=1', { signal })
      const data = await response.json()
      if (response.ok) {
        setProducts((data.products || data.data || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku || null })))
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error fetching default products:', error)
      }
    } finally {
      setProductLoading(false)
    }
  }

  const searchProducts = async (query: string, signal?: AbortSignal) => {
    try {
      setProductLoading(true)
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=100`, { signal })
      const data = await response.json()
      if (response.ok) {
        // Map to unique products (some endpoints return variations)
        const unique = new Map<number, { id: number; name: string; sku?: string | null }>()
        ;(data.products || []).forEach((product: any) => {
          if (!unique.has(product.id)) unique.set(product.id, { id: product.id, name: product.name, sku: product.sku || null })
        })
        setProducts(Array.from(unique.values()))
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error searching products:', error)
      }
    } finally {
      setProductLoading(false)
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
        setSummary(result.summary)
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

  const onExporting = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Transfers per Item')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          // Format dates
          if (gridCell.column.dataField?.includes('Date') || gridCell.column.dataField?.includes('At')) {
            if (gridCell.value) {
              excelCell.value = new Date(gridCell.value)
              excelCell.numFmt = 'yyyy-mm-dd hh:mm:ss'
            }
          }
          // Format numbers
          if (gridCell.column.dataField?.includes('quantity') || gridCell.column.dataField?.includes('Quantity')) {
            if (typeof gridCell.value === 'number') {
              excelCell.numFmt = '#,##0.00'
            }
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Transfers_per_Item_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
  }, [])

  // PivotGrid data source configuration
  const pivotGridDataSource = new PivotGridDataSource({
    fields: [
      {
        caption: 'Product',
        dataField: 'productName',
        area: 'row',
        sortBySummaryField: 'Total Quantity',
        sortOrder: 'desc',
      },
      {
        caption: 'Variation',
        dataField: 'variationName',
        area: 'row',
      },
      {
        caption: 'Product SKU',
        dataField: 'productSku',
        area: 'row',
        visible: false,
      },
      {
        caption: 'From Location',
        dataField: 'fromLocationName',
        area: 'column',
      },
      {
        caption: 'To Location',
        dataField: 'toLocationName',
        area: 'column',
      },
      {
        caption: 'Transfer Route',
        dataField: 'transferRoute',
        area: 'filter',
        selector: (data: any) => `${data.fromLocationName} → ${data.toLocationName}`,
      },
      {
        caption: 'Status',
        dataField: 'statusLabel',
        area: 'filter',
      },
      {
        caption: 'Transfer Date',
        dataField: 'transferDateFormatted',
        dataType: 'date',
        area: 'filter',
      },
      {
        caption: 'Total Quantity',
        dataField: 'quantitySent',
        dataType: 'number',
        summaryType: 'sum',
        area: 'data',
        format: '#,##0.##',
      },
      {
        caption: 'Quantity Received',
        dataField: 'quantityReceived',
        dataType: 'number',
        summaryType: 'sum',
        area: 'data',
        format: '#,##0.##',
      },
      {
        caption: 'Transfer Count',
        dataField: 'transferNumber',
        dataType: 'number',
        summaryType: 'count',
        area: 'data',
      },
    ],
    store: reportData,
  })

  const onPivotExporting = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Transfers Pivot')

    exportPivotGrid({
      component: e.component,
      worksheet,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Transfers_Pivot_${new Date().toISOString().split('T')[0]}.xlsx`
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Transfers per Item Report</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Detailed view of all stock transfers with item-level information
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range Preset */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <select
              value={dateRangePreset}
              onChange={(e) => handleDateRangePresetChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range - Only show when Custom is selected */}
          {dateRangePreset === 'custom' && (
            <>
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
            </>
          )}

          {/* Product Filter with Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <select
                value={filters.productId}
                onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
                size={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Products</option>
                {productLoading && <option disabled>Searching...</option>}
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `(${product.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* From Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Location
            </label>
            <select
              value={filters.fromLocationId}
              onChange={(e) => {
                const newFromLocationId = e.target.value
                // If the new From location is the same as To location, clear To location
                const updatedFilters = { ...filters, fromLocationId: newFromLocationId }
                if (newFromLocationId && newFromLocationId === filters.toLocationId) {
                  updatedFilters.toLocationId = ''
                }
                setFilters(updatedFilters)
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Locations</option>
              {availableFromLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {filters.fromLocationId && filters.toLocationId && filters.fromLocationId === filters.toLocationId && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                From and To locations cannot be the same
              </p>
            )}
          </div>

          {/* To Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Location
            </label>
            <select
              value={filters.toLocationId}
              onChange={(e) => {
                const newToLocationId = e.target.value
                // If the new To location is the same as From location, clear From location
                const updatedFilters = { ...filters, toLocationId: newToLocationId }
                if (newToLocationId && newToLocationId === filters.fromLocationId) {
                  updatedFilters.fromLocationId = ''
                }
                setFilters(updatedFilters)
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Locations</option>
              {availableToLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {filters.toLocationId && filters.fromLocationId && filters.toLocationId === filters.fromLocationId && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                To and From locations cannot be the same
              </p>
            )}
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
              setDateRangePreset('custom')
              setProductSearch('')
            }}
            variant="outline"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Transfers</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalTransfers}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Items</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalItems}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500 dark:text-gray-400">Quantity Sent</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalQuantitySent.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500 dark:text-gray-400">Quantity Received</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalQuantityReceived.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Transfer Flow Summary - Shows quantities by From/To Location */}
          {(filters.fromLocationId || filters.toLocationId) && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg shadow border-2 border-blue-200 dark:border-blue-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                📊 Transfer Flow Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filters.fromLocationId && summary.byFromLocation && (
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      From: {locations.find(l => l.id === parseInt(filters.fromLocationId))?.name}
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {summary.byFromLocation[locations.find(l => l.id === parseInt(filters.fromLocationId))?.name]?.toLocaleString() || 0} units
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total sent</div>
                  </div>
                )}
                {filters.toLocationId && summary.byToLocation && (
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      To: {locations.find(l => l.id === parseInt(filters.toLocationId))?.name}
                    </div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {summary.byToLocation[locations.find(l => l.id === parseInt(filters.toLocationId))?.name]?.toLocaleString() || 0} units
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total received</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* View Toggle */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setShowPivotView(true)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                showPivotView
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📊 Pivot Summary
            </button>
            <button
              onClick={() => setShowPivotView(false)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                !showPivotView
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📋 Detailed View
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {showPivotView ? 'Aggregated transfer totals by product and location' : 'Line-by-line transfer details'}
        </div>
      </div>

      {/* PivotGrid View */}
      {showPivotView && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Transfer Summary by Product & Location
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Drag fields between areas to reorganize the data. Use the Field Chooser to show/hide fields.
            </p>
          </div>
          <PivotGrid
            id="transfersPivotGrid"
            dataSource={pivotGridDataSource}
            allowSortingBySummary={true}
            allowFiltering={true}
            allowSorting={true}
            allowExpandAll={true}
            showBorders={true}
            showColumnTotals={true}
            showColumnGrandTotals={true}
            showRowTotals={true}
            showRowGrandTotals={true}
            height={600}
            onExporting={onPivotExporting}
          >
            <PivotStateStoring
              enabled={true}
              type="localStorage"
              storageKey="transfersPivotGridState"
            />
            <FieldPanel
              showColumnFields={true}
              showDataFields={true}
              showFilterFields={true}
              showRowFields={true}
              allowFieldDragging={true}
              visible={true}
            />
            <FieldChooser enabled={true} height={600} />
            <PivotExport enabled={true} />
          </PivotGrid>
        </div>
      )}

      {/* DataGrid - Detailed View */}
      {!showPivotView && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Detailed Transfer Records
            </h3>
          </div>
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
        >
          <StateStoring enabled={true} type="localStorage" storageKey="transfersPerItemGrid-v2" />
          <Export enabled={true} allowExportSelectedData={true} />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search..." />
          <GroupPanel visible={true} />
          <Grouping autoExpandAll={false} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />

          <Sorting mode="multiple" />

          <Paging defaultPageSize={10} />
          <Pager
            visible={true}
            displayMode="full"
            allowedPageSizes={[10, 20, 30, 40, 50]}
            showPageSizeSelector={true}
            showInfo={true}
            showNavigationButtons={true}
          />

          {/* Transfer Information */}
          <Column
            dataField="transferNumber"
            caption="Transfer #"
            width={150}
            fixed={true}
          />
          <Column
            dataField="transferDateFormatted"
            caption="Transfer Date"
            dataType="date"
            width={120}
          />
          <Column
            dataField="statusLabel"
            caption="Status"
            width={120}
          />

          {/* Product Information */}
          <Column caption="Product" alignment="left">
            <Column
              dataField="productName"
              caption="Product Name"
              minWidth={200}
            />
            <Column
              dataField="productSku"
              caption="Product SKU"
              width={120}
            />
            <Column
              dataField="variationName"
              caption="Variation"
              width={150}
            />
            <Column
              dataField="variationSku"
              caption="Variation SKU"
              width={120}
            />
          </Column>

          {/* Location Information */}
          <Column caption="Locations" alignment="left">
            <Column
              dataField="fromLocationName"
              caption="From"
              width={150}
            />
            <Column
              dataField="toLocationName"
              caption="To"
              width={150}
            />
          </Column>

          {/* Quantity Information */}
          <Column caption="Quantities" alignment="right">
            <Column
              dataField="quantitySent"
              caption="Sent"
              dataType="number"
              format="#,##0.##"
              width={100}
            />
            <Column
              dataField="quantityReceived"
              caption="Received"
              dataType="number"
              format="#,##0.##"
              width={100}
            />
            <Column
              dataField="quantityVariance"
              caption="Variance"
              dataType="number"
              format="#,##0.##"
              width={100}
              cellRender={(cellData: any) => {
                if (cellData.value === null) return 'N/A'
                const variance = cellData.value
                const color = variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'
                return (
                  <span className={color}>
                    {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                  </span>
                )
              }}
            />
          </Column>

          {/* User IDs */}
          <Column caption="User IDs" alignment="left">
            <Column
              dataField="createdById"
              caption="Created By ID"
              width={120}
              dataType="number"
            />
            <Column
              dataField="sentById"
              caption="Sent By ID"
              width={120}
              dataType="number"
            />
            <Column
              dataField="completedById"
              caption="Completed By ID"
              width={120}
              dataType="number"
            />
          </Column>

          {/* Timestamps */}
          <Column caption="Dates" alignment="left">
            <Column
              dataField="createdAtFormatted"
              caption="Created"
              dataType="date"
              width={110}
            />
            <Column
              dataField="completedAtFormatted"
              caption="Completed"
              dataType="date"
              width={110}
            />
          </Column>

          {/* Flags */}
          <Column
            dataField="verified"
            caption="Verified"
            dataType="boolean"
            width={90}
          />
          <Column
            dataField="hasDiscrepancy"
            caption="Has Discrepancy"
            dataType="boolean"
            width={130}
          />
          <Column
            dataField="stockDeducted"
            caption="Stock Deducted"
            dataType="boolean"
            width={130}
          />

          {/* Summary */}
          <Summary>
            <TotalItem
              column="transferNumber"
              summaryType="count"
              displayFormat="Total: {0}"
            />
            <TotalItem
              column="quantitySent"
              summaryType="sum"
              valueFormat="#,##0.##"
              displayFormat="Sum: {0}"
            />
            <TotalItem
              column="quantityReceived"
              summaryType="sum"
              valueFormat="#,##0.##"
              displayFormat="Sum: {0}"
            />
            <TotalItem
              column="quantityVariance"
              summaryType="sum"
              valueFormat="#,##0.##"
              displayFormat="Sum: {0}"
            />

            <GroupItem
              column="quantitySent"
              summaryType="sum"
              valueFormat="#,##0.##"
              displayFormat="Sum: {0}"
              alignByColumn={true}
            />
            <GroupItem
              column="quantityReceived"
              summaryType="sum"
              valueFormat="#,##0.##"
              displayFormat="Sum: {0}"
              alignByColumn={true}
            />
          </Summary>
        </DataGrid>
        </div>
      )}
    </div>
  )
}
