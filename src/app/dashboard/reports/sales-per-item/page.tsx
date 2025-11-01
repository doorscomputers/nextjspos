'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function SalesPerItemReport() {
  const pathname = usePathname()
  const isCashierMode = pathname?.includes('/dashboard/cashier-reports/') ?? false
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [enforcedLocationName, setEnforcedLocationName] = useState<string>('')
  const [categories, setCategories] = useState<any[]>([])

  // Initialize with default date range (today) for faster initial load
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('totalRevenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

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
      if (search) params.set('search', search)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/reports/sales-per-item?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setSummary(data.summary || {})
        setPagination(data.pagination || {})
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Only auto-fetch on table mechanics (page/sort/limit). Do not auto-fetch on typing filters.
  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, sortOrder, limit])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
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

  const exportToExcel = () => {
    const headers = ['Product', 'SKU', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin %', 'Avg Price', 'Transactions']
    const rows = items.map(item => [
      item.productName,
      item.sku,
      item.category,
      item.quantitySold,
      item.totalRevenue.toFixed(2),
      item.totalCost.toFixed(2),
      item.totalProfit.toFixed(2),
      item.profitMargin.toFixed(2),
      item.averagePrice.toFixed(2),
      item.transactionCount
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-per-item-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToCSV = exportToExcel

  const exportToPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Sales Per Item Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(`Total Products: ${summary.totalProducts} | Qty Sold: ${summary.totalQuantitySold?.toLocaleString()} | Revenue: ₱${summary.totalRevenue?.toLocaleString()} | Profit: ₱${summary.totalProfit?.toLocaleString()}`, 14, 32)
    }

    // Add table
    const tableData = items.map(item => [
      item.productName,
      item.sku,
      item.category,
      item.quantitySold,
      `₱${item.totalRevenue.toFixed(2)}`,
      `₱${item.totalProfit.toFixed(2)}`,
      `${item.profitMargin.toFixed(1)}%`,
      `₱${item.averagePrice.toFixed(2)}`,
      item.transactionCount
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Product', 'SKU', 'Category', 'Qty', 'Revenue', 'Profit', 'Margin', 'Avg Price', 'Trans']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    })

    doc.save(`sales-per-item-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-400 dark:text-gray-500">⇅</span>
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>
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
          <button
            onClick={exportToExcel}
            disabled={items.length === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Export to Excel
          </button>
          <button
            onClick={() => window.print()}
            disabled={items.length === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Print Report
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('productName')} className="flex items-center space-x-1">
                    <span>Product</span><SortIcon field="productName" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('category')} className="flex items-center space-x-1">
                    <span>Category</span><SortIcon field="category" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('quantitySold')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Qty Sold</span><SortIcon field="quantitySold" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('totalRevenue')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Revenue</span><SortIcon field="totalRevenue" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('totalProfit')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Profit</span><SortIcon field="totalProfit" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  <button onClick={() => handleSort('profitMargin')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Margin %</span><SortIcon field="profitMargin" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Avg Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Transactions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No items found.</td></tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.category}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 font-semibold">{item.quantitySold}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">₱{item.totalRevenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600 dark:text-green-400">₱{item.totalProfit.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.profitMargin >= 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        item.profitMargin >= 15 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                          'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                        }`}>
                        {item.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">₱{item.averagePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{item.transactionCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} products)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
