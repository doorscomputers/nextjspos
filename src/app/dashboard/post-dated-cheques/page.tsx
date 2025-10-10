"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { MagnifyingGlassIcon, BellAlertIcon, CheckCircleIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
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

interface PostDatedCheque {
  id: number
  chequeNumber: string
  chequeDate: string
  amount: number
  bankName: string | null
  status: string
  clearedDate: string | null
  notes: string | null
  createdAt: string
  payment: {
    id: number
    paymentDate: string
    accountsPayable: {
      id: number
      invoiceNumber: string
      supplier: {
        id: number
        name: string
        mobile: string | null
        email: string | null
      }
    }
  }
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'chequeNumber', label: 'Cheque #' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'invoice', label: 'Invoice #' },
  { id: 'chequeDate', label: 'Cheque Date' },
  { id: 'daysUntilDue', label: 'Days Until Due' },
  { id: 'amount', label: 'Amount' },
  { id: 'bank', label: 'Bank' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
]

export default function PostDatedChequesPage() {
  const { can } = usePermissions()
  const [cheques, setCheques] = useState<PostDatedCheque[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [totalCheques, setTotalCheques] = useState(0)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'chequeNumber', 'supplier', 'invoice', 'chequeDate', 'daysUntilDue', 'amount', 'bank', 'status', 'actions'
  ])

  useEffect(() => {
    fetchCheques()
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

  const fetchCheques = async () => {
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

      const response = await fetch(`/api/post-dated-cheques?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCheques(data.cheques || [])
        setTotalCheques(data.cheques?.length || 0)
      } else {
        toast.error(data.error || 'Failed to fetch post-dated cheques')
      }
    } catch (error) {
      console.error('Error fetching post-dated cheques:', error)
      toast.error('Failed to fetch post-dated cheques')
    } finally {
      setLoading(false)
    }
  }

  const filteredCheques = cheques.filter(cheque => {
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = (
        cheque.chequeNumber.toLowerCase().includes(searchLower) ||
        cheque.payment?.accountsPayable?.supplier?.name.toLowerCase().includes(searchLower) ||
        cheque.payment?.accountsPayable?.invoiceNumber.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }

    // Apply client-side date filter to fix timezone issues
    const dateRange = getDateRange(dateFilter)
    if (dateRange.start || dateRange.end) {
      const chequeDate = new Date(cheque.chequeDate)
      const year = chequeDate.getFullYear()
      const month = String(chequeDate.getMonth() + 1).padStart(2, '0')
      const day = String(chequeDate.getDate()).padStart(2, '0')
      const chequeDateStr = `${year}-${month}-${day}`

      if (dateRange.start && chequeDateStr < dateRange.start) {
        return false
      }
      if (dateRange.end && chequeDateStr > dateRange.end) {
        return false
      }
    }

    return true
  })

  const { sortedData, sortConfig, requestSort } = useTableSort(filteredCheques, { key: 'chequeDate', direction: 'asc' })

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Cheque #', key: 'chequeNumber' },
      { header: 'Supplier', key: 'payment', formatter: (val: any) => val?.accountsPayable?.supplier?.name || 'N/A' },
      { header: 'Invoice #', key: 'payment', formatter: (val: any) => val?.accountsPayable?.invoiceNumber || 'N/A' },
      { header: 'Cheque Date', key: 'chequeDate' },
      { header: 'Amount', key: 'amount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Bank', key: 'bankName' },
      { header: 'Status', key: 'status' },
    ]

    const filename = `post_dated_cheques_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(sortedData, columns, filename)
        break
      case 'excel':
        exportToExcel(sortedData, columns, filename)
        break
      case 'pdf':
        exportToPDF(sortedData, columns, filename, 'Post-Dated Cheques Report')
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

  const getDaysUntilDue = (chequeDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(chequeDate)
    due.setHours(0, 0, 0, 0)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDaysUntilDueBadge = (chequeDate: string, status: string) => {
    if (status !== 'pending') return null

    const days = getDaysUntilDue(chequeDate)

    if (days < 0) {
      return <Badge variant="destructive">Overdue by {Math.abs(days)} days</Badge>
    } else if (days === 0) {
      return <Badge variant="destructive">Due Today</Badge>
    } else if (days <= 3) {
      return <Badge className="bg-orange-500">Due in {days} days</Badge>
    } else if (days <= 7) {
      return <Badge className="bg-yellow-500">Due in {days} days</Badge>
    } else {
      return <Badge variant="outline">{days} days</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'cleared': { variant: 'default', label: 'Cleared' },
      'bounced': { variant: 'destructive', label: 'Bounced' },
      'cancelled': { variant: 'outline', label: 'Cancelled' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const handleMarkAsCleared = async (chequeId: number) => {
    if (!confirm('Mark this cheque as cleared?')) return

    try {
      const response = await fetch(`/api/post-dated-cheques/${chequeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cleared', clearedDate: new Date().toISOString() }),
      })

      if (response.ok) {
        toast.success('Cheque marked as cleared')
        fetchCheques()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update cheque status')
      }
    } catch (error) {
      console.error('Error updating cheque:', error)
      toast.error('Failed to update cheque status')
    }
  }

  const clearFilters = () => {
    setStatusFilter('pending')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchTerm('')
  }

  if (!can(PERMISSIONS.PAYMENT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view post-dated cheques.
        </div>
      </div>
    )
  }

  // Calculate summary stats
  const upcomingCheques = cheques.filter(c => {
    const days = getDaysUntilDue(c.chequeDate)
    return c.status === 'pending' && days >= 0 && days <= 7
  })

  const overdueCheques = cheques.filter(c => {
    const days = getDaysUntilDue(c.chequeDate)
    return c.status === 'pending' && days < 0
  })

  const totalPendingAmount = cheques
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Post-Dated Cheques</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage post-dated cheques</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <BellAlertIcon className="w-4 h-4" />
              Upcoming (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{upcomingCheques.length}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(upcomingCheques.reduce((sum, c) => sum + c.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{overdueCheques.length}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(overdueCheques.reduce((sum, c) => sum + c.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {cheques.filter(c => c.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">{formatCurrency(totalPendingAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cleared</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {cheques.filter(c => c.status === 'cleared').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(cheques.filter(c => c.status === 'cleared').reduce((sum, c) => sum + c.amount, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5" />
              Filters
            </CardTitle>
            {(statusFilter !== 'pending' || dateFilter !== 'all' || searchTerm !== '') && (
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
              placeholder="Search by cheque number, supplier, or invoice..."
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
                {visibleColumns.includes('chequeNumber') && (
                  <SortableTableHead
                    sortKey="chequeNumber"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Cheque #
                  </SortableTableHead>
                )}
                {visibleColumns.includes('supplier') && (
                  <SortableTableHead
                    sortKey="payment.accountsPayable.supplier.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Supplier
                  </SortableTableHead>
                )}
                {visibleColumns.includes('invoice') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Invoice #
                  </SortableTableHead>
                )}
                {visibleColumns.includes('chequeDate') && (
                  <SortableTableHead
                    sortKey="chequeDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Cheque Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('daysUntilDue') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Days Until Due
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
                {visibleColumns.includes('bank') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Bank
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
                    Loading post-dated cheques...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    No post-dated cheques found
                  </td>
                </tr>
              ) : (
                sortedData.map((cheque) => (
                  <tr key={cheque.id} className="hover:bg-muted/50 transition-colors">
                    {visibleColumns.includes('chequeNumber') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cheque.chequeNumber}
                      </td>
                    )}
                    {visibleColumns.includes('supplier') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cheque.payment?.accountsPayable?.supplier ? (
                          <div>
                            <div className="font-medium">{cheque.payment.accountsPayable.supplier.name}</div>
                            {cheque.payment.accountsPayable.supplier.mobile && (
                              <div className="text-gray-500 text-xs">{cheque.payment.accountsPayable.supplier.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('invoice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cheque.payment?.accountsPayable?.invoiceNumber || 'N/A'}
                      </td>
                    )}
                    {visibleColumns.includes('chequeDate') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(cheque.chequeDate)}
                      </td>
                    )}
                    {visibleColumns.includes('daysUntilDue') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getDaysUntilDueBadge(cheque.chequeDate, cheque.status)}
                      </td>
                    )}
                    {visibleColumns.includes('amount') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(cheque.amount)}
                      </td>
                    )}
                    {visibleColumns.includes('bank') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cheque.bankName || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(cheque.status)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {cheque.status === 'pending' && can(PERMISSIONS.PAYMENT_APPROVE) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsCleared(cheque.id)}
                          >
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Clear
                          </Button>
                        )}
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
            totalItems={totalCheques}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalCheques}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
