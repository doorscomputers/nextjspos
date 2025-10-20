"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'
import { exportToCSV, exportToExcel, exportToPDF, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  fromLocationName?: string
  toLocationName?: string
  status: string
  stockDeducted: boolean
  notes: string | null
  createdAt: string
  items: {
    id: number
    quantity: number
  }[]
}

const AVAILABLE_COLUMNS: Column[] = [
  { id: 'transferNumber', label: 'Transfer #' },
  { id: 'date', label: 'Transfer Date' },
  { id: 'from', label: 'From Location' },
  { id: 'to', label: 'To Location' },
  { id: 'items', label: 'Items' },
  { id: 'status', label: 'Status' },
  { id: 'stockDeducted', label: 'Stock Status' },
  { id: 'actions', label: 'Actions' },
]

export default function TransfersPage() {
  const { can } = usePermissions()
  const router = useRouter()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromLocationFilter, setFromLocationFilter] = useState<string>('all')
  const [toLocationFilter, setToLocationFilter] = useState<string>('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalTransfers, setTotalTransfers] = useState(0)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'transferNumber', 'date', 'from', 'to', 'items', 'status', 'actions'
  ])

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchTransfers()
  }, [statusFilter, fromLocationFilter, toLocationFilter, currentPage, itemsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, fromLocationFilter, toLocationFilter])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchTransfers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (fromLocationFilter && fromLocationFilter !== 'all') {
        params.append('fromLocationId', fromLocationFilter)
      }

      if (toLocationFilter && toLocationFilter !== 'all') {
        params.append('toLocationId', toLocationFilter)
      }

      const response = await fetch(`/api/transfers?${params}`)
      const data = await response.json()

      if (response.ok) {
        setTransfers(data.transfers || [])
        setTotalTransfers(data.pagination?.total || 0)
      } else {
        toast.error(data.error || 'Failed to fetch transfers')
      }
    } catch (error) {
      console.error('Error fetching transfers:', error)
      toast.error('Failed to fetch transfers')
    } finally {
      setLoading(false)
    }
  }

  // Filter transfers by search term
  const filteredTransfers = transfers.filter(transfer => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      transfer.transferNumber.toLowerCase().includes(searchLower) ||
      transfer.notes?.toLowerCase().includes(searchLower)
    )
  })

  // Add sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredTransfers, { key: 'id', direction: 'desc' })

  // Export functions
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'Transfer #', key: 'transferNumber' },
      { header: 'Date', key: 'transferDate' },
      { header: 'From Location ID', key: 'fromLocationId' },
      { header: 'To Location ID', key: 'toLocationId' },
      { header: 'Items', key: 'items', formatter: (val: any[]) => val.length.toString() },
      { header: 'Status', key: 'status' },
      { header: 'Stock Deducted', key: 'stockDeducted', formatter: (val: boolean) => val ? 'Yes' : 'No' },
    ]

    const filename = `transfers_${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'csv':
        exportToCSV(sortedData, columns, filename)
        break
      case 'excel':
        exportToExcel(sortedData, columns, filename)
        break
      case 'pdf':
        exportToPDF(sortedData, columns, filename, 'Stock Transfers Report')
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

  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId)
    return location?.name || `Location ${locationId}`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bgColor: string, textColor: string, label: string } } = {
      'draft': {
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        label: 'Draft'
      },
      'pending_check': {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        label: 'Pending Check'
      },
      'checked': {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        label: 'Checked'
      },
      'in_transit': {
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        label: 'In Transit'
      },
      'arrived': {
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-800',
        label: 'Arrived'
      },
      'verifying': {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        label: 'Verifying'
      },
      'verified': {
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-800',
        label: 'Verified'
      },
      'completed': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        label: 'Completed'
      },
      'cancelled': {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        label: 'Cancelled'
      },
    }

    const config = statusConfig[status] || {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      label: status
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
        {config.label}
      </span>
    )
  }

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view stock transfers.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Stock Transfers</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage stock transfers between locations</p>
        </div>
        {can(PERMISSIONS.STOCK_TRANSFER_CREATE) && (
          <Link href="/dashboard/transfers/create">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Transfer
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by transfer number or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_check">Pending Check</SelectItem>
              <SelectItem value="checked">Checked</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="arrived">Arrived</SelectItem>
              <SelectItem value="verifying">Verifying</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={fetchTransfers}
            disabled={loading}
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={fromLocationFilter} onValueChange={setFromLocationFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="From Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={toLocationFilter} onValueChange={setToLocationFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="To Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ColumnVisibilityToggle
            columns={AVAILABLE_COLUMNS}
            visibleColumns={visibleColumns}
            onChange={setVisibleColumns}
          />
          <div className="flex items-center gap-2 border-l pl-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
              <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>

        <ItemsPerPage value={itemsPerPage} onChange={setItemsPerPage} />
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.includes('transferNumber') && (
                  <SortableTableHead
                    sortKey="transferNumber"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Transfer #
                  </SortableTableHead>
                )}
                {visibleColumns.includes('date') && (
                  <SortableTableHead
                    sortKey="transferDate"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Date
                  </SortableTableHead>
                )}
                {visibleColumns.includes('from') && (
                  <SortableTableHead
                    sortKey="fromLocationId"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    From
                  </SortableTableHead>
                )}
                {visibleColumns.includes('to') && (
                  <SortableTableHead
                    sortKey="toLocationId"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    To
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
                {visibleColumns.includes('stockDeducted') && (
                  <SortableTableHead
                    sortKey="stockDeducted"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                  >
                    Stock
                  </SortableTableHead>
                )}
                {visibleColumns.includes('actions') && (
                  <SortableTableHead
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider"
                    align="right"
                  >
                    Actions
                  </SortableTableHead>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-500">Loading transfers...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No transfers found
                  </td>
                </tr>
              ) : (
                sortedData.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    {visibleColumns.includes('transferNumber') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transfer.transferNumber}
                      </td>
                    )}
                    {visibleColumns.includes('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(transfer.transferDate)}
                      </td>
                    )}
                    {visibleColumns.includes('from') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transfer.fromLocationName || getLocationName(transfer.fromLocationId)}
                      </td>
                    )}
                    {visibleColumns.includes('to') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transfer.toLocationName || getLocationName(transfer.toLocationId)}
                      </td>
                    )}
                    {visibleColumns.includes('items') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transfer.items.length} item(s)
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(transfer.status)}
                      </td>
                    )}
                    {visibleColumns.includes('stockDeducted') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transfer.stockDeducted ? (
                          <Badge variant="default">Deducted</Badge>
                        ) : (
                          <Badge variant="secondary">Not Deducted</Badge>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/dashboard/transfers/${transfer.id}`}>
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
      </div>

      {/* Pagination */}
      {!loading && sortedData.length > 0 && (
        <div className="flex items-center justify-between">
          <ResultsInfo
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalTransfers}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalTransfers / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
