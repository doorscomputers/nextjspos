'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export default function PurchaseAnalyticsPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('returns')

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Return Analysis data
  const [returnData, setReturnData] = useState<any>(null)
  const [returnGroupBy, setReturnGroupBy] = useState('supplier')

  // Supplier Performance data
  const [supplierData, setSupplierData] = useState<any>(null)

  // Variance data
  const [varianceData, setVarianceData] = useState<any>(null)
  const [varianceType, setVarianceType] = useState('all')

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      if (activeTab === 'returns') {
        fetchReturnAnalysis()
      } else if (activeTab === 'supplier') {
        fetchSupplierPerformance()
      } else if (activeTab === 'variance') {
        fetchVarianceReport()
      }
    }
  }, [startDate, endDate, activeTab, returnGroupBy, varianceType])

  const fetchReturnAnalysis = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy: returnGroupBy,
      })

      const res = await fetch(`/api/reports/purchases/return-analysis?${params}`)
      if (!res.ok) throw new Error('Failed to fetch return analysis')

      const data = await res.json()
      setReturnData(data.data)
    } catch (error: any) {
      console.error('Error fetching return analysis:', error)
      toast.error('Failed to load return analysis')
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplierPerformance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      const res = await fetch(`/api/reports/purchases/supplier-performance?${params}`)
      if (!res.ok) throw new Error('Failed to fetch supplier performance')

      const data = await res.json()
      setSupplierData(data.data)
    } catch (error: any) {
      console.error('Error fetching supplier performance:', error)
      toast.error('Failed to load supplier performance')
    } finally {
      setLoading(false)
    }
  }

  const fetchVarianceReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        varianceType,
      })

      const res = await fetch(`/api/reports/purchases/variance?${params}`)
      if (!res.ok) throw new Error('Failed to fetch variance report')

      const data = await res.json()
      setVarianceData(data.data)
    } catch (error: any) {
      console.error('Error fetching variance report:', error)
      toast.error('Failed to load variance report')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Excellent</Badge>
      case 'Good':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Good</Badge>
      case 'Fair':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Fair</Badge>
      case 'Poor':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Poor</Badge>
      default:
        return <Badge>{rating}</Badge>
    }
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view reports.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ChartBarIcon className="w-8 h-8" />
          Purchase Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Comprehensive purchase analysis, supplier performance, and variance tracking
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label className="text-gray-900 dark:text-white">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <Label className="text-gray-900 dark:text-white">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Tabs for different reports */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="returns" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            Return Analysis
          </TabsTrigger>
          <TabsTrigger value="supplier" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            Supplier Performance
          </TabsTrigger>
          <TabsTrigger value="variance" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            Purchase Variance
          </TabsTrigger>
        </TabsList>

        {/* Return Analysis Tab */}
        <TabsContent value="returns" className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-4 mb-4">
              <Label className="text-gray-900 dark:text-white">Group By:</Label>
              <Select value={returnGroupBy} onValueChange={setReturnGroupBy}>
                <SelectTrigger className="w-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="supplier" className="text-gray-900 dark:text-white">Supplier</SelectItem>
                  <SelectItem value="product" className="text-gray-900 dark:text-white">Product</SelectItem>
                  <SelectItem value="reason" className="text-gray-900 dark:text-white">Reason</SelectItem>
                  <SelectItem value="date" className="text-gray-900 dark:text-white">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : returnData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <p className="text-sm text-blue-600 dark:text-blue-300">Total Returns</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {returnData.summary.totalReturns}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                    <p className="text-sm text-red-600 dark:text-red-300">Total Return Amount</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {formatCurrency(returnData.summary.totalReturnAmount)}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                    <p className="text-sm text-orange-600 dark:text-orange-300">Qty Returned</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {formatNumber(returnData.summary.totalQuantityReturned)}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                    <p className="text-sm text-purple-600 dark:text-purple-300">Avg Return Value</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatCurrency(returnData.summary.averageReturnAmount)}
                    </p>
                  </div>
                </div>

                {/* Top Reasons */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Top Return Reasons</h3>
                  <div className="space-y-2">
                    {returnData.topReasons.slice(0, 5).map((reason: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded p-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white capitalize">
                            {reason.reason.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {reason.count} returns • {formatCurrency(reason.amount)}
                          </p>
                        </div>
                        <Badge>{formatPercent(reason.percentage)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grouped Data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Returns by {returnGroupBy === 'date' ? 'Month' : returnGroupBy.charAt(0).toUpperCase() + returnGroupBy.slice(1)}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            {returnGroupBy === 'date' ? 'Month' : returnGroupBy}
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Return Count
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Total Amount
                          </th>
                          {returnGroupBy !== 'reason' && (
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Total Quantity
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {returnData.groupedData.slice(0, 10).map((row: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {row.supplierName || row.productName || row.reason || row.month}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {row.returnCount}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {formatCurrency(row.totalAmount)}
                            </td>
                            {returnGroupBy !== 'reason' && (
                              <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                                {formatNumber(row.totalQuantity)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">No data available</div>
            )}
          </div>
        </TabsContent>

        {/* Supplier Performance Tab */}
        <TabsContent value="supplier" className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
              Loading...
            </div>
          ) : supplierData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-300">Total Suppliers</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {supplierData.summary.totalSuppliers}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <p className="text-sm text-green-600 dark:text-green-300">On-Time Delivery</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {formatPercent(supplierData.summary.averageOnTimeDelivery)}
                  </p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-300">Avg Return Rate</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {formatPercent(supplierData.summary.averageReturnRate)}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                  <p className="text-sm text-purple-600 dark:text-purple-300">QC Pass Rate</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {formatPercent(supplierData.summary.averageQcPassRate)}
                  </p>
                </div>
              </div>

              {/* Supplier Performance Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Supplier
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Rating
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Score
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Orders
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          On-Time %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Return Rate
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          QC Pass %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Total Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {supplierData.suppliers.map((supplier: any) => (
                        <tr key={supplier.supplierId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {supplier.supplierName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getRatingBadge(supplier.rating)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={`font-semibold ${
                              supplier.overallScore >= 90 ? 'text-green-600 dark:text-green-400' :
                              supplier.overallScore >= 75 ? 'text-blue-600 dark:text-blue-400' :
                              supplier.overallScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {supplier.overallScore.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {supplier.totalOrders}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            <span className={supplier.onTimeDeliveryRate >= 90 ? 'text-green-600 dark:text-green-400' : ''}>
                              {formatPercent(supplier.onTimeDeliveryRate)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            <span className={supplier.returnRate > 10 ? 'text-red-600 dark:text-red-400' : ''}>
                              {formatPercent(supplier.returnRate)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {supplier.qcInspections > 0 ? formatPercent(supplier.qcPassRate) : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {formatCurrency(supplier.totalOrderValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
              No data available
            </div>
          )}
        </TabsContent>

        {/* Variance Tab */}
        <TabsContent value="variance" className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-4 mb-4">
              <Label className="text-gray-900 dark:text-white">Variance Type:</Label>
              <Select value={varianceType} onValueChange={setVarianceType}>
                <SelectTrigger className="w-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All Variances</SelectItem>
                  <SelectItem value="quantity" className="text-gray-900 dark:text-white">Quantity Only</SelectItem>
                  <SelectItem value="amount" className="text-gray-900 dark:text-white">Amount Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : varianceData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <p className="text-sm text-blue-600 dark:text-blue-300">Total Purchases</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {varianceData.summary.totalPurchases}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                    <p className="text-sm text-orange-600 dark:text-orange-300">With Variance</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {varianceData.summary.purchasesWithVariance}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {formatPercent(varianceData.summary.varianceRate)} of total
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                    <p className="text-sm text-red-600 dark:text-red-300">Amount Variance</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {formatCurrency(Math.abs(varianceData.summary.totalAmountVariance))}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                    <p className="text-sm text-purple-600 dark:text-purple-300">Qty Variance</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatNumber(Math.abs(varianceData.summary.totalQuantityVariance))}
                    </p>
                  </div>
                </div>

                {/* Variance Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Quantity Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Over Received</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {varianceData.summary.overReceivedCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Under Received</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {varianceData.summary.underReceivedCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Exact</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {varianceData.summary.exactReceivedCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Amount Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Over Paid</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {varianceData.summary.overPaidCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Under Paid</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {varianceData.summary.underPaidCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Exact</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {varianceData.summary.exactPaidCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variance Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Top Variances
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            PO Number
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Supplier
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Ordered Amount
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Received Amount
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Amount Variance
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                            Qty Variance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {varianceData.variances.slice(0, 15).map((variance: any) => (
                          <tr key={variance.purchaseId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {variance.purchaseOrderNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {variance.supplierName}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {formatCurrency(variance.orderedAmount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {formatCurrency(variance.receivedAmount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center justify-end gap-1">
                                {variance.amountVariance > 0 ? (
                                  <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
                                ) : variance.amountVariance < 0 ? (
                                  <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
                                ) : null}
                                <span className={
                                  variance.amountVariance > 0 ? 'text-red-600 dark:text-red-400 font-semibold' :
                                  variance.amountVariance < 0 ? 'text-green-600 dark:text-green-400 font-semibold' :
                                  'text-gray-900 dark:text-white'
                                }>
                                  {formatCurrency(variance.amountVariance)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={
                                variance.quantityVariance > 0 ? 'text-green-600 dark:text-green-400' :
                                variance.quantityVariance < 0 ? 'text-red-600 dark:text-red-400' :
                                'text-gray-900 dark:text-white'
                              }>
                                {variance.quantityVariance > 0 ? '+' : ''}
                                {formatNumber(variance.quantityVariance)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">No data available</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
