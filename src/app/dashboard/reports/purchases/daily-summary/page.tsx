'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, Calendar } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface DailySummary {
  day: number
  date: string
  numberOfPOs: number
  totalAmount: number
  totalItems: number
  uniqueSuppliers: number
  approvedPOs: number
  pendingPOs: number
  receivedPOs: number
}

interface ReportData {
  period: {
    year: string
    month: string
    monthName: string
    startDate: string
    endDate: string
  }
  summary: {
    totalDays: number
    totalPOs: number
    totalAmount: number
    avgDailyAmount: number
    avgDailyPOs: number
    peakDay: DailySummary | null
  }
  days: DailySummary[]
}

export default function DailySummaryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString())

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ year, month })

      const response = await fetch(`/api/reports/purchases/daily-summary?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch report')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 print:mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg print:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Daily Summary Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Day-to-day purchase operations overview
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 print:hidden">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {[2025, 2024, 2023, 2022].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2025, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total POs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalPOs}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Daily Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.avgDailyAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Daily POs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.avgDailyPOs.toFixed(1)}
              </p>
            </div>
          </div>

          {data.summary.peakDay && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                Peak Day: {data.summary.peakDay.date}
              </p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {data.summary.peakDay.totalAmount.toLocaleString()} ({data.summary.peakDay.numberOfPOs} POs)
              </p>
            </div>
          )}

          {/* Daily Table */}
          <ReportTable
            data={data.days}
            columns={[
              {
                key: 'date',
                label: 'Date',
                sortable: true,
                render: (value, row) => (
                  <div>
                    <div className="font-medium">{value}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Day {row.day}
                    </div>
                  </div>
                ),
              },
              {
                key: 'numberOfPOs',
                label: 'POs',
                sortable: true,
                align: 'right',
              },
              {
                key: 'totalAmount',
                label: 'Total Amount',
                sortable: true,
                align: 'right',
                render: (value) => <span className="font-semibold">{value.toLocaleString()}</span>,
              },
              {
                key: 'totalItems',
                label: 'Items',
                sortable: true,
                align: 'right',
              },
              {
                key: 'uniqueSuppliers',
                label: 'Suppliers',
                sortable: true,
                align: 'right',
              },
              {
                key: 'approvedPOs',
                label: 'Approved',
                sortable: true,
                align: 'center',
                render: (value) => (
                  <span className="text-green-600 dark:text-green-400 font-medium">{value}</span>
                ),
              },
              {
                key: 'pendingPOs',
                label: 'Pending',
                sortable: true,
                align: 'center',
                render: (value) => (
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">{value}</span>
                ),
              },
              {
                key: 'receivedPOs',
                label: 'Received',
                sortable: true,
                align: 'center',
                render: (value) => (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{value}</span>
                ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="daily-summary"
            pageSize={31}
          />

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Period: {data.period.monthName} {data.period.year}
          </div>
        </>
      )}
    </div>
  )
}
