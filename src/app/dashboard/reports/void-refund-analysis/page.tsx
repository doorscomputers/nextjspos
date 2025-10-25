'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function VoidRefundAnalysisReport() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [voidedTransactions, setVoidedTransactions] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
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
  const [datePreset, setDatePreset] = useState<string>('last_30_days')

  useEffect(() => {
    fetchLocations()
    fetchUsers()
  }, [])

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

      const res = await fetch(`/api/reports/void-refund-analysis?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary || {})
        setVoidedTransactions(data.voidedTransactions || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId, cashierId])

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
    const headers = ['Invoice #', 'Date', 'Amount', 'Reason', 'Cashier', 'Location', 'Customer']
    const rows = voidedTransactions.map(txn => [
      txn.invoiceNumber,
      new Date(txn.saleDate).toLocaleDateString(),
      txn.totalAmount.toFixed(2),
      txn.voidReason,
      txn.cashier.name,
      txn.location.name,
      txn.customer?.name || 'Walk-in'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `void-refund-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Void & Refund Analysis Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(
        `Total Voids: ${summary.totalVoids} | Voided Amount: ₱${summary.totalVoidedAmount?.toLocaleString()} | Void Rate: ${summary.voidRate?.toFixed(2)}%`,
        14,
        32
      )
    }

    // Add table
    const tableData = voidedTransactions.map(txn => [
      txn.invoiceNumber,
      new Date(txn.saleDate).toLocaleDateString(),
      `₱${txn.totalAmount.toFixed(2)}`,
      txn.voidReason,
      txn.cashier.name,
      txn.location.name
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Invoice #', 'Date', 'Amount', 'Reason', 'Cashier', 'Location']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] }
    })

    doc.save(`void-refund-analysis-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Void & Refund Analysis</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Monitor voided transactions and identify patterns</p>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Locations</option>
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
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={voidedTransactions.length === 0}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={voidedTransactions.length === 0}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Voids</div>
            <div className="text-3xl font-bold mt-2">{summary.totalVoids}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.totalVoidedAmount?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Void Rate</div>
            <div className="text-3xl font-bold mt-2">{summary.voidRate?.toFixed(2)}%</div>
            <div className="text-xs mt-1 opacity-80">{summary.totalVoids} / {summary.totalSalesInPeriod} sales</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Avg Void Amount</div>
            <div className="text-3xl font-bold mt-2">₱{summary.averageVoidAmount?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">Per voided transaction</div>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Period</div>
            <div className="text-lg font-bold mt-2">{summary.startDate}</div>
            <div className="text-sm opacity-80">to {summary.endDate}</div>
          </div>
        </div>
      )}

      {/* Top Reasons */}
      {summary && summary.topReasons && summary.topReasons.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Top Void Reasons</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Reason</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Count</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.topReasons.map((reason: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{reason.reason}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{reason.count}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-orange-600 dark:text-orange-400">₱{reason.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Cashiers */}
      {summary && summary.topCashiers && summary.topCashiers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Voids by Cashier</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Void Count</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Voided Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.topCashiers.map((cashier: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{cashier.cashierName}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{cashier.voidCount}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">₱{cashier.voidAmount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voided Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Customer</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : voidedTransactions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No voided transactions found.</td></tr>
              ) : (
                voidedTransactions.map((txn, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{txn.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(txn.saleDate).toLocaleDateString()}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(txn.saleDate).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600 dark:text-red-400">₱{txn.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{txn.voidReason}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{txn.cashier.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{txn.location.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{txn.customer?.name || 'Walk-in'}</td>
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
