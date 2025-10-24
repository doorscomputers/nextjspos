"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { formatCurrency } from '@/lib/currencyUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PrinterIcon, DocumentArrowDownIcon, ChartBarIcon, CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline'
import Chart, {
  ArgumentAxis,
  ValueAxis,
  Series,
  Legend,
  Tooltip,
  Export,
  Label,
  Title,
} from 'devextreme-react/chart'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import DataGrid, {
  Column,
  Export as DataGridExport,
  FilterRow,
  HeaderFilter,
  Paging,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import 'devextreme/dist/css/dx.light.css'

interface Location {
  id: number
  name: string
}

interface Category {
  id: number
  name: string
}

interface Brand {
  id: number
  name: string
}

interface TrendingProduct {
  productId: number
  productName: string
  variationName: string
  sku: string
  categoryName: string
  brandName: string
  totalQuantity: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  salesCount: number
}

interface Metadata {
  totalProducts: number
  dateRange: { start: string; end: string }
  timePeriod: string
  location: string
  category: string
  brand: string
  topN: number
}

export default function TrendingProductsPage() {
  const { can } = usePermissions()
  const chartRef = useRef<any>(null)
  const gridRef = useRef<any>(null)

  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  // Filters
  const [timePeriod, setTimePeriod] = useState('last_30_days')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null)
  const [topN, setTopN] = useState(10)

  const timePeriodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_90_days', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const topNOptions = [
    { value: 10, label: 'Top 10' },
    { value: 20, label: 'Top 20' },
    { value: 50, label: 'Top 50' },
    { value: 100, label: 'Top 100' },
  ]

  useEffect(() => {
    fetchLocations()
    fetchCategories()
    fetchBrands()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok && data.locations) {
        setLocations(data.locations)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast.error('Failed to load locations')
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (response.ok && data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
    }
  }

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands')
      const data = await response.json()
      if (response.ok && data.brands) {
        setBrands(data.brands)
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
      toast.error('Failed to load brands')
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (timePeriod === 'custom' && startDate && endDate) {
        params.append('startDate', startDate.toISOString().split('T')[0])
        params.append('endDate', endDate.toISOString().split('T')[0])
      } else {
        params.append('timePeriod', timePeriod)
      }

      if (selectedLocationId) params.append('locationId', selectedLocationId.toString())
      if (selectedCategoryId) params.append('categoryId', selectedCategoryId.toString())
      if (selectedBrandId) params.append('brandId', selectedBrandId.toString())
      params.append('topN', topN.toString())

      const response = await fetch(`/api/reports/trending-products?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setTrendingProducts(data.trendingProducts || [])
        setMetadata(data.metadata || null)
        toast.success('Report generated successfully')
      } else {
        toast.error(data.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const customizeTooltip = (arg: any) => {
    return {
      text: `${arg.argumentText}\nUnits Sold: ${arg.valueText}\nRevenue: ${formatCurrency(arg.point.data.totalRevenue)}`,
    }
  }

  const exportChartToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('TRENDING PRODUCTS REPORT', 148, 20, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    if (metadata) {
      doc.text(`Period: ${new Date(metadata.dateRange.start).toLocaleDateString()} - ${new Date(metadata.dateRange.end).toLocaleDateString()}`, 148, 28, { align: 'center' })
      doc.text(`Location: ${metadata.location} | Top ${metadata.topN} Products`, 148, 34, { align: 'center' })
    }

    // Capture chart as image
    const chartInstance = chartRef.current?.instance
    if (chartInstance) {
      chartInstance.exportTo('Trending_Products_Chart', 'PNG')
    }

    // Add table data
    const tableData = trendingProducts.map((product, index) => [
      index + 1,
      product.productName,
      product.variationName,
      product.totalQuantity.toFixed(0),
      formatCurrency(product.totalRevenue),
      formatCurrency(product.totalProfit),
      product.salesCount,
    ])

    doc.autoTable({
      startY: 45,
      head: [['#', 'Product', 'Variation', 'Qty Sold', 'Revenue', 'Profit', 'Sales']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    })

    doc.save(`Trending_Products_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportToExcel = () => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Trending Products')

    // Add header
    worksheet.addRow(['TRENDING PRODUCTS REPORT'])
    if (metadata) {
      worksheet.addRow([`Period: ${new Date(metadata.dateRange.start).toLocaleDateString()} - ${new Date(metadata.dateRange.end).toLocaleDateString()}`])
      worksheet.addRow([`Location: ${metadata.location}`])
      worksheet.addRow([`Top ${metadata.topN} Products`])
    }
    worksheet.addRow([])

    // Add data using DevExtreme exporter
    if (gridRef.current) {
      exportDataGrid({
        component: gridRef.current.instance,
        worksheet,
        topLeftCell: { row: 6, column: 1 },
        autoFilterEnabled: true,
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `Trending_Products_${new Date().toISOString().split('T')[0]}.xlsx`
          )
          toast.success('Excel exported successfully')
        })
      })
    }
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view reports
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Print-Only Header */}
      <div className="hidden print:block print-header p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">TRENDING PRODUCTS REPORT</h1>
          {metadata && (
            <>
              <div className="text-sm">
                Period: {new Date(metadata.dateRange.start).toLocaleDateString()} -{' '}
                {new Date(metadata.dateRange.end).toLocaleDateString()}
              </div>
              <div className="text-sm">Location: {metadata.location}</div>
              <div className="text-sm">Top {metadata.topN} Products</div>
              <div className="mt-2 text-xs text-gray-600">
                Generated: {new Date().toLocaleString()}
              </div>
            </>
          )}
        </div>

        {/* Print Table */}
        {trendingProducts.length > 0 && (
          <table className="w-full border-collapse border border-gray-300 mt-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">#</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Variation</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Qty Sold</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Revenue</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {trendingProducts.map((product, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-4 py-2">{idx + 1}</td>
                  <td className="border border-gray-300 px-4 py-2">{product.productName}</td>
                  <td className="border border-gray-300 px-4 py-2">{product.variationName}</td>
                  <td className="border border-gray-300 px-4 py-2">{product.categoryName}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{product.totalQuantity.toFixed(0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(product.totalRevenue)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(product.totalProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Screen-Only Header */}
      <div className="print:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ChartBarIcon className="w-8 h-8 text-blue-600" />
              Trending Products
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Analyze top-selling products by units sold and revenue
            </p>
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FunnelIcon className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </div>

      <div className="print:hidden p-6">
        {/* Filter Controls */}
        {showFilters && (
          <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Report Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Time Period */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Time Period:
                  </label>
                  <SelectBox
                    items={timePeriodOptions}
                    value={timePeriod}
                    onValueChanged={(e) => setTimePeriod(e.value)}
                    displayExpr="label"
                    valueExpr="value"
                    stylingMode="outlined"
                    width="100%"
                  />
                </div>

                {/* Start Date (Custom) */}
                {timePeriod === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Start Date:
                    </label>
                    <DateBox
                      value={startDate}
                      onValueChanged={(e) => e.value && setStartDate(e.value)}
                      displayFormat="MMMM dd, yyyy"
                      type="date"
                      max={new Date()}
                      stylingMode="outlined"
                      width="100%"
                    />
                  </div>
                )}

                {/* End Date (Custom) */}
                {timePeriod === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      End Date:
                    </label>
                    <DateBox
                      value={endDate}
                      onValueChanged={(e) => e.value && setEndDate(e.value)}
                      displayFormat="MMMM dd, yyyy"
                      type="date"
                      max={new Date()}
                      stylingMode="outlined"
                      width="100%"
                    />
                  </div>
                )}

                {/* Location Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Location:
                  </label>
                  <SelectBox
                    items={locations}
                    value={selectedLocationId}
                    onValueChanged={(e) => setSelectedLocationId(e.value)}
                    displayExpr="name"
                    valueExpr="id"
                    placeholder="All Locations"
                    showClearButton={true}
                    searchEnabled={true}
                    stylingMode="outlined"
                    width="100%"
                  />
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Category:
                  </label>
                  <SelectBox
                    items={categories}
                    value={selectedCategoryId}
                    onValueChanged={(e) => setSelectedCategoryId(e.value)}
                    displayExpr="name"
                    valueExpr="id"
                    placeholder="All Categories"
                    showClearButton={true}
                    searchEnabled={true}
                    stylingMode="outlined"
                    width="100%"
                  />
                </div>

                {/* Brand Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Brand:
                  </label>
                  <SelectBox
                    items={brands}
                    value={selectedBrandId}
                    onValueChanged={(e) => setSelectedBrandId(e.value)}
                    displayExpr="name"
                    valueExpr="id"
                    placeholder="All Brands"
                    showClearButton={true}
                    searchEnabled={true}
                    stylingMode="outlined"
                    width="100%"
                  />
                </div>

                {/* Top N Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Show:
                  </label>
                  <SelectBox
                    items={topNOptions}
                    value={topN}
                    onValueChanged={(e) => setTopN(e.value)}
                    displayExpr="label"
                    valueExpr="value"
                    stylingMode="outlined"
                    width="100%"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={fetchReport}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  {loading ? 'Generating Report...' : 'Generate Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {metadata && trendingProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Products</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metadata.totalProducts}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Units Sold</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trendingProducts.reduce((sum, p) => sum + p.totalQuantity, 0).toFixed(0)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(trendingProducts.reduce((sum, p) => sum + p.totalRevenue, 0))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Profit</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(trendingProducts.reduce((sum, p) => sum + p.totalProfit, 0))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Generating report...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart and Table View */}
        {!loading && trendingProducts.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">Top Trending Products</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
                  variant="outline"
                  size="sm"
                >
                  {viewMode === 'chart' ? 'Show Table' : 'Show Chart'}
                </Button>
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Export Excel
                </Button>
                <Button
                  onClick={exportChartToPDF}
                  variant="outline"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Export PDF
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <PrinterIcon className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'chart' ? (
                <div className="w-full">
                  <Chart
                    ref={chartRef}
                    dataSource={trendingProducts}
                    rotated={false}
                    className="dx-card"
                  >
                    <Title text="Total Units Sold by Product" />
                    <ArgumentAxis>
                      <Label
                        overlappingBehavior="rotate"
                        rotationAngle={-45}
                        wordWrap="none"
                      />
                    </ArgumentAxis>
                    <ValueAxis>
                      <Label format="fixedPoint" />
                    </ValueAxis>
                    <Series
                      valueField="totalQuantity"
                      argumentField="productName"
                      name="Total unit sold"
                      type="bar"
                      color="#2563eb"
                    />
                    <Legend visible={true} verticalAlignment="bottom" horizontalAlignment="center" />
                    <Tooltip enabled={true} customizeTooltip={customizeTooltip} />
                    <Export enabled={true} fileName="Trending_Products_Chart" />
                  </Chart>
                </div>
              ) : (
                <div className="w-full">
                  <DataGrid
                    ref={gridRef}
                    dataSource={trendingProducts}
                    showBorders={true}
                    showRowLines={true}
                    showColumnLines={true}
                    rowAlternationEnabled={true}
                    allowColumnReordering={true}
                    allowColumnResizing={true}
                    columnAutoWidth={true}
                    wordWrapEnabled={true}
                  >
                    <FilterRow visible={true} />
                    <HeaderFilter visible={true} />
                    <Paging defaultPageSize={20} />
                    <DataGridExport enabled={true} allowExportSelectedData={false} />

                    <Column dataField="productName" caption="Product Name" minWidth={200} />
                    <Column dataField="variationName" caption="Variation" width={150} />
                    <Column dataField="categoryName" caption="Category" width={120} />
                    <Column dataField="brandName" caption="Brand" width={120} />
                    <Column
                      dataField="totalQuantity"
                      caption="Qty Sold"
                      width={100}
                      alignment="right"
                      format="fixedPoint"
                      dataType="number"
                    />
                    <Column
                      dataField="totalRevenue"
                      caption="Revenue"
                      width={120}
                      alignment="right"
                      format="currency"
                      dataType="number"
                    />
                    <Column
                      dataField="totalProfit"
                      caption="Profit"
                      width={120}
                      alignment="right"
                      format="currency"
                      dataType="number"
                    />
                    <Column
                      dataField="salesCount"
                      caption="# Sales"
                      width={80}
                      alignment="right"
                      dataType="number"
                    />

                    <Summary>
                      <TotalItem column="totalQuantity" summaryType="sum" valueFormat="fixedPoint" />
                      <TotalItem column="totalRevenue" summaryType="sum" valueFormat="currency" />
                      <TotalItem column="totalProfit" summaryType="sum" valueFormat="currency" />
                      <TotalItem column="salesCount" summaryType="sum" />
                    </Summary>
                  </DataGrid>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No Data State */}
        {!loading && trendingProducts.length === 0 && metadata && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12">
              <div className="text-center">
                <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">
                  No trending products found for the selected filters
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Initial State */}
        {!loading && !metadata && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12">
              <div className="text-center">
                <DocumentArrowDownIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">
                  Select filters and click "Generate Report" to view trending products
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
            size: landscape;
          }
        }
      `}</style>
    </div>
  )
}
