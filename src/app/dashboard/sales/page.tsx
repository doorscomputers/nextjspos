"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  status: string
  notes: string | null
  createdAt: string
  customer: {
    id: number
    name: string
    mobile: string | null
  } | null
  items: {
    id: number
    quantity: number
    unitPrice: number
    serialNumbers: any
  }[]
  payments: {
    id: number
    paymentMethod: string
    amount: number
  }[]
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'invoice', label: 'Invoice #' },
  { id: 'date', label: 'Sale Date' },
  { id: 'customer', label: 'Customer' },
  { id: 'items', label: 'Items' },
  { id: 'subtotal', label: 'Subtotal' },
  { id: 'tax', label: 'Tax' },
  { id: 'discount', label: 'Discount' },
  { id: 'total', label: 'Total' },
  { id: 'payment', label: 'Payment' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
]

export default function SalesPage() {
  const { can } = usePermissions()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalSales, setTotalSales] = useState(0)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'invoice', 'date', 'customer', 'items', 'total', 'payment', 'status', 'actions'
  ])

  useEffect(() => {
    fetchSales()
  }, [statusFilter, currentPage, itemsPerPage])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const fetchSales = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/sales?${params}`)
      const data = await response.json()

      if (response.ok) {
        setSales(data.sales || [])
        setTotalSales(data.total || 0)
      } else {
        toast.error(data.error || 'Failed to fetch sales')
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast.error('Failed to fetch sales')
    } finally {
      setLoading(false)
    }
  }

  const handleVoidSale = async (saleId: number, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to void sale ${invoiceNumber}? Stock will be restored.`)) {
      return
    }

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Sale voided successfully')
        fetchSales()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to void sale')
      }
    } catch (error) {
      console.error('Error voiding sale:', error)
      toast.error('Failed to void sale')
    }
  }

  // Filter sales by search term
  const filteredSales = sales.filter(sale => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      sale.invoiceNumber.toLowerCase().includes(searchLower) ||
      sale.customer?.name.toLowerCase().includes(searchLower) ||
      sale.customer?.mobile?.toLowerCase().includes(searchLower)
    )
  })

  // Add sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredSales, { key: 'id', direction: 'desc' })

  // Export functions (use sortedData for exports)
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Invoice #', key: 'invoiceNumber' },
      { header: 'Date', key: 'saleDate' },
      { header: 'Customer', key: 'customer', formatter: (val: any) => val?.name || 'Walk-in Customer' },
      { header: 'Items', key: 'items', formatter: (val: any[]) => val.length.toString() },
      { header: 'Subtotal', key: 'subtotal', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Tax', key: 'taxAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Discount', key: 'discountAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Total', key: 'totalAmount', formatter: (val: number) => `$${val.toFixed(2)}` },
      { header: 'Status', key: 'status' },
    ]

    const filename = `sales_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(sortedData, columns, filename)
        break
      case 'excel':
        exportToExcel(sortedData, columns, filename)
        break
      case 'pdf':
        exportToPDF(sortedData, columns, filename, 'Sales Report')
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
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'completed': 'default',
      'pending': 'secondary',
      'voided': 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'cash': 'Cash',
      'card': 'Card',
      'bank_transfer': 'Bank Transfer',
      'cheque': 'Cheque',
      'other': 'Other',
    }
    return labels[method] || method
  }

  if (!can(PERMISSIONS.SELL_VIEW) && !can(PERMISSIONS.SELL_VIEW_OWN)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view sales.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales</h1>
          <p className="text-gray-500 mt-1">Manage your sales transactions</p>
        </div>
        {can(PERMISSIONS.SELL_CREATE) && (
          <Link href="/dashboard/sales/create">
            <Button>
              <PlusIcon className="w-5 h-5 mr-2" />
              New Sale
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice, customer name, or mobile..."
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
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
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
                {visibleColumns.includes('date') && (
                  <SortableTableHead
                    sortKey="saleDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('customer') && (
                  <SortableTableHead
                    sortKey="customer.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Customer
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
                {visibleColumns.includes('subtotal') && (
                  <SortableTableHead
                    sortKey="subtotal"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Subtotal
                  </SortableTableHead>
                )}
                {visibleColumns.includes('tax') && (
                  <SortableTableHead
                    sortKey="taxAmount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Tax
                  </SortableTableHead>
                )}
                {visibleColumns.includes('discount') && (
                  <SortableTableHead
                    sortKey="discountAmount"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Discount
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
                {visibleColumns.includes('payment') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Payment
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
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    Loading sales...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                    No sales found
                  </td>
                </tr>
              ) : (
                sortedData.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    {visibleColumns.includes('invoice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sale.invoiceNumber}
                      </td>
                    )}
                    {visibleColumns.includes('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(sale.saleDate)}
                      </td>
                    )}
                    {visibleColumns.includes('customer') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.customer ? (
                          <div>
                            <div className="font-medium">{sale.customer.name}</div>
                            {sale.customer.mobile && (
                              <div className="text-gray-500 text-xs">{sale.customer.mobile}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">Walk-in Customer</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('items') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.items.length} {sale.items.length === 1 ? 'item' : 'items'}
                      </td>
                    )}
                    {visibleColumns.includes('subtotal') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(sale.subtotal)}
                      </td>
                    )}
                    {visibleColumns.includes('tax') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(sale.taxAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('discount') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(sale.discountAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('total') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(sale.totalAmount)}
                      </td>
                    )}
                    {visibleColumns.includes('payment') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.payments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {sale.payments.map((payment) => (
                              <div key={payment.id} className="text-xs">
                                {getPaymentMethodLabel(payment.paymentMethod)}: {formatCurrency(payment.amount)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No payment</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(sale.status)}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/sales/${sale.id}`}>
                            <Button variant="ghost" size="sm">
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                          </Link>
                          {can(PERMISSIONS.SELL_DELETE) && sale.status !== 'voided' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVoidSale(sale.id, sale.invoiceNumber)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
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
      {!loading && sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <ResultsInfo
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalSales}
          />
          <div className="flex items-center gap-4">
            <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
            <Pagination
              currentPage={currentPage}
              totalItems={totalSales}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
