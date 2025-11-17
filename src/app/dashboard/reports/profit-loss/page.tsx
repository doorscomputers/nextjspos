"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { LoadingSkeleton } from '@/components/reports/profit-loss/LoadingSkeleton'
import { FilterPanel } from '@/components/reports/profit-loss/FilterPanel'
import dynamic from 'next/dynamic'

// Lazy load the heavy ReportDisplay component
const ReportDisplay = dynamic(
  () => import('@/components/reports/profit-loss/ReportDisplay').then(mod => ({ default: mod.ReportDisplay })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false, // Disable SSR for this component to reduce initial bundle
  }
)

interface ProfitLossData {
  // Left Column - Costs
  openingStockPurchase: number
  openingStockSale: number
  totalPurchase: number
  totalStockAdjustment: number
  totalExpense: number
  totalPurchaseShipping: number
  purchaseAdditionalExpenses: number
  totalTransferShipping: number
  totalSellDiscount: number
  totalCustomerReward: number
  totalSellReturn: number

  // Right Column - Revenue
  closingStockPurchase: number
  closingStockSale: number
  totalSales: number
  totalSellShipping: number
  sellAdditionalExpenses: number
  totalStockRecovered: number
  totalPurchaseReturn: number
  totalPurchaseDiscount: number
  totalSellRoundOff: number

  // Calculated Fields
  cogs: number
  grossProfit: number
  netProfit: number
}

export default function ProfitLossReportPage() {
  const { can } = usePermissions()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [loading, setLoading] = useState(false)

  // Extract params from URL
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const locationId = searchParams.get('locationId') || 'all'

  // Auto-fetch report when URL params change
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, locationId)
    }
  }, [startDate, endDate, locationId])

  const fetchReport = async (start: string, end: string, location: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      })

      if (location !== 'all') {
        params.append('locationId', location)
      }

      const res = await fetch(`/api/reports/profit-loss?${params.toString()}`)

      if (!res.ok) {
        throw new Error('Failed to fetch report')
      }

      const reportData = await res.json()
      setData(reportData)
    } catch (error: any) {
      console.error('Error fetching profit/loss report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view reports.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 print:p-0 print:bg-white">
      {/* Screen Header - Renders immediately */}
      <div className="print:hidden mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profit / Loss Report</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Comprehensive profit and loss statement with COGS, Gross Profit, and Net Profit calculations
        </p>
      </div>

      {/* Filter Panel - Client Component for interactivity */}
      <FilterPanel />

      {/* Report Display - Lazy loaded with Suspense */}
      {loading && <LoadingSkeleton />}

      {!loading && data && (
        <Suspense fallback={<LoadingSkeleton />}>
          <ReportDisplay data={data} startDate={startDate} endDate={endDate} />
        </Suspense>
      )}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
          <svg className="w-24 h-24 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No report generated yet</p>
          <p className="text-sm mt-2">Select dates and click "Generate Report" to view your profit & loss statement</p>
        </div>
      )}
    </div>
  )
}
