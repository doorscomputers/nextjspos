'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function SalesByHourReport() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [hourlyBreakdown, setHourlyBreakdown] = useState<any[]>([])
  const [dayOfWeekBreakdown, setDayOfWeekBreakdown] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Initialize with default date range (last 7 days)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('all')
  const [datePreset, setDatePreset] = useState<string>('last_7_days')

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        const parsedLocations = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.locations)
              ? data.locations
              : []
        setLocations(parsedLocations)
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

      const res = await fetch(`/api/reports/sales-by-hour?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary || {})
        setHourlyBreakdown(data.hourlyBreakdown || [])
        setDayOfWeekBreakdown(data.dayOfWeekBreakdown || [])
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
      case 'last_7_days':
        start = new Date(today.setDate(today.getDate() - 7))
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
    const headers = ['Hour', 'Sales Count', 'Total Revenue', 'Avg Transaction', 'Total Discount']
    const rows = hourlyBreakdown.map(hour => [
      hour.hourLabel,
      hour.salesCount,
      hour.totalRevenue.toFixed(2),
      hour.averageTransaction.toFixed(2),
      hour.totalDiscount.toFixed(2)
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-by-hour-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.text('Hourly Sales Breakdown Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(
        `Total Sales: ${summary.totalSales} | Revenue: ₱${summary.totalRevenue?.toLocaleString()} | Peak Hour: ${summary.peakHour?.hourLabel}`,
        14,
        32
      )
    }

    // Add table
    const tableData = hourlyBreakdown
      .filter(h => h.salesCount > 0)
      .map(hour => [
        hour.hourLabel,
        hour.salesCount,
        `₱${hour.totalRevenue.toFixed(2)}`,
        `₱${hour.averageTransaction.toFixed(2)}`
      ])

    autoTable(doc, {
      startY: 38,
      head: [['Hour', 'Sales Count', 'Total Revenue', 'Avg Transaction']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [168, 85, 247] }
    })

    doc.save(`sales-by-hour-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const getHourBarWidth = (count: number) => {
    if (!summary || summary.peakHour.salesCount === 0) return '0%'
    return `${(count / summary.peakHour.salesCount) * 100}%`
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Hourly Sales Breakdown</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Peak hours analysis and staffing optimization insights</p>
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
              <option value="last_7_days">Last 7 Days</option>
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
            disabled={hourlyBreakdown.length === 0}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={hourlyBreakdown.length === 0}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Sales</div>
            <div className="text-3xl font-bold mt-2">{summary.totalSales?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.totalRevenue?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Peak Sales Hour</div>
            <div className="text-3xl font-bold mt-2">{summary.peakHour?.hourLabel}</div>
            <div className="text-xs mt-1 opacity-80">{summary.peakHour?.salesCount} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Peak Revenue Hour</div>
            <div className="text-3xl font-bold mt-2">{summary.peakRevenueHour?.hourLabel}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.peakRevenueHour?.revenue?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Avg Transaction</div>
            <div className="text-3xl font-bold mt-2">₱{summary.averageTransaction?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">Per sale</div>
          </div>
        </div>
      )}

      {/* Busy/Slow Hours Indicators */}
      {summary && summary.busyHours && summary.busyHours.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-400">🔥 Busy Hours (Top 25%)</h3>
            <div className="space-y-2">
              {summary.busyHours.map((hour: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hour.hourLabel}</span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs font-semibold">
                    {hour.salesCount} sales
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">💤 Slow Hours (Bottom 25%)</h3>
            <div className="space-y-2">
              {summary.slowHours.map((hour: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hour.hourLabel}</span>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-semibold">
                    {hour.salesCount} sales
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hourly Breakdown Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Hourly Sales Distribution</h3>
        <div className="space-y-3">
          {hourlyBreakdown.map((hour, idx) => (
            <div key={idx} className="flex items-center space-x-3">
              <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">{hour.hourLabel}</div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${hour.salesCount === summary?.peakHour?.salesCount
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600'
                      : 'bg-gradient-to-r from-purple-500 to-purple-600'
                    }`}
                  style={{ width: getHourBarWidth(hour.salesCount) }}
                >
                  {hour.salesCount > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                      {hour.salesCount} sales
                    </span>
                  )}
                </div>
              </div>
              <div className="w-24 text-sm text-right text-gray-600 dark:text-gray-400">
                ₱{hour.totalRevenue.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day of Week Breakdown */}
      {dayOfWeekBreakdown && dayOfWeekBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Sales by Day of Week</h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {dayOfWeekBreakdown.map((day, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{day.dayName}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{day.salesCount}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">₱{day.totalRevenue.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
