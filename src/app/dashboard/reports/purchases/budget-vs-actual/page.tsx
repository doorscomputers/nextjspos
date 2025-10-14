'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, DollarSign } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface MonthlyBudget {
  month: string
  monthName: string
  budget: number
  actual: number
  numberOfPOs: number
  variance: number
  variancePercent: number
  status: string
}

interface ReportData {
  summary: {
    year: string
    totalBudget: number
    totalActual: number
    totalVariance: number
    totalVariancePercent: number
    monthsOverBudget: number
    monthsUnderBudget: number
    monthsOnBudget: number
    avgMonthlySpending: number
    remainingBudget: number
  }
  months: MonthlyBudget[]
}

export default function BudgetVsActualPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [monthlyBudget, setMonthlyBudget] = useState('50000')

  const fetchReport = async () => {
    if (!monthlyBudget || parseFloat(monthlyBudget) === 0) {
      setError('Please enter a monthly budget')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ year, monthlyBudget })
      const response = await fetch(`/api/reports/purchases/budget-vs-actual?${params}`)
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

  const getStatusBadge = (status: string) => {
    const styles = {
      over: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      under: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      'on-budget': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles['on-budget']}`}>
        {status === 'over' ? 'Over Budget' : status === 'under' ? 'Under Budget' : 'On Budget'}
      </span>
    )
  }

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
                Budget vs Actual Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Compare planned spending against actual purchases
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
              Monthly Budget
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              placeholder="Enter monthly budget"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchReport}
              disabled={loading || !monthlyBudget}
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Budget ({data.summary.year})</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalBudget.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Actual</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalActual.toLocaleString()}
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${
              data.summary.totalVariance > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
              <p className="text-sm font-medium mb-2">Total Variance</p>
              <p className="text-2xl font-bold">
                {data.summary.totalVariance.toLocaleString()}
              </p>
              <p className="text-sm mt-1">
                {data.summary.totalVariancePercent.toFixed(1)}%
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">Avg Monthly Spending</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">
                {data.summary.avgMonthlySpending.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Budget Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Months Over Budget</p>
              <p className="text-3xl font-bold text-red-800 dark:text-red-300">
                {data.summary.monthsOverBudget}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Months Under Budget</p>
              <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                {data.summary.monthsUnderBudget}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Months On Budget</p>
              <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">
                {data.summary.monthsOnBudget}
              </p>
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <ReportTable
            data={data.months}
            columns={[
              {
                key: 'monthName',
                label: 'Month',
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: 'budget',
                label: 'Budget',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'actual',
                label: 'Actual',
                sortable: true,
                align: 'right',
                render: (value) => <span className="font-semibold">{value.toLocaleString()}</span>,
              },
              {
                key: 'variance',
                label: 'Variance',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className={value > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'}>
                    {value.toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'variancePercent',
                label: 'Variance %',
                sortable: true,
                align: 'right',
                render: (value) => `${value.toFixed(1)}%`,
              },
              {
                key: 'numberOfPOs',
                label: 'POs',
                sortable: true,
                align: 'right',
              },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                align: 'center',
                render: (value) => getStatusBadge(value),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="budget-vs-actual"
            pageSize={12}
          />

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Year: {data.summary.year}
          </div>
        </>
      )}
    </div>
  )
}
