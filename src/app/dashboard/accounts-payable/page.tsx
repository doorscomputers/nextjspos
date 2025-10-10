"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { MagnifyingGlassIcon, EyeIcon, CurrencyDollarIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'
import { exportToCSV, exportToExcel, exportToPDF, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { formatCurrency } from '@/lib/currencyUtils'

interface AccountsPayable {
  id: number
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  paidAmount: number
  balanceAmount: number
  status: string
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  purchase: {
    id: number
    purchaseOrderNumber: string
  } | null
}

interface AgingData {
  current: number
  days30: number
  days60: number
  days90: number
  days90Plus: number
  total: number
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'invoice', label: 'Invoice #' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'invoiceDate', label: 'Invoice Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'amount', label: 'Amount' },
  { id: 'paid', label: 'Paid' },
  { id: 'balance', label: 'Balance' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
]

export default function AccountsPayablePage() {
  const { can } = usePermissions()
  const [payables, setPayables] = useState<AccountsPayable[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [agingData, setAgingData] = useState<AgingData | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [totalPayables, setTotalPayables] = useState(0)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'invoice', 'supplier', 'invoiceDate', 'dueDate', 'amount', 'paid', 'balance', 'status', 'actions'
  ])

  useEffect(() => {
    fetchPayables()
  }, [statusFilter, currentPage, itemsPerPage, dateFilter, customStartDate, customEndDate])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, dateFilter])

  const getDateRange = (filter: string) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    const result = { start: '', end: '' }

    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    switch (filter) {
      case 'today':
        result.start = todayStr
        result.end = todayStr
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = formatDate(yesterday)
        result.start = yesterdayStr
        result.end = yesterdayStr
        break
      case 'this_week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        result.start = formatDate(weekStart)
        result.end = todayStr
        break
      case 'last_week':
        const lastWeekStart = new Date(today)
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6)
        result.start = formatDate(lastWeekStart)
        result.end = formatDate(lastWeekEnd)
        break
      case 'this_month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        result.start = formatDate(monthStart)
        result.end = todayStr
        break
      case 'last_month':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        result.start = formatDate(lastMonthStart)
        result.end = formatDate(lastMonthEnd)
        break
      case 'this_quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1)
        result.start = formatDate(quarterStart)
        result.end = todayStr
        break
      case 'last_quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear()
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3
        const lastQuarterStart = new Date(lastQuarterYear, lastQuarterMonth, 1)
        const lastQuarterEnd = new Date(lastQuarterYear, lastQuarterMonth + 3, 0)
        result.start = formatDate(lastQuarterStart)
        result.end = formatDate(lastQuarterEnd)
        break
      case 'this_year':
        const yearStart = new Date(today.getFullYear(), 0, 1)
        result.start = formatDate(yearStart)
        result.end = todayStr
        break
      case 'last_year':
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1)
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31)
        result.start = formatDate(lastYearStart)
        result.end = formatDate(lastYearEnd)
        break
      case 'custom':
        if (customStartDate) result.start = customStartDate
        if (customEndDate) result.end = customEndDate
        break
    }

    return result
  }

  const fetchPayables = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '100', // Fetch more for client-side filtering
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      // NOTE: Date filtering is done client-side to avoid timezone issues
      // Do NOT send startDate/endDate to API

      const response = await fetch(`/api/accounts-payable?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPayables(data.payables || [])
        setTotalPayables(data.payables?.length || 0)
        setAgingData(data.aging || null)
      } else {
        toast.error(data.error || 'Failed to fetch accounts payable')
      }
    } catch (error) {
      console.error('Error fetching accounts payable:', error)
      toast.error('Failed to fetch accounts payable')
    } finally {
      setLoading(false)
    }
  }

  const filteredPayables = payables.filter(payable => {
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = (
        payable.invoiceNumber.toLowerCase().includes(searchLower) ||
        payable.supplier?.name.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }

    // Apply client-side date filter to fix timezone issues
    const dateRange = getDateRange(dateFilter)
    if (dateRange.start || dateRange.end) {
      const invoiceDate = new Date(payable.invoiceDate)
      const year = invoiceDate.getFullYear()
      const month = String(invoiceDate.getMonth() + 1).padStart(2, '0')
      const day = String(invoiceDate.getDate()).padStart(2, '0')
      const invoiceDateStr = `${year}-${month}-${day}`

      if (dateRange.start && invoiceDateStr < dateRange.start) {
        return false
      }
      if (dateRange.end && invoiceDateStr > dateRange.end) {
        return false
      }
    }

    return true
  })

  const { sortedData, sortConfig, requestSort } = useTableSort(filteredPayables, { key: 'id', direction: 'desc' })

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Invoice #', key: 'invoiceNumber' },
      { header: 'Supplier', key: 'supplier', formatter: (val: any) => val?.name || 'N/A' },
      { header: 'Invoice Date', key: 'invoiceDate' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Amount', key: 'amount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Paid', key: 'paidAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Balance', key: 'balanceAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Status', key: 'status' },
    ]

    const filename = `accounts_payable_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(sortedData, columns, filename)
        break
      case 'excel':
        exportToExcel(sortedData, columns, filename)
        break
      case 'pdf':
        exportToPDF(sortedData, columns, filename, 'Accounts Payable Report')
        break
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'unpaid': { variant: 'destructive', label: 'Unpaid' },
      'partially_paid': { variant: 'secondary', label: 'Partially Paid' },
      'paid': { variant: 'default', label: 'Paid' },
      'overdue': { variant: 'destructive', label: 'Overdue' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = today.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchTerm('')
  }

  if (!can(PERMISSIONS.ACCOUNTS_PAYABLE_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view accounts payable.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage supplier payables</p>
        </div>
        {can(PERMISSIONS.PAYMENT_CREATE) && (
          <Link href="/dashboard/payments/new">
            <Button>
              <CurrencyDollarIcon className="w-5 h-5 mr-2" />
              Make Payment
            </Button>
          </Link>
        )}
      </div>

      {/* Aging Summary Cards */}
      {agingData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-500">{formatCurrency(agingData.current)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">1-30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(agingData.days30)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">31-60 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(agingData.days60)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">61-90 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(agingData.days90)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">90+ Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(agingData.days90Plus)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(agingData.total)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5" />
              Filters
            </CardTitle>
            {(statusFilter !== 'all' || dateFilter !== 'all' || searchTerm !== '') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <XMarkIcon className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="last_quarter">Last Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="last_year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or supplier name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
          </div>
        </div>
        <ColumnVisibilityToggle
          availableColumns={AVAILABLE_COLUMNS}
          visibleColumns={visibleColumns}
          onChange={setVisibleColumns}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
          <DocumentTextIcon className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
          <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
          <DocumentTextIcon className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                {visibleColumns.includes('invoice') && (
                  <SortableTableHead
                    sortKey="invoiceNumber"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Invoice #
                  </SortableTableHead>
                )}
                {visibleColumns.includes('supplier') && (
                  <SortableTableHead
                    sortKey="supplier.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Supplier
                  </SortableTableHead>
                )}
                {visibleColumns.includes('invoiceDate') && (
                  <SortableTableHead
                    sortKey="invoiceDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Invoice Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('dueDate') && (
                  <SortableTableHead
                    sortKey="dueDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Due Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('amount') && (
                  <SortableTableHead
                    sortKey="amount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Amount
                  </SortableTableHead>
                )}
                {visibleColumns.includes('paid') && (
                  <SortableTableHead
                    sortKey="paidAmount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Paid
                  </SortableTableHead>
                )}
                {visibleColumns.includes('balance') && (
                  <SortableTableHead
                    sortKey="balanceAmount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Balance
                  </SortableTableHead>
                )}
                {visibleColumns.includes('status') && (
                  <SortableTableHead
                    sortKey="status"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Status
                  </SortableTableHead>
                )}
                {visibleColumns.includes('actions') && (
                  <SortableTableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    Actions
                  </SortableTableHead>
                )}
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    Loading accounts payable...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    No accounts payable found
                  </td>
                </tr>
              ) : (
                sortedData.map((payable) => (
                  <tr key={payable.id} className="hover:bg-muted/50 transition-colors">
                    {visibleColumns.includes('invoice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {payable.invoiceNumber}
                      </td>
                    )}
                    {visibleColumns.includes('supplier') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {payable.supplier ? (
                          <div>
                            <div className="font-medium">{payable.supplier.name}</div>
                            {payable.supplier.mobile && (
                              <div className="text-muted-foreground text-xs">{payable.supplier.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('invoiceDate') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(payable.invoiceDate)}
                      </td>
                    )}
                    {visibleColumns.includes('dueDate') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <div>{formatDate(payable.dueDate)}</div>
                        {getDaysOverdue(payable.dueDate) > 0 && payable.status !== 'paid' && (
                          <div className="text-red-600 dark:text-red-400 text-xs font-medium">
                            {getDaysOverdue(payable.dueDate)} days overdue
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('amount') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                        {formatCurrency(payable.amount)}
                      </td>
                    )}
                    {visibleColumns.includes('paid') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-500 font-medium">
                        {formatCurrency(payable.paidAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('balance') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(payable.balanceAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payable.status)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Link href={`/dashboard/payments/new?apId=${payable.id}`}>
                          <Button variant="outline" size="sm">
                            <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                            Pay
                          </Button>
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <ResultsInfo
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalPayables}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalPayables}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
