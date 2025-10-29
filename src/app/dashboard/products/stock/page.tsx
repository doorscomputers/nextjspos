"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MagnifyingGlassIcon, DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import ColumnVisibilityToggle from '@/components/ColumnVisibilityToggle'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import StockFiltersPanel, { StockFilters } from '@/components/StockFiltersPanel'

interface PivotRow {
  productId: number
  variationId: number
  productName: string
  productSku: string
  productImage: string | null
  variationName: string
  variationSku: string
  category: string
  brand: string
  unit: string
  stockByLocation: Record<number, number>
  totalStock: number
}

export default function AllBranchStockPage() {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [rows, setRows] = useState<PivotRow[]>([])
  const [columnTotals, setColumnTotals] = useState<{ byLocation: Record<number, number>; grandTotal: number }>({
    byLocation: {},
    grandTotal: 0,
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
    category: '',
    brand: '',
    unit: '',
    minTotalStock: '',
    maxTotalStock: '',
    locationFilters: {},
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'product', 'sku', 'variation', 'category', 'brand'
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

  const getActiveFilterCount = () => {
    const {
      locationFilters,
      ...rest
    } = filters

    let count = Object.values(rest).filter((value) => value !== '').length

    Object.values(locationFilters).forEach((range) => {
      if (range.min !== '') count += 1
      if (range.max !== '') count += 1
    })

    return count
  }

  // Ensure location filters stay in sync with locations list
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

      const response = await fetch('/api/products/stock', {
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
          const baseColumns = ['product', 'sku', 'variation', 'category', 'brand']
          const locationColumns = data.locations.map((loc: { id: number }) => `location-${loc.id}`)
          const defaultColumns = [...baseColumns, ...locationColumns, 'total']

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
        grandTotal: data.totals?.grandTotal || 0,
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
  if (qty > 10) return 'bg-green-100 text-green-800'
  if (qty > 0) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

const pageStartIndex = (currentPage - 1) * itemsPerPage
const pageDisplayStart = totalCount === 0 ? 0 : pageStartIndex + 1
const pageDisplayEnd =
  totalCount === 0 ? 0 : Math.min(pageStartIndex + rows.length, totalCount)

const handlePageChange = (page: number) => {
  setCurrentPage(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const displayedRows = rows

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

// Export handlers
const getExportColumns = (locationList: { id: number; name: string }[] = locations): ExportColumn[] => {
  const columns: ExportColumn[] = [
    {
      id: 'product',
      label: 'Product',
      getValue: (row: PivotRow) => row.productName
      },
      {
        id: 'sku',
        label: 'SKU',
        getValue: (row: PivotRow) => row.variationSku
      },
      {
        id: 'variation',
        label: 'Variation',
        getValue: (row: PivotRow) => row.variationName
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
      ]

  // Add location columns
  locationList.forEach(loc => {
    columns.push({
      id: `location-${loc.id}`,
      label: loc.name,
      getValue: (row: PivotRow) => (row.stockByLocation[loc.id] || 0).toString()
    })
    })

    // Add total column
    columns.push({
      id: 'total',
      label: 'Total',
      getValue: (row: PivotRow) => row.totalStock.toString()
    })

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
      filename: 'all-branch-stock',
      columns: getExportColumns(exportData.locationsForExport),
      data: exportData.rows,
      title: 'All Branch Stock',
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
      filename: 'all-branch-stock',
      columns: getExportColumns(exportData.locationsForExport),
      data: exportData.rows,
      title: 'All Branch Stock',
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
      filename: 'all-branch-stock',
      columns: getExportColumns(exportData.locationsForExport),
      data: exportData.rows,
      title: 'All Branch Stock Report',
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
      filename: 'all-branch-stock',
      columns: getExportColumns(exportData.locationsForExport),
      data: exportData.rows,
      title: 'All Branch Stock',
    })
  } catch (error) {
    console.error('Error printing stock data:', error)
    toast.error('Failed to prepare stock data for printing')
  }
}

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">All Branch Stock</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">View stock levels across all business locations</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSimpleFilterChange('search', e.target.value)}
              placeholder="Search by product name, SKU, category, or brand..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <ColumnVisibilityToggle
            columns={[
              { id: 'product', label: 'Product', required: true },
              { id: 'sku', label: 'SKU' },
              { id: 'variation', label: 'Variation' },
              { id: 'category', label: 'Category' },
              { id: 'brand', label: 'Brand' },
                ...locations.map(loc => ({
                id: `location-${loc.id}`,
                label: loc.name
              })),
              { id: 'total', label: 'Total', required: true }
            ]}
            visibleColumns={visibleColumns}
            onToggle={setVisibleColumns}
          />
      </div>

      <StockFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        locations={locations}
        isVisible={showAdvancedFilters}
        onToggleVisibility={() => setShowAdvancedFilters((prev) => !prev)}
        activeFilterCount={getActiveFilterCount()}
      />

      {/* Export buttons and Results info */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700">
          Showing <strong>{pageDisplayStart}</strong> to <strong>{pageDisplayEnd}</strong> of <strong>{totalCount}</strong> products
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export buttons */}
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
          {/* Horizontal scroll hint */}
          {locations.length > 3 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
            Displaying stock across <strong>{locations.length} branches</strong>. Scroll horizontally to view all locations.
            </div>
          )}
          <div className="overflow-auto max-h-[calc(100vh-400px)]" style={{ maxWidth: '100%' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-30 shadow-sm">
                <tr>
                  {visibleColumns.includes('product') && (
                    <SortableTableHead
                      sortKey="productName"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-20 min-w-[200px]"
                    >
                      Product
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('sku') && (
                    <SortableTableHead
                      sortKey="variationSku"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                    >
                      SKU
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('variation') && (
                    <SortableTableHead
                      sortKey="variationName"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[80px]"
                    >
                      Variation
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('category') && (
                    <SortableTableHead
                      sortKey="category"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
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
                    {/* Dynamic location columns */}
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
                  {/* Total column */}
                  {visibleColumns.includes('total') && (
                    <SortableTableHead
                      sortKey="totalStock"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="px-3 py-3 text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 sticky right-0 z-20 min-w-[100px]"
                      align="center"
                    >
                      Total
                    </SortableTableHead>
                  )}
                </tr>
                <tr className="bg-gray-100 dark:bg-gray-700 text-xs">
                  {visibleColumns.includes('product') && (
                    <th className="px-3 py-2 sticky left-0 bg-gray-100 dark:bg-gray-700 z-20">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={filters.productName}
                          onChange={(e) => handleSimpleFilterChange('productName', e.target.value)}
                          placeholder="Filter name"
                          className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        <input
                          type="text"
                          value={filters.productSku}
                          onChange={(e) => handleSimpleFilterChange('productSku', e.target.value)}
                          placeholder="Filter product SKU"
                          className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.includes('sku') && (
                    <th className="px-2 py-2">
                      <input
                        type="text"
                        value={filters.variationSku}
                        onChange={(e) => handleSimpleFilterChange('variationSku', e.target.value)}
                        placeholder="Filter SKU"
                        className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </th>
                  )}
                  {visibleColumns.includes('variation') && (
                    <th className="px-2 py-2">
                      <input
                        type="text"
                        value={filters.variationName}
                        onChange={(e) => handleSimpleFilterChange('variationName', e.target.value)}
                        placeholder="Filter variation"
                        className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </th>
                  )}
                  {visibleColumns.includes('category') && (
                    <th className="px-2 py-2">
                      <input
                        type="text"
                        value={filters.category}
                        onChange={(e) => handleSimpleFilterChange('category', e.target.value)}
                        placeholder="Filter category"
                        className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </th>
                  )}
                  {visibleColumns.includes('brand') && (
                    <th className="px-2 py-2">
                      <input
                        type="text"
                        value={filters.brand}
                        onChange={(e) => handleSimpleFilterChange('brand', e.target.value)}
                        placeholder="Filter brand"
                        className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </th>
                  )}
                    {locations
                    .filter((location) => visibleColumns.includes(`location-${location.id}`))
                    .map((location) => {
                      const locationFilter = filters.locationFilters[location.id.toString()] || { min: '', max: '' }
                      return (
                        <th key={location.id} className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              value={locationFilter.min}
                              onChange={(e) => handleLocationFilterChange(location.id, 'min', e.target.value)}
                              placeholder="Min"
                              className="w-full px-2 py-1 rounded border border-blue-300 dark:border-blue-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                            <input
                              type="number"
                              value={locationFilter.max}
                              onChange={(e) => handleLocationFilterChange(location.id, 'max', e.target.value)}
                              placeholder="Max"
                              className="w-full px-2 py-1 rounded border border-blue-300 dark:border-blue-600 text-xs focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                          </div>
                        </th>
                      )
                    })}
                  {visibleColumns.includes('total') && (
                    <th className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/40 sticky right-0 z-20">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          value={filters.minTotalStock}
                          onChange={(e) => handleSimpleFilterChange('minTotalStock', e.target.value)}
                          placeholder="Min"
                          className="w-full px-2 py-1 rounded border border-indigo-300 dark:border-indigo-600 text-xs focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        <input
                          type="number"
                          value={filters.maxTotalStock}
                          onChange={(e) => handleSimpleFilterChange('maxTotalStock', e.target.value)}
                          placeholder="Max"
                          className="w-full px-2 py-1 rounded border border-indigo-300 dark:border-indigo-600 text-xs focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {totalCount === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No stock data found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayedRows.map((row, index) => (
                      <tr key={`${row.productId}-${row.variationId}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {visibleColumns.includes('product') && (
                          <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
                            <div className="flex items-center">
                              {row.productImage ? (
                                <img
                                  src={row.productImage}
                                  alt={row.productName}
                                  className="h-8 w-8 rounded object-cover mr-2 flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700 mr-2 flex-shrink-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                                  No
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.productName}</div>
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('sku') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.variationSku}
                          </td>
                        )}
                        {visibleColumns.includes('variation') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                            {row.variationName}
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
                          {/* Dynamic location stock cells */}
                        {locations
                          .filter(location => visibleColumns.includes(`location-${location.id}`))
                          .map(location => (
                            <td key={location.id} className="px-3 py-3 whitespace-nowrap text-center bg-blue-50/30 dark:bg-blue-900/20">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockColor(row.stockByLocation[location.id] || 0)}`}
                              >
                                {row.stockByLocation[location.id] || 0}
                              </span>
                            </td>
                          ))
                        }
                        {/* Total cell */}
                        {visibleColumns.includes('total') && (
                          <td className="px-3 py-3 whitespace-nowrap text-center bg-indigo-50 dark:bg-indigo-900/30 sticky right-0 z-10 shadow-sm">
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-900 dark:text-indigo-100">
                              {row.totalStock}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Column totals row */}
                    <tr className="bg-gray-100 dark:bg-gray-700 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                      {visibleColumns.includes('product') && (
                        <td className="px-3 py-4 text-right text-sm text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-100 dark:bg-gray-700 z-10 shadow-sm">
                          <strong>Column Totals:</strong>
                        </td>
                      )}
                      {visibleColumns.includes('sku') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('variation') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('category') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('brand') && <td className="px-2 py-4"></td>}
                        {locations
                        .filter(location => visibleColumns.includes(`location-${location.id}`))
                        .map(location => (
                          <td key={location.id} className="px-3 py-4 text-center text-sm font-bold text-gray-900 dark:text-gray-100 bg-blue-100 dark:bg-blue-900/40">
                            {(columnTotals.byLocation[location.id] || 0).toLocaleString()}
                          </td>
                        ))
                      }
                      {visibleColumns.includes('total') && (
                        <td className="px-3 py-4 text-center text-base font-bold text-indigo-900 dark:text-indigo-100 bg-indigo-200 dark:bg-indigo-800 sticky right-0 z-10 shadow-sm">
                          {columnTotals.grandTotal.toLocaleString()}
                        </td>
                      )}
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
                {/* Previous button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {/* Page numbers */}
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

                {/* Next button */}
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
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
              {columnTotals.grandTotal.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
