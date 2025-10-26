'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Chart,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Tooltip,
  CommonSeriesSettings,
  Label,
  Format,
  Export as ChartExport
} from 'devextreme-react/chart'
import {
  PieChart,
  Series as PieSeries,
  Label as PieLabel,
  Connector,
  Export as PieExport,
  Legend as PieLegend
} from 'devextreme-react/pie-chart'
import DataGrid, {
  Column,
  Summary,
  TotalItem,
  Export,
  Paging
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react'

interface AnalyticsData {
  summary: {
    totalPurchases: number
    totalAmount: number
    totalQuantity: number
    uniqueSuppliers: number
    uniqueProducts: number
    avgOrderValue: number
    avgItemsPerOrder: number
    periodGrowth: number
  }
  monthlyTrends: Array<{
    month: string
    totalAmount: number
    orderCount: number
    avgOrderValue: number
  }>
  topSuppliers: Array<{
    supplierId: number
    supplierName: string
    totalAmount: number
    orderCount: number
    percentage: number
  }>
  categoryBreakdown: Array<{
    category: string
    totalAmount: number
    quantity: number
    percentage: number
  }>
  topProducts: Array<{
    productId: number
    productName: string
    productSku: string
    category: string
    totalQuantity: number
    totalAmount: number
    orderCount: number
    avgUnitCost: number
  }>
}

export default function PurchaseAnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [period, setPeriod] = useState('last-3-months')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  const periods = [
    { value: 'last-30-days', text: 'Last 30 Days' },
    { value: 'last-3-months', text: 'Last 3 Months' },
    { value: 'last-6-months', text: 'Last 6 Months' },
    { value: 'last-12-months', text: 'Last 12 Months' },
    { value: 'ytd', text: 'Year to Date' },
    { value: 'custom', text: 'Custom Range' }
  ]

  useEffect(() => {
    // Set default date range based on period
    const today = new Date()
    const start = new Date()

    switch (period) {
      case 'last-30-days':
        start.setDate(today.getDate() - 30)
        break
      case 'last-3-months':
        start.setMonth(today.getMonth() - 3)
        break
      case 'last-6-months':
        start.setMonth(today.getMonth() - 6)
        break
      case 'last-12-months':
        start.setFullYear(today.getFullYear() - 1)
        break
      case 'ytd':
        start.setMonth(0)
        start.setDate(1)
        break
    }

    if (period !== 'custom') {
      setStartDate(start)
      setEndDate(today)
    }
  }, [period])

  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalytics()
    }
  }, [startDate, endDate])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: startDate!.toISOString().split('T')[0],
        endDate: endDate!.toISOString().split('T')[0]
      })

      const response = await fetch(`/api/reports/purchases/analytics?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load purchase analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Purchase Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive purchase insights and trends analysis
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Period
            </label>
            <SelectBox
              items={periods}
              value={period}
              onValueChanged={(e) => setPeriod(e.value)}
              displayExpr="text"
              valueExpr="value"
              width={200}
            />
          </div>

          {period === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <DateBox
                  value={startDate}
                  onValueChanged={(e) => setStartDate(e.value)}
                  type="date"
                  width={150}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <DateBox
                  value={endDate}
                  onValueChanged={(e) => setEndDate(e.value)}
                  type="date"
                  width={150}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Total Purchases</div>
              <div className="text-3xl font-bold mt-2">₱{data.summary.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs opacity-75 mt-1">{data.summary.totalPurchases} orders</div>
            </div>
            <DollarSign className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Avg Order Value</div>
              <div className="text-3xl font-bold mt-2">₱{data.summary.avgOrderValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs opacity-75 mt-1 flex items-center gap-1">
                {data.summary.periodGrowth > 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    +{data.summary.periodGrowth.toFixed(1)}% vs prev period
                  </>
                ) : (
                  <span>Stable</span>
                )}
              </div>
            </div>
            <ShoppingCart className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Total Items</div>
              <div className="text-3xl font-bold mt-2">{data.summary.totalQuantity.toLocaleString()}</div>
              <div className="text-xs opacity-75 mt-1">{data.summary.uniqueProducts} unique products</div>
            </div>
            <Package className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Active Suppliers</div>
              <div className="text-3xl font-bold mt-2">{data.summary.uniqueSuppliers}</div>
              <div className="text-xs opacity-75 mt-1">Avg {data.summary.avgItemsPerOrder.toFixed(1)} items/order</div>
            </div>
            <Users className="h-12 w-12 opacity-20" />
          </div>
        </div>
      </div>

      {/* Charts Row 1: Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Purchase Trends</h2>
          <Chart
            dataSource={data.monthlyTrends}
            height={350}
          >
            <ChartExport enabled={true} />
            <CommonSeriesSettings argumentField="month" />

            <Series
              valueField="totalAmount"
              name="Total Amount"
              type="bar"
              color="#3B82F6"
            />
            <Series
              valueField="orderCount"
              name="Order Count"
              axis="orders"
              type="spline"
              color="#10B981"
            />

            <ArgumentAxis>
              <Label rotationAngle={-45} />
            </ArgumentAxis>

            <ValueAxis name="amount">
              <Label>
                <Format type="currency" precision={0} />
              </Label>
            </ValueAxis>

            <ValueAxis name="orders" position="right">
              <Label />
            </ValueAxis>

            <Legend verticalAlignment="bottom" horizontalAlignment="center" />
            <Tooltip enabled={true} />
          </Chart>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Spending by Category</h2>
          <PieChart
            dataSource={data.categoryBreakdown}
            height={350}
            type="doughnut"
            innerRadius={0.6}
          >
            <PieExport enabled={true} />
            <PieSeries
              argumentField="category"
              valueField="totalAmount"
            >
              <PieLabel visible={true} format="₱#,##0">
                <Connector visible={true} />
              </PieLabel>
            </PieSeries>
            <PieLegend
              horizontalAlignment="center"
              verticalAlignment="bottom"
            />
            <Tooltip
              enabled={true}
              customizeTooltip={(arg: any) => ({
                text: `${arg.argumentText}: ₱${arg.value.toLocaleString()} (${arg.percentText})`
              })}
            />
          </PieChart>
        </div>
      </div>

      {/* Top Suppliers Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Suppliers by Volume</h2>
        <DataGrid
          dataSource={data.topSuppliers}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={300}
        >
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <Paging defaultPageSize={10} />

          <Column dataField="supplierName" caption="Supplier Name" />
          <Column dataField="orderCount" caption="Orders" width={100} alignment="center" />
          <Column
            dataField="totalAmount"
            caption="Total Amount"
            format="₱#,##0.00"
            alignment="right"
            width={150}
          />
          <Column
            dataField="percentage"
            caption="% of Total"
            width={120}
            alignment="right"
            customizeText={(cellInfo: any) => `${cellInfo.value.toFixed(1)}%`}
          />

          <Summary>
            <TotalItem column="supplierName" summaryType="count" displayFormat="{0} suppliers" />
            <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
          </Summary>
        </DataGrid>
      </div>

      {/* Top Products Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Most Purchased Items</h2>
        <DataGrid
          dataSource={data.topProducts}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={400}
        >
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <Paging defaultPageSize={15} />

          <Column dataField="productName" caption="Product Name" minWidth={200} />
          <Column dataField="productSku" caption="SKU" width={120} />
          <Column dataField="category" caption="Category" width={130} />
          <Column
            dataField="totalQuantity"
            caption="Total Qty"
            width={100}
            alignment="right"
            format="#,##0"
          />
          <Column
            dataField="orderCount"
            caption="Orders"
            width={90}
            alignment="center"
          />
          <Column
            dataField="totalAmount"
            caption="Total Cost"
            width={140}
            alignment="right"
            format="₱#,##0.00"
          />
          <Column
            dataField="avgUnitCost"
            caption="Avg Unit Cost"
            width={130}
            alignment="right"
            format="₱#,##0.00"
          />

          <Summary>
            <TotalItem column="productName" summaryType="count" displayFormat="{0} products" />
            <TotalItem column="totalQuantity" summaryType="sum" valueFormat="#,##0" />
            <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
          </Summary>
        </DataGrid>
      </div>
    </div>
  )
}
