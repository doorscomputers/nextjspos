'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function CashInOutReport() {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [users, setUsers] = useState<any[]>([])

  // Initialize with default date range (last 30 days)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('all')
  const [cashierId, setCashierId] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<string>('last_30_days')

  useEffect(() => {
    fetchLocations()
    fetchUsers()
  }, [])

  const fetchLocations = async () => {
    try {
      let list: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          list = Array.isArray(ul.locations) ? ul.locations : []
          list = list.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
        }
      } catch (e) {
        console.warn('Failed to load /api/user-locations, falling back to /api/locations', e)
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
        const resolved = primaryLocationId || (list[0]?.id ? String(list[0].id) : 'all')
        setLocationId(resolved)
      }
    } catch (error) {
      console.error('Error:', error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId !== 'all') params.set('locationId', locationId)
      if (cashierId !== 'all') params.set('cashierId', cashierId)
      if (type !== 'all') params.set('type', type)
      if (search) params.set('search', search)

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
  }, [startDate, endDate, locationId, cashierId, type, search])

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
      case 'last_30_days':
        start = new Date(today.setDate(today.getDate() - 30))
        end = new Date()
        break
      case 'custom':
        return
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setDatePreset(range)
  }

  const exportToExcel = () => {
    const headers = ['Date', 'Type', 'Amount', 'Reason', 'Reference', 'Location', 'Cashier', 'Shift']
    const rows = records.map(rec => [
      new Date(rec.date).toLocaleDateString(),
      rec.type === 'cash_in' ? 'Cash In' : 'Cash Out',
      rec.amount.toFixed(2),
      rec.reason,
      rec.referenceNumber || '',
      rec.location.name,
      rec.cashier.name,
      rec.shift?.shiftNumber || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-in-out-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Cash In/Out Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(
        `Total Cash In: ₱${summary.totalCashIn?.toLocaleString()} | Cash Out: ₱${summary.totalCashOut?.toLocaleString()} | Net: ₱${summary.netCashFlow?.toLocaleString()}`,
        14,
        32
      )
    }

    // Add table
    const tableData = records.map(rec => [
      new Date(rec.date).toLocaleDateString(),
      rec.type === 'cash_in' ? 'Cash In' : 'Cash Out',
      `₱${rec.amount.toFixed(2)}`,
      rec.reason,
      rec.location.name,
      rec.cashier.name
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Date', 'Type', 'Amount', 'Reason', 'Location', 'Cashier']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] }
    })

    doc.save(`cash-in-out-${new Date().toISOString().split('T')[0]}.pdf`)
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

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Cash In/Out Report</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Track all cash movements and transactions</p>
        </div>
        <Link href="/dashboard/reports" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold shadow-md hover:shadow-lg transition-all">
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              <option value="cash_in">Cash In Only</option>
              <option value="cash_out">Cash Out Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {hasAccessToAll && (
                <option value="all">All Locations</option>
              )}
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cashier</label>
            <select
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Cashiers</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.username})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Reason</label>
            <input
              type="text"
              placeholder="Search by reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={records.length === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Export to Excel
          </button>
          <button
            onClick={() => window.print()}
            disabled={records.length === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Print Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Cash In</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalCashIn?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.countCashIn} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Cash Out</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalCashOut?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.countCashOut} transactions</div>
          </div>
          <div className={`bg-gradient-to-br ${summary.netCashFlow >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} p-6 rounded-lg shadow-lg text-white`}>
            <div className="text-sm opacity-90">Net Cash Flow</div>
            <div className="text-3xl font-bold mt-2">₱{summary.netCashFlow?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.netCashFlow >= 0 ? 'Positive' : 'Negative'} flow</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Records</div>
            <div className="text-3xl font-bold mt-2">{summary.totalRecords}</div>
            <div className="text-xs mt-1 opacity-80">{summary.startDate} to {summary.endDate}</div>
          </div>
        </div>
      )}

      {/* Top Locations Breakdown */}
      {summary && summary.topLocations && summary.topLocations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Cash Flow by Location</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Location</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cash In</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cash Out</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Net Flow</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.topLocations.map((loc: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{loc.locationName}</td>
                    <td className="px-4 py-2 text-sm text-right text-green-600 dark:text-green-400">₱{loc.cashIn?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-600 dark:text-red-400">₱{loc.cashOut?.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-sm text-right font-semibold ${loc.netCash >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      ₱{loc.netCash?.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{loc.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Records Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Date</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Shift</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No cash in/out records found.</td></tr>
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
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{rec.location.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{rec.cashier.name}</td>
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
