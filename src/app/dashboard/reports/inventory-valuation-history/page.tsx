'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectBox } from 'devextreme-react/select-box'
import DataGrid, {
  Column,
  Export,
  Paging,
  SearchPanel,
  Sorting
} from 'devextreme-react/data-grid'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Package, DollarSign, Layers, BarChart3, Download, RefreshCw } from 'lucide-react'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid } from 'devextreme/excel_exporter'

interface Location {
  id: number
  name: string
}

interface CategoryValuation {
  categoryName: string
  totalQuantity: number
  totalValue: number
  percentOfTotal: number
}

interface PeriodValuation {
  period: string
  periodEnd: Date
  totalQuantity: number
  totalValue: number
  changeValue?: number
  changePercent?: number
  categoryBreakdown: CategoryValuation[]
}

interface TrendData {
  periods: PeriodValuation[]
  summary: {
    startValue: number
    endValue: number
    changeValue: number
    changePercent: number
    method: string
  }
}

export default function InventoryValuationHistoryPage() {
  const { can, user } = usePermissions()
  const router = useRouter()

  // State
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [valuationMethod, setValuationMethod] = useState<'fifo' | 'lifo' | 'avco'>('avco')
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodValuation | null>(null)

  // Check permissions
  useEffect(() => {
    if (!can(PERMISSIONS.PRODUCT_VIEW)) {
      router.push('/dashboard')
    }
  }, [can, router])

  // Load locations
  useEffect(() => {
    fetchLocations()
  }, [user])

  // Load data when filters change
  useEffect(() => {
    if (user) {
      fetchTrendData()
    }
  }, [selectedYear, periodType, selectedLocationId, valuationMethod, user])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/user-locations')
      const data = await response.json()
      const locationsList = data.locations || []

      // Add "All Locations" option
      setLocations([
        { id: 0, name: 'All Locations' },
        ...locationsList
      ])

      // Auto-select first location
      setSelectedLocationId(null)
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchTrendData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        periodType,
        method: valuationMethod,
        includeCurrent: 'true' // Include current month/quarter/year
      })

      if (selectedLocationId && selectedLocationId > 0) {
        params.append('locationId', selectedLocationId.toString())
      }

      const response = await fetch(`/api/reports/inventory-valuation-history?${params}`)
      const result = await response.json()

      if (result.success) {
        const trend = result.data.trend
        let allPeriods = [...trend.periods]

        // Include current period if available
        if (result.data.current) {
          const currentData = result.data.current
          // Add current period to the end of the periods array
          allPeriods.push({
            period: currentData.period || 'Current',
            periodEnd: new Date(),
            totalQuantity: currentData.totalQuantity || 0,
            totalValue: currentData.totalValue || 0,
            categoryBreakdown: currentData.categoryBreakdown || []
          })
        }

        // Calculate changes for each period
        const periodsWithChanges = allPeriods.map((period: PeriodValuation, index: number) => {
          if (index === 0) {
            return { ...period, changeValue: 0, changePercent: 0 }
          }

          const prevPeriod = allPeriods[index - 1]
          const changeValue = period.totalValue - prevPeriod.totalValue
          const changePercent = prevPeriod.totalValue > 0
            ? (changeValue / prevPeriod.totalValue) * 100
            : 0

          return { ...period, changeValue, changePercent }
        })

        setTrendData({
          ...trend,
          periods: periodsWithChanges
        })

        // Auto-select last period (current period if available)
        if (periodsWithChanges.length > 0) {
          setSelectedPeriod(periodsWithChanges[periodsWithChanges.length - 1])
        }
      }
    } catch (error) {
      console.error('Error fetching trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportToExcel = () => {
    if (!trendData) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Inventory Valuation Trend')

    // Add headers
    worksheet.columns = [
      { header: 'Period', key: 'period', width: 15 },
      { header: 'Total Quantity', key: 'quantity', width: 15 },
      { header: 'Total Value', key: 'value', width: 15 },
      { header: 'Change Value', key: 'changeValue', width: 15 },
      { header: 'Change %', key: 'changePercent', width: 15 }
    ]

    // Add data
    trendData.periods.forEach(period => {
      worksheet.addRow({
        period: period.period,
        quantity: period.totalQuantity,
        value: period.totalValue,
        changeValue: period.changeValue || 0,
        changePercent: period.changePercent || 0
      })
    })

    // Style headers
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    }

    // Save file
    workbook.xlsx.writeBuffer().then(buffer => {
      saveAs(
        new Blob([buffer], { type: 'application/octet-stream' }),
        `Inventory_Valuation_History_${selectedYear}_${periodType}.xlsx`
      )
    })
  }

  // Generate years dropdown (current year + 2 years back)
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value)
  }

  // Format number
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  // Prepare chart data
  const chartData = trendData?.periods.map(period => ({
    name: period.period,
    value: period.totalValue,
    quantity: period.totalQuantity
  })) || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Historical Inventory Valuation
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Track inventory value over time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchTrendData}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={handleExportToExcel}
              disabled={!trendData || loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <Card className="mb-6 bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Year */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Year
                </label>
                <SelectBox
                  items={years}
                  value={selectedYear}
                  onValueChanged={(e) => setSelectedYear(e.value)}
                  className="dx-theme-material-typography"
                />
              </div>

              {/* Period Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Period Type
                </label>
                <SelectBox
                  items={[
                    { id: 'monthly', name: 'Monthly' },
                    { id: 'quarterly', name: 'Quarterly' },
                    { id: 'yearly', name: 'Yearly' }
                  ]}
                  value={periodType}
                  onValueChanged={(e) => setPeriodType(e.value)}
                  displayExpr="name"
                  valueExpr="id"
                  className="dx-theme-material-typography"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Location
                </label>
                <SelectBox
                  items={locations}
                  value={selectedLocationId || 0}
                  onValueChanged={(e) => setSelectedLocationId(e.value === 0 ? null : e.value)}
                  displayExpr="name"
                  valueExpr="id"
                  className="dx-theme-material-typography"
                />
              </div>

              {/* Valuation Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Method
                </label>
                <SelectBox
                  items={[
                    { id: 'avco', name: 'Weighted Average' },
                    { id: 'fifo', name: 'FIFO' },
                    { id: 'lifo', name: 'LIFO' }
                  ]}
                  value={valuationMethod}
                  onValueChanged={(e) => setValuationMethod(e.value)}
                  displayExpr="name"
                  valueExpr="id"
                  className="dx-theme-material-typography"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-300">Loading valuation data...</p>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && trendData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Start Value */}
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Start Value</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(trendData.summary.startValue)}
                      </p>
                    </div>
                    <DollarSign className="w-10 h-10 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              {/* End Value */}
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">End Value</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(trendData.summary.endValue)}
                      </p>
                    </div>
                    <Package className="w-10 h-10 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Change Value */}
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Change</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        trendData.summary.changeValue >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(Math.abs(trendData.summary.changeValue))}
                      </p>
                    </div>
                    {trendData.summary.changeValue >= 0 ? (
                      <TrendingUp className="w-10 h-10 text-green-500" />
                    ) : (
                      <TrendingDown className="w-10 h-10 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Change Percent */}
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Change %</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        trendData.summary.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trendData.summary.changePercent >= 0 ? '+' : ''}
                        {formatNumber(trendData.summary.changePercent)}%
                      </p>
                    </div>
                    <BarChart3 className="w-10 h-10 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Chart */}
            <Card className="mb-6 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  Inventory Value Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Total Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Period Data Table */}
            <Card className="mb-6 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  Period Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataGrid
                  dataSource={trendData.periods}
                  showBorders={true}
                  rowAlternationEnabled={true}
                  onRowClick={(e) => setSelectedPeriod(e.data)}
                >
                  <Paging defaultPageSize={12} />
                  <SearchPanel visible={true} />
                  <Sorting mode="single" />
                  <Export enabled={true} />

                  <Column
                    dataField="period"
                    caption="Period"
                    width={150}
                  />
                  <Column
                    dataField="totalQuantity"
                    caption="Quantity"
                    format={{ type: 'fixedPoint', precision: 2 }}
                  />
                  <Column
                    dataField="totalValue"
                    caption="Total Value"
                    format={{ type: 'currency', currency: 'PHP' }}
                  />
                  <Column
                    dataField="changeValue"
                    caption="Change"
                    cellRender={(data) => {
                      const value = data.value || 0
                      return (
                        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {value >= 0 ? '+' : ''}{formatCurrency(value)}
                        </span>
                      )
                    }}
                  />
                  <Column
                    dataField="changePercent"
                    caption="Change %"
                    cellRender={(data) => {
                      const value = data.value || 0
                      return (
                        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {value >= 0 ? '+' : ''}{formatNumber(value)}%
                        </span>
                      )
                    }}
                  />
                </DataGrid>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            {selectedPeriod && selectedPeriod.categoryBreakdown.length > 0 && (
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Category Breakdown - {selectedPeriod.period}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataGrid
                    dataSource={selectedPeriod.categoryBreakdown}
                    showBorders={true}
                    rowAlternationEnabled={true}
                  >
                    <Paging defaultPageSize={10} />
                    <Sorting mode="single" />

                    <Column
                      dataField="categoryName"
                      caption="Category"
                    />
                    <Column
                      dataField="totalQuantity"
                      caption="Quantity"
                      format={{ type: 'fixedPoint', precision: 2 }}
                    />
                    <Column
                      dataField="totalValue"
                      caption="Value"
                      format={{ type: 'currency', currency: 'PHP' }}
                    />
                    <Column
                      dataField="percentOfTotal"
                      caption="% of Total"
                      cellRender={(data) => `${formatNumber(data.value)}%`}
                    />
                  </DataGrid>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* No Data State */}
        {!loading && !trendData && (
          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">
                No valuation data available for the selected filters
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
