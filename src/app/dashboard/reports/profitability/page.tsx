"use client"

import { useState, useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'

interface Location {
  id: number
  name: string
}

interface ProfitabilityData {
  summary: {
    startDate: string
    endDate: string
    totalRevenue: number
    totalCOGS: number
    totalGrossProfit: number
    grossProfitMargin: number
    totalSales: number
    totalItemsSold: number
  }
  byProduct?: Array<{
    productId: number
    productName: string
    variationName: string
    revenue: number
    cogs: number
    grossProfit: number
    grossProfitMargin: number
    quantitySold: number
  }>
  byLocation?: Array<{
    locationId: number
    locationName: string
    revenue: number
    cogs: number
    grossProfit: number
    grossProfitMargin: number
    salesCount: number
    averageSaleValue: number
  }>
  byCategory?: Array<{
    categoryId: number
    categoryName: string
    revenue: number
    cogs: number
    grossProfit: number
    grossProfitMargin: number
    quantitySold: number
  }>
  byDate?: Array<{
    date: string
    revenue: number
    cogs: number
    grossProfit: number
    grossProfitMargin: number
    salesCount: number
  }>
}

export default function ProfitabilityReportPage() {
  const { can } = usePermissions()
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const defaultStartDate = useMemo(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return date.toISOString().split('T')[0]
  }, [])
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [locationId, setLocationId] = useState('all')
  const [groupBy, setGroupBy] = useState('product')
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    fetchLocations()
    fetchReport()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const resData = await response.json()
      if (response.ok) {
        const locData = Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData?.locations)
          ? resData.locations
          : Array.isArray(resData)
          ? resData
          : []

        // Filter out Main Warehouse (non-selling location) and only show active locations
        const activeLocations = locData.filter((location: Location) =>
          location.name && !location.name.toLowerCase().includes('main warehouse')
        )

        setLocations(activeLocations)
      } else {
        setLocations([])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      setLocations([])
    }
  }

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy,
      })

      if (locationId && locationId !== 'all') {
        params.append('locationId', locationId)
      }

      const response = await fetch(`/api/reports/profitability?${params}`)
      const resData = await response.json()

      if (response.ok) {
        setData(resData)
      } else {
        console.error('Profitability API error:', resData)
        toast.error(resData.error || resData.details || 'Failed to fetch profitability report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to fetch profitability report')
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLocationId('all')
    setGroupBy('product')
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (startDate !== defaultStartDate || endDate !== defaultEndDate) count += 1
    if (locationId !== 'all') count += 1
    if (groupBy !== 'product') count += 1
    return count
  }, [startDate, endDate, defaultStartDate, defaultEndDate, locationId, groupBy])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(2)}%`
  }

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view reports.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profitability & COGS Report</h1>
        <p className="text-gray-500 mt-1">Cost of Goods Sold, Revenue, and Gross Profit Analysis</p>
      </div>

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleResetFilters}
        clearLabel="Reset Filters"
        description="Choose a date window, focus a specific location, and adjust how results are grouped."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
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

            <div className="space-y-2">
              <Label htmlFor="groupBy">Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger id="groupBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
        </div>

        <div className="mt-4">
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Report'}
          </Button>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">{data.summary.totalSales} sales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total COGS</CardTitle>
                <ShoppingCartIcon className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalCOGS)}</div>
                <p className="text-xs text-gray-500 mt-1">{data.summary.totalItemsSold} items sold</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <ArrowTrendingUpIcon className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalGrossProfit)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {data.summary.totalRevenue > 0
                    ? `${formatPercent((data.summary.totalGrossProfit / data.summary.totalRevenue) * 100)} margin`
                    : 'N/A'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <ChartBarIcon className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(data.summary.grossProfitMargin)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {data.summary.grossProfitMargin >= 30 ? 'Excellent' :
                   data.summary.grossProfitMargin >= 20 ? 'Good' :
                   data.summary.grossProfitMargin >= 10 ? 'Fair' : 'Low'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          {groupBy === 'product' && data.byProduct && (
            <Card>
              <CardHeader>
                <CardTitle>Profitability by Product</CardTitle>
                <CardDescription>Top performing products by gross profit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Product</th>
                        <th className="text-right py-3 px-4">Qty Sold</th>
                        <th className="text-right py-3 px-4">Revenue</th>
                        <th className="text-right py-3 px-4">COGS</th>
                        <th className="text-right py-3 px-4">Gross Profit</th>
                        <th className="text-right py-3 px-4">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byProduct.map((product, index) => (
                        <tr key={product.productId} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium">{product.productName}</div>
                              <div className="text-sm text-gray-500">{product.variationName}</div>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">{product.quantitySold}</td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(product.revenue)}</td>
                          <td className="text-right py-3 px-4 text-red-600">{formatCurrency(product.cogs)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">
                            {formatCurrency(product.grossProfit)}
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className={`inline-flex items-center gap-1 ${
                              product.grossProfitMargin >= 30 ? 'text-green-600' :
                              product.grossProfitMargin >= 20 ? 'text-blue-600' :
                              product.grossProfitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {product.grossProfitMargin >= 20 ? (
                                <ArrowTrendingUpIcon className="w-4 h-4" />
                              ) : product.grossProfitMargin < 10 ? (
                                <ArrowTrendingDownIcon className="w-4 h-4" />
                              ) : null}
                              {formatPercent(product.grossProfitMargin)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {groupBy === 'location' && data.byLocation && (
            <Card>
              <CardHeader>
                <CardTitle>Profitability by Location</CardTitle>
                <CardDescription>Performance comparison across locations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Location</th>
                        <th className="text-right py-3 px-4">Sales</th>
                        <th className="text-right py-3 px-4">Avg Sale</th>
                        <th className="text-right py-3 px-4">Revenue</th>
                        <th className="text-right py-3 px-4">COGS</th>
                        <th className="text-right py-3 px-4">Gross Profit</th>
                        <th className="text-right py-3 px-4">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byLocation.map((location) => (
                        <tr key={location.locationId} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{location.locationName}</td>
                          <td className="text-right py-3 px-4">{location.salesCount}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(location.averageSaleValue)}</td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(location.revenue)}</td>
                          <td className="text-right py-3 px-4 text-red-600">{formatCurrency(location.cogs)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">
                            {formatCurrency(location.grossProfit)}
                          </td>
                          <td className="text-right py-3 px-4">{formatPercent(location.grossProfitMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {groupBy === 'category' && data.byCategory && (
            <Card>
              <CardHeader>
                <CardTitle>Profitability by Category</CardTitle>
                <CardDescription>Category performance analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Category</th>
                        <th className="text-right py-3 px-4">Qty Sold</th>
                        <th className="text-right py-3 px-4">Revenue</th>
                        <th className="text-right py-3 px-4">COGS</th>
                        <th className="text-right py-3 px-4">Gross Profit</th>
                        <th className="text-right py-3 px-4">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCategory.map((category) => (
                        <tr key={category.categoryId} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{category.categoryName}</td>
                          <td className="text-right py-3 px-4">{category.quantitySold}</td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(category.revenue)}</td>
                          <td className="text-right py-3 px-4 text-red-600">{formatCurrency(category.cogs)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">
                            {formatCurrency(category.grossProfit)}
                          </td>
                          <td className="text-right py-3 px-4">{formatPercent(category.grossProfitMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {groupBy === 'date' && data.byDate && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Profitability Trend</CardTitle>
                <CardDescription>Day-by-day performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-right py-3 px-4">Sales</th>
                        <th className="text-right py-3 px-4">Revenue</th>
                        <th className="text-right py-3 px-4">COGS</th>
                        <th className="text-right py-3 px-4">Gross Profit</th>
                        <th className="text-right py-3 px-4">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byDate.map((day) => (
                        <tr key={day.date} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{new Date(day.date).toLocaleDateString()}</td>
                          <td className="text-right py-3 px-4">{day.salesCount}</td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(day.revenue)}</td>
                          <td className="text-right py-3 px-4 text-red-600">{formatCurrency(day.cogs)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">
                            {formatCurrency(day.grossProfit)}
                          </td>
                          <td className="text-right py-3 px-4">{formatPercent(day.grossProfitMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Click "Generate Report" to view profitability analysis</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
