"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MagnifyingGlassIcon, DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import ColumnVisibilityToggle from '@/components/ColumnVisibilityToggle'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface PivotRow {
  productId: number
  variationId: number
  productName: string
  productSku: string
  productImage: string | null
  variationName: string
  variationSku: string
  supplier: string
  category: string
  brand: string
  unit: string
  lastDeliveryDate: string | null
  lastQtyDelivered: number
  cost: number
  price: number
  stockByLocation: Record<number, number>
  totalStock: number
  totalCost: number
  totalPrice: number
  isActive: boolean
}

type StockFilters = {
  search: string
  productName: string
  productSku: string
  variationName: string
  variationSku: string
  supplier: string
  category: string
  brand: string
  isActive: string
  locationFilters: Record<string, { min: string; max: string }>
}

export default function BranchStockPivotPage() {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [rows, setRows] = useState<PivotRow[]>([])
  const [columnTotals, setColumnTotals] = useState<{
    byLocation: Record<number, number>
    costByLocation: Record<number, number>
    priceByLocation: Record<number, number>
    grandTotal: number
    grandTotalCost: number
    grandTotalPrice: number
  }>({
    byLocation: {},
    costByLocation: {},
    priceByLocation: {},
    grandTotal: 0,
    grandTotalCost: 0,
    grandTotalPrice: 0,
  })
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortKey, setSortKey] = useState<string>('productName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [filters, setFilters] = useState<StockFilters>({
    search: '',
    productName: '',
    productSku: '',
    variationName: '',
    variationSku: '',
    supplier: '',
    category: '',
    brand: '',
    isActive: 'all',
    locationFilters: {},
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'itemCode', 'itemName', 'supplier', 'category', 'brand', 'lastDeliveryDate',
    'lastQtyDelivered', 'cost', 'price'
  ])

  const handleFiltersChange = (updatedFilters: StockFilters) => {
    setFilters(updatedFilters)
    setCurrentPage(1)
  }

  const handleSimpleFilterChange = (key: keyof StockFilters, value: string) => {
    handleFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  const handleLocationFilterChange = (locationId: number, field: 'min' | 'max', value: string) => {
    const locationKey = locationId.toString()
    const updatedLocationFilters = {
      ...filters.locationFilters,
      [locationKey]: {
        ...(filters.locationFilters[locationKey] || { min: '', max: '' }),
        [field]: value,
      },
    }

    handleFiltersChange({
      ...filters,
      locationFilters: updatedLocationFilters,
    })
  }

  useEffect(() => {
    setFilters((prev) => {
      const locationKeys = locations.map((loc) => loc.id.toString())
      let changed = false
      const updatedLocationFilters: Record<string, { min: string; max: string }> = {}

      locationKeys.forEach((key) => {
        if (prev.locationFilters[key]) {
          updatedLocationFilters[key] = prev.locationFilters[key]
        } else {
          updatedLocationFilters[key] = { min: '', max: '' }
          changed = true
        }
      })

      if (Object.keys(prev.locationFilters).length !== locationKeys.length) {
        changed = true
      }

      if (!changed) {
        return prev
      }

      return {
        ...prev,
        locationFilters: updatedLocationFilters,
      }
    })
  }, [locations])

  const fetchStockData = useCallback(
    async (options?: { page?: number; limit?: number; sortKey?: string; sortDirection?: 'asc' | 'desc'; exportAll?: boolean }) => {
      const isExport = options?.exportAll ?? false
      const payload = {
        page: options?.page ?? currentPage,
        limit: options?.limit ?? itemsPerPage,
        sortKey: options?.sortKey ?? sortKey,
        sortOrder: options?.sortDirection ?? sortDirection,
        filters,
        exportAll: isExport,
      }

      try {
        if (!isExport) {
          setLoading(true)
        }

        const response = await fetch('/api/products/branch-stock-pivot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new Error(errorBody.error || 'Failed to fetch stock data')
        }

        const data = await response.json()

        if (isExport) {
          return data
        }

        const fetchedRows: PivotRow[] = data.rows || []
        setRows(fetchedRows)

        if (Array.isArray(data.locations)) {
          setLocations(data.locations)
          setVisibleColumns((prev) => {
            const baseColumns = ['itemCode', 'itemName', 'supplier', 'category', 'brand', 'lastDeliveryDate', 'lastQtyDelivered', 'cost', 'price']
            const locationColumns = data.locations.map((loc: { id: number }) => `location-${loc.id}`)
            const defaultColumns = [...baseColumns, ...locationColumns, 'totalStocks', 'totalCost', 'totalPrice', 'active']

            const prevLocationColumns = prev.filter((column) => column.startsWith('location-'))
            const hasDifferentLocations =
              prevLocationColumns.length !== locationColumns.length ||
              locationColumns.some((columnId) => !prev.includes(columnId))

            if (prev.length === 0 || hasDifferentLocations) {
              return defaultColumns
            }

            return prev
          })
        }

        setColumnTotals({
          byLocation: data.totals?.byLocation || {},
          costByLocation: data.totals?.costByLocation || {},
          priceByLocation: data.totals?.priceByLocation || {},
          grandTotal: data.totals?.grandTotal || 0,
          grandTotalCost: data.totals?.grandTotalCost || 0,
          grandTotalPrice: data.totals?.grandTotalPrice || 0,
        })

        if (data.pagination) {
          setTotalCount(data.pagination.totalCount || fetchedRows.length)
          setTotalPages(Math.max(1, data.pagination.totalPages || 1))
          if (data.pagination.page && data.pagination.page !== currentPage) {
            setCurrentPage(data.pagination.page)
          }
        } else {
          setTotalCount(fetchedRows.length)
          setTotalPages(1)
        }

        if (data.sorting) {
          if (data.sorting.sortKey && data.sorting.sortKey !== sortKey) {
            setSortKey(data.sorting.sortKey)
          }
          if (data.sorting.sortOrder && data.sorting.sortOrder !== sortDirection) {
            setSortDirection(data.sorting.sortOrder)
          }
        }

        return data
      } catch (error) {
        console.error('Error fetching stock data:', error)
        if (isExport) {
          throw error
        }
        toast.error('Failed to load stock data')
        return null
      } finally {
        if (!isExport) {
          setLoading(false)
        }
      }
    },
    [currentPage, itemsPerPage, sortKey, sortDirection, filters]
  )

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i += 1) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i += 1) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i += 1) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }, [currentPage, totalPages])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(nextDirection)
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const getStockColor = (qty: number) => {
    if (qty > 10) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    if (qty > 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  }

  const pageStartIndex = (currentPage - 1) * itemsPerPage
  const pageDisplayStart = totalCount === 0 ? 0 : pageStartIndex + 1
  const pageDisplayEnd = totalCount === 0 ? 0 : Math.min(pageStartIndex + rows.length, totalCount)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const fetchAllRowsForExport = useCallback(async () => {
    const exportResponse = await fetchStockData({ exportAll: true, page: 1 })

    if (!exportResponse?.rows) {
      return null
    }

    return {
      rows: exportResponse.rows as PivotRow[],
      locationsForExport: exportResponse.locations ?? locations,
    }
  }, [fetchStockData, locations])

  const getExportColumns = (locationList: { id: number; name: string }[] = locations): ExportColumn[] => {
    const columns: ExportColumn[] = [
      {
        id: 'itemCode',
        label: 'Item Code',
        getValue: (row: PivotRow) => row.variationSku
      },
      {
        id: 'itemName',
        label: 'Item Name',
        getValue: (row: PivotRow) => row.productName
      },
      {
        id: 'supplier',
        label: 'Supplier',
        getValue: (row: PivotRow) => row.supplier || '-'
      },
      {
        id: 'category',
        label: 'Category',
        getValue: (row: PivotRow) => row.category || '-'
      },
      {
        id: 'brand',
        label: 'Brand',
        getValue: (row: PivotRow) => row.brand || '-'
      },
      {
        id: 'lastDeliveryDate',
        label: 'Last Delivery Date',
        getValue: (row: PivotRow) => row.lastDeliveryDate || '-'
      },
      {
        id: 'lastQtyDelivered',
        label: 'Last Qty Delivered',
        getValue: (row: PivotRow) => row.lastQtyDelivered.toString()
      },
      {
        id: 'cost',
        label: 'Cost',
        getValue: (row: PivotRow) => row.cost.toFixed(2)
      },
      {
        id: 'price',
        label: 'Price',
        getValue: (row: PivotRow) => row.price.toFixed(2)
      }
    ]

    locationList.forEach(loc => {
      columns.push({
        id: `location-${loc.id}`,
        label: loc.name,
        getValue: (row: PivotRow) => (row.stockByLocation[loc.id] || 0).toString()
      })
    })

    columns.push(
      {
        id: 'totalStocks',
        label: 'Total Stocks',
        getValue: (row: PivotRow) => row.totalStock.toFixed(2)
      },
      {
        id: 'totalCost',
        label: 'Total Cost',
        getValue: (row: PivotRow) => row.totalCost.toFixed(2)
      },
      {
        id: 'totalPrice',
        label: 'Total Price',
        getValue: (row: PivotRow) => row.totalPrice.toFixed(2)
      },
      {
        id: 'active',
        label: 'Active',
        getValue: (row: PivotRow) => row.isActive ? 'TRUE' : 'FALSE'
      }
    )

    return columns
  }

  const handleExportCSV = async () => {
    try {
      const exportData = await fetchAllRowsForExport()
      if (!exportData) {
        toast.error('No stock data available for export')
        return
      }

      exportToCSV({
        filename: 'branch-stock-pivot',
        columns: getExportColumns(exportData.locationsForExport),
        data: exportData.rows,
        title: 'Branch Stock Pivot',
      })
      toast.success('Stock data exported to CSV')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast.error('Failed to export stock data to CSV')
    }
  }

  const handleExportExcel = async () => {
    try {
      const exportData = await fetchAllRowsForExport()
      if (!exportData) {
        toast.error('No stock data available for export')
        return
      }

      exportToExcel({
        filename: 'branch-stock-pivot',
        columns: getExportColumns(exportData.locationsForExport),
        data: exportData.rows,
        title: 'Branch Stock Pivot',
      })
      toast.success('Stock data exported to Excel')
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast.error('Failed to export stock data to Excel')
    }
  }

  const handleExportPDF = async () => {
    try {
      const exportData = await fetchAllRowsForExport()
      if (!exportData) {
        toast.error('No stock data available for export')
        return
      }

      exportToPDF({
        filename: 'branch-stock-pivot',
        columns: getExportColumns(exportData.locationsForExport),
        data: exportData.rows,
        title: 'Branch Stock Pivot Report',
      })
      toast.success('Stock data exported to PDF')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Failed to export stock data to PDF')
    }
  }

  const handlePrint = async () => {
    try {
      const exportData = await fetchAllRowsForExport()
      if (!exportData) {
        toast.error('No stock data available to print')
        return
      }

      printTable({
        filename: 'branch-stock-pivot',
        columns: getExportColumns(exportData.locationsForExport),
        data: exportData.rows,
        title: 'Branch Stock Pivot',
      })
    } catch (error) {
      console.error('Error printing stock data:', error)
      toast.error('Failed to prepare stock data for printing')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Branch Stock Pivot</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Comprehensive stock view across all locations with cost analysis</p>
        </div>
        <Button
          onClick={() => fetchStockData()}
          variant="outline"
          size="sm"
          className="shadow-sm hover:shadow-md transition-all"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleSimpleFilterChange('search', e.target.value)}
            placeholder="Search by product, SKU, supplier, category, or brand..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filters.isActive}
            onChange={(e) => handleSimpleFilterChange('isActive', e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Products</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

          <ColumnVisibilityToggle
            columns={[
              { id: 'itemCode', label: 'Item Code', required: true },
              { id: 'itemName', label: 'Item Name', required: true },
              { id: 'supplier', label: 'Supplier' },
              { id: 'category', label: 'Category' },
              { id: 'brand', label: 'Brand' },
              { id: 'lastDeliveryDate', label: 'Last Delivery Date' },
              { id: 'lastQtyDelivered', label: 'Last Qty Delivered' },
              { id: 'cost', label: 'Cost' },
              { id: 'price', label: 'Price' },
              ...locations.map(loc => ({
                id: `location-${loc.id}`,
                label: loc.name
              })),
              { id: 'totalStocks', label: 'Total Stocks', required: true },
              { id: 'totalCost', label: 'Total Cost' },
              { id: 'totalPrice', label: 'Total Price' },
              { id: 'active', label: 'Active' }
            ]}
            visibleColumns={visibleColumns}
            onToggle={setVisibleColumns}
          />
        </div>
      </div>

      {/* Export buttons and Results info */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700">
          Showing <strong>{pageDisplayStart}</strong> to <strong>{pageDisplayEnd}</strong> of <strong>{totalCount}</strong> products
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all"
            title="Export CSV"
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all"
            title="Export Excel"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all"
            title="Print"
          >
            <PrinterIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>

          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all"
            title="Export PDF"
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-300">Loading stock data...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {locations.length > 3 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
              Displaying stock across <strong>{locations.length} locations</strong>. Scroll horizontally to view all branches.
            </div>
          )}
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {visibleColumns.includes('itemCode') && (
                    <SortableTableHead
                      sortKey="variationSku"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-20 min-w-[150px]"
                    >
                      Item Code
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('itemName') && (
                    <SortableTableHead
                      sortKey="productName"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs uppercase tracking-wider min-w-[200px]"
                    >
                      Item Name
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('supplier') && (
                    <SortableTableHead
                      sortKey="supplier"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[120px]"
                    >
                      Supplier
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('category') && (
                    <SortableTableHead
                      sortKey="category"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[120px]"
                    >
                      Category
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('brand') && (
                    <SortableTableHead
                      sortKey="brand"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                    >
                      Brand
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('lastDeliveryDate') && (
                    <SortableTableHead
                      sortKey="lastDeliveryDate"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[140px]"
                    >
                      Last Delivery Date
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('lastQtyDelivered') && (
                    <SortableTableHead
                      sortKey="lastQtyDelivered"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                      align="right"
                    >
                      Last Qty Delivered
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('cost') && (
                    <SortableTableHead
                      sortKey="cost"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                      align="right"
                    >
                      Cost
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('price') && (
                    <SortableTableHead
                      sortKey="price"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                      align="right"
                    >
                      Price
                    </SortableTableHead>
                  )}
                  {locations
                    .filter(location => visibleColumns.includes(`location-${location.id}`))
                    .map(location => (
                      <SortableTableHead
                        key={location.id}
                        sortKey={`location-${location.id}`}
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="px-3 py-3 text-xs uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 min-w-[110px] whitespace-nowrap"
                        align="center"
                      >
                        {location.name}
                      </SortableTableHead>
                    ))
                  }
                  {visibleColumns.includes('totalStocks') && (
                    <SortableTableHead
                      sortKey="totalStock"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/40 min-w-[110px]"
                      align="center"
                    >
                      Total Stocks
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('totalCost') && (
                    <SortableTableHead
                      sortKey="totalCost"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs font-bold uppercase tracking-wider bg-yellow-100 dark:bg-yellow-900/40 min-w-[120px]"
                      align="right"
                    >
                      Total Cost
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('totalPrice') && (
                    <SortableTableHead
                      sortKey="totalPrice"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 min-w-[120px]"
                      align="right"
                    >
                      Total Price
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('active') && (
                    <th className="px-3 py-3 text-xs uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 sticky right-0 z-20 min-w-[90px] text-center">
                      Active
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {totalCount === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + locations.length} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No stock data found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.map((row, index) => (
                      <tr key={`${row.productId}-${row.variationId}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {visibleColumns.includes('itemCode') && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
                            {row.variationSku}
                          </td>
                        )}
                        {visibleColumns.includes('itemName') && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            <div className="font-medium">{row.productName}</div>
                            {(row.variationName !== 'DUMMY' && row.variationName !== 'Default') && (
                              <div className="text-gray-500 dark:text-gray-400">{row.variationName}</div>
                            )}
                          </td>
                        )}
                        {visibleColumns.includes('supplier') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.supplier || '-'}
                          </td>
                        )}
                        {visibleColumns.includes('category') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.category || '-'}
                          </td>
                        )}
                        {visibleColumns.includes('brand') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.brand || '-'}
                          </td>
                        )}
                        {visibleColumns.includes('lastDeliveryDate') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.lastDeliveryDate ? new Date(row.lastDeliveryDate).toLocaleDateString() : '-'}
                          </td>
                        )}
                        {visibleColumns.includes('lastQtyDelivered') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 text-right">
                            {row.lastQtyDelivered}
                          </td>
                        )}
                        {visibleColumns.includes('cost') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 text-right">
                            ₱{row.cost.toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.includes('price') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 text-right">
                            ₱{row.price.toFixed(2)}
                          </td>
                        )}
                        {locations
                          .filter(location => visibleColumns.includes(`location-${location.id}`))
                          .map(location => (
                            <td key={location.id} className="px-3 py-3 whitespace-nowrap text-center bg-blue-50/30 dark:bg-blue-900/20">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockColor(row.stockByLocation[location.id] || 0)}`}>
                                {row.stockByLocation[location.id] || 0}
                              </span>
                            </td>
                          ))
                        }
                        {visibleColumns.includes('totalStocks') && (
                          <td className="px-3 py-3 whitespace-nowrap text-center bg-green-50 dark:bg-green-900/30">
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100">
                              {row.totalStock.toFixed(2)}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('totalCost') && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-gray-100 text-right bg-yellow-50 dark:bg-yellow-900/30">
                            ₱{row.totalCost.toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.includes('totalPrice') && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-gray-100 text-right bg-indigo-50 dark:bg-indigo-900/30">
                            ₱{row.totalPrice.toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.includes('active') && (
                          <td className="px-3 py-3 whitespace-nowrap text-center sticky right-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${row.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {row.isActive ? 'TRUE' : 'FALSE'}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Column totals row */}
                    <tr className="bg-gray-100 dark:bg-gray-700 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                      {visibleColumns.includes('itemCode') && (
                        <td className="px-3 py-4 text-right text-sm text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-100 dark:bg-gray-700 z-10 shadow-sm" colSpan={visibleColumns.includes('itemName') ? 2 : 1}>
                          <strong>Column Totals:</strong>
                        </td>
                      )}
                      {!visibleColumns.includes('itemCode') && visibleColumns.includes('itemName') && (
                        <td className="px-3 py-4 text-right text-sm text-gray-700 dark:text-gray-200">
                          <strong>Column Totals:</strong>
                        </td>
                      )}
                      {visibleColumns.includes('supplier') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('category') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('brand') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('lastDeliveryDate') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('lastQtyDelivered') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('cost') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('price') && <td className="px-2 py-4"></td>}
                      {locations
                        .filter(location => visibleColumns.includes(`location-${location.id}`))
                        .map(location => (
                          <td key={location.id} className="px-3 py-4 text-center text-sm font-bold text-gray-900 dark:text-gray-100 bg-blue-100 dark:bg-blue-900/40">
                            {(columnTotals.byLocation[location.id] || 0).toLocaleString()}
                          </td>
                        ))
                      }
                      {visibleColumns.includes('totalStocks') && (
                        <td className="px-3 py-4 text-center text-base font-bold text-green-900 dark:text-green-100 bg-green-200 dark:bg-green-800">
                          {columnTotals.grandTotal.toLocaleString()}
                        </td>
                      )}
                      {visibleColumns.includes('totalCost') && (
                        <td className="px-3 py-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100 bg-yellow-100 dark:bg-yellow-900/40">
                          ₱{columnTotals.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.includes('totalPrice') && (
                        <td className="px-3 py-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40">
                          ₱{columnTotals.grandTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.includes('active') && <td className="px-3 py-4 sticky right-0 bg-gray-100 dark:bg-gray-700 z-10 shadow-sm"></td>}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {pageNumbers.map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500 dark:text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stock Summary */}
      {!loading && totalCount > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Products</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {totalCount.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Locations</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {locations.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Grand Total Stock</h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
              {columnTotals.grandTotal.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Inventory Value</h3>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
              ₱{columnTotals.grandTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
