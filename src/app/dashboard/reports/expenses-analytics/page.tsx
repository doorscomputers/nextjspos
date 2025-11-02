'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import PieChart, {
  Series as PieSeries,
  Label as PieLabel,
  Connector,
  Legend as PieLegend,
  Tooltip as PieTooltip,
  Export as PieExport
} from 'devextreme-react/pie-chart'
import DataGrid, {
  Column,
  Export as GridExport,
  FilterRow,
  Paging,
  Summary,
  TotalItem,
  GroupPanel,
  Grouping
} from 'devextreme-react/data-grid'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Calendar, PieChartIcon, BarChart3 } from 'lucide-react'

interface ExpenseData {
  id: number
  referenceNumber: string
  expenseDate: string
  amount: number
  payeeName: string
  description: string
  status: string
  categoryId: number
  locationId: number
  category: {
    id: number
    name: string
  }
  location: {
    id: number
    name: string
  }
  glAccount: {
    accountCode: string
    accountName: string
  } | null
}

interface CategorySummary {
  category: string
  totalAmount: number
  count: number
  percentage: number
}

interface DateSummary {
  date: string
  totalAmount: number
  count: number
}

interface MonthSummary {
  month: string
  totalAmount: number
  count: number
}

export default function ExpenseAnalyticsPage() {
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<ExpenseData[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Filters
  const currentYear = new Date().getFullYear()
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const [startDate, setStartDate] = useState(`${currentYear}-${currentMonth}-01`)
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('approved')

  // Fetch categories and locations
  useEffect(() => {
    fetchCategories()
    fetchLocations()
  }, [])

  // Fetch expenses when filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchExpenses()
    }
  }, [startDate, endDate, selectedCategory, selectedLocation, selectedStatus])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/expenses/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedCategory !== 'all' && { categoryId: selectedCategory }),
        ...(selectedLocation !== 'all' && { locationId: selectedLocation }),
        ...(selectedStatus !== 'all' && { status: selectedStatus })
      })

      const res = await fetch(`/api/expenses?${params}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data)
      } else {
        toast.error('Failed to fetch expenses')
      }
    } catch (error) {
      toast.error('Error loading expenses')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate summaries
  const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
  const averageExpense = expenses.length > 0 ? totalAmount / expenses.length : 0

  // Category-wise summary
  const categorySummary: CategorySummary[] = Object.values(
    expenses.reduce((acc: Record<string, CategorySummary>, exp) => {
      const categoryName = exp.category.name
      if (!acc[categoryName]) {
        acc[categoryName] = {
          category: categoryName,
          totalAmount: 0,
          count: 0,
          percentage: 0
        }
      }
      acc[categoryName].totalAmount += parseFloat(exp.amount.toString())
      acc[categoryName].count += 1
      return acc
    }, {})
  ).map(item => ({
    ...item,
    percentage: totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0
  })).sort((a, b) => b.totalAmount - a.totalAmount)

  // Date-wise summary (daily)
  const dateSummary: DateSummary[] = Object.values(
    expenses.reduce((acc: Record<string, DateSummary>, exp) => {
      const date = exp.expenseDate
      if (!acc[date]) {
        acc[date] = { date, totalAmount: 0, count: 0 }
      }
      acc[date].totalAmount += parseFloat(exp.amount.toString())
      acc[date].count += 1
      return acc
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))

  // Month-wise summary
  const monthSummary: MonthSummary[] = Object.values(
    expenses.reduce((acc: Record<string, MonthSummary>, exp) => {
      const month = exp.expenseDate.substring(0, 7) // YYYY-MM
      if (!acc[month]) {
        acc[month] = { month, totalAmount: 0, count: 0 }
      }
      acc[month].totalAmount += parseFloat(exp.amount.toString())
      acc[month].count += 1
      return acc
    }, {})
  ).sort((a, b) => a.month.localeCompare(b.month))

  // Pie chart data
  const categoryPieData = categorySummary.map(item => ({
    category: item.category,
    value: item.totalAmount
  }))

  // Bar chart data (monthly trend)
  const monthlyChartData = monthSummary.map(item => ({
    argument: item.month,
    totalAmount: item.totalAmount,
    count: item.count
  }))

  // Daily trend chart
  const dailyChartData = dateSummary.map(item => ({
    argument: item.date,
    amount: item.totalAmount
  }))

  if (!can(PERMISSIONS.EXPENSE_VIEW)) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          You do not have permission to view expenses.
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
            Expense Analytics & Intelligence
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive expense analysis by date, category, and location
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
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
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Average Expense</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {formatCurrency(averageExpense)}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {expenses.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Categories Used</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {categorySummary.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <PieChartIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Expenses by Category</h2>
            <PieChart
              id="category-pie"
              dataSource={categoryPieData}
              height={350}
              palette="Soft Pastel"
            >
              <PieSeries argumentField="category" valueField="value">
                <PieLabel visible={true} customizeText={(e: any) => `${formatCurrency(e.value)}\n(${e.percentText})`} />
                <Connector visible={true} width={1} />
              </PieSeries>
              <PieLegend visible={true} horizontalAlignment="center" verticalAlignment="bottom" />
              <PieTooltip enabled={true} customizeTooltip={(e: any) => ({
                text: `${e.argumentText}: ${formatCurrency(e.value)} (${e.percentText})`
              })} />
              <PieExport enabled={true} />
            </PieChart>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Category Summary Table</h2>
            <DataGrid
              dataSource={categorySummary}
              showBorders={true}
              columnAutoWidth={true}
              height={350}
            >
              <Column dataField="category" caption="Category" />
              <Column
                dataField="totalAmount"
                caption="Total Amount"
                format="currency"
                customizeText={(e: any) => formatCurrency(e.value)}
              />
              <Column dataField="count" caption="Transactions" />
              <Column
                dataField="percentage"
                caption="% of Total"
                customizeText={(e: any) => `${e.value.toFixed(2)}%`}
              />
              <Summary>
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="currency" customizeText={(e: any) => `Total: ${formatCurrency(e.value)}`} />
                <TotalItem column="count" summaryType="sum" />
              </Summary>
            </DataGrid>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Time-based Analysis */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Monthly Expense Trend</h2>
          <Chart
            id="monthly-trend"
            dataSource={monthlyChartData}
            height={350}
          >
            <CommonSeriesSettings argumentField="argument" type="bar" />
            <Series
              valueField="totalAmount"
              name="Total Expenses"
              color="#3b82f6"
              type="bar"
            />
            <ArgumentAxis>
              <Grid visible={true} />
            </ArgumentAxis>
            <ValueAxis>
              <Grid visible={true} />
            </ValueAxis>
            <Legend visible={true} verticalAlignment="bottom" horizontalAlignment="center" />
            <Title text="Monthly Expense Trend" />
            <Tooltip enabled={true} customizeTooltip={(e: any) => ({
              text: `${e.seriesName}: ${formatCurrency(e.value)}`
            })} />
            <Export enabled={true} />
          </Chart>
        </CardContent>
      </Card>

      {/* Detailed Expenses Table */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Detailed Expense Records</h2>
          <DataGrid
            dataSource={expenses}
            showBorders={true}
            columnAutoWidth={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
          >
            <FilterRow visible={true} />
            <GroupPanel visible={true} />
            <Grouping autoExpandAll={false} />
            <Column dataField="expenseDate" caption="Date" dataType="date" groupIndex={0} />
            <Column dataField="referenceNumber" caption="Reference #" />
            <Column dataField="category.name" caption="Category" />
            <Column dataField="location.name" caption="Location" />
            <Column
              dataField="amount"
              caption="Amount"
              format="currency"
              customizeText={(e: any) => formatCurrency(e.value)}
            />
            <Column dataField="payeeName" caption="Payee" />
            <Column dataField="description" caption="Description" width={300} />
            <Column dataField="status" caption="Status" />
            <Summary>
              <TotalItem column="amount" summaryType="sum" valueFormat="currency" customizeText={(e: any) => `Total: ${formatCurrency(e.value)}`} />
            </Summary>
            <GridExport enabled={true} allowExportSelectedData={false} />
            <Paging defaultPageSize={25} />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  )
}
