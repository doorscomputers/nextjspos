'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import ReportTable from '@/components/reports/ReportTable'

interface CostTrend {
  month: string
  label: string
  totalQuantity: number
  avgCost: number
  minCost: number
  maxCost: number
  numberOfPurchases: number
  changeFromPrev: number
  direction: string
}

interface ReportData {
  product: {
    id: number
    name: string
    sku: string
  }
  summary: {
    productName: string
    productSku: string
    totalPurchases: number
    totalQuantity: number
    overallAvgCost: number
    lowestCost: number
    highestCost: number
    currentCost: number
    costVariance: number
  }
  trends: CostTrend[]
}

export default function CostTrendPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [variationId, setVariationId] = useState('')
  const [months, setMonths] = useState('12')
  const [variations, setVariations] = useState<any[]>([])

  // Fetch product variations for dropdown
  useEffect(() => {
    const fetchVariations = async () => {
      try {
        const response = await fetch('/api/products/variations')
        const result = await response.json()
        if (response.ok) {
          setVariations(result.variations || [])
        }
      } catch (err) {
        console.error('Failed to fetch variations', err)
      }
    }
    fetchVariations()
  }, [])

  const fetchReport = async () => {
    if (!variationId) {
      setError('Please select a product variation')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ variationId, months })
      const response = await fetch(`/api/reports/purchases/cost-trend?${params}`)
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

  const getTrendIcon = (direction: string) => {
    if (direction === 'increasing') return <TrendingUp className="h-4 w-4 text-red-500" />
    if (direction === 'decreasing') return <TrendingDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
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
                Item Cost Trend Report
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Visual charts showing price changes over time
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
              Select Product Variation
            </label>
            <select
              value={variationId}
              onChange={(e) => setVariationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">-- Select Product Variation --</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.product.name} - {v.name} (SKU: {v.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Period
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
              <option value="18">Last 18 Months</option>
              <option value="24">Last 24 Months</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchReport}
              disabled={loading || !variationId}
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
          {/* Product Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {data.summary.productName}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">SKU: {data.summary.productSku}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {(data.summary.currentCost || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Overall Avg Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {(data.summary.overallAvgCost || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-400">Lowest Cost</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-300 mt-1">
                {(data.summary.lowestCost || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">Highest Cost</p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-300 mt-1">
                {(data.summary.highestCost || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Cost Variance */}
          <div className={`p-4 rounded-lg border mb-6 ${
            (data.summary.costVariance || 0) > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : (data.summary.costVariance || 0) < 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <p className="text-sm font-medium mb-2">Cost Variance (First to Current)</p>
            <div className="flex items-center space-x-2">
              {getTrendIcon((data.summary.costVariance || 0) > 0 ? 'increasing' : (data.summary.costVariance || 0) < 0 ? 'decreasing' : 'stable')}
              <span className="text-2xl font-bold">
                {(data.summary.costVariance || 0).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Trend Table */}
          <ReportTable
            data={data.trends}
            columns={[
              {
                key: 'label',
                label: 'Month',
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: 'avgCost',
                label: 'Avg Cost',
                sortable: true,
                align: 'right',
                render: (value) => <span className="font-semibold">{value.toFixed(2)}</span>,
              },
              {
                key: 'minCost',
                label: 'Min Cost',
                sortable: true,
                align: 'right',
                render: (value) => value.toFixed(2),
              },
              {
                key: 'maxCost',
                label: 'Max Cost',
                sortable: true,
                align: 'right',
                render: (value) => value.toFixed(2),
              },
              {
                key: 'totalQuantity',
                label: 'Quantity',
                sortable: true,
                align: 'right',
                render: (value) => value.toLocaleString(),
              },
              {
                key: 'numberOfPurchases',
                label: 'Purchases',
                sortable: true,
                align: 'right',
              },
              {
                key: 'changeFromPrev',
                label: 'Change',
                sortable: true,
                align: 'center',
                render: (value, row) => (
                  <div className="flex items-center justify-center space-x-1">
                    {getTrendIcon(row.direction)}
                    <span>{value !== 0 ? `${value.toFixed(1)}%` : '—'}</span>
                  </div>
                ),
              },
            ]}
            searchable={true}
            exportable={true}
            reportName="item-cost-trend"
            pageSize={24}
          />
        </>
      )}
    </div>
  )
}
