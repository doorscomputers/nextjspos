"use client"

import { useState, useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { formatCurrency } from '@/lib/currencyUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  PrinterIcon,
  InformationCircleIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'

interface Location {
  id: number
  name: string
}

interface PurchaseSaleData {
  // Purchase Data
  totalPurchase: number
  purchaseIncludingTax: number
  totalPurchaseReturn: number
  purchaseDue: number

  // Sale Data
  totalSale: number
  saleIncludingTax: number
  totalSellReturn: number
  saleDue: number

  // Comparisons
  salePurchaseDiff: number
  totalDue: number
}

export default function PurchaseSaleReportPage() {
  const { can } = usePermissions()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PurchaseSaleData | null>(null)

  // Filters
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }, [])
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [locationId, setLocationId] = useState<string>('all')
  const [locations, setLocations] = useState<Location[]>([])
  const [showFilters, setShowFilters] = useState(true)

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const locData = Array.isArray(data?.locations)
            ? data.locations
            : Array.isArray(data)
            ? data
            : []
          setLocations(locData)
        } else {
          setLocations([])
        }
      } catch (error) {
        console.error('Error fetching locations:', error)
        setLocations([])
      }
    }
    fetchLocations()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      if (locationId !== 'all') {
        params.append('locationId', locationId)
      }

      const res = await fetch(`/api/reports/purchase-sale?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        console.error('Purchase & Sale Report API error:', error)
        throw new Error(error.error || error.details || 'Failed to fetch report')
      }

      const reportData = await res.json()
      setData(reportData)
      toast.success('Purchase & Sale report loaded successfully')
    } catch (error: any) {
      console.error('Error fetching purchase & sale report:', error)
      toast.error(error.message || 'Failed to load purchase & sale report')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchReport()
  }, [])

  const handleResetFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLocationId('all')
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const activeFilterCount = useMemo(() => {
    return [
      startDate !== defaultStartDate || endDate !== defaultEndDate,
      locationId !== 'all',
    ].filter(Boolean).length
  }, [startDate, endDate, defaultStartDate, defaultEndDate, locationId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handlePrint = () => {
    window.print()
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
      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">PURCHASE & SALE REPORT</h1>
          <div className="text-sm">
            <div>Period: {formatDate(startDate)} to {formatDate(endDate)}</div>
            <div className="mt-2">Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="print:hidden mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchase & Sale Report</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Comparative analysis of purchases and sales with tax calculations and due amounts
        </p>
      </div>

      {/* Filters */}
      <div className="print:hidden mb-6">
        <ReportFilterPanel
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
          activeCount={activeFilterCount}
          onClearAll={handleResetFilters}
          clearLabel="Reset Filters"
          description="Select date range and location to filter purchase and sale data."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate" className="mb-2 block">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>

            <div>
              <Label htmlFor="endDate" className="mb-2 block">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>

            <div>
              <Label htmlFor="location" className="mb-2 block">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={fetchReport}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </ReportFilterPanel>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="ml-4 text-gray-600 dark:text-gray-300">Loading purchase & sale data...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Main Cards - Purchases and Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Purchases Card */}
            <Card className="bg-white dark:bg-gray-800 border-2 border-orange-300 dark:border-orange-700">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-b-2 border-orange-300 dark:border-orange-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <ShoppingCartIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  Purchases
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Purchase
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(data.totalPurchase)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Purchase Including Tax
                    </span>
                    <div className="relative group">
                      <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Total purchase amount with VAT/Tax included
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                    {formatCurrency(data.purchaseIncludingTax)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Purchase Return Including Tax
                    </span>
                  </div>
                  <span className="text-lg font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(data.totalPurchaseReturn)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Purchase Due
                  </span>
                  <span className="text-xl font-bold text-orange-700 dark:text-orange-300">
                    {formatCurrency(data.purchaseDue)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sales Card */}
            <Card className="bg-white dark:bg-gray-800 border-2 border-green-300 dark:border-green-700">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-b-2 border-green-300 dark:border-green-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <ShoppingBagIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  Sales
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Sale
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(data.totalSale)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sale Including Tax
                    </span>
                    <div className="relative group">
                      <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Total sale amount with VAT/Tax included
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(data.saleIncludingTax)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Sell Return Including Tax
                    </span>
                  </div>
                  <span className="text-lg font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(data.totalSellReturn)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 bg-green-50 dark:bg-green-900/20 rounded-lg px-4">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Sale Due
                  </span>
                  <span className="text-xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(data.saleDue)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sale - Purchase */}
            <Card className={`bg-gradient-to-br ${
              data.salePurchaseDiff >= 0
                ? 'from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700'
                : 'from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 border-red-200 dark:border-red-700'
            } border-2`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <ScaleIcon className="w-6 h-6" />
                  Overall (Sale - Purchase)
                  <div className="relative group">
                    <InformationCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                      Net difference between total sales and total purchases (including tax)
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold mb-2 ${
                  data.salePurchaseDiff >= 0
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {formatCurrency(data.salePurchaseDiff)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.salePurchaseDiff >= 0
                    ? 'Positive cash flow - Sales exceed purchases'
                    : 'Negative cash flow - Purchases exceed sales'}
                </p>
              </CardContent>
            </Card>

            {/* Total Due Amount */}
            <Card className={`bg-gradient-to-br ${
              data.totalDue >= 0
                ? 'from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700'
                : 'from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700'
            } border-2`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <CurrencyDollarIcon className="w-6 h-6" />
                  Due Amount
                  <div className="relative group">
                    <InformationCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                      Net amount due: Purchase Due + Sale Due. Positive means you owe suppliers, negative means customers owe you.
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold mb-2 ${
                  data.totalDue >= 0
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-green-700 dark:text-green-300'
                }`}>
                  {formatCurrency(Math.abs(data.totalDue))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.totalDue >= 0
                    ? 'Amount payable to suppliers'
                    : 'Amount receivable from customers'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Print Button and Info */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between print:hidden">
              <CardTitle className="text-gray-900 dark:text-white">Report Summary</CardTitle>
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="border-gray-300 dark:border-gray-600"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Report
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Report Insights:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-blue-900 dark:text-blue-200 mt-2 space-y-1">
                  <li>
                    <strong>Sale - Purchase:</strong> Shows your operational profit margin. A positive value indicates
                    revenue exceeds procurement costs.
                  </li>
                  <li>
                    <strong>Due Amount:</strong> Tracks outstanding payments. Manage this carefully to maintain healthy
                    cash flow and supplier relationships.
                  </li>
                  <li>
                    <strong>Including Tax:</strong> All tax-inclusive amounts help you understand the full financial
                    impact including VAT/sales tax.
                  </li>
                </ul>
              </div>

              {/* Additional Metrics */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Purchase Returns Rate</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.totalPurchase > 0
                      ? ((data.totalPurchaseReturn / data.purchaseIncludingTax) * 100).toFixed(2)
                      : '0.00'}%
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sale Returns Rate</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.totalSale > 0
                      ? ((data.totalSellReturn / data.saleIncludingTax) * 100).toFixed(2)
                      : '0.00'}%
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sales to Purchase Ratio</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.totalPurchase > 0
                      ? (data.totalSale / data.totalPurchase).toFixed(2)
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 1.5cm;
            size: portrait;
          }
        }
      `}</style>
    </div>
  )
}
