"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
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

interface Payment {
  id: number
  paymentMethod: string
  amount: number
  paymentDate: string
  referenceNumber: string | null
  notes: string | null
  createdAt: string
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
  postDatedCheque: {
    id: number
    chequeNumber: string
    chequeDate: string
    bankName: string | null
  } | null
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'date', label: 'Payment Date' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'invoice', label: 'Invoice #' },
  { id: 'method', label: 'Payment Method' },
  { id: 'reference', label: 'Reference' },
  { id: 'amount', label: 'Amount' },
  { id: 'actions', label: 'Actions' },
]

export default function PaymentsPage() {
  const { can } = usePermissions()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [totalPayments, setTotalPayments] = useState(0)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'date', 'supplier', 'invoice', 'method', 'reference', 'amount', 'actions'
  ])

  useEffect(() => {
    fetchPayments()
  }, [methodFilter, currentPage, itemsPerPage, dateFilter, customStartDate, customEndDate])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, methodFilter, dateFilter])

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

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '100', // Fetch more for client-side filtering
      })

      if (methodFilter && methodFilter !== 'all') {
        params.append('paymentMethod', methodFilter)
      }

      // NOTE: Date filtering is done client-side to avoid timezone issues
      // Do NOT send startDate/endDate to API

      const response = await fetch(`/api/payments?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPayments(data.payments || [])
        setTotalPayments(data.payments?.length || 0)
      } else {
        toast.error(data.error || 'Failed to fetch payments')
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to fetch payments')
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = payments.filter(payment => {
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = (
        payment.accountsPayable?.supplier?.name.toLowerCase().includes(searchLower) ||
        payment.accountsPayable?.invoiceNumber.toLowerCase().includes(searchLower) ||
        payment.referenceNumber?.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }

    // Apply client-side date filter to fix timezone issues
    const dateRange = getDateRange(dateFilter)
    if (dateRange.start || dateRange.end) {
      const paymentDate = new Date(payment.paymentDate)
      const year = paymentDate.getFullYear()
      const month = String(paymentDate.getMonth() + 1).padStart(2, '0')
      const day = String(paymentDate.getDate()).padStart(2, '0')
      const paymentDateStr = `${year}-${month}-${day}`

      if (dateRange.start && paymentDateStr < dateRange.start) {
        return false
      }
      if (dateRange.end && paymentDateStr > dateRange.end) {
        return false
      }
    }

    return true
  })

  const { sortedData, sortConfig, requestSort } = useTableSort(filteredPayments, { key: 'id', direction: 'desc' })

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Date', key: 'paymentDate' },
      { header: 'Supplier', key: 'accountsPayable', formatter: (val: any) => val?.supplier?.name || 'N/A' },
      { header: 'Invoice #', key: 'accountsPayable', formatter: (val: any) => val?.invoiceNumber || 'N/A' },
      { header: 'Method', key: 'paymentMethod' },
      { header: 'Reference', key: 'referenceNumber' },
      { header: 'Amount', key: 'amount', formatter: (val: number) => `$${val.toFixed(2)}` },
    ]

    const filename = `payments_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(sortedData, columns, filename)
        break
      case 'excel':
        exportToExcel(sortedData, columns, filename)
        break
      case 'pdf':
        exportToPDF(sortedData, columns, filename, 'Payment History Report')
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

  const getMethodBadge = (method: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'cash': { variant: 'default', label: 'Cash' },
      'cheque': { variant: 'secondary', label: 'Cheque' },
      'bank_transfer': { variant: 'outline', label: 'Bank Transfer' },
      'credit_card': { variant: 'secondary', label: 'Credit Card' },
      'debit_card': { variant: 'secondary', label: 'Debit Card' },
    }
    const methodConfig = config[method] || { variant: 'outline', label: method }
    return <Badge variant={methodConfig.variant}>{methodConfig.label}</Badge>
  }

  const clearFilters = () => {
    setMethodFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchTerm('')
  }

  if (!can(PERMISSIONS.PAYMENT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view payments.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground mt-1">View all supplier payments</p>
        </div>
        {can(PERMISSIONS.PAYMENT_CREATE) && (
          <Link href="/dashboard/payments/new">
            <Button>
              <PlusIcon className="w-5 h-5 mr-2" />
              New Payment
            </Button>
          </Link>
        )}
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5" />
              Filters
            </CardTitle>
            {(methodFilter !== 'all' || dateFilter !== 'all' || searchTerm !== '') && (
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
              <Label>Payment Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
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
              placeholder="Search by supplier, invoice, or reference..."
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
                {visibleColumns.includes('date') && (
                  <SortableTableHead
                    sortKey="paymentDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Payment Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('supplier') && (
                  <SortableTableHead
                    sortKey="accountsPayable.supplier.name"
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
                    sortKey="accountsPayable.invoiceNumber"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Invoice #
                  </SortableTableHead>
                )}
                {visibleColumns.includes('method') && (
                  <SortableTableHead
                    sortKey="paymentMethod"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Payment Method
                  </SortableTableHead>
                )}
                {visibleColumns.includes('reference') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Reference
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
                    Loading payments...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                sortedData.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/50 transition-colors">
                    {visibleColumns.includes('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payment.paymentDate)}
                      </td>
                    )}
                    {visibleColumns.includes('supplier') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.accountsPayable?.supplier ? (
                          <div>
                            <div className="font-medium">{payment.accountsPayable.supplier.name}</div>
                            {payment.accountsPayable.supplier.mobile && (
                              <div className="text-gray-500 text-xs">{payment.accountsPayable.supplier.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('invoice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.accountsPayable?.invoiceNumber || 'N/A'}
                      </td>
                    )}
                    {visibleColumns.includes('method') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getMethodBadge(payment.paymentMethod)}
                        {payment.postDatedCheque && (
                          <div className="text-xs text-gray-500 mt-1">
                            Cheque: {payment.postDatedCheque.chequeNumber}
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('reference') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.referenceNumber || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('amount') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/dashboard/accounts-payable`}>
                          <Button variant="ghost" size="sm">
                            <EyeIcon className="w-4 h-4" />
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
            totalItems={totalPayments}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalPayments}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
