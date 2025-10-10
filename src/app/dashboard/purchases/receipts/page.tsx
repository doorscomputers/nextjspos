'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ClipboardDocumentCheckIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

interface PurchaseReceipt {
  id: number
  receiptNumber: string
  receiptDate: string
  status: string
  purchaseId: number | null
  purchase: {
    id: number
    purchaseOrderNumber: string
    supplier: {
      id: number
      name: string
    }
  } | null
  supplier: {
    id: number
    name: string
  }
  receivedBy: number
  receivedAt: string
  approvedBy: number | null
  approvedAt: string | null
  receivedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  }
  approvedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  } | null
  totalQuantity: number
}

type SortField = 'receiptNumber' | 'receiptDate' | 'supplier' | 'totalQuantity' | 'status'
type SortOrder = 'asc' | 'desc'

export default function PurchaseReceiptsPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<PurchaseReceipt[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [sortField, setSortField] = useState<SortField>('receiptDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100', // Fetch more records for client-side filtering
        sortBy: sortField,
        sortOrder: sortOrder,
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      // NOTE: Date filtering is done client-side to avoid timezone issues
      // Do NOT send startDate/endDate to API

      const res = await fetch(`/api/purchases/receipts?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch receipts')
      }

      const data = await res.json()

      // Client-side sorting as fallback
      let sortedReceipts = data.data || []
      sortedReceipts.sort((a: PurchaseReceipt, b: PurchaseReceipt) => {
        let aVal: any, bVal: any

        switch (sortField) {
          case 'receiptNumber':
            aVal = a.receiptNumber
            bVal = b.receiptNumber
            break
          case 'receiptDate':
            aVal = new Date(a.receiptDate).getTime()
            bVal = new Date(b.receiptDate).getTime()
            break
          case 'supplier':
            aVal = (a.purchase?.supplier.name || a.supplier.name).toLowerCase()
            bVal = (b.purchase?.supplier.name || b.supplier.name).toLowerCase()
            break
          case 'totalQuantity':
            aVal = a.totalQuantity
            bVal = b.totalQuantity
            break
          case 'status':
            aVal = a.status
            bVal = b.status
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })

      setReceipts(sortedReceipts)
      setFilteredReceipts(sortedReceipts)
      setTotalPages(data.pagination.totalPages)
    } catch (error: any) {
      console.error('Error fetching receipts:', error)
      toast.error(error.message || 'Failed to load receipts')
    } finally {
      setLoading(false)
    }
  }

  // Client-side search and date filtering
  useEffect(() => {
    let filtered = [...receipts]

    // Apply search filter
    if (searchTerm.trim()) {
      const lowercaseSearch = searchTerm.toLowerCase()
      filtered = filtered.filter(receipt => {
        const grnNumber = receipt.receiptNumber.toLowerCase()
        const poNumber = receipt.purchase?.purchaseOrderNumber.toLowerCase() || ''
        const supplierName = (receipt.purchase?.supplier.name || receipt.supplier.name).toLowerCase()
        const receivedBy = getFullName(receipt.receivedByUser).toLowerCase()
        const approvedBy = receipt.approvedByUser ? getFullName(receipt.approvedByUser).toLowerCase() : ''
        const status = receipt.status.toLowerCase()

        return (
          grnNumber.includes(lowercaseSearch) ||
          poNumber.includes(lowercaseSearch) ||
          supplierName.includes(lowercaseSearch) ||
          receivedBy.includes(lowercaseSearch) ||
          approvedBy.includes(lowercaseSearch) ||
          status.includes(lowercaseSearch)
        )
      })
    }

    // Apply client-side date filter to fix timezone issues
    const dateRange = getDateRange(dateFilter)
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(receipt => {
        const receiptDate = new Date(receipt.receiptDate)
        const year = receiptDate.getFullYear()
        const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
        const day = String(receiptDate.getDate()).padStart(2, '0')
        const receiptDateStr = `${year}-${month}-${day}`

        let matches = true
        if (dateRange.start && receiptDateStr < dateRange.start) {
          matches = false
        }
        if (dateRange.end && receiptDateStr > dateRange.end) {
          matches = false
        }
        return matches
      })
    }

    setFilteredReceipts(filtered)
  }, [searchTerm, receipts, dateFilter, customStartDate, customEndDate])

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
        const quarter = Math.floor(today.getMonth() / 3)
        const quarterStart = new Date(today.getFullYear(), quarter * 3, 1)
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
      default:
        break
    }

    return result
  }

  useEffect(() => {
    if (can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
      fetchReceipts()
    }
  }, [page, statusFilter, dateFilter, customStartDate, customEndDate, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />
    )
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchTerm('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getFullName = (user: { firstName: string; lastName: string; surname: string } | undefined) => {
    if (!user) return 'N/A'
    return `${user.firstName} ${user.surname} ${user.lastName}`.trim()
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    }

    return (
      <Badge variant="outline" className={styles[status] || ''}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  if (!can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view purchase receipts.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Purchase Receipts (GRN)</h1>
          <p className="text-gray-600 mt-1">
            View and approve goods received notes
          </p>
        </div>
        {can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && (
          <Link href="/dashboard/purchases/receipts/new">
            <Button>
              <PlusIcon className="w-5 h-5 mr-2" />
              New GRN
            </Button>
          </Link>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by GRN#, PO#, Supplier, Received By, Approved By, or Status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters */}
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
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
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

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Receipts ({filteredReceipts.length} {searchTerm ? `of ${receipts.length}` : ''} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No receipts match your search' : 'No purchase receipts found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('receiptNumber')}
                      >
                        GRN # {getSortIcon('receiptNumber')}
                      </th>
                      <th className="text-left py-3 px-4">PO #</th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('supplier')}
                      >
                        Supplier {getSortIcon('supplier')}
                      </th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('receiptDate')}
                      >
                        Receipt Date {getSortIcon('receiptDate')}
                      </th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('totalQuantity')}
                      >
                        Quantity {getSortIcon('totalQuantity')}
                      </th>
                      <th className="text-left py-3 px-4">Received By</th>
                      <th className="text-left py-3 px-4">Approved By</th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('status')}
                      >
                        Status {getSortIcon('status')}
                      </th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((receipt) => (
                      <tr key={receipt.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{receipt.receiptNumber}</span>
                            {!receipt.purchaseId && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                                Direct Entry
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {receipt.purchase ? (
                            <Link
                              href={`/dashboard/purchases/${receipt.purchase.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {receipt.purchase.purchaseOrderNumber}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic">No PO</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {receipt.purchase ? receipt.purchase.supplier.name : receipt.supplier.name}
                        </td>
                        <td className="py-3 px-4">
                          {formatDate(receipt.receiptDate)}
                        </td>
                        <td className="py-3 px-4">
                          {receipt.totalQuantity} units
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-sm">
                              {getFullName(receipt.receivedByUser)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(receipt.receivedAt)}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {receipt.approvedByUser ? (
                            <div>
                              <div className="font-medium text-sm">
                                {getFullName(receipt.approvedByUser)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {receipt.approvedAt && formatDate(receipt.approvedAt)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(receipt.status)}
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/dashboard/purchases/receipts/${receipt.id}`}>
                            <Button variant="outline" size="sm">
                              <ClipboardDocumentCheckIcon className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
