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
  Export as ChartExport,
  Grid
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
  Paging,
  Scrolling
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Activity,
  Target,
  Clock,
  MapPin,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw
} from 'lucide-react'

interface IntelligenceDashboardData {
  executive: {
    revenue: number
    revenueGrowth: number
    transactions: number
    transactionGrowth: number
    profit: number
    profitMargin: number
    avgTransactionValue: number
    itemsSold: number
    totalCustomers: number
    inventoryValue: number
    lowStockCount: number
    outOfStockCount: number
  }
  revenueTrends: Array<{
    date: string
    revenue: number
    transactions: number
    avgTransaction: number
  }>
  topProducts: Array<{
    productId: number
    name: string
    sku: string
    category: string
    revenue: number
    quantity: number
    profit: number
    transactions: number
  }>
  categoryData: Array<{
    category: string
    revenue: number
    profit: number
    quantity: number
    transactions: number
  }>
  hourlyPattern: Array<{
    hour: number
    transactions: number
    revenue: number
  }>
  topCustomers: Array<{
    customerId: number
    name: string
    email: string
    phone: string
    revenue: number
    transactions: number
    lastPurchase: Date
  }>
  fastMovers: Array<{
    productId: number
    name: string
    sku: string
    quantitySold: number
    currentStock: number
    daysToStockOut: number
    reorderRecommended: boolean
  }>
  reorderRecommendations: Array<{
    productId: number
    name: string
    sku: string
    quantitySold: number
    currentStock: number
    daysToStockOut: number
    reorderRecommended: boolean
  }>
  locationData: Array<{
    locationId: number
    locationName: string
    revenue: number
    transactions: number
    profit: number
  }>
  locations: Array<{
    id: number
    name: string
  }>
}

