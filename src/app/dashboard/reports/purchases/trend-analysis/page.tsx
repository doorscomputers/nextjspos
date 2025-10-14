'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface TrendData {
  period: string
  label: string
  totalAmount: number
  numberOfPOs: number
  avgPOValue: number
  trendDirection: string
  trendPercentage: number
}

interface ReportData {
  period: {
    type: string
    year: string
    compareYears: boolean
  }
  summary: {
    totalAmount: number
    totalPOs: number
    avgPeriodAmount: number
    avgPOValue: number
    peakPeriod: {
      period: string
      label: string
      amount: number
    }
    lowestPeriod: {
      period: string
      label: string
      amount: number
    }
    overallTrend: string
  }
  trends: TrendData[]
}

export default function PurchaseTrendAnalysisPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        period,
        year,
      })

      const response = await fetch(`/api/reports/purchases/trend-analysis?${params}`)
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

  const getTrendIcon = (direction: string) => {
    if (direction === 'increasing') return <TrendingUp className="h-4 w-4 text-green-500" />
    if (direction === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '0'
    return amount.toLocaleString()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
                Purchase Trend Analysis Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Time-based purchasing patterns with trend indicators
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
              Period Type
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {[2025, 2024, 2023, 2022].map(y => (
                <option key={y} value={y}>{y}</option>
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total POs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalPOs}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Period Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.avgPeriodAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Overall Trend</p>
              <div className="flex items-center space-x-2 mt-1">
                {getTrendIcon(data.summary.overallTrend)}
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                  {data.summary.overallTrend}
                </span>
              </div>
            </div>
          </div>

          {/* Peak/Lowest Period Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Peak Period</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">
                {data.summary.peakPeriod.label}
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {data.summary.peakPeriod.amount.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Lowest Period</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {data.summary.lowestPeriod.label}
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {data.summary.lowestPeriod.amount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Trend Table with Search, Sort, Export */}
          <ReportTable
            data={data.trends}
            columns={[
              {
                key: 'label',
                label: 'Period',
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: 'totalAmount',
                label: 'Total Amount',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className="font-semibold">{formatCurrency(value)}</span>
                ),
              },
              {
                key: 'numberOfPOs',
                label: 'POs',
                sortable: true,
                align: 'right',
              },
              {
                key: 'avgPOValue',
                label: 'Avg PO Value',
                sortable: true,
                align: 'right',
                render: (value) => formatCurrency(value),
              },
              {
                key: 'trendDirection',
                label: 'Trend',
                sortable: true,
                align: 'center',
                render: (value, row) => (
                  <div className="flex items-center justify-center space-x-2">
                    {getTrendIcon(value)}
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {row.trendPercentage !== 0 ? `${row.trendPercentage.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="purchase-trend-analysis"
            pageSize={20}
          />

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Period: {period === 'year' ? 'Last 5 Years' : year}
          </div>
        </>
      )}
    </div>
  )
}
