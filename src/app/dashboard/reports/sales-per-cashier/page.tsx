'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (value?: number | null) => `PHP ${currencyFormatter.format(value ?? 0)}`

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
  { value: 'gcash', label: 'GCash' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'VOIDED', label: 'Voided' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

const VIEW_OPTIONS: Array<{ value: 'invoice' | 'item'; label: string }> = [
  { value: 'invoice', label: 'Invoice Summary' },
  { value: 'item', label: 'Item Breakdown' },
]

const getDateInputValue = (date: Date) => date.toISOString().split('T')[0]

const formatPercentage = (value?: number | null) => {
  if (value === undefined || value === null) return '0.0%'
  return `${value.toFixed(1)}%`
}

const formatNumber = (value?: number | null) => (value ?? 0).toLocaleString()

const SortIndicator = ({ active, order }: { active: boolean; order: 'asc' | 'desc' }) => {
  if (!active) {
    return <span className="text-gray-400 ml-1">^v</span>
  }
  return <span className="ml-1">{order === 'asc' ? '^' : 'v'}</span>
}

interface Summary {
  totalSales: number
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalCOGS: number
  grossProfit: number
  totalItems: number
}

export default function SalesPerCashierReport() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [cashiers, setCashiers] = useState<any[]>([])

  const [datePreset, setDatePreset] = useState<string>('thisMonth')
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => getDateInputValue(new Date()))
  const [cashierId, setCashierId] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [viewMode, setViewMode] = useState<'invoice' | 'item'>('invoice')
  const [sortBy, setSortBy] = useState<'createdAt' | 'saleDate' | 'totalAmount' | 'invoiceNumber'>('saleDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load user-scoped locations first
        let list: any[] = []
        let accessAll = false
        let primary: string | null = null
        try {
          const ulRes = await fetch('/api/user-locations')
          if (ulRes.ok) {
            const ul = await ulRes.json()
            list = Array.isArray(ul.locations) ? ul.locations : []
            // Exclude warehouses for sales views
            list = list.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
            accessAll = Boolean(ul.hasAccessToAll)
            primary = ul.primaryLocationId ? String(ul.primaryLocationId) : null
          }
        } catch (e) {
          // ignore and fallback
        }

        if (!list.length) {
          const res = await fetch('/api/locations')
          if (res.ok) {
            const data = await res.json()
            const raw = Array.isArray(data)
              ? data
              : Array.isArray(data.locations)
                ? data.locations
                : Array.isArray(data.data)
                  ? data.data
                  : []
            list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
            accessAll = true
          }
        }

        setLocations(list)
        setHasAccessToAll(accessAll)
        if (!accessAll) {
          const resolved = primary || (list[0]?.id ? String(list[0].id) : 'all')
          setLocationId(resolved)
        }

        // Load cashiers
        const cashiersRes = await fetch('/api/users')
        if (cashiersRes.ok) {
          const cashiersData = await cashiersRes.json()
          const usersArray = Array.isArray(cashiersData) ? cashiersData : cashiersData.users || []
          setCashiers(usersArray)
        }
      } catch (err) {
        console.error('Failed to load filter data:', err)
      }
    }

    loadFilters()
  }, [])

  useEffect(() => {
    if (viewMode === 'item' && sortBy !== 'createdAt') {
      setSortBy('createdAt')
      setSortOrder('desc')
    }
    setPage(1)
  }, [viewMode])

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    if (preset === 'custom') {
      return
    }

    const today = new Date()
    let rangeStart = new Date(today)
    let rangeEnd = new Date(today)

    switch (preset) {
      case 'today':
        break
      case 'yesterday':
        rangeStart.setDate(rangeStart.getDate() - 1)
        rangeEnd = new Date(rangeStart)
        break
      case 'thisWeek': {
        const day = today.getDay()
        rangeStart.setDate(today.getDate() - day)
        break
      }
      case 'lastWeek': {
        const day = today.getDay()
        rangeEnd.setDate(today.getDate() - day - 1)
        rangeStart = new Date(rangeEnd)
        rangeStart.setDate(rangeEnd.getDate() - 6)
        break
      }
      case 'thisMonth':
        rangeStart = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'lastMonth':
        rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        rangeEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'thisQuarter': {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
        rangeStart = new Date(today.getFullYear(), quarterStartMonth, 1)
        break
      }
      case 'lastQuarter': {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
        rangeStart = new Date(today.getFullYear(), quarterStartMonth - 3, 1)
        rangeEnd = new Date(today.getFullYear(), quarterStartMonth, 0)
        break
      }
      case 'thisYear':
        rangeStart = new Date(today.getFullYear(), 0, 1)
        break
      case 'lastYear':
        rangeStart = new Date(today.getFullYear() - 1, 0, 1)
        rangeEnd = new Date(today.getFullYear() - 1, 11, 31)
        break
      default:
        break
    }

    setStartDate(getDateInputValue(rangeStart))
    setEndDate(getDateInputValue(rangeEnd))
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('viewMode', viewMode)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (cashierId && cashierId !== 'all') params.set('cashierId', cashierId)
      if (locationId && locationId !== 'all') params.set('locationId', locationId)
      if (status && status !== 'all') params.set('status', status)
      if (invoiceNumber) params.set('invoiceNumber', invoiceNumber.trim())
      if (productSearch) params.set('productSearch', productSearch.trim())
      if (paymentMethod && paymentMethod !== 'all') params.set('paymentMethod', paymentMethod)
      if (datePreset && datePreset !== 'custom') params.set('dateRange', datePreset)

      const res = await fetch(`/api/reports/sales-per-cashier?${params.toString()}`)

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Failed to fetch sales per cashier report.')
      }

      const data = await res.json()

      setSummary(data.summary || null)
      setPagination(data.pagination || null)

      if (viewMode === 'invoice') {
        setSales(data.sales || [])
        setItems([])
      } else {
        setItems(data.items || [])
        setSales([])
      }
    } catch (err: any) {
      console.error('Sales per cashier report error:', err)
      setError(err.message || 'Unable to load report data.')
      setSummary(null)
      setSales([])
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [
    viewMode,
    sortBy,
    sortOrder,
    page,
    limit,
    startDate,
    endDate,
    cashierId,
    locationId,
    status,
    invoiceNumber,
    productSearch,
    paymentMethod,
    datePreset,
  ])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleSort = (field: 'createdAt' | 'saleDate' | 'totalAmount' | 'invoiceNumber') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const resetPagination = () => setPage(1)

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales Per Cashier</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Track sales performance by cashier with invoice or item level detail.</p>
        </div>
        <Link
          href="/dashboard/reports"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Preset</label>
            <select
              value={datePreset}
              onChange={(e) => {
                applyDatePreset(e.target.value)
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
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
                resetPagination()
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
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'invoice' | 'item')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cashier</label>
            <select
              value={cashierId}
              onChange={(e) => {
                setCashierId(e.target.value)
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Cashiers</option>
              {cashiers.map((cashier: any) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.firstName ? `${cashier.firstName} ${cashier.surname || ''}`.trim() : cashier.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value)
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              {hasAccessToAll && <option value="all">All Locations</option>}
              {locations.map((loc: any) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value)
                resetPagination()
              }}
              placeholder="Search invoice #"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Search</label>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                resetPagination()
              }}
              placeholder="Product name or SKU"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value)
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rows Per Page</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10))
                resetPagination()
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              resetPagination()
              fetchReport()
            }}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Report'}
          </button>
          <button
            onClick={() => {
              setDatePreset('thisMonth')
              const today = new Date()
              setStartDate(getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)))
              setEndDate(getDateInputValue(new Date()))
              setCashierId('all')
              setLocationId('all')
              setStatus('all')
              setInvoiceNumber('')
              setProductSearch('')
              setPaymentMethod('all')
              setViewMode('invoice')
              setSortBy('saleDate')
              setSortOrder('desc')
              setLimit(50)
              setPage(1)
            }}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-lg shadow">
            <div className="text-sm opacity-80">Total Sales</div>
            <div className="text-3xl font-bold mt-2">{summary.totalSales.toLocaleString()}</div>
            <div className="text-xs opacity-80 mt-1">Invoices matching filters</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-lg shadow">
            <div className="text-sm opacity-80">Gross Revenue</div>
            <div className="text-3xl font-bold mt-2">{formatCurrency(summary.totalRevenue)}</div>
            <div className="text-xs opacity-80 mt-1">Includes tax and discounts</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 rounded-lg shadow">
            <div className="text-sm opacity-80">Gross Profit</div>
            <div className="text-3xl font-bold mt-2">{formatCurrency(summary.grossProfit)}</div>
            <div className="text-xs opacity-80 mt-1">
              Margin {summary.totalRevenue > 0 ? formatPercentage((summary.grossProfit / summary.totalRevenue) * 100) : '0.0%'}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-lg shadow">
            <div className="text-sm opacity-80">Items Sold</div>
            <div className="text-3xl font-bold mt-2">{formatNumber(summary.totalItems)}</div>
            <div className="text-xs opacity-80 mt-1">Across all invoices</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'invoice' ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    <button
                      onClick={() => handleSort('invoiceNumber')}
                      className="flex items-center"
                    >
                      Invoice #
                      <SortIndicator active={sortBy === 'invoiceNumber'} order={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    <button onClick={() => handleSort('saleDate')} className="flex items-center">
                      Date
                      <SortIndicator active={sortBy === 'saleDate'} order={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    <button onClick={() => handleSort('totalAmount')} className="flex items-center justify-end w-full">
                      Total
                      <SortIndicator active={sortBy === 'totalAmount'} order={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Subtotal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                      Loading report...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                      No sales found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">{sale.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{sale.saleDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{sale.cashier}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{sale.cashierUsername}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{sale.location}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{sale.customer}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">{sale.itemCount}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(sale.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(sale.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(sale.taxAmount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">
                        {sale.discountAmount > 0 ? `-${formatCurrency(sale.discountAmount)}` : formatCurrency(0)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            sale.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : sale.status === 'CANCELLED' || sale.status === 'VOIDED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">SKU</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                      Loading report...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                      No sale items found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">{item.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{item.saleDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.cashier}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.cashierUsername}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{item.location}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.sku}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-800">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.total)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency(item.profit)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : item.status === 'CANCELLED' || item.status === 'VOIDED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}{' '}
              <span className="text-gray-500">({pagination.total} records)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
