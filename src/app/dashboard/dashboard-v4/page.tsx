'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PieChart, {
  Series as PieSeries,
  Label,
  Connector,
  Legend as PieLegend,
  Tooltip as PieTooltip,
  Export as PieExport
} from 'devextreme-react/pie-chart'
import Chart, {
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Title,
  Tooltip,
  Export,
  Grid
} from 'devextreme-react/chart'
import DataGrid, {
  Column,
  Export as GridExport,
  Paging,
  Pager
} from 'devextreme-react/data-grid'
import { DateBox, SelectBox, Button } from 'devextreme-react'
import { formatCurrency } from '@/lib/utils'
import type {
  DashboardV4Data,
  PieChartDataPoint,
  BarChartDataPoint
} from '@/types/dashboard-v4'

export default function DashboardV4Page() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardV4Data | null>(null)

  // Filters
  const currentYear = new Date().getFullYear()
  const [startDate, setStartDate] = useState<Date>(new Date(currentYear, 0, 1))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [selectedLocation, setSelectedLocation] = useState<number | 'all'>('all')
  const [locations, setLocations] = useState<any[]>([])

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations')
        if (response.ok) {
          const data = await response.json()
          setLocations([{ id: 'all', name: 'All Locations' }, ...data])
        }
      } catch (error) {
        console.error('Failed to fetch locations:', error)
      }
    }
    fetchLocations()
  }, [])

  // Fetch dashboard data
  useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          locationId: selectedLocation.toString()
        })

        const response = await fetch(`/api/dashboard/financial-v4?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const data = await response.json()
        setDashboardData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, startDate, endDate, selectedLocation])

  // Prepare chart data
  const receivablesChartData: PieChartDataPoint[] = dashboardData
    ? [
        { name: 'Paid', value: dashboardData.receivables.paid },
        { name: 'Unpaid', value: dashboardData.receivables.unpaid }
      ]
    : []

  const payablesChartData: PieChartDataPoint[] = dashboardData
    ? [
        { name: 'Paid', value: dashboardData.payables.paid },
        { name: 'Unpaid', value: dashboardData.payables.unpaid }
      ]
    : []

  const inventoryChartData: PieChartDataPoint[] = dashboardData
    ? [
        { name: 'Sold', value: dashboardData.inventory.sold },
        { name: 'Available', value: dashboardData.inventory.available }
      ]
    : []

  const receivablesAgingData = dashboardData
    ? [
        { period: '0-30 Days', amount: dashboardData.receivables.aging['0-30'] },
        { period: '31-60 Days', amount: dashboardData.receivables.aging['31-60'] },
        { period: '61-90 Days', amount: dashboardData.receivables.aging['61-90'] },
        { period: 'Over 90 Days', amount: dashboardData.receivables.aging['90+'] }
      ]
    : []

  const payablesAgingData = dashboardData
    ? [
        { period: '0-30 Days', amount: dashboardData.payables.aging['0-30'] },
        { period: '31-60 Days', amount: dashboardData.payables.aging['31-60'] },
        { period: '61-90 Days', amount: dashboardData.payables.aging['61-90'] },
        { period: 'Over 90 Days', amount: dashboardData.payables.aging['90+'] }
      ]
    : []

  const inventoryAgingData = dashboardData
    ? [
        { period: '0-3 Months', amount: dashboardData.inventory.aging['0-3'] },
        { period: '4-5 Months', amount: dashboardData.inventory.aging['4-5'] },
        { period: '7-9 Months', amount: dashboardData.inventory.aging['7-9'] },
        { period: 'Over 9 Months', amount: dashboardData.inventory.aging['9+'] }
      ]
    : []

  const salesByLocationChartData: BarChartDataPoint[] = dashboardData
    ? dashboardData.salesByLocation.map((item) => ({
        argument: item.month,
        ...item
      }))
    : []

  const locationNames = dashboardData?.locationNames || []

  const incomeExpensesChartData: BarChartDataPoint[] = dashboardData
    ? dashboardData.incomeExpenses.map((item) => ({
        argument: item.month,
        grossIncome: item.grossIncome,
        expenses: item.expenses,
        netIncome: item.netIncome
      }))
    : []

  const handlePrint = () => {
    window.print()
  }

  const handleExport = () => {
    // This will be handled by DevExtreme export functionality
    alert('Use the export buttons on individual charts and tables')
  }

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="text-xl font-semibold">Error</p>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Financial Dashboard V4
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive financial analytics and reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            text="Print"
            icon="print"
            onClick={handlePrint}
            type="normal"
            stylingMode="outlined"
          />
          <Button
            text="Export All"
            icon="export"
            onClick={handleExport}
            type="default"
            stylingMode="contained"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <DateBox
              value={startDate}
              onValueChanged={(e) => e.value && setStartDate(e.value)}
              type="date"
              displayFormat="MMM dd, yyyy"
              width="100%"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <DateBox
              value={endDate}
              onValueChanged={(e) => e.value && setEndDate(e.value)}
              type="date"
              displayFormat="MMM dd, yyyy"
              width="100%"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <SelectBox
              items={locations}
              value={selectedLocation}
              onValueChanged={(e) => setSelectedLocation(e.value)}
              displayExpr="name"
              valueExpr="id"
              width="100%"
            />
          </div>
        </div>
      </div>

      {/* Row 1: Receivables, Payables, Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receivables */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Receivables
            </h2>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatCurrency(dashboardData?.receivables.total || 0)}
            </p>
          </div>
          <PieChart
            id="receivables-chart"
            dataSource={receivablesChartData}
            palette="Soft Pastel"
            height={250}
          >
            <PieSeries argumentField="name" valueField="value">
              <Label visible={true} format="currency" customizeText={(e: any) => formatCurrency(e.value)} />
              <Connector visible={true} width={1} />
            </PieSeries>
            <PieLegend visible={true} horizontalAlignment="center" verticalAlignment="bottom" />
            <PieTooltip enabled={true} format="currency" customizeTooltip={(e: any) => ({
              text: `${e.argumentText}: ${formatCurrency(e.value)}`
            })} />
            <PieExport enabled={true} />
          </PieChart>
          {/* Aging Breakdown */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Aging Breakdown
            </h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {receivablesAgingData.map((item) => (
                <div key={item.period} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.period}</div>
                  <div className="text-blue-600 dark:text-blue-400 font-semibold">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payables */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Payables</h2>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {formatCurrency(dashboardData?.payables.total || 0)}
            </p>
          </div>
          <PieChart
            id="payables-chart"
            dataSource={payablesChartData}
            palette="Soft"
            height={250}
          >
            <PieSeries argumentField="name" valueField="value">
              <Label visible={true} format="currency" customizeText={(e: any) => formatCurrency(e.value)} />
              <Connector visible={true} width={1} />
            </PieSeries>
            <PieLegend visible={true} horizontalAlignment="center" verticalAlignment="bottom" />
            <PieTooltip enabled={true} format="currency" customizeTooltip={(e: any) => ({
              text: `${e.argumentText}: ${formatCurrency(e.value)}`
            })} />
            <PieExport enabled={true} />
          </PieChart>
          {/* Aging Breakdown */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Aging Breakdown
            </h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {payablesAgingData.map((item) => (
                <div key={item.period} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.period}</div>
                  <div className="text-orange-600 dark:text-orange-400 font-semibold">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Inventory
            </h2>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {formatCurrency(dashboardData?.inventory.total || 0)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {dashboardData?.inventory.sold ? `Sold: ${formatCurrency(dashboardData.inventory.sold)}` : ''}
            </p>
          </div>
          <PieChart
            id="inventory-chart"
            dataSource={inventoryChartData}
            palette="Bright"
            height={250}
          >
            <PieSeries argumentField="name" valueField="value">
              <Label visible={true} format="currency" customizeText={(e: any) => formatCurrency(e.value)} />
              <Connector visible={true} width={1} />
            </PieSeries>
            <PieLegend visible={true} horizontalAlignment="center" verticalAlignment="bottom" />
            <PieTooltip enabled={true} format="currency" customizeTooltip={(e: any) => ({
              text: `${e.argumentText}: ${formatCurrency(e.value)}`
            })} />
            <PieExport enabled={true} />
          </PieChart>
          {/* Aging Breakdown */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Aging Breakdown
            </h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {inventoryAgingData.map((item) => (
                <div key={item.period} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.period}</div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Sales by Location */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sales Per Location (Branch/Store)
        </h2>
        <Chart
          id="sales-by-location-chart"
          dataSource={salesByLocationChartData}
          height={350}
        >
          <CommonSeriesSettings argumentField="argument" type="bar" />
          {locationNames.map((locationName, index) => {
            // Generate distinct colors for each location
            const colors = ['#FFB84D', '#FFA366', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#00BCD4', '#FFEB3B']
            const color = colors[index % colors.length]
            return (
              <Series
                key={locationName}
                valueField={locationName}
                name={locationName}
                color={color}
              />
            )
          })}
          <ArgumentAxis>
            <Grid visible={true} />
          </ArgumentAxis>
          <ValueAxis>
            <Grid visible={true} />
          </ValueAxis>
          <Legend visible={true} verticalAlignment="bottom" horizontalAlignment="center" />
          <Title text="Monthly Sales by Location" />
          <Tooltip enabled={true} customizeTooltip={(e: any) => ({
            text: `${e.seriesName}: ${formatCurrency(e.value)}`
          })} />
          <Export enabled={true} />
        </Chart>
      </div>

      {/* Row 3: Income and Expenses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Income and Expenses (Net)
        </h2>
        <Chart
          id="income-expenses-chart"
          dataSource={incomeExpensesChartData}
          height={350}
        >
          <CommonSeriesSettings argumentField="argument" type="bar" />
          <Series valueField="grossIncome" name="Gross Income" color="#FF9966" />
          <Series valueField="expenses" name="Expenses" color="#FFB84D" />
          <Series valueField="netIncome" name="Net Income" color="#90EE90" />
          <ArgumentAxis>
            <Grid visible={true} />
          </ArgumentAxis>
          <ValueAxis>
            <Grid visible={true} />
          </ValueAxis>
          <Legend visible={true} verticalAlignment="bottom" horizontalAlignment="center" />
          <Title text="Monthly Income & Expenses" />
          <Tooltip enabled={true} customizeTooltip={(e: any) => ({
            text: `${e.seriesName}: ${formatCurrency(e.value)}`
          })} />
          <Export enabled={true} />
        </Chart>
      </div>

      {/* Row 4: Top Selling Products */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Top Selling Products (Store) in Qty
        </h2>
        <DataGrid
          dataSource={dashboardData?.topProducts.byQuantity || []}
          showBorders={true}
          columnAutoWidth={true}
          wordWrapEnabled={true}
        >
          <Column dataField="rank" caption="RANK" width={80} />
          <Column dataField="productName" caption="Products" />
          <Column dataField="sku" caption="SKU" width={120} />
          <Column
            dataField="quantity"
            caption="Qty."
            format={{ type: 'fixedPoint', precision: 2 }}
            alignment="right"
          />
          <Column
            dataField="avgPrice"
            caption="Ave. SP"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <Column
            dataField="totalSales"
            caption="Total Sales"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <GridExport enabled={true} allowExportSelectedData={false} />
          <Paging enabled={false} />
        </DataGrid>
      </div>

      {/* Row 5: Top Grossing Products */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Top Grossing Products (Store) in Profit
        </h2>
        <DataGrid
          dataSource={dashboardData?.topProducts.byProfit || []}
          showBorders={true}
          columnAutoWidth={true}
          wordWrapEnabled={true}
        >
          <Column dataField="rank" caption="RANK" width={80} />
          <Column dataField="productName" caption="Products" />
          <Column dataField="sku" caption="SKU" width={120} />
          <Column
            dataField="quantity"
            caption="Qty."
            format={{ type: 'fixedPoint', precision: 2 }}
            alignment="right"
          />
          <Column
            dataField="margin"
            caption="Margin"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <Column
            dataField="profit"
            caption="Profit"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <GridExport enabled={true} allowExportSelectedData={false} />
          <Paging enabled={false} />
        </DataGrid>
      </div>

      {/* Row 6: Lowest Grossing Products */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
          Lowest Grossing Products (Store) in Profit
        </h2>
        <DataGrid
          dataSource={dashboardData?.topProducts.lowestProfit || []}
          showBorders={true}
          columnAutoWidth={true}
          wordWrapEnabled={true}
        >
          <Column dataField="rank" caption="RANK" width={80} />
          <Column dataField="productName" caption="Products" />
          <Column dataField="sku" caption="SKU" width={120} />
          <Column
            dataField="quantity"
            caption="Qty."
            format={{ type: 'fixedPoint', precision: 2 }}
            alignment="right"
          />
          <Column
            dataField="margin"
            caption="Margin"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <Column
            dataField="profit"
            caption="Profit"
            format="currency"
            customizeText={(e: any) => formatCurrency(e.value)}
            alignment="right"
          />
          <GridExport enabled={true} allowExportSelectedData={false} />
          <Paging enabled={false} />
        </DataGrid>
      </div>
    </div>
  )
}
