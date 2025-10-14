'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, CreditCard, AlertCircle } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface PurchasePayment {
  purchaseId: number
  refNo: string
  purchaseDate: string
  supplierName: string
  locationName: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  dueDate: string | null
  daysOverdue: number
  agingCategory: string
}

interface ReportData {
  period: {
    type: string
    year: string
    startDate: string
    endDate: string
  }
  summary: {
    totalPurchases: number
    totalAmount: number
    totalPaid: number
    totalOutstanding: number
    fullyPaid: number
    partiallyPaid: number
    unpaid: number
    overdue: number
  }
  aging: {
    current: { count: number; amount: number }
    '0-30': { count: number; amount: number }
    '30-60': { count: number; amount: number }
    '60-90': { count: number; amount: number }
    '90+': { count: number; amount: number }
  }
  paymentMethodBreakdown: Record<string, { count: number; amount: number }>
  purchases: PurchasePayment[]
}

export default function PaymentStatusReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString())
  const [quarter, setQuarter] = useState('Q1')

  const fetchReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        period,
        year,
      })

      if (period === 'month' && month) params.append('month', month)

      const response = await fetch(`/api/reports/purchases/payment-status?${params}`)
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

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      partial: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      pending: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status}
      </span>
    )
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
                Payment Status Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Purchase payment tracking with aging analysis
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
              <option value="month">Month</option>
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalPurchases}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400">Total Paid</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {data.summary.totalPaid.toLocaleString()}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">Outstanding</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                {data.summary.totalOutstanding.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Payment Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-400 mb-2">Fully Paid</p>
              <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                {data.summary.fullyPaid}
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">Partially Paid</p>
              <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">
                {data.summary.partiallyPaid}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 dark:text-red-400 mb-2">Overdue</p>
                <p className="text-3xl font-bold text-red-800 dark:text-red-300">
                  {data.summary.overdue}
                </p>
              </div>
              {data.summary.overdue > 0 && (
                <AlertCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
          </div>

          {/* Aging Analysis */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Aging Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(data.aging).map(([category, values]) => (
                <div key={category} className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{category}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {values.count}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {values.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Purchases Table with Search, Sort, Export */}
          <ReportTable
            data={data.purchases}
            columns={[
              {
                key: 'refNo',
                label: 'PO Number',
                sortable: true,
                render: (value, row) => (
                  <div>
                    <div className="font-medium">{value}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {row.purchaseDate}
                    </div>
                  </div>
                ),
              },
              {
                key: 'supplierName',
                label: 'Supplier',
                sortable: true,
              },
              {
                key: 'totalAmount',
                label: 'Total',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'paidAmount',
                label: 'Paid',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className="text-green-600 dark:text-green-400">
                    {value.toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'outstandingAmount',
                label: 'Outstanding',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className="text-red-600 dark:text-red-400">
                    {value.toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'paymentStatus',
                label: 'Status',
                sortable: true,
                align: 'center',
                render: (value) => getStatusBadge(value),
              },
              {
                key: 'daysOverdue',
                label: 'Days Overdue',
                sortable: true,
                align: 'center',
                render: (value) =>
                  value > 0 ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {value} days
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">—</span>
                  ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="payment-status-report"
            pageSize={20}
          />

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center print:mt-8">
            Report Period: {data.period.startDate} to {data.period.endDate}
          </div>
        </>
      )}
    </div>
  )
}
