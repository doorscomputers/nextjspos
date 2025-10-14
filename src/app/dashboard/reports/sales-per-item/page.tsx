'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SalesPerItemReport() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('totalRevenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    fetchLocations()
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [startDate, endDate, locationId, categoryId, search, sortBy, sortOrder, page, limit])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error:', error)
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const exportToCSV = () => {
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

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-400">⇅</span>
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Per Item Report</h1>
          <p className="text-gray-600 mt-1">Product performance analysis and profitability</p>
        </div>
        <Link href="/dashboard/reports" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Product</label>
            <input
              type="text"
              placeholder="Product name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('productName')} className="flex items-center space-x-1">
                    <span>Product</span><SortIcon field="productName" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('category')} className="flex items-center space-x-1">
                    <span>Category</span><SortIcon field="category" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('quantitySold')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Qty Sold</span><SortIcon field="quantitySold" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('totalRevenue')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Revenue</span><SortIcon field="totalRevenue" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('totalProfit')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Profit</span><SortIcon field="totalProfit" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  <button onClick={() => handleSort('profitMargin')} className="flex items-center justify-end space-x-1 w-full">
                    <span>Margin %</span><SortIcon field="profitMargin" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Avg Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Transactions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No items found.</td></tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.category}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-semibold">{item.quantitySold}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">₱{item.totalRevenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">₱{item.totalProfit.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.profitMargin >= 30 ? 'bg-green-100 text-green-800' :
                        item.profitMargin >= 15 ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {item.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">₱{item.averagePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{item.transactionCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} products)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border rounded bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
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
