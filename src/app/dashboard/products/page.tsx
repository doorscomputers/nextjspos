"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import ProductActionsDropdown from '@/components/ProductActionsDropdown'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import ColumnVisibilityToggle, { Column } from '@/components/ColumnVisibilityToggle'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { AddToLocationModal, RemoveFromLocationModal } from '@/components/BulkLocationModals'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface Product {
  id: number
  name: string
  type: string
  sku: string
  purchasePrice: number | null
  sellingPrice: number | null
  image: string | null
  enableStock: boolean
  alertQuantity: number | null
  isActive: boolean
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  unit: { id: number; name: string; shortName: string } | null
  tax: { id: number; name: string; amount: number } | null
  variations: ProductVariation[]
  createdAt: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  purchasePrice: number
  sellingPrice: number
  variationLocationDetails: VariationLocationDetail[]
}

interface VariationLocationDetail {
  id: number
  qtyAvailable: number
}

interface BusinessLocation {
  id: number
  name: string
}

export default function ProductsPage() {
  const { can } = usePermissions()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all') // all, active, inactive

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Column visibility state - Actions is now second (right after Product)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'product', 'actions', 'sku', 'status', 'category', 'brand', 'unit', 'purchasePrice', 'sellingPrice', 'type', 'tax'
  ])

  // Bulk action state
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [modalLocationName, setModalLocationName] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchLocations()
  }, [activeFilter])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, activeFilter])

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

  const fetchProducts = async () => {
    setLoading(true)
    try {
      let url = '/api/products'
      if (activeFilter === 'active') {
        url += '?active=true'
      } else if (activeFilter === 'inactive') {
        url += '?active=false'
      }

      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleProductActive = async (productId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/products/${productId}/toggle-active`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        // Update local state
        setProducts(products.map(p =>
          p.id === productId ? { ...p, isActive: data.isActive } : p
        ))
      } else {
        toast.error(data.error || 'Failed to toggle product status')
      }
    } catch (error) {
      console.error('Error toggling product status:', error)
      toast.error('Failed to toggle product status')
    }
  }

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(paginatedProducts.map(p => p.id))
    } else {
      setSelectedProductIds([])
    }
  }

  const handleSelectProduct = (productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProductIds([...selectedProductIds, productId])
    } else {
      setSelectedProductIds(selectedProductIds.filter(id => id !== productId))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedProductIds.length} product(s)?`)) {
      return
    }

    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setSelectedProductIds([])
        fetchProducts()
      } else {
        toast.error(data.error || 'Failed to delete products')
      }
    } catch (error) {
      console.error('Error deleting products:', error)
      toast.error('Failed to delete products')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkActivate = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/products/bulk-toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds, isActive: true })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setSelectedProductIds([])
        fetchProducts()
      } else {
        toast.error(data.error || 'Failed to activate products')
      }
    } catch (error) {
      console.error('Error activating products:', error)
      toast.error('Failed to activate products')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/products/bulk-toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds, isActive: false })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setSelectedProductIds([])
        fetchProducts()
      } else {
        toast.error(data.error || 'Failed to deactivate products')
      }
    } catch (error) {
      console.error('Error deactivating products:', error)
      toast.error('Failed to deactivate products')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkAddToLocation = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (!selectedLocationId) {
      toast.error('Please select a location')
      return
    }

    setBulkActionLoading(true)
    try {
      // First, check if products already exist at location
      const checkResponse = await fetch('/api/products/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds, locationId: selectedLocationId })
      })

      const checkData = await checkResponse.json()

      if (!checkResponse.ok) {
        toast.error(checkData.error || 'Failed to check products at location')
        setBulkActionLoading(false)
        return
      }

      // If all products already exist, show error
      if (!checkData.canProceed) {
        toast.error('All selected products already exist at this location')
        setBulkActionLoading(false)
        return
      }

      // Show information about existing products
      if (checkData.existingCount > 0) {
        toast.info(checkData.message)
      }

      // Set location name and show confirmation modal
      setModalLocationName(checkData.locationName)
      setShowAddModal(true)
      setBulkActionLoading(false)
    } catch (error) {
      console.error('Error checking products at location:', error)
      toast.error('Failed to check products at location')
      setBulkActionLoading(false)
    }
  }

  const confirmAddToLocation = async () => {
    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/products/bulk-add-to-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds, locationId: selectedLocationId })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setSelectedProductIds([])
        setSelectedLocationId(null)
        setShowAddModal(false)
      } else {
        toast.error(data.error || 'Failed to add products to location')
      }
    } catch (error) {
      console.error('Error adding products to location:', error)
      toast.error('Failed to add products to location')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkRemoveFromLocation = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (!selectedLocationId) {
      toast.error('Please select a location')
      return
    }

    // Find location name
    const location = locations.find(loc => loc.id === selectedLocationId)
    if (!location) {
      toast.error('Location not found')
      return
    }

    // Show password verification modal
    setModalLocationName(location.name)
    setShowRemoveModal(true)
  }

  const confirmRemoveFromLocation = async (password: string) => {
    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/products/bulk-remove-from-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProductIds,
          locationId: selectedLocationId,
          password
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setSelectedProductIds([])
        setSelectedLocationId(null)
        setShowRemoveModal(false)
      } else {
        // Show specific error message from API
        const errorMessage = data.error || 'Failed to remove products from location'
        toast.error(errorMessage)
        console.error('API Error:', { status: response.status, error: data })
      }
    } catch (error) {
      console.error('Error removing products from location:', error)
      toast.error(`Network error: ${error instanceof Error ? error.message : 'Failed to remove products from location'}`)
    } finally {
      setBulkActionLoading(false)
    }
  }


  const getTotalStock = (product: Product) => {
    if (!product.enableStock) return 'N/A'
    if (product.type === 'variable') {
      return product.variations.reduce((total, variation) => {
        const varStock = variation.variationLocationDetails.reduce((sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()), 0)
        return total + varStock
      }, 0).toFixed(2)
    }
    return '0.00'
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Apply sorting to filtered products
  const { sortedData, sortConfig, requestSort } = useTableSort<Product>(filteredProducts, { key: 'name', direction: 'asc' })

  // Pagination logic
  const totalItems = sortedData.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = sortedData.slice(startIndex, endIndex)

  // Define available columns for visibility toggle - Actions is second
  const availableColumns: Column[] = [
    { id: 'product', label: 'Product', required: true },
    { id: 'actions', label: 'Actions', required: true },
    { id: 'sku', label: 'SKU' },
    { id: 'status', label: 'Status' },
    { id: 'category', label: 'Category' },
    { id: 'brand', label: 'Brand' },
    { id: 'unit', label: 'Unit' },
    ...(can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) ? [{ id: 'purchasePrice', label: 'Purchase Price' }] : []),
    { id: 'sellingPrice', label: 'Selling Price' },
    { id: 'type', label: 'Type' },
    { id: 'tax', label: 'Tax' }
  ]

  // Export handlers - respecting visible columns
  const getExportColumns = (): ExportColumn[] => {
    const columnMap: Record<string, ExportColumn> = {
      product: {
        id: 'product',
        label: 'Product',
        getValue: (p: Product) => p.name
      },
      sku: {
        id: 'sku',
        label: 'SKU',
        getValue: (p: Product) => p.sku
      },
      status: {
        id: 'status',
        label: 'Status',
        getValue: (p: Product) => p.isActive ? 'Active' : 'Inactive'
      },
      category: {
        id: 'category',
        label: 'Category',
        getValue: (p: Product) => p.category?.name || '-'
      },
      brand: {
        id: 'brand',
        label: 'Brand',
        getValue: (p: Product) => p.brand?.name || '-'
      },
      unit: {
        id: 'unit',
        label: 'Unit',
        getValue: (p: Product) => p.unit?.shortName || '-'
      },
      purchasePrice: {
        id: 'purchasePrice',
        label: 'Purchase Price',
        getValue: (p: Product) => p.purchasePrice ? Number(p.purchasePrice).toFixed(2) : '0.00'
      },
      sellingPrice: {
        id: 'sellingPrice',
        label: 'Selling Price',
        getValue: (p: Product) => p.sellingPrice ? Number(p.sellingPrice).toFixed(2) : '0.00'
      },
      stock: {
        id: 'stock',
        label: 'Stock',
        getValue: (p: Product) => getTotalStock(p)
      },
      type: {
        id: 'type',
        label: 'Type',
        getValue: (p: Product) => p.type
      },
      tax: {
        id: 'tax',
        label: 'Tax',
        getValue: (p: Product) => p.tax ? `${p.tax.name} (${p.tax.amount}%)` : '-'
      }
    }

    // Return only visible columns in order, excluding 'actions'
    return visibleColumns
      .filter(colId => colId !== 'actions' && columnMap[colId])
      .map(colId => columnMap[colId])
  }

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'products',
      columns: getExportColumns(),
      data: filteredProducts,
      title: 'Products'
    })
    toast.success('Products exported to CSV')
  }

  const handleExportExcel = () => {
    exportToExcel({
      filename: 'products',
      columns: getExportColumns(),
      data: filteredProducts,
      title: 'Products'
    })
    toast.success('Products exported to Excel')
  }

  const handleExportPDF = () => {
    exportToPDF({
      filename: 'products',
      columns: getExportColumns(),
      data: filteredProducts,
      title: 'Products Export'
    })
    toast.success('Products exported to PDF')
  }

  const handlePrint = () => {
    printTable({
      filename: 'products',
      columns: getExportColumns(),
      data: filteredProducts,
      title: 'Products'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Header Section with Gradient */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
              Products
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">Manage your inventory with ease</p>
          </div>
          {can(PERMISSIONS.PRODUCT_CREATE) && (
            <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <Link href="/dashboard/products/add">
                <PlusIcon className="w-5 h-5" />
                Add Product
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar and Filter - Modern Card Design */}
      <Card className="mb-6 border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 transition-colors" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, SKU, category, or brand..."
                className="pl-10 h-11 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
              />
            </div>
            <div className="w-full md:w-56">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="h-11 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-400/20">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColumnVisibilityToggle
              columns={availableColumns}
              visibleColumns={visibleColumns}
              onToggle={setVisibleColumns}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export buttons and Results info */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <ResultsInfo
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            itemName="products"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export buttons with modern styling */}
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

          <ItemsPerPage
            value={itemsPerPage}
            onChange={(value) => {
              setItemsPerPage(value)
              setCurrentPage(1)
            }}
          />
        </div>
      </div>

      {loading ? (
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 font-medium">Loading products...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-xl border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/50 hover:from-slate-100 hover:to-blue-50">
                <SortableTableHead className="w-12">
                  <Checkbox
                    checked={paginatedProducts.length > 0 && selectedProductIds.length === paginatedProducts.length}
                    onCheckedChange={handleSelectAll}
                    className="border-slate-400"
                  />
                </SortableTableHead>
                {visibleColumns.includes('product') && (
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Product
                  </SortableTableHead>
                )}
                {visibleColumns.includes('actions') && (
                  <SortableTableHead className="font-semibold text-slate-700">Actions</SortableTableHead>
                )}
                {visibleColumns.includes('sku') && (
                  <SortableTableHead
                    sortKey="sku"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    SKU
                  </SortableTableHead>
                )}
                {visibleColumns.includes('status') && (
                  <SortableTableHead
                    sortKey="isActive"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Status
                  </SortableTableHead>
                )}
                {visibleColumns.includes('category') && (
                  <SortableTableHead
                    sortKey="category.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Category
                  </SortableTableHead>
                )}
                {visibleColumns.includes('brand') && (
                  <SortableTableHead
                    sortKey="brand.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Brand
                  </SortableTableHead>
                )}
                {visibleColumns.includes('unit') && (
                  <SortableTableHead
                    sortKey="unit.shortName"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Unit
                  </SortableTableHead>
                )}
                {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && visibleColumns.includes('purchasePrice') && (
                  <SortableTableHead
                    sortKey="purchasePrice"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Purchase Price
                  </SortableTableHead>
                )}
                {visibleColumns.includes('sellingPrice') && (
                  <SortableTableHead
                    sortKey="sellingPrice"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Selling Price
                  </SortableTableHead>
                )}
                {visibleColumns.includes('stock') && (
                  <SortableTableHead className="font-semibold text-slate-700">Stock</SortableTableHead>
                )}
                {visibleColumns.includes('type') && (
                  <SortableTableHead
                    sortKey="type"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Type
                  </SortableTableHead>
                )}
                {visibleColumns.includes('tax') && (
                  <SortableTableHead
                    sortKey="tax.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction}
                    onSort={requestSort}
                    className="font-semibold text-slate-700"
                  >
                    Tax
                  </SortableTableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-slate-500 font-medium">No products found</p>
                      {can(PERMISSIONS.PRODUCT_CREATE) && (
                        <p className="text-slate-400 text-sm">Click &quot;Add Product&quot; to create one</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className={`transition-all duration-200 ${
                      !product.isActive
                        ? 'bg-slate-50/50 hover:bg-slate-100/50'
                        : 'hover:bg-blue-50/30'
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                        className="border-slate-400"
                      />
                    </TableCell>
                    {visibleColumns.includes('product') && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover shadow-sm ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium shadow-sm">
                              No img
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold truncate ${
                              product.isActive ? 'text-slate-900' : 'text-slate-500'
                            }`}>
                              {product.name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.includes('actions') && (
                      <TableCell>
                        <ProductActionsDropdown
                          product={{
                            id: product.id,
                            name: product.name,
                            enableStock: product.enableStock
                          }}
                          onDelete={fetchProducts}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.includes('sku') && (
                      <TableCell className="font-mono text-sm text-slate-700">
                        {product.sku}
                      </TableCell>
                    )}
                    {visibleColumns.includes('status') && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 shadow-sm">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-slate-300 shadow-sm">
                              Inactive
                            </Badge>
                          )}
                          {can(PERMISSIONS.PRODUCT_UPDATE) && (
                            <Switch
                              checked={product.isActive}
                              onCheckedChange={() => toggleProductActive(product.id, product.isActive)}
                              className="data-[state=checked]:bg-emerald-600"
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.includes('category') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {product.category?.name || <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                    {visibleColumns.includes('brand') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {product.brand?.name || <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                    {visibleColumns.includes('unit') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {product.unit?.shortName || <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                    {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && visibleColumns.includes('purchasePrice') && (
                      <TableCell className={`text-sm font-medium ${product.isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                        <span className="font-mono">${product.purchasePrice ? Number(product.purchasePrice).toFixed(2) : '0.00'}</span>
                      </TableCell>
                    )}
                    {visibleColumns.includes('sellingPrice') && (
                      <TableCell className={`text-sm font-medium ${product.isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                        <span className="font-mono">${product.sellingPrice ? Number(product.sellingPrice).toFixed(2) : '0.00'}</span>
                      </TableCell>
                    )}
                    {visibleColumns.includes('stock') && (
                      <TableCell className={`text-sm font-medium ${product.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        <span className="font-mono">{getTotalStock(product)}</span>
                      </TableCell>
                    )}
                    {visibleColumns.includes('type') && (
                      <TableCell>
                        <Badge className={`shadow-sm ${
                          product.type === 'single'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                        }`}>
                          {product.type}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.includes('tax') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {product.tax ? `${product.tax.name} (${product.tax.amount}%)` : <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Bulk Action Buttons */}
          {selectedProductIds.length > 0 && (
            <div className="px-6 py-5 border-t border-slate-200 bg-gradient-to-r from-blue-50/50 to-slate-50/50">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-base px-3 py-1">
                      {selectedProductIds.length} selected
                    </Badge>
                  </div>
                  <Button
                    onClick={() => setSelectedProductIds([])}
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Clear selection
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Delete Selected */}
                  {can(PERMISSIONS.PRODUCT_DELETE) && (
                    <Button
                      onClick={handleBulkDelete}
                      disabled={bulkActionLoading}
                      variant="destructive"
                      size="sm"
                      className="shadow-md hover:shadow-lg transition-all"
                    >
                      Delete Selected
                    </Button>
                  )}

                  {/* Activate/Deactivate Selected */}
                  {can(PERMISSIONS.PRODUCT_UPDATE) && (
                    <>
                      <Button
                        onClick={handleBulkActivate}
                        disabled={bulkActionLoading}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all"
                      >
                        Activate Selected
                      </Button>
                      <Button
                        onClick={handleBulkDeactivate}
                        disabled={bulkActionLoading}
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 shadow-md hover:shadow-lg transition-all"
                        title="Deactivated products will not be available for purchase or sell"
                      >
                        Deactivate Selected
                      </Button>
                    </>
                  )}

                  {/* Location Actions */}
                  {(can(PERMISSIONS.PRODUCT_UPDATE) || can(PERMISSIONS.PRODUCT_OPENING_STOCK)) && locations.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={selectedLocationId?.toString() || ''} onValueChange={(value) => setSelectedLocationId(parseInt(value))}>
                          <SelectTrigger className="w-48 bg-white border-slate-300 shadow-sm">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(location => (
                              <SelectItem key={location.id} value={location.id.toString()}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleBulkAddToLocation}
                          disabled={bulkActionLoading || !selectedLocationId}
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-700 shadow-md hover:shadow-lg transition-all"
                        >
                          Add to Location
                        </Button>
                        <Button
                          onClick={handleBulkRemoveFromLocation}
                          disabled={bulkActionLoading || !selectedLocationId}
                          size="sm"
                          variant="outline"
                          className="shadow-md hover:shadow-lg transition-all"
                        >
                          Remove from Location
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="px-6 py-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30"
          />
        </Card>
      )}

      {/* Add to Location Modal */}
      <AddToLocationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        locationName={modalLocationName}
        productCount={selectedProductIds.length}
        onConfirm={confirmAddToLocation}
        loading={bulkActionLoading}
      />

      {/* Remove from Location Modal */}
      <RemoveFromLocationModal
        open={showRemoveModal}
        onOpenChange={setShowRemoveModal}
        locationName={modalLocationName}
        productCount={selectedProductIds.length}
        onConfirm={confirmRemoveFromLocation}
        loading={bulkActionLoading}
      />
    </div>
  )
}
