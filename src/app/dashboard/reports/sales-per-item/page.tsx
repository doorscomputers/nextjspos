'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { exportDataGrid as exportDataGridToPdf } from 'devextreme/pdf_exporter'
import { jsPDF as jsPDFType } from 'jspdf'

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

  // Initialize with empty date range to show ALL sales by default
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    fetchLocations()
    fetchCategories()
  }, [])

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
    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Sales Per Item')

      exportDataGrid({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          if (gridCell.rowType === 'data') {
            if (gridCell.column.dataField === 'totalRevenue' ||
                gridCell.column.dataField === 'totalCost' ||
                gridCell.column.dataField === 'totalProfit' ||
                gridCell.column.dataField === 'averagePrice') {
              excelCell.numFmt = '₱#,##0.00'
            }
            if (gridCell.column.dataField === 'profitMargin') {
              excelCell.numFmt = '0.00"%"'
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `sales-per-item-${new Date().toISOString().split('T')[0]}.xlsx`)
        })
      })
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape') as jsPDFType

      exportDataGridToPdf({
        jsPDFDocument: doc,
        component: e.component,
      }).then(() => {
        doc.save(`sales-per-item-${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const customizeMarginCell = (cellInfo: any) => {
    const margin = cellInfo.value
    if (margin >= 30) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    } else if (margin >= 15) {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
    }
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales Per Item Report</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Product performance analysis and profitability</p>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Product</label>
            <input
              type="text"
              placeholder="Product name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Per Page</label>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={fetchItems}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Products</div>
            <div className="text-3xl font-bold mt-2">{summary.totalProducts}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Qty Sold</div>
            <div className="text-3xl font-bold mt-2">{summary.totalQuantitySold?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Revenue</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalRevenue?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Profit</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalProfit?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Avg Margin</div>
            <div className="text-3xl font-bold mt-2">{summary.averageMargin?.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
        <DataGrid
          ref={dataGridRef}
          dataSource={items}
          keyExpr="productId"
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
          <Sorting mode="multiple" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search..." />
          <ColumnChooser enabled={true} mode="select" />

          <Paging defaultPageSize={50} />
          <Pager
            visible={true}
            allowedPageSizes={[25, 50, 100, 200]}
            showPageSizeSelector={true}
            showInfo={true}
            showNavigationButtons={true}
          />

          <Export enabled={true} allowExportSelectedData={false} />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>

          <Column
            dataField="productName"
            caption="Product"
            alignment="left"
            allowSorting={true}
            allowFiltering={true}
          />
          <Column
            dataField="sku"
            caption="SKU"
            alignment="left"
            width={120}
            allowSorting={true}
            allowFiltering={true}
          />
          <Column
            dataField="category"
            caption="Category"
            alignment="left"
            width={150}
            allowSorting={true}
            allowFiltering={true}
          />
          <Column
            dataField="quantitySold"
            caption="Qty Sold"
            alignment="right"
            dataType="number"
            width={100}
            allowSorting={true}
            format="#,##0"
          />
          <Column
            dataField="totalRevenue"
            caption="Revenue"
            alignment="right"
            dataType="number"
            width={130}
            allowSorting={true}
            format="₱#,##0.00"
          />
          <Column
            dataField="totalCost"
            caption="Cost"
            alignment="right"
            dataType="number"
            width={130}
            allowSorting={true}
            format="₱#,##0.00"
          />
          <Column
            dataField="totalProfit"
            caption="Profit"
            alignment="right"
            dataType="number"
            width={130}
            allowSorting={true}
            format="₱#,##0.00"
            cssClass="font-semibold text-green-600 dark:text-green-400"
          />
          <Column
            dataField="profitMargin"
            caption="Margin %"
            alignment="center"
            dataType="number"
            width={110}
            allowSorting={true}
            format="#,##0.00'%'"
            cellRender={(cellInfo) => (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${customizeMarginCell(cellInfo)}`}>
                {cellInfo.value.toFixed(1)}%
              </span>
            )}
          />
          <Column
            dataField="averagePrice"
            caption="Avg Price"
            alignment="right"
            dataType="number"
            width={120}
            allowSorting={true}
            format="₱#,##0.00"
          />
          <Column
            dataField="transactionCount"
            caption="Transactions"
            alignment="right"
            dataType="number"
            width={120}
            allowSorting={true}
            format="#,##0"
          />
        </DataGrid>
      </div>
    </div>
  )
}
