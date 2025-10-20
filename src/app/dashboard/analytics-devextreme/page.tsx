"use client"

import { Chart, Series, CommonSeriesSettings, Legend, Export as ChartExport, Title, Tooltip, ArgumentAxis, ValueAxis, Label } from 'devextreme-react/chart'
import PieChart, { Series as PieSeries, Legend as PieLegend, Export as PieExport, Label as PieLabel } from 'devextreme-react/pie-chart'

const salesData = [
  { date: '2025-01-01', sales: 45000, purchases: 28000 },
  { date: '2025-01-02', sales: 52000, purchases: 31000 },
  { date: '2025-01-03', sales: 48000, purchases: 29000 },
  { date: '2025-01-04', sales: 61000, purchases: 35000 },
  { date: '2025-01-05', sales: 58000, purchases: 33000 },
  { date: '2025-01-06', sales: 72000, purchases: 42000 },
  { date: '2025-01-07', sales: 68000, purchases: 40000 },
]

const topProducts = [
  { product: 'Laptop Dell', revenue: 562500 },
  { product: 'iPhone 15', revenue: 441000 },
  { product: 'Samsung S24', revenue: 348000 },
  { product: 'MacBook Air', revenue: 456000 },
  { product: 'iPad Pro', revenue: 227500 },
]

const categoryData = [
  { category: 'Electronics', value: 458000 },
  { category: 'Computers', value: 392000 },
  { category: 'Accessories', value: 186000 },
  { category: 'Mobile', value: 156000 },
]

export default function AnalyticsDevExtremePage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Business Analytics Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Sales</div>
          <div className="text-3xl font-bold">₱404,000</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Purchases</div>
          <div className="text-3xl font-bold">₱238,000</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Profit</div>
          <div className="text-3xl font-bold">₱166,000</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Profit Margin</div>
          <div className="text-3xl font-bold">41%</div>
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
          <Chart dataSource={topProducts} height={350} rotated={true}>
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
          <PieChart dataSource={categoryData} height={350} type="doughnut" palette="Bright" innerRadius={0.6}>
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
