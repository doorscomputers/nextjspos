"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { DocumentTextIcon, TableCellsIcon, DocumentChartBarIcon, PrinterIcon } from "@heroicons/react/24/outline"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

interface TrendData {
  summary: {
    year: number
    groupBy: string
    totalProducts: number
    totalQuantityPurchased: number
    totalCostPurchased: number
    totalPurchases: number
    avgCostPerPurchase: string
    avgQuantityPerPurchase: string
  }
  products: any[]
  top10Products: any[]
  chartData: {
    labels: string[]
    datasets: any[]
  }
  periodComparison: Array<{
    period: string
    totalQuantity: number
    totalCost: number
    productCount: number
  }>
  allPeriods: string[]
}

export default function PurchaseTrendsPage() {
  const currentYear = new Date().getFullYear()
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(currentYear.toString())
  const [groupBy, setGroupBy] = useState('month')
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line')

  // New filters
  const [productId, setProductId] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [locationId, setLocationId] = useState('all')

  // Dropdown data
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchTrends()
  }, [year, groupBy, productId, supplierId, locationId])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      setProducts(data.products || data)
    } catch (error) {
      console.error('Failed to fetch products:', error)
      setProducts([])
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      setSuppliers(data.suppliers || data)
    } catch (error) {
      console.error('Failed to fetch suppliers:', error)
      setSuppliers([])
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      setLocations(data.locations || data)
    } catch (error) {
      console.error('Failed to fetch locations:', error)
      setLocations([])
    }
  }

  const fetchTrends = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('year', year)
      params.append('groupBy', groupBy)

      if (productId !== 'all') params.append('productId', productId)
      if (supplierId !== 'all') params.append('supplierId', supplierId)
      if (locationId !== 'all') params.append('locationId', locationId)

      const response = await fetch(`/api/reports/purchases/trends?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('API Error:', response.status, errorData)

        if (response.status === 401) {
          throw new Error('Authentication failed. Please refresh the page and try again.')
        }

        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Verify data structure before setting
      if (!data.summary || !data.products) {
        console.error('Invalid data structure received:', data)
        throw new Error('Invalid data structure from API')
      }

      setTrendData(data)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch purchase trends:', error)
      setError(error instanceof Error ? error.message : 'Failed to load purchase trends')
      setTrendData(null)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!trendData?.products.length) return

    const headers = [
      "Product Name",
      "SKU",
      "Total Quantity Purchased",
      "Total Cost",
      "Number of Purchases",
      "Avg Cost per Unit",
      ...trendData.allPeriods
    ]

    const rows = trendData.products.map((product) => [
      product.productName,
      product.productSku,
      product.totalQuantity,
      product.totalCost.toFixed(2),
      product.purchaseCount,
      product.avgCost.toFixed(2),
      ...trendData.allPeriods.map(period => {
        const periodData = product.byPeriod[period]
        return periodData ? periodData.quantity : 0
      })
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `purchase-trends-${year}-${groupBy}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportToExcel = () => {
    if (!trendData?.products.length) return

    const worksheetData = [
      ["Product Name", "SKU", "Total Quantity", "Total Cost", "Purchases", "Avg Cost/Unit", ...trendData.allPeriods],
      ...trendData.products.map((product) => [
        product.productName,
        product.productSku,
        product.totalQuantity,
        product.totalCost,
        product.purchaseCount,
        product.avgCost,
        ...trendData.allPeriods.map(period => {
          const periodData = product.byPeriod[period]
          return periodData ? periodData.quantity : 0
        })
      ])
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Trends")
    XLSX.writeFile(workbook, `purchase-trends-${year}-${groupBy}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportToPDF = () => {
    if (!trendData?.products.length) return

    const doc = new jsPDF('l', 'mm', 'a4')

    doc.setFontSize(18)
    doc.text(`Purchase Trends Report - ${year}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${groupBy.toUpperCase()} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22)

    // Summary
    doc.setFontSize(11)
    doc.text(`Total Products: ${trendData.summary.totalProducts}`, 14, 30)
    doc.text(`Total Quantity Purchased: ${trendData.summary.totalQuantityPurchased.toLocaleString()}`, 14, 36)
    doc.text(`Total Cost: $${trendData.summary.totalCostPurchased.toLocaleString()}`, 14, 42)

    // Top 20 table
    autoTable(doc, {
      startY: 48,
      head: [['Product', 'SKU', 'Total Qty', 'Total Cost', 'Avg Cost/Unit']],
      body: trendData.top10Products.slice(0, 20).map(p => [
        p.productName,
        p.productSku,
        p.totalQuantity,
        `$${p.totalCost.toFixed(2)}`,
        `$${p.avgCost.toFixed(2)}`
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    })

    doc.save(`purchase-trends-${year}-${groupBy}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const handlePrint = () => {
    window.print()
  }

  // Prepare chart data for Recharts
  const chartDataFormatted = trendData?.periodComparison?.map((period, index) => ({
    period: trendData.chartData?.labels?.[index] || period.period,
    ...(trendData.top10Products || []).reduce((acc, product) => {
      const periodData = product.byPeriod?.[period.period]
      acc[product.productName] = periodData ? periodData.cost : 0
      return acc
    }, {} as Record<string, number>)
  })) || []

  const colors = [
    '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EC4899',
    '#EAB308', '#06B4D4', '#EF4444', '#22C55E', '#A855F7'
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Trends Analysis</h1>
          <p className="text-sm text-gray-600 mt-1">
            Analyze product purchase patterns and costs over time
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} disabled={!trendData} className="bg-green-600 hover:bg-green-700 text-white">
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            CSV
          </Button>
          <Button onClick={exportToExcel} disabled={!trendData} className="bg-blue-600 hover:bg-blue-700 text-white">
            <TableCellsIcon className="w-5 h-5 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} disabled={!trendData} className="bg-red-600 hover:bg-red-700 text-white">
            <DocumentChartBarIcon className="w-5 h-5 mr-2" />
            PDF
          </Button>
          <Button onClick={handlePrint} disabled={!trendData} className="bg-gray-700 hover:bg-gray-800 text-white">
            <PrinterIcon className="w-5 h-5 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-lg">Report Settings & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Report Settings Row */}
          <div>
            <label className="block text-sm font-semibold mb-3 text-gray-800">Report Settings</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Year Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Year</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group By */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Period</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Chart Type</label>
                <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Data Filters Row */}
          <div>
            <label className="block text-sm font-semibold mb-3 text-gray-800">Data Filters</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Product Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Filter by Product</label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Filter by Supplier</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Filter by Location</label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(productId !== 'all' || supplierId !== 'all' || locationId !== 'all') && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Active Filters:</span>
              {productId !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Product: {products.find(p => p.id.toString() === productId)?.name}
                  <button
                    onClick={() => setProductId('all')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {supplierId !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Supplier: {suppliers.find(s => s.id.toString() === supplierId)?.name}
                  <button
                    onClick={() => setSupplierId('all')}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {locationId !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Location: {locations.find(l => l.id.toString() === locationId)?.name}
                  <button
                    onClick={() => setLocationId('all')}
                    className="ml-2 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setProductId('all')
                  setSupplierId('all')
                  setLocationId('all')
                }}
                className="ml-auto text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {trendData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-900">{trendData.summary.totalProducts}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Total Quantity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-900">{trendData.summary.totalQuantityPurchased.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-900">${trendData.summary.totalCostPurchased.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-900">{trendData.summary.totalPurchases}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Report</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                onClick={() => fetchTrends()}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      ) : trendData && chartDataFormatted.length > 0 ? (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Top 10 Products - Purchase Cost Trends ({year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartDataFormatted}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                    <Legend />
                    {trendData.top10Products.map((product, index) => (
                      <Line
                        key={product.productId}
                        type="monotone"
                        dataKey={product.productName}
                        stroke={colors[index]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartDataFormatted}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                    <Legend />
                    {trendData.top10Products.map((product, index) => (
                      <Bar
                        key={product.productId}
                        dataKey={product.productName}
                        fill={colors[index]}
                      />
                    ))}
                  </BarChart>
                ) : (
                  <AreaChart data={chartDataFormatted}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                    <Legend />
                    {trendData.top10Products.map((product, index) => (
                      <Area
                        key={product.productId}
                        type="monotone"
                        dataKey={product.productName}
                        stroke={colors[index]}
                        fill={colors[index]}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Products Table */}
      {trendData && (
        <Card id="print-area">
          <CardHeader>
            <CardTitle>Product Purchase Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Rank</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Product Name</th>
                    <th className="text-left p-3 font-semibold text-gray-700">SKU</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Total Qty</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Total Cost</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Purchases</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Avg Cost/Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.products.map((product, index) => (
                    <tr key={product.productId} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-700">#{index + 1}</td>
                      <td className="p-3 font-medium text-blue-600">{product.productName}</td>
                      <td className="p-3 text-gray-700">{product.productSku}</td>
                      <td className="p-3 text-right font-bold text-gray-900">{product.totalQuantity.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-green-700">${product.totalCost.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-800">{product.purchaseCount}</td>
                      <td className="p-3 text-right text-gray-700">
                        ${product.avgCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
