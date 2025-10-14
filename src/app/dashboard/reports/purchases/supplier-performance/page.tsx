'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, Award, TrendingUp, TrendingDown } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface SupplierPerformance {
  supplierId: number
  supplierName: string
  totalOrders: number
  totalOrderValue: number
  averageOrderValue: number
  onTimeDeliveryRate: number
  returnRate: number
  defectRate: number
  qcPassRate: number
  overallScore: number
  rating: string
}

interface ReportData {
  summary: {
    totalSuppliers: number
    totalOrders: number
    totalOrderValue: number
    averageOnTimeDelivery: number
    averageReturnRate: number
    averageQcPassRate: number
  }
  suppliers: SupplierPerformance[]
}

export default function SupplierPerformancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/reports/purchases/supplier-performance?${params}`)
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
    // Set default dates (last 6 months)
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 6)

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport()
    }
  }, [startDate, endDate])

  const getRatingBadge = (rating: string) => {
    const styles = {
      Excellent: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      Good: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      Fair: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      Poor: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[rating as keyof typeof styles] || styles.Fair}`}>
        {rating}
      </span>
    )
  }

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (score < 60) return <TrendingDown className="h-4 w-4 text-red-500" />
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
                Supplier Performance Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                On-time delivery, quality metrics, and reliability scores
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
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalSuppliers}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalOrders}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Order Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalOrderValue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                Avg On-Time Delivery
              </p>
              <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                {data.summary.averageOnTimeDelivery.toFixed(1)}%
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                Avg QC Pass Rate
              </p>
              <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">
                {data.summary.averageQcPassRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                Avg Return Rate
              </p>
              <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">
                {data.summary.averageReturnRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Suppliers Table */}
          <ReportTable
            data={data.suppliers}
            columns={[
              {
                key: 'supplierName',
                label: 'Supplier',
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: 'totalOrders',
                label: 'Orders',
                sortable: true,
                align: 'right',
              },
              {
                key: 'totalOrderValue',
                label: 'Order Value',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'onTimeDeliveryRate',
                label: 'On-Time %',
                sortable: true,
                align: 'right',
                render: (value) => `${value.toFixed(1)}%`,
              },
              {
                key: 'qcPassRate',
                label: 'QC Pass %',
                sortable: true,
                align: 'right',
                render: (value) => `${value.toFixed(1)}%`,
              },
              {
                key: 'returnRate',
                label: 'Return %',
                sortable: true,
                align: 'right',
                render: (value) => `${value.toFixed(1)}%`,
              },
              {
                key: 'overallScore',
                label: 'Score',
                sortable: true,
                align: 'center',
                render: (value) => (
                  <div className="flex items-center justify-center space-x-1">
                    {getScoreIcon(value)}
                    <span className="font-semibold">{value.toFixed(0)}</span>
                  </div>
                ),
              },
              {
                key: 'rating',
                label: 'Rating',
                sortable: true,
                align: 'center',
                render: (value) => getRatingBadge(value),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="supplier-performance"
            pageSize={20}
          />

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Period: {startDate} to {endDate}
          </div>
        </>
      )}
    </div>
  )
}
