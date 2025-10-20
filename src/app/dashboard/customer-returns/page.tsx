"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'
import { exportToCSV, exportToExcel, exportToPDF, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

interface CustomerReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  totalRefundAmount: number
  notes: string | null
  createdAt: string
  customer: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  } | null
  sale: {
    id: number
    invoiceNumber: string
    saleDate: string
  }
  items: {
    id: number
    quantity: number
    condition: string
    returnType: string
  }[]
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'returnNumber', label: 'Return #' },
  { id: 'date', label: 'Return Date' },
  { id: 'invoice', label: 'Original Sale' },
  { id: 'customer', label: 'Customer' },
  { id: 'items', label: 'Items' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'refundAmount', label: 'Refund Amount' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
]

export default function CustomerReturnsPage() {
  const { can } = usePermissions()
  const [returns, setReturns] = useState<CustomerReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalReturns, setTotalReturns] = useState(0)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'returnNumber', 'date', 'invoice', 'customer', 'items', 'refundAmount', 'status', 'actions'
  ])

  useEffect(() => {
    fetchReturns()
  }, [statusFilter, currentPage, itemsPerPage])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const fetchReturns = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/customer-returns?${params}`)
      const data = await response.json()

      if (response.ok) {
        setReturns(data.returns || [])
        setTotalReturns(data.pagination?.total || 0)
      } else {
        toast.error(data.error || 'Failed to fetch customer returns')
      }
    } catch (error) {
      console.error('Error fetching customer returns:', error)
      toast.error('Failed to fetch customer returns')
    } finally {
      setLoading(false)
    }
  }

  // Filter returns by search term
  const filteredReturns = returns.filter(returnItem => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      returnItem.returnNumber.toLowerCase().includes(searchLower) ||
      returnItem.sale.invoiceNumber.toLowerCase().includes(searchLower) ||
      returnItem.customer?.name.toLowerCase().includes(searchLower) ||
      returnItem.customer?.mobile?.toLowerCase().includes(searchLower)
    )
  })

  // Export functions
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Return #', key: 'returnNumber' },
      { header: 'Date', key: 'returnDate' },
      { header: 'Invoice #', key: 'sale', formatter: (val: any) => val.invoiceNumber },
      { header: 'Customer', key: 'customer', formatter: (val: any) => val?.name || 'N/A' },
      { header: 'Items', key: 'items', formatter: (val: any[]) => val.length.toString() },
      { header: 'Refund Amount', key: 'totalRefundAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Status', key: 'status' },
    ]

    const filename = `customer_returns_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(filteredReturns, columns, filename)
        break
      case 'excel':
        exportToExcel(filteredReturns, columns, filename)
        break
      case 'pdf':
        exportToPDF(filteredReturns, columns, filename, 'Customer Returns Report')
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

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'approved': { variant: 'default', label: 'Approved' },
      'rejected': { variant: 'destructive', label: 'Rejected' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const getConditionSummary = (items: CustomerReturn['items']) => {
    const resellable = items.filter(i => i.condition === 'resellable').length
    const damaged = items.filter(i => i.condition === 'damaged').length
    const defective = items.filter(i => i.condition === 'defective').length

    const parts = []
    if (resellable > 0) parts.push(`${resellable} resellable`)
    if (damaged > 0) parts.push(`${damaged} damaged`)
    if (defective > 0) parts.push(`${defective} defective`)

    return parts.length > 0 ? parts.join(', ') : 'N/A'
  }

  if (!can(PERMISSIONS.CUSTOMER_RETURN_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view customer returns.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Returns</h1>
          <p className="text-gray-500 mt-1">Manage customer returns and warranty claims</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by return #, invoice #, customer name, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <ColumnVisibilityToggle
          availableColumns={AVAILABLE_COLUMNS}
          visibleColumns={visibleColumns}
          onChange={setVisibleColumns}
        />
      </div>

      {/* Export Buttons */}
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.includes('returnNumber') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return #
                  </th>
                )}
                {visibleColumns.includes('date') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                )}
                {visibleColumns.includes('invoice') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Sale
                  </th>
                )}
                {visibleColumns.includes('customer') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                )}
                {visibleColumns.includes('items') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                )}
                {visibleColumns.includes('conditions') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conditions
                  </th>
                )}
                {visibleColumns.includes('refundAmount') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Refund Amount
                  </th>
                )}
                {visibleColumns.includes('status') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                )}
                {visibleColumns.includes('actions') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    Loading customer returns...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    No customer returns found
                  </td>
                </tr>
              ) : (
                filteredReturns.map((returnItem) => (
                  <tr key={returnItem.id} className="hover:bg-gray-50">
                    {visibleColumns.includes('returnNumber') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {returnItem.returnNumber}
                      </td>
                    )}
                    {visibleColumns.includes('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(returnItem.returnDate)}
                      </td>
                    )}
                    {visibleColumns.includes('invoice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <Link
                          href={`/dashboard/sales/${returnItem.sale.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {returnItem.sale.invoiceNumber}
                        </Link>
                      </td>
                    )}
                    {visibleColumns.includes('customer') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {returnItem.customer ? (
                          <div>
                            <div className="font-medium">{returnItem.customer.name}</div>
                            {returnItem.customer.mobile && (
                              <div className="text-gray-500 text-xs">{returnItem.customer.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('items') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {returnItem.items.length} {returnItem.items.length === 1 ? 'item' : 'items'}
                      </td>
                    )}
                    {visibleColumns.includes('conditions') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate">
                          {getConditionSummary(returnItem.items)}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('refundAmount') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(returnItem.totalRefundAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(returnItem.status)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/dashboard/customer-returns/${returnItem.id}`}>
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

      {/* Pagination */}
      {!loading && filteredReturns.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <ResultsInfo
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalReturns}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalReturns}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
