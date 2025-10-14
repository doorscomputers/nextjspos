'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, Users, Award } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface SupplierSummary {
  rank: number
  supplierId: number
  supplierName: string
  supplierEmail: string
  supplierPhone: string
  totalPurchaseValue: number
  numberOfPOs: number
  numberOfItems: number
  avgOrderValue: number
  outstandingPayables: number
}

interface ReportData {
  period: {
    type: string
    year: string
    quarter?: string
    month?: string
    startDate: string
    endDate: string
  }
  summary: {
    totalSuppliers: number
    totalPurchaseValue: number
    totalPOs: number
    totalItems: number
    avgPurchasePerSupplier: number
  }
  suppliers: SupplierSummary[]
}

export default function SupplierPurchaseSummaryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [quarter, setQuarter] = useState('Q1')
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString())

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        period,
        year,
      })

      if (period === 'quarter' && quarter) params.append('quarter', quarter)
      if (period === 'month' && month) params.append('month', month)

      const response = await fetch(`/api/reports/purchases/supplier-summary?${params}`)
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

  const handlePrint = () => {
    window.print()
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <Award className="h-5 w-5 text-yellow-500" />
    } else if (rank === 2) {
      return <Award className="h-5 w-5 text-gray-400" />
    } else if (rank === 3) {
      return <Award className="h-5 w-5 text-amber-600" />
    }
    return null
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
                Supplier Purchase Summary Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Supplier rankings, purchase volumes, and outstanding payables
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
              onClick={handlePrint}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Period Type
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
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

          {period === 'quarter' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quarter
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="Q1">Q1 (Jan-Mar)</option>
                <option value="Q2">Q2 (Apr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dec)</option>
              </select>
            </div>
          )}

          {period === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(2025, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Report Content */}
      {!loading && !error && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalSuppliers}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchase Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalPurchaseValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total POs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalPOs}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalItems}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg per Supplier</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.avgPurchasePerSupplier.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Suppliers Table with Search, Sort, Export */}
          <ReportTable
            data={data.suppliers}
            columns={[
              {
                key: 'rank',
                label: 'Rank',
                sortable: true,
                render: (value) => (
                  <div className="flex items-center space-x-2">
                    {getRankBadge(value)}
                    <span className="font-medium">#{value}</span>
                  </div>
                ),
              },
              {
                key: 'supplierName',
                label: 'Supplier',
                sortable: true,
                render: (value, row) => (
                  <div>
                    <div className="font-medium">{value}</div>
                    {row.supplierEmail && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {row.supplierEmail}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'totalPurchaseValue',
                label: 'Purchase Value',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className="font-semibold">{value.toLocaleString()}</span>
                ),
              },
              {
                key: 'numberOfPOs',
                label: 'POs',
                sortable: true,
                align: 'right',
              },
              {
                key: 'numberOfItems',
                label: 'Items',
                sortable: true,
                align: 'right',
              },
              {
                key: 'avgOrderValue',
                label: 'Avg Order Value',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'outstandingPayables',
                label: 'Outstanding',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className={`font-semibold ${
                    value > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {value.toLocaleString()}
                  </span>
                ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="supplier-purchase-summary"
            pageSize={20}
          />

          {/* Period Info */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Period: {data.period.startDate} to {data.period.endDate}
          </div>
        </>
      )}
    </div>
  )
}
