'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

/**
 * Cashier Non-Sales Cash Report
 * Auto-filtered to show only the logged-in cashier's transactions at their assigned location
 */
export default function CashierNonSalesCashReport() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [locationName, setLocationName] = useState<string>('')

  // Initialize with today's date by default
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [type, setType] = useState('all')
  const [datePreset, setDatePreset] = useState<string>('today')

  // Get user's location on mount
  useEffect(() => {
    fetchUserLocation()
  }, [])

  const fetchUserLocation = async () => {
    try {
      const res = await fetch('/api/user-locations')
      if (res.ok) {
        const data = await res.json()
        if (data.locations && data.locations.length > 0) {
          // Use primary location or first assigned location
          const loc = data.locations.find((l: any) => l.id === data.primaryLocationId) || data.locations[0]
          setLocationName(loc?.name || 'Your Location')
        }
      }
    } catch (error) {
      console.error('Error fetching user location:', error)
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (type !== 'all') params.set('type', type)
      // Auto-filter by current user - the API will handle location filtering based on user's assigned location
      params.set('filterByCurrentUser', 'true')

      const res = await fetch(`/api/reports/cash-in-out?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records || [])
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, type])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

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
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date()
        break
      case 'last_7_days':
        start = new Date(today.setDate(today.getDate() - 7))
        end = new Date()
        break
      case 'custom':
        return
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setDatePreset(range)
  }

  const getTypeBadge = (recordType: string) => {
    if (recordType === 'cash_in') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
          CASH IN
        </span>
      )
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
        CASH OUT
      </span>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Non-Sales Cash</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Your cash in/out transactions at {locationName || 'your location'}
          </p>
        </div>
        <Link
          href="/dashboard/reports"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold shadow-md hover:shadow-lg transition-all"
        >
          Back to Reports
        </Link>
      </div>

      {/* Simple Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
            <select
              value={datePreset}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset('custom')
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset('custom')
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
            </select>
          </div>

          {/* Action Buttons */}
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handlePrint}
            disabled={records.length === 0}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Print
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Cash In</div>
            <div className="text-2xl font-bold mt-1">₱{(summary.totalCashIn || 0).toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.countCashIn || 0} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Cash Out</div>
            <div className="text-2xl font-bold mt-1">₱{(summary.totalCashOut || 0).toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.countCashOut || 0} transactions</div>
          </div>
          <div className={`bg-gradient-to-br ${(summary.netCashFlow || 0) >= 0 ? 'from-amber-500 to-amber-600' : 'from-orange-500 to-orange-600'} p-5 rounded-lg shadow-lg text-white`}>
            <div className="text-sm opacity-90">Net Cash Flow</div>
            <div className="text-2xl font-bold mt-1">₱{(summary.netCashFlow || 0).toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{(summary.netCashFlow || 0) >= 0 ? 'Positive' : 'Negative'} flow</div>
          </div>
        </div>
      )}

      {/* Transaction Records Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-amber-50 dark:bg-amber-900/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Date & Time</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-300 uppercase">Shift</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No cash in/out records found for the selected period.</td></tr>
              ) : (
                records.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(rec.date).toLocaleDateString()}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(rec.date).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{getTypeBadge(rec.type)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${rec.type === 'cash_in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ₱{rec.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{rec.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{rec.referenceNumber || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {rec.shift ? `#${rec.shift.shiftNumber}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
