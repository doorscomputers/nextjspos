'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react'
import DataGrid, {
  Column,
  Export,
  Summary,
  TotalItem,
  GroupItem,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  GroupPanel,
  Grouping,
} from 'devextreme-react/data-grid'
import 'devextreme/dist/css/dx.light.css'

export default function ExpenseReportsPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])
  const [reportType, setReportType] = useState('main')
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    categoryId: '',
    locationId: '',
    status: ''
  })
  const [categories, setCategories] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    fetchCategories()
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [filters, reportType])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expenses/categories?activeOnly=true')
      const data = await response.json()
      if (response.ok) {
        setCategories(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations?activeOnly=true')
      const data = await response.json()
      if (response.ok) {
        setLocations(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchReport = async () => {
    if (!can(PERMISSIONS.EXPENSE_VIEW)) {
      toast.error('You do not have permission to view expense reports')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.categoryId) params.append('categoryId', filters.categoryId)
      if (filters.locationId) params.append('locationId', filters.locationId)
      if (filters.status) params.append('status', filters.status)

      let endpoint = '/api/reports/expenses'
      if (reportType === 'by-category') {
        endpoint = '/api/reports/expenses/by-category'
      } else if (reportType === 'by-location') {
        endpoint = '/api/reports/expenses/by-location'
      } else if (reportType === 'trend') {
        endpoint = '/api/reports/expenses/trend'
        params.append('groupBy', 'month')
      }

      const response = await fetch(`${endpoint}?${params}`)
      const data = await response.json()

      if (response.ok) {
        if (reportType === 'by-category' || reportType === 'by-location') {
          setExpenses(data.report || [])
          setSummary(data.summary || null)
        } else if (reportType === 'trend') {
          setExpenses(data.trendData || [])
          setSummary(data.summary || null)
        } else {
          setExpenses(data.expenses || [])
          setSummary(data.summary || null)
        }
      } else {
        toast.error('Failed to fetch report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const amountCellRender = (data: any) => {
    const value = data.value || 0
    return (
      <div className="text-right font-semibold">
        {parseFloat(value.toString()).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </div>
    )
  }

  const dateCellRender = (data: any) => {
    return new Date(data.value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const statusCellRender = (data: any) => {
    const status = data.value
    let colorClasses = ''

    switch (status) {
      case 'draft':
        colorClasses = 'bg-gray-100 text-gray-800'
        break
      case 'approved':
        colorClasses = 'bg-blue-100 text-blue-800'
        break
      case 'posted':
        colorClasses = 'bg-green-100 text-green-800'
        break
      case 'void':
        colorClasses = 'bg-red-100 text-red-800'
        break
      default:
        colorClasses = 'bg-gray-100 text-gray-800'
    }

    return (
      <div className="flex items-center justify-center">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${colorClasses}`}>
          {status}
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Expense Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Analyze expense data with various groupings and filters
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Report</SelectItem>
                    <SelectItem value="by-category">By Category</SelectItem>
                    <SelectItem value="by-location">By Location</SelectItem>
                    <SelectItem value="trend">Trend Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="categoryId">Category</Label>
                <Select
                  value={filters.categoryId || "all"}
                  onValueChange={(value) => setFilters({ ...filters, categoryId: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="locationId">Location</Label>
                <Select
                  value={filters.locationId || "all"}
                  onValueChange={(value) => setFilters({ ...filters, locationId: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={fetchReport} disabled={loading}>
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-500 to-blue-600">
              <CardContent className="p-6 text-white">
                <div className="text-sm opacity-90">Total Expenses</div>
                <div className="text-3xl font-bold mt-2">
                  {summary.totalExpenses || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-green-500 to-green-600">
              <CardContent className="p-6 text-white">
                <div className="text-sm opacity-90">Total Amount</div>
                <div className="text-3xl font-bold mt-2">
                  {parseFloat((summary.totalAmount || summary.grandTotal || 0).toString()).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-500 to-purple-600">
              <CardContent className="p-6 text-white">
                <div className="text-sm opacity-90">
                  {reportType === 'by-category' ? 'Categories' : reportType === 'by-location' ? 'Locations' : 'Average'}
                </div>
                <div className="text-3xl font-bold mt-2">
                  {summary.totalCategories || summary.totalLocations || summary.periods || '-'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Data Grid */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            <DataGrid
              dataSource={expenses}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              columnAutoWidth={true}
              wordWrapEnabled={true}
            >
              <LoadPanel enabled={loading} />
              <SearchPanel visible={true} />
              <HeaderFilter visible={true} />
              <Sorting mode="multiple" />
              <Grouping contextMenuEnabled={true} />
              <GroupPanel visible={true} emptyPanelText="Drag a column here to group" />
              <Paging enabled={true} defaultPageSize={20} />
              <Pager
                visible={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector={true}
                showNavigationButtons={true}
                showInfo={true}
              />
              <Export enabled={true} allowExportSelectedData={false} />

              {reportType === 'main' && (
                <>
                  <Column dataField="referenceNumber" caption="Reference #" width={150} />
                  <Column dataField="expenseDate" caption="Date" width={120} dataType="date" cellRender={dateCellRender} />
                  <Column dataField="category.name" caption="Category" width={150} />
                  <Column dataField="location.name" caption="Location" width={150} />
                  <Column dataField="amount" caption="Amount" width={120} dataType="number" cellRender={amountCellRender} />
                  <Column dataField="payeeName" caption="Payee" width={150} />
                  <Column dataField="paymentMethod" caption="Payment Method" width={130} />
                  <Column dataField="status" caption="Status" width={100} cellRender={statusCellRender} />
                  <Summary>
                    <TotalItem column="amount" summaryType="sum" valueFormat="currency" />
                    <TotalItem column="referenceNumber" summaryType="count" displayFormat="{0} expenses" />
                  </Summary>
                </>
              )}

              {reportType === 'by-category' && (
                <>
                  <Column dataField="categoryName" caption="Category" width={200} />
                  <Column dataField="totalExpenses" caption="# of Expenses" width={150} dataType="number" />
                  <Column dataField="totalAmount" caption="Total Amount" width={150} dataType="number" cellRender={amountCellRender} />
                  <Column dataField="averageAmount" caption="Average Amount" width={150} dataType="number" cellRender={amountCellRender} />
                  <Summary>
                    <TotalItem column="totalAmount" summaryType="sum" valueFormat="currency" />
                    <TotalItem column="totalExpenses" summaryType="sum" displayFormat="{0} total" />
                  </Summary>
                </>
              )}

              {reportType === 'by-location' && (
                <>
                  <Column dataField="locationName" caption="Location" width={200} />
                  <Column dataField="city" caption="City" width={120} />
                  <Column dataField="totalExpenses" caption="# of Expenses" width={150} dataType="number" />
                  <Column dataField="totalAmount" caption="Total Amount" width={150} dataType="number" cellRender={amountCellRender} />
                  <Column dataField="averageAmount" caption="Average Amount" width={150} dataType="number" cellRender={amountCellRender} />
                  <Summary>
                    <TotalItem column="totalAmount" summaryType="sum" valueFormat="currency" />
                    <TotalItem column="totalExpenses" summaryType="sum" displayFormat="{0} total" />
                  </Summary>
                </>
              )}

              {reportType === 'trend' && (
                <>
                  <Column dataField="period" caption="Period" width={150} />
                  <Column dataField="count" caption="# of Expenses" width={150} dataType="number" />
                  <Column dataField="total" caption="Total Amount" width={150} dataType="number" cellRender={amountCellRender} />
                  <Summary>
                    <TotalItem column="total" summaryType="sum" valueFormat="currency" />
                    <TotalItem column="count" summaryType="sum" displayFormat="{0} total" />
                  </Summary>
                </>
              )}
            </DataGrid>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
