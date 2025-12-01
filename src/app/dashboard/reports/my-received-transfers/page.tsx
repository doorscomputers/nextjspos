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

export default function MyReceivedTransfersReport() {
  const { can } = usePermissions()
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<any[]>([])
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productLoading, setProductLoading] = useState(false)
  const [showPivotView, setShowPivotView] = useState(false) // Default to Detailed View

  const [myLocation, setMyLocation] = useState<{ id: number; name: string } | null>(null)

  const [dateRangePreset, setDateRangePreset] = useState('today')
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    fromLocationId: '',
    toLocationId: '',
    status: 'all',
  })

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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const availableFromLocations = myLocation
    ? locations.filter(loc => loc.id !== myLocation.id)
    : []

  const availableToLocations = myLocation
    ? locations.filter(loc => loc.id === myLocation.id)
    : []

  // Debug logging
  console.log('🔍 [My Received Transfers] Debug:', {
    myLocationId: myLocation?.id,
    myLocationName: myLocation?.name,
    totalLocations: locations.length,
    locationIds: locations.map(l => l.id),
    availableFromCount: availableFromLocations.length,
    availableToCount: availableToLocations.length,
  })

  useEffect(() => {
    console.log('🚀 [My Received Transfers] Component mounted, starting initialization...')

    // Fetch locations first (independent of myLocation)
    fetchLocations()

    // Then fetch user's location
    fetchMyLocation()
  }, [])

  useEffect(() => {
    console.log('🔄 [My Received Transfers] State changed - myLocation:', myLocation, 'locations count:', locations.length)
    if (myLocation && locations.length > 0) {
      console.log('✅ Both myLocation and locations are ready, initializing report...')
      fetchDefaultProducts()
      setFilters(prev => ({ ...prev, toLocationId: myLocation.id.toString() }))
      generateReport({ ...filters, toLocationId: myLocation.id.toString() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLocation, locations])

  const fetchMyLocation = async () => {
    try {
      console.log('📡 Fetching my location...')
      const res = await fetch('/api/user-locations/my-location')
      const data = await res.json()
      console.log('📊 My location API response:', data)
      if (data?.location) {
        console.log('✅ Setting myLocation:', { id: data.location.id, name: data.location.name })
        setMyLocation({ id: data.location.id, name: data.location.name })
      } else {
        console.error('❌ No location in response:', data)
        toast.error('No location assigned to your account.')
      }
    } catch (err) {
      console.error('❌ Error fetching my location:', err)
      toast.error('Unable to fetch your assigned location')
    }
  }

  const fetchLocations = async () => {
    try {
      setLocationsLoading(true)
      console.log('📡 Fetching all active locations (for transfer reports)...')
      // Use the all-active endpoint to get ALL locations (not filtered by RBAC)
      const response = await fetch('/api/locations/all-active')
      const result = await response.json()
      console.log('📊 All Active Locations API response:', result)
      if (response.ok && result.success) {
        console.log('✅ Setting locations:', result.data?.length, 'locations')
        console.log('📋 Location names:', result.data?.map((l: any) => l.name))
        setLocations(result.data || [])
      } else {
        console.error('❌ Failed to fetch locations:', result)
      }
    } catch (error) {
      console.error('❌ Error fetching locations:', error)
    } finally {
      setLocationsLoading(false)
    }
  }

  // Debounced remote search
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      if (productSearch && productSearch.trim()) {
        searchProducts(productSearch, controller.signal)
      } else {
        fetchDefaultProducts(controller.signal)
      }
    }, 350)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [productSearch])

  const fetchDefaultProducts = async (signal?: AbortSignal) => {
    try {
      setProductLoading(true)
      const res = await fetch('/api/products?forTransaction=true&limit=50&page=1', { signal })
      const data = await res.json()
      if (res.ok) {
        setProducts((data.products || data.data || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku || null })))
      }
    } catch (e) {
      if ((e as any).name !== 'AbortError') console.error('Error fetching default products:', e)
    } finally {
      setProductLoading(false)
    }
  }

  const searchProducts = async (query: string, signal?: AbortSignal) => {
    try {
      setProductLoading(true)
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=100`, { signal })
      const data = await res.json()
      if (res.ok) {
        const unique = new Map<number, { id: number; name: string; sku?: string | null }>()
          ; (data.products || []).forEach((p: any) => { if (!unique.has(p.id)) unique.set(p.id, { id: p.id, name: p.name, sku: p.sku || null }) })
        setProducts(Array.from(unique.values()))
      }
    } catch (e) {
      if ((e as any).name !== 'AbortError') console.error('Error searching products:', e)
    } finally {
      setProductLoading(false)
    }
  }

  const generateReport = async (customFilters?: typeof filters) => {
    try {
      setLoading(true)
      const f = customFilters || filters
      const params = new URLSearchParams()
      if (f.startDate) params.append('startDate', f.startDate)
      if (f.endDate) params.append('endDate', f.endDate)
      if (f.productId) params.append('productId', f.productId)
      if (f.fromLocationId) params.append('fromLocationId', f.fromLocationId)
      if (f.toLocationId) params.append('toLocationId', f.toLocationId)
      if (f.status) params.append('status', f.status)

      const response = await fetch(`/api/reports/transfers-per-item?${params}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setReportData(result.data)
        setSummary(result.summary)
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
    const worksheet = workbook.addWorksheet('My Received Transfers')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `My_Received_Transfers_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
  }, [])

  const pivotGridDataSource = new PivotGridDataSource({
    fields: [
      { caption: 'Product', dataField: 'productName', area: 'row' },
      { caption: 'Variation', dataField: 'variationName', area: 'row' },
      { caption: 'From Location', dataField: 'fromLocationName', area: 'column' },
      { caption: 'To Location', dataField: 'toLocationName', area: 'column' },
      { caption: 'Status', dataField: 'statusLabel', area: 'filter' },
      { caption: 'Transfer Date', dataField: 'transferDateFormatted', dataType: 'date', area: 'filter' },
      { caption: 'Total Quantity', dataField: 'quantitySent', dataType: 'number', summaryType: 'sum', area: 'data', format: '#,##0.##' },
      { caption: 'Quantity Received', dataField: 'quantityReceived', dataType: 'number', summaryType: 'sum', area: 'data', format: '#,##0.##' },
    ],
    store: reportData,
  })

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Received Transfers</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Incoming transfers to your location</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</label>
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

          {dateRangePreset === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product</label>
            <div className="space-y-2">
              <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              <select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })} size={5} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <option value="">All Products</option>
                {productLoading && <option disabled>Searching...</option>}
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.name} {product.sku ? `(${product.sku})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Location</label>
            <select value={filters.fromLocationId} onChange={(e) => setFilters({ ...filters, fromLocationId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="">All Locations</option>
              {locationsLoading ? (
                <option disabled>Loading locations...</option>
              ) : availableFromLocations.length === 0 ? (
                <option disabled>No other locations available</option>
              ) : (
                availableFromLocations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Location</label>
            <select value={filters.toLocationId} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              {availableToLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Fixed to your location</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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
          <Button onClick={() => generateReport()} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
          <Button onClick={() => { setFilters({ startDate: '', endDate: '', productId: '', fromLocationId: '', toLocationId: myLocation ? myLocation.id.toString() : '', status: 'all' }); setDateRangePreset('custom'); setProductSearch('') }} variant="outline">Clear Filters</Button>
        </div>
      </div>

      {summary && (
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
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalQuantitySent.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500 dark:text-gray-400">Quantity Received</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalQuantityReceived.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button onClick={() => setShowPivotView(true)} className={`px-4 py-2 text-sm font-medium transition-colors ${showPivotView ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>📊 Pivot Summary</button>
            <button onClick={() => setShowPivotView(false)} className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${!showPivotView ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>📋 Detailed View</button>
          </div>
        </div>
      </div>

      {showPivotView && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <PivotGrid id="myReceivedTransfersPivot" dataSource={pivotGridDataSource} allowSortingBySummary allowFiltering allowSorting allowExpandAll showBorders showColumnTotals showColumnGrandTotals showRowTotals showRowGrandTotals height={600}>
            <PivotStateStoring enabled type="localStorage" storageKey="myReceivedTransfersPivotState-v2" />
            <FieldPanel showColumnFields showDataFields showFilterFields showRowFields allowFieldDragging visible />
            <FieldChooser enabled height={600} />
            <PivotExport enabled />
          </PivotGrid>
        </div>
      )}

      {!showPivotView && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <DataGrid dataSource={reportData} showBorders showRowLines showColumnLines rowAlternationEnabled allowColumnReordering allowColumnResizing columnAutoWidth onExporting={onExporting}>
            <StateStoring enabled type="localStorage" storageKey="myReceivedTransfersGrid-v2" />
            <Export enabled allowExportSelectedData />
            <FilterRow visible />
            <HeaderFilter visible />
            <SearchPanel visible width={240} placeholder="Search..." />
            <GroupPanel visible />
            <Grouping autoExpandAll={false} />
            <ColumnChooser enabled mode="select" />
            <ColumnFixing enabled />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={10} />
            <Pager visible allowedPageSizes={[10, 20, 30, 40, 50]} showPageSizeSelector showInfo showNavigationButtons />

            <Column dataField="transferNumber" caption="Transfer #" width={150} fixed />
            <Column dataField="transferDateFormatted" caption="Transfer Date" dataType="date" width={120} />
            <Column dataField="statusLabel" caption="Status" width={120} />

            <Column caption="Product" alignment="left">
              <Column dataField="productName" caption="Product Name" minWidth={200} />
              <Column dataField="productSku" caption="Product SKU" width={120} />
              <Column dataField="variationName" caption="Variation" width={150} />
              <Column dataField="variationSku" caption="Variation SKU" width={120} />
            </Column>

            <Column caption="Locations" alignment="left">
              <Column dataField="fromLocationName" caption="From" width={150} />
              <Column dataField="toLocationName" caption="To" width={150} />
            </Column>

            <Column caption="Quantities" alignment="right">
              <Column dataField="quantitySent" caption="Sent" dataType="number" format="#,##0.##" width={100} />
              <Column dataField="quantityReceived" caption="Received" dataType="number" format="#,##0.##" width={100} />
              <Column dataField="quantityVariance" caption="Variance" dataType="number" format="#,##0.##" width={100} />
            </Column>

            <Summary>
              <TotalItem column="transferNumber" summaryType="count" displayFormat="Total: {0}" />
              <TotalItem column="quantitySent" summaryType="sum" valueFormat="#,##0.##" displayFormat="Sum: {0}" />
              <TotalItem column="quantityReceived" summaryType="sum" valueFormat="#,##0.##" displayFormat="Sum: {0}" />
              <TotalItem column="quantityVariance" summaryType="sum" valueFormat="#,##0.##" displayFormat="Sum: {0}" />
              <GroupItem column="quantitySent" summaryType="sum" valueFormat="#,##0.##" displayFormat="Sum: {0}" alignByColumn />
              <GroupItem column="quantityReceived" summaryType="sum" valueFormat="#,##0.##" displayFormat="Sum: {0}" alignByColumn />
            </Summary>
          </DataGrid>
        </div>
      )}
    </div>
  )
}


