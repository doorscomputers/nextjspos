"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import CurrentShiftWidget from "@/components/CurrentShiftWidget"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button as UiButton } from "@/components/ui/button"
import Button from 'devextreme-react/button'
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid'
import Chart, {
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Title,
  Tooltip as ChartTooltip,
  Grid,
} from 'devextreme-react/chart'
import PieChart, {
  Series as PieSeries,
  Label,
  Connector,
  Legend as PieLegend,
  Tooltip as PieTooltip,
} from 'devextreme-react/pie-chart'
import { toast } from 'sonner'

const CASHIER_ROLES = ['Sales Cashier', 'Cashier (Legacy)'] as const

interface DashboardMetrics {
  totalSales: number
  netAmount: number
  invoiceDue: number
  totalSellReturn: number
  totalPurchase: number
  purchaseDue: number
  totalSupplierReturn: number
  expense: number
  salesCount: number
  purchaseCount: number
}

interface DashboardCharts {
  salesLast30Days: Array<{ date: string; amount: number }>
  salesCurrentYear: Array<{ date: string; amount: number }>
}

interface DashboardTables {
  stockAlerts: Array<{
    id: number
    productName: string
    variationName: string
    sku: string
    currentQty: number
    alertQty: number
  }>
  pendingShipments: Array<{
    id: number
    transferNumber: string
    from: string
    to: string
    status: string
    date: string
  }>
  salesPaymentDue: Array<{
    id: number
    invoiceNumber: string
    customer: string
    date: string
    amount: number
  }>
  purchasePaymentDue: Array<{
    id: number
    purchaseOrderNumber: string
    supplier: string
    date: string
    amount: number
  }>
  supplierPayments: Array<{
    id: number
    paymentNumber: string
    supplier: string
    date: string
    amount: number
    paymentMethod: string
    purchaseOrderNumber: string
  }>
}

interface SalesByLocationData {
  period: string
  locations: string[]
  salesByLocation: Record<string, Array<{ period: string; amount: number }>>
  totals: Array<{ location: string; total: number }>
}

// Loading Skeleton Components
const MetricSkeleton = () => (
  <div className="relative overflow-hidden rounded-lg shadow-lg bg-gray-200 dark:bg-gray-700 p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-3"></div>
        <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
      </div>
      <div className="p-3 bg-gray-300 dark:bg-gray-600 rounded-full">
        <div className="h-8 w-8"></div>
      </div>
    </div>
  </div>
)

const ChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded flex items-end justify-around p-4 gap-2">
      {[60, 80, 40, 90, 50, 70].map((height, i) => (
        <div key={i} className="bg-gray-300 dark:bg-gray-600 rounded-t" style={{ height: `${height}%`, width: '100%' }}></div>
      ))}
    </div>
  </div>
)

const TableSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex gap-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    ))}
  </div>
)

