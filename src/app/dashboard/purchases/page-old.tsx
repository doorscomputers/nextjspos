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
import { DocumentArrowDownIcon, DocumentTextIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { formatCurrency } from '@/lib/currencyUtils'

interface Purchase {
  id: number
  purchaseOrderNumber: string
  purchaseDate: string
  expectedDeliveryDate: string | null
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  items: {
    id: number
    quantity: number
    quantityReceived: number
    unitCost: number
  }[]
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'poNumber', label: 'PO Number' },
  { id: 'date', label: 'PO Date' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'items', label: 'Items' },
  { id: 'received', label: 'Received' },
  { id: 'total', label: 'Total' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
]

export default function PurchasesPage() {
  const { can } = usePermissions()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalPurchases, setTotalPurchases] = useState(0)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'poNumber', 'date', 'supplier', 'items', 'received', 'total', 'status', 'actions'
  ])

  useEffect(() => {
    fetchPurchases()
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

  const fetchPurchases = async () => {
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

      const response = await fetch(`/api/purchases?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPurchases(data.purchases || [])
        setTotalPurchases(data.purchases?.length || 0)
      } else {
        toast.error(data.error || 'Failed to fetch purchases')
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
      toast.error('Failed to fetch purchases')
    } finally {
      setLoading(false)
    }
  }

  const filteredPurchases = purchases.filter(purchase => {
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = (
        purchase.purchaseOrderNumber.toLowerCase().includes(searchLower) ||
        purchase.supplier?.name.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }

    // Apply client-side date filter to fix timezone issues
    const dateRange = getDateRange(dateFilter)
    if (dateRange.start || dateRange.end) {
      const purchaseDate = new Date(purchase.purchaseDate)
      const year = purchaseDate.getFullYear()
      const month = String(purchaseDate.getMonth() + 1).padStart(2, '0')
      const day = String(purchaseDate.getDate()).padStart(2, '0')
      const purchaseDateStr = `${year}-${month}-${day}`

      if (dateRange.start && purchaseDateStr < dateRange.start) {
        return false
      }
      if (dateRange.end && purchaseDateStr > dateRange.end) {
        return false
      }
    }

    return true
  })

  // Add sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredPurchases, { key: 'id', direction: 'desc' })

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      {
        id: 'purchaseOrderNumber',
        label: 'PO #',
        getValue: (row: any) => row.purchaseOrderNumber
      },
      {
        id: 'purchaseDate',
        label: 'Date',
        getValue: (row: any) => formatDate(row.purchaseDate)
      },
      {
        id: 'supplier',
        label: 'Supplier',
        getValue: (row: any) => row.supplier?.name || 'N/A'
      },
      {
        id: 'items',
        label: 'Items',
        getValue: (row: any) => row.items.length.toString()
      },
      {
        id: 'totalAmount',
        label: 'Total',
        getValue: (row: any) => formatCurrency(row.totalAmount)
      },
      {
        id: 'status',
        label: 'Status',
        getValue: (row: any) => row.status
      },
    ]

    const filename = `purchases_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV({ data: sortedData, columns, filename })
        break
      case 'excel':
        exportToExcel({ data: sortedData, columns, filename, title: 'Purchase Orders' })
        break
      case 'pdf':
        exportToPDF({ data: sortedData, columns, filename, title: 'Purchase Orders Report' })
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
    const statusLower = status.toLowerCase()

    if (statusLower === 'pending') {
      return (
        <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700">
          Pending
        </Badge>
      )
    }

    if (statusLower === 'received') {
      return (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-300 dark:border-green-700">
          Received
        </Badge>
      )
    }

    if (statusLower === 'partially_received') {
      return (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-blue-300 dark:border-blue-700">
          Partially Received
        </Badge>
      )
    }

    if (statusLower === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>
    }

    return <Badge variant="outline">{status}</Badge>
  }

  const getReceivedStatus = (items: Purchase['items']) => {
    const totalOrdered = items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0)
    const totalReceived = items.reduce((sum, item) => sum + parseFloat(item.quantityReceived.toString()), 0)

    if (totalReceived === 0) return `0 / ${totalOrdered}`
    return `${totalReceived} / ${totalOrdered}`
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchTerm('')
  }

  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return (
      <div className="p-6 sm:p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          You do not have permission to view purchases.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage purchase orders from suppliers</p>
        </div>
        {can(PERMISSIONS.PURCHASE_CREATE) && (
          <Link href="/dashboard/purchases/create">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Purchase Order
            </Button>
          </Link>
        )}
      </div>

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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
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
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="Search by PO number or supplier name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
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
        <Button onClick={() => window.print()} variant="secondary" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PrinterIcon className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Print</span>
        </Button>
        <Button onClick={() => handleExport('excel')} variant="secondary" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white">
          <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Export </span>Excel
        </Button>
        <Button onClick={() => handleExport('pdf')} variant="secondary" className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white">
          <DocumentTextIcon className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Export </span>PDF
        </Button>
      </div>

      <Card className="shadow-lg border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {visibleColumns.includes('poNumber') && (
                  <SortableTableHead
                    sortKey="purchaseOrderNumber"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    PO Number
                  </SortableTableHead>
                )}
                {visibleColumns.includes('date') && (
                  <SortableTableHead
                    sortKey="purchaseDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Date
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
                {visibleColumns.includes('items') && (
                  <SortableTableHead
                    sortKey="items"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Items
                  </SortableTableHead>
                )}
                {visibleColumns.includes('received') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Received
                  </SortableTableHead>
                )}
                {visibleColumns.includes('total') && (
                  <SortableTableHead
                    sortKey="totalAmount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Total
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
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Actions
                  </SortableTableHead>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Loading purchases...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No purchases found
                  </td>
                </tr>
              ) : (
                sortedData.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {visibleColumns.includes('poNumber') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {purchase.purchaseOrderNumber}
                      </td>
                    )}
                    {visibleColumns.includes('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(purchase.purchaseDate)}
                      </td>
                    )}
                    {visibleColumns.includes('supplier') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {purchase.supplier ? (
                          <div>
                            <div className="font-medium">{purchase.supplier.name}</div>
                            {purchase.supplier.mobile && (
                              <div className="text-gray-500 dark:text-gray-400 text-xs">{purchase.supplier.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">N/A</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('items') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}
                      </td>
                    )}
                    {visibleColumns.includes('received') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {getReceivedStatus(purchase.items)}
                      </td>
                    )}
                    {visibleColumns.includes('total') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(purchase.totalAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(purchase.status)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/dashboard/purchases/${purchase.id}`}>
                          <Button variant="ghost" size="sm">
                            <EyeIcon className="w-4 h-4 mr-1" />
                            View
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
      </Card>

      {!loading && sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <ResultsInfo
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalPurchases}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalPurchases}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
