'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface LineItem {
  purchaseId: number
  purchaseOrderNumber: string
  purchaseDate: string
  supplierName: string
  supplierId: number
  productId: number
  productName: string
  sku: string
  categoryName: string
  quantity: number
  unitCost: number
  lineTotal: number
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
    totalLines: number
    totalQuantity: number
    totalAmount: number
    uniquePOs: number
    uniqueProducts: number
    uniqueSuppliers: number
  }
  items: LineItem[]
}

export default function ItemPurchaseDetailPage() {
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

      const response = await fetch(`/api/reports/purchases/item-detail?${params}`)
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
                Item Purchase Detail Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Detailed transaction history for each purchase line item
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
              {[2025, 2024, 2023, 2022].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
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
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Lines</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalLines}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Quantity</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalQuantity.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Purchase Orders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.uniquePOs}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.uniqueProducts}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.summary.uniqueSuppliers}
              </p>
            </div>
          </div>

          {/* Items Table with Search, Sort, and Export */}
          <ReportTable
            data={data.items}
            columns={[
              {
                key: 'purchaseDate',
                label: 'Date',
                sortable: true,
              },
              {
                key: 'purchaseOrderNumber',
                label: 'PO Number',
                sortable: true,
              },
              {
                key: 'supplierName',
                label: 'Supplier',
                sortable: true,
              },
              {
                key: 'productName',
                label: 'Product',
                sortable: true,
                render: (value, row) => (
                  <div>
                    <div className="font-medium">{value}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{row.sku}</div>
                  </div>
                ),
              },
              {
                key: 'categoryName',
                label: 'Category',
                sortable: true,
              },
              {
                key: 'quantity',
                label: 'Quantity',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'unitCost',
                label: 'Unit Cost',
                sortable: true,
                align: 'right',
                render: (value) => value.toFixed(2),
              },
              {
                key: 'lineTotal',
                label: 'Line Total',
                sortable: true,
                align: 'right',
                render: (value) => (
                  <span className="font-semibold">{value.toLocaleString()}</span>
                ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="item-purchase-detail"
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
