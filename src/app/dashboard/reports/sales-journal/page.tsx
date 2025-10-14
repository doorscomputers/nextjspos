'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function SalesJournalReport() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [cashiers, setCashiers] = useState<any[]>([])

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [locationId, setLocationId] = useState('')
  const [cashierId, setCashierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchLocations()
    fetchCashiers()
  }, [])

  useEffect(() => {
    fetchSales()
  }, [startDate, endDate, locationId, cashierId, paymentMethod, search, sortBy, sortOrder, page, limit])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchCashiers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setCashiers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching cashiers:', error)
    }
  }

  const fetchSales = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)
      if (cashierId) params.set('cashierId', cashierId)
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod)
      if (search) params.set('search', search)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/reports/sales-journal?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSales(data.sales || [])
        setSummary(data.summary || {})
        setPagination(data.pagination || {})
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
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

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const exportToCSV = () => {
    const headers = [
      'Invoice #',
      'Date',
      'Cashier',
      'Location',
      'Customer',
      'Payment Method',
      'Items',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Status'
    ]

    const rows = sales.map(sale => [
      sale.invoiceNumber,
      new Date(sale.date).toLocaleString(),
      sale.cashier,
      sale.location,
      sale.customer,
      sale.paymentMethod,
      sale.items,
      sale.subtotal.toFixed(2),
      sale.tax.toFixed(2),
      sale.discount.toFixed(2),
      sale.totalAmount.toFixed(2),
      sale.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-journal-${new Date().toISOString().split('T')[0]}.csv`
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
          <h1 className="text-3xl font-bold text-gray-900">Sales Journal Report</h1>
          <p className="text-gray-600 mt-1">Complete transaction log with detailed information</p>
        </div>
        <Link
          href="/dashboard/reports"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cashier</label>
            <select
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Cashiers</option>
              {cashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.firstName} {cashier.lastName} ({cashier.username})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Invoice # or Customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value))
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Sales</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalAmount?.toLocaleString()}</div>
            <div className="text-sm mt-1 opacity-75">{summary.totalSales} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Net Sales</div>
            <div className="text-3xl font-bold mt-2">₱{summary.netSales?.toLocaleString()}</div>
            <div className="text-sm mt-1 opacity-75">Excluding tax</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Tax</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalTax?.toLocaleString()}</div>
            <div className="text-sm mt-1 opacity-75">VAT collected</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Discount</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalDiscount?.toLocaleString()}</div>
            <div className="text-sm mt-1 opacity-75">Given to customers</div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Avg Transaction</div>
            <div className="text-3xl font-bold mt-2">
              ₱{summary.totalSales > 0 ? (summary.totalAmount / summary.totalSales).toFixed(2) : '0'}
            </div>
            <div className="text-sm mt-1 opacity-75">Per sale</div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('invoiceNumber')} className="flex items-center space-x-1 hover:text-gray-900">
                    <span>Invoice #</span>
                    <SortIcon field="invoiceNumber" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('createdAt')} className="flex items-center space-x-1 hover:text-gray-900">
                    <span>Date</span>
                    <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('cashier')} className="flex items-center space-x-1 hover:text-gray-900">
                    <span>Cashier</span>
                    <SortIcon field="cashier" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('location')} className="flex items-center space-x-1 hover:text-gray-900">
                    <span>Location</span>
                    <SortIcon field="location" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('customer')} className="flex items-center space-x-1 hover:text-gray-900">
                    <span>Customer</span>
                    <SortIcon field="customer" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Subtotal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Tax</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Discount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <button onClick={() => handleSort('totalAmount')} className="flex items-center justify-end space-x-1 hover:text-gray-900 w-full">
                    <span>Total</span>
                    <SortIcon field="totalAmount" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    Loading sales data...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    No sales found for the selected filters.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <>
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.date).toLocaleDateString()}<br />
                        <span className="text-xs text-gray-500">{new Date(sale.date).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sale.cashier}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sale.location}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {sale.customer}
                        {sale.customerContact && (
                          <div className="text-xs text-gray-500">{sale.customerContact}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' :
                          sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{sale.items}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                        ₱{sale.subtotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                        ₱{sale.tax.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-600">
                        {sale.discount > 0 ? `-₱${sale.discount.toFixed(2)}` : '₱0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        ₱{sale.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          sale.status === 'VOID' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleRow(sale.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {expandedRows.has(sale.id) ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(sale.id) && (
                      <tr>
                        <td colSpan={13} className="px-4 py-4 bg-gray-50">
                          <div className="text-sm">
                            <h4 className="font-semibold text-gray-900 mb-2">Sale Items:</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Product</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">SKU</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Quantity</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Unit Price</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.itemDetails?.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-t border-gray-200">
                                      <td className="px-3 py-2 text-sm text-gray-900">{item.product}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600">{item.sku}</td>
                                      <td className="px-3 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                                      <td className="px-3 py-2 text-sm text-right text-gray-900">₱{item.price.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">₱{item.subtotal.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total sales)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${
                      page === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {pagination.totalPages > 5 && <span className="px-2 py-1 text-gray-500">...</span>}
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
