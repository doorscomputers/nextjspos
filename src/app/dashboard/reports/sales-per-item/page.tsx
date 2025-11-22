'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Export,
  Toolbar,
  Item,
  HeaderFilter,
  FilterRow,
  Sorting,
  ColumnChooser,
  Summary,
  TotalItem,
  StateStoring,
  Grouping,
  GroupPanel,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'

// Import DevExtreme styles
import 'devextreme/dist/css/dx.light.css'

export default function SalesPerItemReport() {
  const pathname = usePathname()
  const isCashierMode = pathname?.includes('/dashboard/cashier-reports/') ?? false
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [enforcedLocationName, setEnforcedLocationName] = useState<string>('')
  const [categories, setCategories] = useState<any[]>([])
  const dataGridRef = useRef<DataGrid>(null)

  // Initialize with today's date
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    fetchLocations()
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [locationId, startDate, endDate, categoryId])

  const fetchLocations = async () => {
    try {
      // Prefer user-scoped locations so we can enforce per-user visibility
      let scopedLocations: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          const list = Array.isArray(ul.locations) ? ul.locations : []
          // Exclude any Warehouse location defensively for sales reports
          scopedLocations = list.filter((loc: any) => loc?.name && !loc.name.toLowerCase().includes('warehouse'))
          accessAll = isCashierMode ? false : Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
        } else {
          // Only fallback if the endpoint is unavailable/forbidden
          throw new Error('user-locations not accessible')
        }
      } catch (e) {
        console.warn('Failed to load user-locations, falling back to /api/locations', e)
      }

      // Fallback to all business locations ONLY when user-locations call failed entirely
      if (!scopedLocations.length && accessAll === false && primaryLocationId === null) {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          scopedLocations = list.filter((loc: any) => loc?.name && !loc.name.toLowerCase().includes('warehouse'))
          accessAll = true // business-wide list implies admin-like access
        }
      }

      setLocations(scopedLocations)
      setHasAccessToAll(accessAll)

      // Auto-select sensible default for restricted users
      if (!accessAll) {
        const resolved = primaryLocationId || (scopedLocations[0]?.id ? String(scopedLocations[0].id) : '')
        setLocationId(resolved)
        const found = scopedLocations.find((l: any) => String(l.id) === String(resolved))
        if (found) setEnforcedLocationName(found.name)
      }
    } catch (error) {
      console.error('Error loading locations:', error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)
      if (categoryId) params.set('categoryId', categoryId)
      // Fetch all data for client-side filtering/sorting
      params.set('limit', '10000')

      const res = await fetch(`/api/reports/sales-per-item?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Predefined date filters
  const [datePreset, setDatePreset] = useState<string>('today')

  const setDateRange = (range: string) => {
    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (range) {
      case 'today':
        start = new Date()
        end = new Date()
        break
      case 'yesterday':
        start = new Date(today.setDate(today.getDate() - 1))
        end = new Date(start)
        break
      case 'this_week':
        const dayOfWeek = today.getDay()
        start = new Date(today.setDate(today.getDate() - dayOfWeek))
        end = new Date()
        break
      case 'last_week':
        const lastWeekEnd = new Date(today.setDate(today.getDate() - today.getDay() - 1))
        start = new Date(lastWeekEnd)
        start.setDate(lastWeekEnd.getDate() - 6)
        end = lastWeekEnd
        break
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date()
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'this_quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        start = new Date(today.getFullYear(), currentQuarter * 3, 1)
        end = new Date()
        break
      case 'last_quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1
        const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear()
        const quarter = lastQuarter < 0 ? 3 : lastQuarter
        start = new Date(year, quarter * 3, 1)
        end = new Date(year, quarter * 3 + 3, 0)
        break
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date()
        break
      case 'last_year':
        start = new Date(today.getFullYear() - 1, 0, 1)
        end = new Date(today.getFullYear() - 1, 11, 31)
        break
      case 'last_30_days':
        start = new Date(today.setDate(today.getDate() - 30))
        end = new Date()
        break
      case 'last_90_days':
        start = new Date(today.setDate(today.getDate() - 90))
        end = new Date()
        break
      case 'custom':
        return // Don't change dates for custom selection
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setDatePreset(range)
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Per Item')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (gridCell.column.dataField === 'amount' || gridCell.column.dataField === 'price') {
            excelCell.numFmt = '₱#,##0.00'
          }
          if (gridCell.column.dataField === 'quantity') {
            excelCell.numFmt = '#,##0.##'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        const locationName = locations.find(l => String(l.id) === String(locationId))?.name || 'All-Locations'
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `sales-per-item-${locationName}-${startDate}-to-${endDate}.xlsx`)
      })
    })
    e.cancel = true
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales Per Item Report (Admin)</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Detailed line item view with filters</p>
        </div>
        <Link href="/dashboard/reports" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Preset Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range Preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset('custom')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset('custom')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            {isCashierMode ? (
              <div className="px-3 py-2 bg-blue-50 rounded-md border border-blue-200 text-sm font-semibold text-blue-900">
                {enforcedLocationName || 'Assigned Location'}
              </div>
            ) : (
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              >
                {hasAccessToAll && (
                  <option value="">All Locations</option>
                )}
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Items</div>
            <div className="text-3xl font-bold mt-2">{summary.totalItems || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Qty Sold</div>
            <div className="text-3xl font-bold mt-2">{summary.totalQuantitySold?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Revenue</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalRevenue?.toLocaleString() || 0}</div>
          </div>
        </div>
      )}

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <DataGrid
            ref={dataGridRef}
            dataSource={items}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            onExporting={onExporting}
          >
            <StateStoring enabled={true} type="localStorage" storageKey="admin-sales-per-item-grid" />
            <Sorting mode="multiple" />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search product or SKU..." />
            <ColumnChooser enabled={true} mode="select" />
            <GroupPanel visible={true} />
            <Grouping autoExpandAll={false} />

            <Paging defaultPageSize={20} />
            <Pager
              visible={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showPageSizeSelector={true}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Export enabled={true} allowExportSelectedData={false} />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="exportButton" />
              <Item name="columnChooserButton" />
            </Toolbar>

            <Column
              dataField="saleDate"
              caption="Date"
              dataType="date"
              format="MM/dd/yyyy"
              width={110}
            />
            <Column
              dataField="saleTime"
              caption="Time"
              dataType="datetime"
              format="hh:mm a"
              width={100}
              alignment="center"
            />
            <Column
              dataField="invoiceNumber"
              caption="Invoice #"
              minWidth={150}
              cssClass="font-medium"
            />
            <Column
              dataField="customer"
              caption="Customer"
              minWidth={150}
            />
            <Column
              dataField="location"
              caption="Location"
              width={130}
            />
            <Column
              dataField="cashier"
              caption="Cashier"
              minWidth={150}
            />
            <Column
              dataField="productName"
              caption="Product Name"
              minWidth={200}
            />
            <Column
              dataField="sku"
              caption="SKU"
              width={130}
            />
            <Column
              dataField="quantity"
              caption="Qty"
              dataType="number"
              format="#,##0.##"
              alignment="right"
              width={80}
            />
            <Column
              dataField="price"
              caption="Price"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={110}
            />
            <Column
              dataField="amount"
              caption="Amount"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={120}
              cssClass="font-semibold"
            />

            <Summary>
              <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0.##" />
              <TotalItem column="amount" summaryType="sum" valueFormat="₱#,##0.00" />
              <TotalItem column="saleDate" summaryType="count" displayFormat="Total: {0} items" />
            </Summary>
          </DataGrid>
        )}
      </div>
    </div>
  )
}
