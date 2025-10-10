"use client"

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface StockItem {
  productId: number
  productName: string
  productSku: string
  productImage: string | null
  variationId: number
  variationName: string
  variationSku: string
  locationId: number
  locationName: string
  qtyAvailable: number
  unit: string
  category: string
  brand: string
  sellingPrice: number
}

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
  sellingPrice: number
  stockByLocation: Record<number, number>
  totalStock: number
}

export default function AllBranchStockPage() {
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'product', 'sku', 'variation', 'category', 'brand', 'sellingPrice'
  ])

  useEffect(() => {
    fetchStockData()
  }, [])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const fetchStockData = async () => {
    try {
      const response = await fetch('/api/products/stock')
      const data = await response.json()
      if (response.ok) {
        const stock = data.stock || []
        setStockData(stock)

        // Extract ALL unique locations from stock data
        const uniqueLocations = Array.from(
          new Map(
            stock.map((item: StockItem) => [
              item.locationId,
              { id: item.locationId, name: item.locationName }
            ])
          ).values()
        ).sort((a, b) => a.name.localeCompare(b.name))

        setLocations(uniqueLocations)

        // Initialize visible columns to include all locations
        setVisibleColumns(prev => {
          const locationCols = uniqueLocations.map(loc => `location-${loc.id}`)
          return ['product', 'sku', 'variation', 'category', 'brand', 'sellingPrice', ...locationCols, 'total']
        })
      }
    } catch (error) {
      console.error('Error fetching stock data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Pivot data: Group by product and show locations as columns
  const pivotData = (): PivotRow[] => {
    const grouped = new Map<string, PivotRow>()

    stockData.forEach(item => {
      const key = `${item.productId}-${item.variationId}`

      if (!grouped.has(key)) {
        grouped.set(key, {
          productId: item.productId,
          variationId: item.variationId,
          productName: item.productName,
          productSku: item.productSku,
          productImage: item.productImage,
          variationName: item.variationName,
          variationSku: item.variationSku,
          category: item.category,
          brand: item.brand,
          unit: item.unit,
          sellingPrice: item.sellingPrice,
          stockByLocation: {},
          totalStock: 0
        })
      }

      const row = grouped.get(key)!
      row.stockByLocation[item.locationId] = item.qtyAvailable
      row.totalStock += item.qtyAvailable
    })

    return Array.from(grouped.values())
  }

  const pivotedData = pivotData()

  // Filter pivoted data
  const filteredData = pivotedData.filter(row => {
    const matchesSearch =
      row.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.variationSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.brand.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  // Add sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredData, { key: 'productName', direction: 'asc' })

  // Calculate column totals (use sortedData for totals)
  const columnTotals = {
    byLocation: {} as Record<number, number>,
    grandTotal: 0
  }

  sortedData.forEach(row => {
    locations.forEach(loc => {
      const qty = row.stockByLocation[loc.id] || 0
      columnTotals.byLocation[loc.id] = (columnTotals.byLocation[loc.id] || 0) + qty
    })
    columnTotals.grandTotal += row.totalStock
  })

  const getStockColor = (qty: number) => {
    if (qty > 10) return 'bg-green-100 text-green-800'
    if (qty > 0) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  // Pagination logic (use sortedData instead of filteredData)
  const totalItems = sortedData.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 7

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Export handlers
  const getExportColumns = (): ExportColumn[] => {
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
      {
        id: 'sellingPrice',
        label: 'Selling Price',
        getValue: (row: PivotRow) => row.sellingPrice.toFixed(2)
      }
    ]

    // Add location columns
    locations.forEach(loc => {
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

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'all-branch-stock',
      columns: getExportColumns(),
      data: sortedData,
      title: 'All Branch Stock'
    })
    toast.success('Stock data exported to CSV')
  }

  const handleExportExcel = () => {
    exportToExcel({
      filename: 'all-branch-stock',
      columns: getExportColumns(),
      data: sortedData,
      title: 'All Branch Stock'
    })
    toast.success('Stock data exported to Excel')
  }

  const handleExportPDF = () => {
    exportToPDF({
      filename: 'all-branch-stock',
      columns: getExportColumns(),
      data: sortedData,
      title: 'All Branch Stock Report'
    })
    toast.success('Stock data exported to PDF')
  }

  const handlePrint = () => {
    printTable({
      filename: 'all-branch-stock',
      columns: getExportColumns(),
      data: sortedData,
      title: 'All Branch Stock'
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">All Branch Stock</h1>
        <p className="text-gray-600 mt-1">View stock levels across all business locations</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name, SKU, category, or brand..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          />
        </div>

        <ColumnVisibilityToggle
          columns={[
            { id: 'product', label: 'Product', required: true },
            { id: 'sku', label: 'SKU' },
            { id: 'variation', label: 'Variation' },
            { id: 'category', label: 'Category' },
            { id: 'brand', label: 'Brand' },
            { id: 'sellingPrice', label: 'Selling Price' },
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

      {/* Export buttons and Results info */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-300">
          Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, totalItems)}</strong> of <strong>{totalItems}</strong> products
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export buttons */}
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all hover:border-blue-300"
            title="Export CSV"
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all hover:border-green-300"
            title="Export Excel"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all hover:border-purple-300"
            title="Print"
          >
            <PrinterIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>

          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all hover:border-red-300"
            title="Export PDF"
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
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
        <div className="text-center py-12">Loading stock data...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Horizontal scroll hint */}
          {locations.length > 3 && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
              📊 <strong>{locations.length} branches</strong> - Scroll horizontally to view all locations →
            </div>
          )}
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.includes('product') && (
                    <SortableTableHead
                      sortKey="productName"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-3 py-3 text-xs uppercase tracking-wider sticky left-0 bg-gray-50 z-20 min-w-[200px]"
                    >
                      Product
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('sku') && (
                    <SortableTableHead
                      sortKey="variationSku"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                    >
                      SKU
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('variation') && (
                    <SortableTableHead
                      sortKey="variationName"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[80px]"
                    >
                      Variation
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('category') && (
                    <SortableTableHead
                      sortKey="category"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                    >
                      Category
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('brand') && (
                    <SortableTableHead
                      sortKey="brand"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[100px]"
                    >
                      Brand
                    </SortableTableHead>
                  )}
                  {visibleColumns.includes('sellingPrice') && (
                    <SortableTableHead
                      sortKey="sellingPrice"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-2 py-3 text-xs uppercase tracking-wider min-w-[120px]"
                      align="right"
                    >
                      Selling Price
                    </SortableTableHead>
                  )}
                  {/* Dynamic location columns */}
                  {locations
                    .filter(location => visibleColumns.includes(`location-${location.id}`))
                    .map(location => (
                      <SortableTableHead
                        key={location.id}
                        sortKey={`stockByLocation.${location.id}`}
                        currentSortKey={sortConfig?.key as string}
                        currentSortDirection={sortConfig?.direction}
                        onSort={requestSort}
                        className="px-3 py-3 text-xs uppercase tracking-wider bg-blue-50 min-w-[110px] whitespace-nowrap"
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
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="px-3 py-3 text-xs font-bold uppercase tracking-wider bg-indigo-100 sticky right-0 z-20 min-w-[100px]"
                      align="center"
                    >
                      Total
                    </SortableTableHead>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                      No stock data found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedData.map((row, index) => (
                      <tr key={`${row.productId}-${row.variationId}-${index}`} className="hover:bg-gray-50">
                        {visibleColumns.includes('product') && (
                          <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white z-10 shadow-sm">
                            <div className="flex items-center">
                              {row.productImage ? (
                                <img
                                  src={row.productImage}
                                  alt={row.productName}
                                  className="h-8 w-8 rounded object-cover mr-2 flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-gray-200 mr-2 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                                  No
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{row.productName}</div>
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('sku') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900">
                            {row.variationSku}
                          </td>
                        )}
                        {visibleColumns.includes('variation') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900">
                            {row.variationName}
                          </td>
                        )}
                        {visibleColumns.includes('category') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900">
                            {row.category || '-'}
                          </td>
                        )}
                        {visibleColumns.includes('brand') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900">
                            {row.brand || '-'}
                          </td>
                        )}
                        {visibleColumns.includes('sellingPrice') && (
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-900 text-right">
                            {row.sellingPrice.toFixed(2)}
                          </td>
                        )}
                        {/* Dynamic location stock cells */}
                        {locations
                          .filter(location => visibleColumns.includes(`location-${location.id}`))
                          .map(location => (
                            <td key={location.id} className="px-3 py-3 whitespace-nowrap text-center bg-blue-50/30">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockColor(row.stockByLocation[location.id] || 0)}`}>
                                {row.stockByLocation[location.id] || 0}
                              </span>
                            </td>
                          ))
                        }
                        {/* Total cell */}
                        {visibleColumns.includes('total') && (
                          <td className="px-3 py-3 whitespace-nowrap text-center bg-indigo-50 sticky right-0 z-10 shadow-sm">
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full bg-indigo-200 text-indigo-900">
                              {row.totalStock}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Column totals row */}
                    <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                      {visibleColumns.includes('product') && (
                        <td className="px-3 py-4 text-right text-sm text-gray-700 sticky left-0 bg-gray-100 z-10 shadow-sm">
                          <strong>Column Totals:</strong>
                        </td>
                      )}
                      {visibleColumns.includes('sku') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('variation') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('category') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('brand') && <td className="px-2 py-4"></td>}
                      {visibleColumns.includes('sellingPrice') && <td className="px-2 py-4"></td>}
                      {locations
                        .filter(location => visibleColumns.includes(`location-${location.id}`))
                        .map(location => (
                          <td key={location.id} className="px-3 py-4 text-center text-sm font-bold text-gray-900 bg-blue-100">
                            {(columnTotals.byLocation[location.id] || 0).toLocaleString()}
                          </td>
                        ))
                      }
                      {visibleColumns.includes('total') && (
                        <td className="px-3 py-4 text-center text-base font-bold text-indigo-900 bg-indigo-200 sticky right-0 z-10 shadow-sm">
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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                {/* Previous button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
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
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stock Summary */}
      {!loading && filteredData.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {filteredData.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Locations</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {locations.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Grand Total Stock</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {columnTotals.grandTotal}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