export default function DashboardV3Page() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<IntelligenceDashboardData | null>(null)
  // Start with null dates = no filter = show all-time data
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate ? startDate.toISOString().split('T')[0] : '',
          endDate: endDate ? endDate.toISOString().split('T')[0] : '',
          locationIds: selectedLocations,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      toast.error('Failed to load dashboard intelligence')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 font-medium">
            Loading Business Intelligence...
          </p>
        </div>
      </div>
    )
  }

  const { executive } = data

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Sales Dashboard V3
          </h1>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </button>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-4">
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
          {data.locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Locations
              </label>
              <SelectBox
                items={data.locations}
                displayExpr="name"
                valueExpr="id"
                value={selectedLocations}
                onValueChanged={(e) => setSelectedLocations(e.value ? [e.value] : [])}
                placeholder="All Locations"
                width={200}
                showClearButton={true}
              />
            </div>
          )}
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY - KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </div>
              <div className="text-3xl font-bold mt-2">
                ₱{executive.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {executive.revenueGrowth >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-semibold">+{executive.revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    <span className="font-semibold">{executive.revenueGrowth.toFixed(1)}%</span>
                  </>
                )}
                <span className="opacity-75">vs previous period</span>
              </div>
            </div>
            <Activity className="h-12 w-12 opacity-20" />
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <Target className="h-4 w-4" />
                Total Profit
              </div>
              <div className="text-3xl font-bold mt-2">
                ₱{executive.profit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs opacity-90">
                Margin: <span className="font-semibold">{executive.profitMargin.toFixed(1)}%</span>
              </div>
            </div>
            <TrendingUp className="h-12 w-12 opacity-20" />
          </div>
        </div>

        {/* Transactions Card */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <ShoppingCart className="h-4 w-4" />
                Transactions
              </div>
              <div className="text-3xl font-bold mt-2">
                {executive.transactions.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {executive.transactionGrowth >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-semibold">+{executive.transactionGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    <span className="font-semibold">{executive.transactionGrowth.toFixed(1)}%</span>
                  </>
                )}
                <span className="opacity-75">vs previous period</span>
              </div>
            </div>
            <BarChart3 className="h-12 w-12 opacity-20" />
          </div>
        </div>

        {/* Avg Transaction Value Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <Activity className="h-4 w-4" />
                Avg Transaction
              </div>
              <div className="text-3xl font-bold mt-2">
                ₱{executive.avgTransactionValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs opacity-90">
                {executive.itemsSold.toLocaleString()} items sold
              </div>
            </div>
            <Zap className="h-12 w-12 opacity-20" />
          </div>
        </div>
      </div>

      {/* SECONDARY KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inventory Value */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                <Package className="h-4 w-4" />
                Inventory Value
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                ₱{executive.inventoryValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <Package className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                <Users className="h-4 w-4" />
                Total Customers
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {executive.totalCustomers.toLocaleString()}
              </div>
            </div>
            <Users className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-500 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Low Stock Items
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {executive.lowStockCount}
              </div>
            </div>
            <AlertTriangle className="h-10 w-10 text-yellow-300 dark:text-yellow-600" />
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-red-500 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-500 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Out of Stock
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {executive.outOfStockCount}
              </div>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-300 dark:text-red-600" />
          </div>
        </div>
      </div>

      {/* REVENUE TRENDS CHART */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Revenue & Transaction Trends
        </h2>
        <Chart
          dataSource={data.revenueTrends}
          height={400}
        >
          <ChartExport enabled={true} />
          <CommonSeriesSettings argumentField="date" />

          <Series
            valueField="revenue"
            name="Revenue"
            type="splinearea"
            color="#3B82F6"
          />
          <Series
            valueField="avgTransaction"
            name="Avg Transaction Value"
            axis="avgValue"
            type="spline"
            color="#10B981"
          />

          <ArgumentAxis>
            <Label format="MMM dd" rotationAngle={-45} />
          </ArgumentAxis>

          <ValueAxis name="revenue">
            <Label>
              <Format type="currency" precision={0} />
            </Label>
            <Grid visible={true} />
          </ValueAxis>

          <ValueAxis name="avgValue" position="right">
            <Label>
              <Format type="currency" precision={0} />
            </Label>
          </ValueAxis>

          <Legend verticalAlignment="bottom" horizontalAlignment="center" />
          <Tooltip enabled={true} />
        </Chart>
      </div>

      {/* CATEGORY PERFORMANCE & HOURLY PATTERN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-purple-600" />
            Revenue by Category
          </h2>
          <PieChart
            dataSource={data.categoryData}
            height={350}
            type="doughnut"
            innerRadius={0.65}
          >
            <PieExport enabled={true} />
            <PieSeries
              argumentField="category"
              valueField="revenue"
            >
              <PieLabel visible={true} format="₱#,##0" customizeText={(arg: any) => `${arg.argumentText}\n₱${(arg.value / 1000).toFixed(0)}k`}>
                <Connector visible={true} width={1} />
              </PieLabel>
            </PieSeries>
            <PieLegend
              horizontalAlignment="center"
              verticalAlignment="bottom"
            />
            <Tooltip
              enabled={true}
              customizeTooltip={(arg: any) => ({
                text: `${arg.argumentText}: ₱${arg.value.toLocaleString()}`
              })}
            />
          </PieChart>
        </div>

        {/* Hourly Sales Pattern */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Sales Pattern by Hour
          </h2>
          <Chart
            dataSource={data.hourlyPattern}
            height={350}
          >
            <ChartExport enabled={true} />
            <Series
              valueField="revenue"
              argumentField="hour"
              type="bar"
              color="#F59E0B"
            />
            <ArgumentAxis>
              <Label customizeText={(e: any) => `${e.value}:00`} />
            </ArgumentAxis>
            <ValueAxis>
              <Label>
                <Format type="currency" precision={0} />
              </Label>
            </ValueAxis>
            <Tooltip
              enabled={true}
              customizeTooltip={(arg: any) => ({
                text: `${arg.argument}:00\nRevenue: ₱${arg.value.toLocaleString()}\nTransactions: ${data.hourlyPattern[arg.argument]?.transactions || 0}`
              })}
            />
          </Chart>
        </div>
      </div>

      {/* TOP PRODUCTS TABLE */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-green-600" />
          Top Performing Products
        </h2>
        <DataGrid
          dataSource={data.topProducts}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={400}
        >
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <Paging defaultPageSize={10} />
          <Scrolling mode="virtual" />

          <Column dataField="name" caption="Product Name" minWidth={200} />
          <Column dataField="sku" caption="SKU" width={120} />
          <Column dataField="category" caption="Category" width={130} />
          <Column
            dataField="quantity"
            caption="Qty Sold"
            width={100}
            alignment="right"
            format="#,##0"
          />
          <Column
            dataField="transactions"
            caption="Orders"
            width={90}
            alignment="center"
          />
          <Column
            dataField="revenue"
            caption="Revenue"
            width={140}
            alignment="right"
            format="₱#,##0.00"
          />
          <Column
            dataField="profit"
            caption="Profit"
            width={140}
            alignment="right"
            format="₱#,##0.00"
            customizeText={(cellInfo: any) => {
              const value = cellInfo.value
              return value >= 0 ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : `-₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
            }}
          />

          <Summary>
            <TotalItem column="name" summaryType="count" displayFormat="{0} products" />
            <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0" />
            <TotalItem column="revenue" summaryType="sum" valueFormat="₱#,##0.00" />
            <TotalItem column="profit" summaryType="sum" valueFormat="₱#,##0.00" />
          </Summary>
        </DataGrid>
      </div>

      {/* INVENTORY INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast Movers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Fast Moving Products
          </h2>
          <DataGrid
            dataSource={data.fastMovers}
            showBorders={true}
            columnAutoWidth={true}
            rowAlternationEnabled={true}
            height={350}
          >
            <Export enabled={true} formats={['xlsx', 'pdf']} />
            <Paging defaultPageSize={8} />

            <Column dataField="name" caption="Product" minWidth={150} />
            <Column dataField="sku" caption="SKU" width={100} />
            <Column
              dataField="quantitySold"
              caption="Sold"
              width={80}
              alignment="right"
              format="#,##0"
            />
            <Column
              dataField="currentStock"
              caption="Stock"
              width={80}
              alignment="right"
              format="#,##0"
            />
          </DataGrid>
        </div>

        {/* Reorder Recommendations */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Reorder Recommendations
          </h2>
          <DataGrid
            dataSource={data.reorderRecommendations}
            showBorders={true}
            columnAutoWidth={true}
            rowAlternationEnabled={true}
            height={350}
          >
            <Export enabled={true} formats={['xlsx', 'pdf']} />
            <Paging defaultPageSize={8} />

            <Column dataField="name" caption="Product" minWidth={150} />
            <Column dataField="sku" caption="SKU" width={100} />
            <Column
              dataField="currentStock"
              caption="Stock"
              width={80}
              alignment="right"
              format="#,##0"
            />
            <Column
              dataField="daysToStockOut"
              caption="Days Left"
              width={100}
              alignment="center"
              customizeText={(cellInfo: any) => {
                const days = cellInfo.value
                return days < 7 ? `${days} days ⚠️` : `${days} days`
              }}
            />
          </DataGrid>
        </div>
      </div>

      {/* TOP CUSTOMERS TABLE */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Top Customers
        </h2>
        <DataGrid
          dataSource={data.topCustomers}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={350}
        >
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <Paging defaultPageSize={10} />

          <Column dataField="name" caption="Customer Name" minWidth={180} />
          <Column dataField="email" caption="Email" minWidth={180} />
          <Column dataField="phone" caption="Phone" width={130} />
          <Column
            dataField="transactions"
            caption="Orders"
            width={90}
            alignment="center"
          />
          <Column
            dataField="revenue"
            caption="Total Revenue"
            width={150}
            alignment="right"
            format="₱#,##0.00"
          />
          <Column
            dataField="lastPurchase"
            caption="Last Purchase"
            width={130}
            dataType="date"
            format="MMM dd, yyyy"
          />

          <Summary>
            <TotalItem column="name" summaryType="count" displayFormat="{0} customers" />
            <TotalItem column="revenue" summaryType="sum" valueFormat="₱#,##0.00" />
          </Summary>
        </DataGrid>
      </div>

      {/* LOCATION PERFORMANCE */}
      {data.locationData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            Performance by Location
          </h2>
          <DataGrid
            dataSource={data.locationData}
            showBorders={true}
            columnAutoWidth={true}
            rowAlternationEnabled={true}
            height={300}
          >
            <Export enabled={true} formats={['xlsx', 'pdf']} />
            <Paging defaultPageSize={10} />

            <Column dataField="locationName" caption="Location" minWidth={200} />
            <Column
              dataField="transactions"
              caption="Transactions"
              width={130}
              alignment="center"
            />
            <Column
              dataField="revenue"
              caption="Revenue"
              width={150}
              alignment="right"
              format="₱#,##0.00"
            />
            <Column
              dataField="profit"
              caption="Profit"
              width={150}
              alignment="right"
              format="₱#,##0.00"
            />

            <Summary>
              <TotalItem column="locationName" summaryType="count" displayFormat="{0} locations" />
              <TotalItem column="revenue" summaryType="sum" valueFormat="₱#,##0.00" />
              <TotalItem column="profit" summaryType="sum" valueFormat="₱#,##0.00" />
            </Summary>
          </DataGrid>
        </div>
      )}

      {/* INSIGHTS & RECOMMENDATIONS */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Key Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Revenue Performance
            </div>
            <p>
              {executive.revenueGrowth >= 0
                ? `Revenue is up ${executive.revenueGrowth.toFixed(1)}% compared to the previous period. Maintain momentum by focusing on high-margin products.`
                : `Revenue is down ${Math.abs(executive.revenueGrowth).toFixed(1)}%. Consider promotions on slow-moving items and review pricing strategy.`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              Inventory Health
            </div>
            <p>
              {executive.lowStockCount > 0
                ? `${executive.lowStockCount} products are running low. Review reorder recommendations to prevent stockouts.`
                : 'Inventory levels are healthy. Continue monitoring fast-moving products.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Profit Margin
            </div>
            <p>
              Current profit margin is {executive.profitMargin.toFixed(1)}%.
              {executive.profitMargin >= 30
                ? ' Excellent profitability! Focus on scaling high-margin categories.'
                : ' Consider reviewing supplier costs and adjusting pricing for better margins.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Customer Engagement
            </div>
            <p>
              Average transaction value is ₱{executive.avgTransactionValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.
              Consider upselling and cross-selling strategies to increase basket size.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
