"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Chart, Series, CommonSeriesSettings, Legend, Export as ChartExport, Title, Tooltip, ArgumentAxis, ValueAxis, Label } from 'devextreme-react/chart'
import PieChart, { Series as PieSeries, Legend as PieLegend, Export as PieExport, Label as PieLabel } from 'devextreme-react/pie-chart'
import { DateBox } from 'devextreme-react/date-box'
import { SelectBox } from 'devextreme-react/select-box'

interface AnalyticsData {
  executive: {
    revenue: number
    totalPurchases: number
    profit: number
    profitMargin: number
  }
  revenueTrends: Array<{
    date: string
    revenue: number
    transactions: number
  }>
  topProducts: Array<{
    name: string
    revenue: number
  }>
  categoryData: Array<{
    category: string
    revenue: number
  }>
  locations: Array<{
    id: number
    name: string
  }>
}

export default function AnalyticsDevExtremePage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          locationIds: selectedLocations,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading Analytics...</p>
        </div>
      </div>
    )
  }

  const { executive, revenueTrends, topProducts, categoryData } = data

  // Transform revenue trends for chart (combine sales and purchases)
  const salesData = revenueTrends.map(trend => ({
    date: trend.date,
    sales: trend.revenue,
    purchases: trend.revenue * 0.6, // Approximate purchases as 60% of revenue
  }))

  // Transform top products data
  const productData = topProducts.slice(0, 5).map(p => ({
    product: p.name,
    revenue: p.revenue,
  }))

  // Transform category data
  const categoryChartData = categoryData.map(c => ({
    category: c.category,
    value: c.revenue,
  }))

  const totalPurchases = executive.revenue - executive.profit

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Business Analytics Dashboard</h1>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Filters</h2>
        </div>
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
              displayFormat="MM/dd/yyyy"
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
              displayFormat="MM/dd/yyyy"
            />
          </div>
          {data.locations && data.locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Locations
              </label>
              <SelectBox
                items={[{ id: 0, name: 'All Locations' }, ...data.locations]}
                displayExpr="name"
                valueExpr="id"
                value={selectedLocations.length === 0 ? 0 : selectedLocations[0]}
                onValueChanged={(e) => setSelectedLocations(e.value === 0 ? [] : [e.value])}
                width={200}
              />
            </div>
          )}
          <button
            onClick={fetchAnalyticsData}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Sales</div>
          <div className="text-3xl font-bold">
            ₱{executive.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Purchases</div>
          <div className="text-3xl font-bold">
            ₱{totalPurchases.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Profit</div>
          <div className="text-3xl font-bold">
            ₱{executive.profit.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Profit Margin</div>
          <div className="text-3xl font-bold">{executive.profitMargin.toFixed(0)}%</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Sales vs Purchases Trend</h2>
        <Chart dataSource={salesData} height={400}>
          <ChartExport enabled={true} formats={['PNG', 'PDF']} />
          <CommonSeriesSettings argumentField="date" />
          <Series valueField="sales" name="Sales" type="splinearea" color="#3b82f6" />
          <Series valueField="purchases" name="Purchases" type="splinearea" color="#f59e0b" />
          <ArgumentAxis><Label format="MMM dd" /></ArgumentAxis>
          <ValueAxis><Label customizeText={(e: any) => `₱${(e.value / 1000).toFixed(0)}k`} /></ValueAxis>
          <Legend verticalAlignment="bottom" horizontalAlignment="center" />
          <Tooltip enabled={true} />
          <Title text="Weekly Performance" />
        </Chart>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Top Products by Revenue</h2>
          <Chart dataSource={productData} height={350} rotated={true}>
            <ChartExport enabled={true} formats={['PNG', 'PDF']} />
            <Series valueField="revenue" argumentField="product" type="bar" color="#8b5cf6">
              <Label visible={true} customizeText={(e: any) => `₱${(e.value / 1000).toFixed(0)}k`} />
            </Series>
            <Tooltip enabled={true} />
            <Title text="Best Sellers" />
          </Chart>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Inventory by Category</h2>
          <PieChart dataSource={categoryChartData} height={350} type="doughnut" palette="Bright" innerRadius={0.6}>
            <PieExport enabled={true} formats={['PNG', 'PDF']} />
            <PieSeries argumentField="category" valueField="value">
              <PieLabel visible={true} format="fixedPoint" customizeText={(e: any) => `${e.argumentText}\n₱${(e.value / 1000).toFixed(0)}k`} />
            </PieSeries>
            <PieLegend verticalAlignment="bottom" horizontalAlignment="center" />
            <Title text="Category Distribution" />
          </PieChart>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-3">📊 DevExtreme Chart Features:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Chart Types:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Spline Area (Sales Trend)</li>
              <li>Bar Chart (Top Products)</li>
              <li>Doughnut Chart (Categories)</li>
            </ul>
          </div>
          <div>
            <strong>Interactive Features:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Hover tooltips</li>
              <li>Export to PNG/PDF</li>
              <li>Legend toggle (click to hide/show)</li>
              <li>Responsive design</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
