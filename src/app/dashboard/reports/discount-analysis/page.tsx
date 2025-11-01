'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function DiscountAnalysisReport() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [breakdown, setBreakdown] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)

  // Initialize with default date range (last 30 days)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')
  const [datePreset, setDatePreset] = useState<string>('last_30_days')

  useEffect(() => {
    fetchLocations()
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
        console.warn('Failed /api/user-locations, fallback to /api/locations', e)
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
        const resolved = primaryLocationId || (list[0]?.id ? String(list[0].id) : '')
        setLocationId(resolved)
      }
    } catch (error) {
      console.error('Error:', error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)

      const res = await fetch(`/api/reports/discount-analysis?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary || {})
        setBreakdown(data.breakdown || {})
        setTrend(data.trend || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId])

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
    if (!breakdown) return

    const headers = ['Category', 'Item', 'Count', 'Total Discount', 'Avg Discount', 'Discount %']
    const rows: any[] = []

    // By Type
    breakdown.byType?.forEach((item: any) => {
      rows.push([
        'Discount Type',
        item.type,
        item.count,
        item.totalDiscount.toFixed(2),
        item.averageDiscount.toFixed(2),
        item.discountPercentage.toFixed(2) + '%'
      ])
    })

    // By Location
    breakdown.byLocation?.forEach((item: any) => {
      rows.push([
        'Location',
        item.location,
        item.count,
        item.totalDiscount.toFixed(2),
        item.averageDiscount.toFixed(2),
        item.discountPercentage.toFixed(2) + '%'
      ])
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discount-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.text('Discount Analysis Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(
        `Total Discounts: ₱${summary.totalDiscountAmount?.toLocaleString()} | Discount Rate: ${summary.discountRate?.toFixed(1)}%`,
        14,
        32
      )
    }

    // Add table
    if (breakdown && breakdown.byType) {
      const tableData = breakdown.byType.map((item: any) => [
        item.type,
        item.count,
        `₱${item.totalDiscount.toFixed(2)}`,
        `₱${item.averageDiscount.toFixed(2)}`,
        `${item.discountPercentage.toFixed(1)}%`
      ])

      autoTable(doc, {
        startY: 38,
        head: [['Discount Type', 'Count', 'Total Discount', 'Avg Discount', 'Discount %']],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [239, 68, 68] }
      })
    }

    doc.save(`discount-analysis-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Discount Analysis Report</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Monitor discount usage by type, cashier, and location</p>
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
              {hasAccessToAll && (
                <option value="">All Locations</option>
              )}
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
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
            disabled={!breakdown}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Export to Excel
          </button>
          <button
            onClick={() => window.print()}
            disabled={!breakdown}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            Print Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Discounts</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalDiscountAmount?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.discountedTransactions} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Discount Rate</div>
            <div className="text-3xl font-bold mt-2">{summary.discountRate?.toFixed(1)}%</div>
            <div className="text-xs mt-1 opacity-80">{summary.discountedTransactions} / {summary.totalTransactions} sales</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Average Discount</div>
            <div className="text-3xl font-bold mt-2">₱{summary.averageDiscount?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">Per discounted transaction</div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Discount Impact</div>
            <div className="text-3xl font-bold mt-2">{summary.discountImpact?.toFixed(1)}%</div>
            <div className="text-xs mt-1 opacity-80">Of total sales value</div>
          </div>
        </div>
      )}

      {/* Discount Type Breakdown */}
      {breakdown && breakdown.byType && breakdown.byType.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Discount by Type</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Discount Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Count</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Discount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Avg Discount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Discount %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {breakdown.byType.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.type}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{item.count}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">₱{item.totalDiscount?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">₱{item.averageDiscount?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        {item.discountPercentage?.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Location Breakdown */}
      {breakdown && breakdown.byLocation && breakdown.byLocation.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Discount by Location</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Location</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Count</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Discount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Avg Discount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Discount %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {breakdown.byLocation.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.location}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{item.count}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">₱{item.totalDiscount?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">₱{item.averageDiscount?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                        {item.discountPercentage?.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cashier Breakdown */}
      {breakdown && breakdown.byCashier && breakdown.byCashier.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Discount by Cashier</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Count</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Discount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Avg Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {breakdown.byCashier.slice(0, 10).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.cashierName}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{item.count}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">₱{item.totalDiscount?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">₱{item.averageDiscount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
