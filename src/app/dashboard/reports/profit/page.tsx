"use client"

import { useState, useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'

interface ProfitReportData {
  summary: {
    startDate: string
    endDate: string
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    grossProfitMargin: number
    totalExpenses: number
    netProfit: number
    netProfitMargin: number
    totalSales: number
    totalExpenseRecords: number
  }
  byLocation?: Array<{
    locationId: number
    locationName: string
    revenue: number
    cogs: number
    expenses: number
    grossProfit: number
    netProfit: number
    grossProfitMargin: number
    netProfitMargin: number
    salesCount: number
  }>
  byDate?: Array<{
    date: string
    revenue: number
    cogs: number
    expenses: number
    grossProfit: number
    netProfit: number
    grossProfitMargin: number
    netProfitMargin: number
    salesCount: number
  }>
  byExpenseCategory?: Array<{
    categoryId: number
    categoryName: string
    totalExpenses: number
    expenseCount: number
  }>
}

export default function ProfitReportPage() {
  const { can, user } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ProfitReportData | null>(null)

  // Filters
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }, [])
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [locationId, setLocationId] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<string>('none')
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [showFilters, setShowFilters] = useState(true)

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const locData = Array.isArray(data?.locations)
            ? data.locations
            : Array.isArray(data)
            ? data
            : []
          setLocations(locData)
        } else {
          setLocations([])
        }
      } catch (error) {
        console.error('Error fetching locations:', error)
        setLocations([])
      }
    }
    fetchLocations()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      if (locationId !== 'all') {
        params.append('locationId', locationId)
      }

      if (groupBy !== 'none') {
        params.append('groupBy', groupBy)
      }

      const res = await fetch(`/api/reports/profit?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        console.error('Net Profit API error:', error)
        throw new Error(error.error || error.details || 'Failed to fetch report')
      }

      const reportData = await res.json()
      setData(reportData)
    } catch (error: any) {
      console.error('Error fetching profit report:', error)
      toast.error(error.message || 'Failed to load profit report')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchReport()
  }, [])

  const handleResetFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLocationId('all')
    setGroupBy('none')
    setTimeout(() => {
      fetchReport()
    }, 0)
  }

  const activeFilterCount = useMemo(() => {
    return [
      startDate !== defaultStartDate || endDate !== defaultEndDate,
      locationId !== 'all',
      groupBy !== 'none',
    ].filter(Boolean).length
  }, [startDate, endDate, defaultStartDate, defaultEndDate, locationId, groupBy])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Net Profit Report</h1>
        <p className="text-gray-600 mt-1">
          Complete profit analysis including revenue, COGS, and operating expenses
        </p>
      </div>

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleResetFilters}
        clearLabel="Reset Filters"
        description="Pick a reporting window, focus on a location, and choose how to group profit analytics."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="startDate" className="mb-2 block">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate" className="mb-2 block">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="location" className="mb-2 block">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="groupBy" className="mb-2 block">Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger id="groupBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="expense_category">Expense Category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={fetchReport}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
        </div>
      </ReportFilterPanel>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
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

            {/* Total COGS */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost of Goods Sold</CardTitle>
                <ChartBarIcon className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalCOGS)}</div>
                <p className="text-xs text-gray-500 mt-1">Direct product costs</p>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Operating Expenses</CardTitle>
                <BanknotesIcon className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalExpenses)}</div>
                <p className="text-xs text-gray-500 mt-1">{data.summary.totalExpenseRecords} expense records</p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <ReceiptPercentIcon className={`h-4 w-4 ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.summary.netProfit)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatPercent(data.summary.netProfitMargin)} margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Profit Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Profit Breakdown</CardTitle>
              <CardDescription>
                From {formatDate(data.summary.startDate)} to {formatDate(data.summary.endDate)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Revenue</span>
                  <span className="text-green-600 font-bold">{formatCurrency(data.summary.totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pl-4 text-sm">
                  <span className="text-gray-600">- Cost of Goods Sold</span>
                  <span className="text-orange-600">({formatCurrency(data.summary.totalCOGS)})</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="font-medium">= Gross Profit</span>
                  <span className="font-bold">{formatCurrency(data.summary.grossProfit)}</span>
                </div>
                <div className="flex justify-between items-center pl-4 text-sm">
                  <span className="text-gray-600">Gross Profit Margin</span>
                  <span className="text-blue-600">{formatPercent(data.summary.grossProfitMargin)}</span>
                </div>
                <div className="flex justify-between items-center pl-4 text-sm mt-4">
                  <span className="text-gray-600">- Operating Expenses</span>
                  <span className="text-red-600">({formatCurrency(data.summary.totalExpenses)})</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="font-medium text-lg">= Net Profit</span>
                  <span className={`font-bold text-lg ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.summary.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-4 text-sm">
                  <span className="text-gray-600">Net Profit Margin</span>
                  <span className={data.summary.netProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatPercent(data.summary.netProfitMargin)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grouped Data Tables */}
          {data.byLocation && (
            <Card>
              <CardHeader>
                <CardTitle>Profit by Location</CardTitle>
                <CardDescription>Compare performance across business locations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Location</th>
                        <th className="text-right py-2 px-4">Revenue</th>
                        <th className="text-right py-2 px-4">COGS</th>
                        <th className="text-right py-2 px-4">Expenses</th>
                        <th className="text-right py-2 px-4">Gross Profit</th>
                        <th className="text-right py-2 px-4">Net Profit</th>
                        <th className="text-right py-2 px-4">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byLocation.map((location) => (
                        <tr key={location.locationId} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium">{location.locationName}</td>
                          <td className="text-right py-2 px-4">{formatCurrency(location.revenue)}</td>
                          <td className="text-right py-2 px-4 text-orange-600">
                            {formatCurrency(location.cogs)}
                          </td>
                          <td className="text-right py-2 px-4 text-red-600">
                            {formatCurrency(location.expenses)}
                          </td>
                          <td className="text-right py-2 px-4">
                            {formatCurrency(location.grossProfit)}
                          </td>
                          <td className={`text-right py-2 px-4 font-medium ${
                            location.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(location.netProfit)}
                          </td>
                          <td className="text-right py-2 px-4">
                            <span className={`inline-flex items-center gap-1 ${
                              location.netProfitMargin >= 20 ? 'text-green-600' :
                              location.netProfitMargin >= 10 ? 'text-blue-600' :
                              location.netProfitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {location.netProfitMargin >= 20 ? (
                                <ArrowTrendingUpIcon className="w-4 h-4" />
                              ) : location.netProfitMargin < 0 ? (
                                <ArrowTrendingDownIcon className="w-4 h-4" />
                              ) : null}
                              {formatPercent(location.netProfitMargin)}
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

          {data.byDate && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Profit Trend</CardTitle>
                <CardDescription>Track profit performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Date</th>
                        <th className="text-right py-2 px-4">Revenue</th>
                        <th className="text-right py-2 px-4">COGS</th>
                        <th className="text-right py-2 px-4">Expenses</th>
                        <th className="text-right py-2 px-4">Net Profit</th>
                        <th className="text-right py-2 px-4">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byDate.map((day) => (
                        <tr key={day.date} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium">{formatDate(day.date)}</td>
                          <td className="text-right py-2 px-4">{formatCurrency(day.revenue)}</td>
                          <td className="text-right py-2 px-4 text-orange-600">
                            {formatCurrency(day.cogs)}
                          </td>
                          <td className="text-right py-2 px-4 text-red-600">
                            {formatCurrency(day.expenses)}
                          </td>
                          <td className={`text-right py-2 px-4 font-medium ${
                            day.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(day.netProfit)}
                          </td>
                          <td className="text-right py-2 px-4">
                            {formatPercent(day.netProfitMargin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {data.byExpenseCategory && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Operating expense breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Category</th>
                        <th className="text-right py-2 px-4">Total Expenses</th>
                        <th className="text-right py-2 px-4">Record Count</th>
                        <th className="text-right py-2 px-4">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byExpenseCategory.map((category) => {
                        const percentOfTotal = data.summary.totalExpenses > 0
                          ? (category.totalExpenses / data.summary.totalExpenses) * 100
                          : 0
                        return (
                          <tr key={category.categoryId} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4 font-medium">{category.categoryName}</td>
                            <td className="text-right py-2 px-4 text-red-600">
                              {formatCurrency(category.totalExpenses)}
                            </td>
                            <td className="text-right py-2 px-4 text-gray-600">
                              {category.expenseCount}
                            </td>
                            <td className="text-right py-2 px-4">
                              {formatPercent(percentOfTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