export default function DashboardProgressivePage() {
  const router = useRouter()
  const { can, hasAnyRole, user } = usePermissions()

  // Separate loading states for progressive loading
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(true)
  const [loadingTables, setLoadingTables] = useState(true)

  // Separate data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [charts, setCharts] = useState<DashboardCharts | null>(null)
  const [tables, setTables] = useState<DashboardTables | null>(null)

  const [locationFilter, setLocationFilter] = useState("all")
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [showAllLocationsOption, setShowAllLocationsOption] = useState(false)

  // Sales by location states
  const [salesPeriod, setSalesPeriod] = useState<'day' | 'month' | 'quarter' | 'year'>('day')
  const [salesByLocation, setSalesByLocation] = useState<SalesByLocationData | null>(null)
  const [loadingSales, setLoadingSales] = useState(false)

  // Supplier payments date range filter
  const [supplierPaymentsDateRange, setSupplierPaymentsDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all')

  // Performance tracking
  const [loadTimes, setLoadTimes] = useState<{
    metrics?: number
    charts?: number
    tables?: number
    total?: number
  }>({})

  // AUTO-REDIRECT: Cashiers with active shifts should go straight to POS
  useEffect(() => {
    const checkShiftAndRedirect = async () => {
      if (hasAnyRole([...CASHIER_ROLES]) && can(PERMISSIONS.SHIFT_OPEN)) {
        try {
          const response = await fetch('/api/shifts/check-unclosed')
          if (!response.ok) return

          const data = await response.json()
          if (data.hasUnclosedShift) {
            console.log('[Dashboard] Auto-redirecting cashier to POS (active shift detected)')
            router.push('/dashboard/pos')
          }
        } catch (error) {
          console.error('[Dashboard] Error checking shift for auto-redirect:', error)
        }
      }
    }

    if (user) {
      checkShiftAndRedirect()
    }
  }, [user, hasAnyRole, can, router])

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    // Progressive loading: Start all fetches, but don't wait for each other
    const startTime = Date.now()
    fetchMetrics(startTime)
    fetchCharts(startTime)
    fetchTables(startTime)
  }, [locationFilter, supplierPaymentsDateRange])

  useEffect(() => {
    if (user) {
      fetchSalesByLocation()
    }
  }, [salesPeriod, user])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        const fetchedLocations = Array.isArray(data.locations) ? data.locations : (Array.isArray(data) ? data : [])
        setLocations(fetchedLocations)

        if (fetchedLocations.length > 1) {
          setShowAllLocationsOption(true)
          setLocationFilter("all")
        } else if (fetchedLocations.length === 1) {
          setShowAllLocationsOption(false)
          setLocationFilter(fetchedLocations[0].id.toString())
        } else {
          setShowAllLocationsOption(false)
          setLocations([])
        }
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  // 🚀 PROGRESSIVE LOADING #1: Fetch Metrics First (Critical Data)
  const fetchMetrics = async (startTime: number) => {
    try {
      setLoadingMetrics(true)
      const params = new URLSearchParams()
      if (locationFilter !== "all") {
        params.append("locationId", locationFilter)
      }

      // Add date range filter for supplier payments
      const today = new Date()
      if (supplierPaymentsDateRange === 'today') {
        params.append("startDate", today.toISOString().split('T')[0])
        params.append("endDate", today.toISOString().split('T')[0])
      } else if (supplierPaymentsDateRange === 'week') {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        params.append("startDate", weekAgo.toISOString().split('T')[0])
        params.append("endDate", today.toISOString().split('T')[0])
      } else if (supplierPaymentsDateRange === 'month') {
        const monthAgo = new Date(today)
        monthAgo.setDate(monthAgo.getDate() - 30)
        params.append("startDate", monthAgo.toISOString().split('T')[0])
        params.append("endDate", today.toISOString().split('T')[0])
      }

      const metricStart = Date.now()
      const response = await fetch(`/api/dashboard/stats-progressive?${params.toString()}&section=metrics`)

      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics)

        const metricTime = Date.now() - metricStart
        setLoadTimes(prev => ({ ...prev, metrics: metricTime }))
        console.log(`📊 [Progressive] Metrics loaded in ${metricTime}ms`)
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
      toast.error('Failed to load dashboard metrics')
    } finally {
      setLoadingMetrics(false)
    }
  }

  // 🚀 PROGRESSIVE LOADING #2: Fetch Charts Second (Visualizations)
  const fetchCharts = async (startTime: number) => {
    try {
      setLoadingCharts(true)
      const params = new URLSearchParams()
      if (locationFilter !== "all") {
        params.append("locationId", locationFilter)
      }

      const chartStart = Date.now()
      const response = await fetch(`/api/dashboard/stats-progressive?${params.toString()}&section=charts`)

      if (response.ok) {
        const data = await response.json()
        setCharts(data.charts)

        const chartTime = Date.now() - chartStart
        setLoadTimes(prev => ({ ...prev, charts: chartTime }))
        console.log(`📈 [Progressive] Charts loaded in ${chartTime}ms`)
      }
    } catch (error) {
      console.error("Failed to fetch charts:", error)
      toast.error('Failed to load dashboard charts')
    } finally {
      setLoadingCharts(false)
    }
  }

  // 🚀 PROGRESSIVE LOADING #3: Fetch Tables Last (Detailed Data)
  const fetchTables = async (startTime: number) => {
    try {
      setLoadingTables(true)
      const params = new URLSearchParams()
      if (locationFilter !== "all") {
        params.append("locationId", locationFilter)
      }

      const tableStart = Date.now()
      const response = await fetch(`/api/dashboard/stats-progressive?${params.toString()}&section=tables`)

      if (response.ok) {
        const data = await response.json()
        setTables(data.tables)

        const tableTime = Date.now() - tableStart
        const totalTime = Date.now() - startTime
        setLoadTimes(prev => ({ ...prev, tables: tableTime, total: totalTime }))
        console.log(`📋 [Progressive] Tables loaded in ${tableTime}ms`)
        console.log(`⚡ [Progressive] Total dashboard load time: ${totalTime}ms`)
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error)
      toast.error('Failed to load dashboard tables')
    } finally {
      setLoadingTables(false)
    }
  }

  const fetchSalesByLocation = async () => {
    try {
      setLoadingSales(true)
      const response = await fetch(`/api/dashboard/sales-by-location?period=${salesPeriod}`)
      if (response.ok) {
        const data = await response.json()
        setSalesByLocation(data)
      } else {
        toast.error('Failed to load sales by location')
      }
    } catch (error) {
      console.error("Failed to fetch sales by location:", error)
      toast.error('Failed to load sales by location')
    } finally {
      setLoadingSales(false)
    }
  }

  const refreshAll = () => {
    const startTime = Date.now()
    fetchMetrics(startTime)
    fetchCharts(startTime)
    fetchTables(startTime)
    fetchSalesByLocation()
  }

  const formatAmount = (amount: number) => {
    return formatCurrency(amount)
  }

  const metricCards = [
    {
      name: "Total Sales",
      value: metrics?.totalSales || 0,
      icon: CurrencyDollarIcon,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Net Amount",
      value: metrics?.netAmount || 0,
      icon: BanknotesIcon,
      color: "from-green-500 to-green-600",
      textColor: "text-green-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Invoice Due",
      value: metrics?.invoiceDue || 0,
      icon: ArrowTrendingUpIcon,
      color: "from-orange-500 to-orange-600",
      textColor: "text-orange-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Total Sell Return",
      value: metrics?.totalSellReturn || 0,
      icon: ReceiptRefundIcon,
      color: "from-red-500 to-red-600",
      textColor: "text-red-600",
      permission: PERMISSIONS.CUSTOMER_RETURN_VIEW,
    },
    {
      name: "Total Purchase",
      value: metrics?.totalPurchase || 0,
      icon: ShoppingCartIcon,
      color: "from-purple-500 to-purple-600",
      textColor: "text-purple-600",
      permission: PERMISSIONS.PURCHASE_VIEW,
    },
    {
      name: "Purchase Due",
      value: metrics?.purchaseDue || 0,
      icon: ArrowTrendingDownIcon,
      color: "from-yellow-500 to-yellow-600",
      textColor: "text-yellow-600",
      permission: PERMISSIONS.PURCHASE_VIEW,
    },
    {
      name: "Total Supplier Return",
      value: metrics?.totalSupplierReturn || 0,
      icon: ReceiptRefundIcon,
      color: "from-pink-500 to-pink-600",
      textColor: "text-pink-600",
      permission: PERMISSIONS.SUPPLIER_RETURN_VIEW,
    },
    {
      name: "Expense",
      value: metrics?.expense || 0,
      icon: BanknotesIcon,
      color: "from-gray-500 to-gray-600",
      textColor: "text-gray-600",
      permission: PERMISSIONS.EXPENSE_VIEW,
    },
  ]

  const filteredMetrics = metricCards.filter(
    (metric) => !metric.permission || can(metric.permission)
  )

  // Transform data for bar chart
  const getChartData = () => {
    if (!salesByLocation) return []

    const allPeriods = new Set<string>()
    Object.values(salesByLocation.salesByLocation).forEach((locationData) => {
      locationData.forEach((item) => allPeriods.add(item.period))
    })

    return Array.from(allPeriods).map((period) => {
      const dataPoint: any = { period }
      salesByLocation.locations.forEach((location) => {
        const locationData = salesByLocation.salesByLocation[location]
        const item = locationData?.find((d) => d.period === period)
        dataPoint[location] = item?.amount || 0
      })
      return dataPoint
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Location Filter and Performance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Overview (Progressive Loading)
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
            Welcome back, {user?.name}
            {loadTimes.total && (
              <Badge variant="outline" className="ml-2">
                ⚡ Loaded in {loadTimes.total}ms
              </Badge>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {locations.length > 0 && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Location:</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {showAllLocationsOption && (
                    <SelectItem value="all">All Locations</SelectItem>
                  )}
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button onClick={refreshAll} variant="outline" size="sm">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Shift Widget */}
      {can(PERMISSIONS.SHIFT_OPEN) && hasAnyRole([...CASHIER_ROLES]) && (
        <CurrentShiftWidget />
      )}

      {/* 🚀 SECTION 1: Metric Cards (Loads First - Most Critical) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingMetrics ? (
          // Show skeleton loaders while metrics are loading
          Array.from({ length: 8 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          // Show actual metrics once loaded
          filteredMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.name} className={`relative overflow-hidden rounded-lg shadow-lg bg-gradient-to-br ${metric.color} p-6 text-white hover:shadow-xl transition-all duration-200 hover:scale-105`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium opacity-90">{metric.name}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-2">
                      {formatAmount(metric.value)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                    <Icon className="h-8 w-8" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Sales by Location Charts */}
      {can(PERMISSIONS.SELL_VIEW) && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-xl font-bold">Sales by Location</CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</label>
                <Select value={salesPeriod} onValueChange={(value) => setSalesPeriod(value as any)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Today</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSales ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : !salesByLocation || salesByLocation.locations.length === 0 || salesByLocation.totals.every(t => t.total === 0) ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                <svg className="w-24 h-24 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium">No sales data available</p>
                <p className="text-sm mt-2">Sales data will appear here once you start making sales</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div>
                  <Chart
                    dataSource={getChartData()}
                    height={350}
                  >
                    <Title text={`Sales by Location (${salesPeriod.charAt(0).toUpperCase() + salesPeriod.slice(1)})`} />
                    <CommonSeriesSettings argumentField="period" type="bar" />
                    {salesByLocation?.locations.map((location, index) => (
                      <Series
                        key={location}
                        valueField={location}
                        name={location}
                        color={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]}
                      />
                    ))}
                    <ArgumentAxis>
                      <Grid visible={true} />
                    </ArgumentAxis>
                    <ValueAxis>
                      <Grid visible={true} />
                    </ValueAxis>
                    <Legend verticalAlignment="bottom" horizontalAlignment="center" />
                    <ChartTooltip
                      enabled={true}
                      customizeTooltip={(pointInfo: any) => ({
                        text: `${pointInfo.seriesName}: ${formatAmount(pointInfo.value)}`,
                      })}
                    />
                    <Export enabled={true} />
                  </Chart>
                </div>

                {/* Pie Chart */}
                <div>
                  <PieChart
                    dataSource={salesByLocation?.totals || []}
                    height={350}
                  >
                    <Title text="Total Sales Distribution" />
                    <PieSeries
                      argumentField="location"
                      valueField="total"
                    >
                      <Label visible={true} customizeText={(pointInfo: any) => `${formatAmount(pointInfo.value)}`}>
                        <Connector visible={true} width={1} />
                      </Label>
                    </PieSeries>
                    <PieLegend verticalAlignment="bottom" horizontalAlignment="center" />
                    <PieTooltip
                      enabled={true}
                      customizeTooltip={(pointInfo: any) => ({
                        text: `${pointInfo.argumentText}: ${formatAmount(pointInfo.value)}`,
                      })}
                    />
                    <Export enabled={true} />
                  </PieChart>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 🚀 SECTION 2: Charts (Loads Second - Visualizations) */}
      {can(PERMISSIONS.SELL_VIEW) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Last 30 Days */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sales Last 30 Days
                {loadingCharts && <Badge variant="outline">Loading...</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCharts ? (
                <ChartSkeleton />
              ) : (
                <Chart
                  dataSource={charts?.salesLast30Days || []}
                  height={300}
                >
                  <Series
                    argumentField="date"
                    valueField="amount"
                    name="Sales"
                    type="line"
                    color="#3b82f6"
                  />
                  <ArgumentAxis>
                    <Grid visible={true} />
                  </ArgumentAxis>
                  <ValueAxis>
                    <Grid visible={true} />
                  </ValueAxis>
                  <Legend visible={false} />
                  <ChartTooltip
                    enabled={true}
                    customizeTooltip={(pointInfo: any) => ({
                      text: `${pointInfo.argumentText}: ${formatAmount(pointInfo.value)}`,
                    })}
                  />
                  <Export enabled={true} />
                </Chart>
              )}
            </CardContent>
          </Card>

          {/* Sales Current Financial Year */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sales Current Financial Year
                {loadingCharts && <Badge variant="outline">Loading...</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCharts ? (
                <ChartSkeleton />
              ) : (
                <Chart
                  dataSource={charts?.salesCurrentYear || []}
                  height={300}
                >
                  <Series
                    argumentField="date"
                    valueField="amount"
                    name="Sales"
                    type="line"
                    color="#10b981"
                  />
                  <ArgumentAxis>
                    <Grid visible={true} />
                  </ArgumentAxis>
                  <ValueAxis>
                    <Grid visible={true} />
                  </ValueAxis>
                  <Legend visible={false} />
                  <ChartTooltip
                    enabled={true}
                    customizeTooltip={(pointInfo: any) => ({
                      text: `${pointInfo.argumentText}: ${formatAmount(pointInfo.value)}`,
                    })}
                  />
                  <Export enabled={true} />
                </Chart>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🚀 SECTION 3: Tables (Loads Last - Detailed Data) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Payment Due */}
        {can(PERMISSIONS.SELL_VIEW) && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sales Payment Due
                {loadingTables && <Badge variant="outline">Loading...</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTables ? (
                <TableSkeleton />
              ) : (
                <DataGrid
                  dataSource={tables?.salesPaymentDue || []}
                  showBorders={true}
                  columnAutoWidth={true}
                  height={300}
                  keyExpr="id"
                >
                  <Column dataField="invoiceNumber" caption="Invoice" />
                  <Column dataField="customer" caption="Customer" />
                  <Column dataField="date" caption="Date" width={100} />
                  <Column
                    dataField="amount"
                    caption="Amount"
                    dataType="number"
                    format="₱#,##0.00"
                    alignment="right"
                  />
                  <Summary>
                    <TotalItem column="amount" summaryType="sum" valueFormat="₱#,##0.00" />
                  </Summary>
                </DataGrid>
              )}
            </CardContent>
          </Card>
        )}

        {/* Purchase Payment Due */}
        {can(PERMISSIONS.PURCHASE_VIEW) && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Purchase Payment Due
                {loadingTables && <Badge variant="outline">Loading...</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTables ? (
                <TableSkeleton />
              ) : (
                <DataGrid
                  dataSource={tables?.purchasePaymentDue || []}
                  showBorders={true}
                  columnAutoWidth={true}
                  height={300}
                  keyExpr="id"
                >
                  <Column dataField="purchaseOrderNumber" caption="PO Number" />
                  <Column dataField="supplier" caption="Supplier" />
                  <Column dataField="date" caption="Date" width={100} />
                  <Column
                    dataField="amount"
                    caption="Amount"
                    dataType="number"
                    format="₱#,##0.00"
                    alignment="right"
                  />
                  <Summary>
                    <TotalItem column="amount" summaryType="sum" valueFormat="₱#,##0.00" />
                  </Summary>
                </DataGrid>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payments to Suppliers */}
        {can(PERMISSIONS.PURCHASE_VIEW) && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <BanknotesIcon className="h-5 w-5 text-purple-600" />
                  Payments to Suppliers
                  {loadingTables && <Badge variant="outline">Loading...</Badge>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</label>
                  <Select value={supplierPaymentsDateRange} onValueChange={(value) => setSupplierPaymentsDateRange(value as any)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTables ? (
                <TableSkeleton />
              ) : (
                <DataGrid
                  dataSource={tables?.supplierPayments || []}
                  showBorders={true}
                  columnAutoWidth={true}
                  height={300}
                  keyExpr="id"
                >
                  <Column dataField="paymentNumber" caption="Payment #" width={120} />
                  <Column dataField="supplier" caption="Supplier" />
                  <Column dataField="purchaseOrderNumber" caption="PO Number" width={120} />
                  <Column dataField="date" caption="Date" width={100} />
                  <Column
                    dataField="paymentMethod"
                    caption="Method"
                    width={100}
                    cellRender={(data: any) => (
                      <Badge variant="outline" className="capitalize">
                        {data.value.replace('_', ' ')}
                      </Badge>
                    )}
                  />
                  <Column
                    dataField="amount"
                    caption="Amount"
                    dataType="number"
                    format="₱#,##0.00"
                    alignment="right"
                  />
                  <Summary>
                    <TotalItem column="amount" summaryType="sum" valueFormat="₱#,##0.00" />
                  </Summary>
                  <Export enabled={true} />
                </DataGrid>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Stock Alert Summary */}
        {can(PERMISSIONS.PRODUCT_VIEW) && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer shadow-lg" onClick={() => window.location.href = '/dashboard/reports/stock-alert'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                  Low Stock Alert
                  {loadingTables && <Badge variant="outline">Loading...</Badge>}
                </div>
                {!loadingTables && (
                  <Badge variant="destructive" className="text-lg px-3 py-1">
                    {tables?.stockAlerts.length || 0}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {loadingTables ? (
                    "Loading stock alerts..."
                  ) : tables?.stockAlerts.length === 0 ? (
                    "All products are well stocked"
                  ) : (
                    `${tables?.stockAlerts.length} product(s) below alert level`
                  )}
                </p>
                <Button
                  text="View Detailed Report"
                  type="default"
                  icon="warning"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.location.href = '/dashboard/reports/stock-alert'
                  }}
                  stylingMode="contained"
                  width="100%"
                  className="mt-4"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Shipments */}
        {can(PERMISSIONS.STOCK_TRANSFER_VIEW) && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-blue-600" />
                Pending Shipments
                {loadingTables && <Badge variant="outline">Loading...</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTables ? (
                <TableSkeleton />
              ) : (
                <DataGrid
                  dataSource={tables?.pendingShipments || []}
                  showBorders={true}
                  columnAutoWidth={true}
                  height={300}
                  keyExpr="id"
                >
                  <Column dataField="transferNumber" caption="Transfer #" width={120} />
                  <Column
                    caption="Route"
                    cellRender={(data: any) => (
                      <div className="text-sm">
                        <span className="text-gray-600">{data.data.from}</span>
                        {" → "}
                        <span className="text-gray-900 dark:text-gray-100">{data.data.to}</span>
                      </div>
                    )}
                  />
                  <Column dataField="status" caption="Status" width={100} />
                  <Column dataField="date" caption="Date" width={100} />
                </DataGrid>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Summary */}
      {loadTimes.total && (
        <Card className="shadow-lg bg-gradient-to-r from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Progressive Loading Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Metrics</p>
                <p className="text-2xl font-bold text-blue-600">{loadTimes.metrics}ms</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Charts</p>
                <p className="text-2xl font-bold text-green-600">{loadTimes.charts}ms</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Tables</p>
                <p className="text-2xl font-bold text-purple-600">{loadTimes.tables}ms</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Total</p>
                <p className="text-2xl font-bold text-orange-600">{loadTimes.total}ms</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              💡 Critical metrics show immediately, while charts and tables load progressively in the background
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
