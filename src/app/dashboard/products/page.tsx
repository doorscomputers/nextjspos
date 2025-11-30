/**
 * ============================================================================
 * PRODUCTS LIST PAGE (src/app/dashboard/products/page.tsx)
 * ============================================================================
 *
 * PURPOSE: Main product management page showing all products in a data table
 *
 * WHAT THIS PAGE DOES:
 * 1. Displays all products for the user's business in a paginated table
 * 2. Provides advanced filtering (name, SKU, category, brand, type, stock, etc.)
 * 3. Allows sorting by any column (name, SKU, stock, price, etc.)
 * 4. Supports bulk actions (add/remove products from locations)
 * 5. Shows real-time stock quantities across all locations
 * 6. Enables/disables products with toggle switches
 * 7. Export products to CSV, Excel, PDF, or Print
 * 8. Column visibility customization (show/hide columns)
 * 9. Quick search across product name and description
 * 10. Links to edit page, product history, and product details
 *
 * USER JOURNEY:
 * User clicks "Products" in sidebar
 *   ↓
 * This page loads (GET /api/products/list)
 *   ↓
 * Displays products in table with filters
 *   ↓
 * User can:
 *   - Search products by name
 *   - Filter by category, brand, type, stock level
 *   - Sort by any column
 *   - Toggle active/inactive status
 *   - Select multiple products for bulk actions
 *   - Export data to various formats
 *   - Click "Add Product" → /dashboard/products/add
 *   - Click "Edit" → /dashboard/products/[id]/edit
 *   - Click "History" → /dashboard/products/[id]/history
 *   - Click product name → /dashboard/products/[id] (details)
 *
 * KEY FEATURES:
 *
 * 1. ADVANCED FILTERING:
 *    - Multi-column filters (search, SKU, category, brand, unit, type, stock range)
 *    - Real-time filtering as user types (with debounce)
 *    - Persistent filter state during session
 *    - Clear all filters button
 *
 * 2. PAGINATION:
 *    - Server-side pagination (only loads current page from API)
 *    - Configurable items per page (10, 25, 50, 100)
 *    - Shows total count and page info
 *    - Automatic page adjustment when filters change
 *
 * 3. COLUMN MANAGEMENT:
 *    - Show/hide columns dynamically
 *    - Default columns: Product, Actions, SKU, Status, Category, Brand, Unit, Type, Tax
 *    - Optional columns: Stock, Purchase Price, Selling Price, Created Date
 *    - State persisted in browser localStorage
 *
 * 4. SORTING:
 *    - Click any column header to sort
 *    - Toggle ascending/descending
 *    - Visual indicators (↑ ↓)
 *    - Server-side sorting for performance
 *
 * 5. BULK ACTIONS:
 *    - Select multiple products with checkboxes
 *    - "Select All" checkbox in header
 *    - Actions:
 *      * Add selected products to a location
 *      * Remove selected products from a location
 *    - Validation: Cannot remove if product has stock at location
 *
 * 6. ACTIVE/INACTIVE TOGGLE:
 *    - Switch component to enable/disable products
 *    - Green = Active (can be sold)
 *    - Gray = Inactive (hidden from POS)
 *    - Immediate API call on toggle
 *    - Permission required: PRODUCT_ACTIVATE
 *
 * 7. EXPORT FUNCTIONALITY:
 *    - CSV: Comma-separated values for Excel/spreadsheets
 *    - Excel: .xlsx file with formatting
 *    - PDF: Printable PDF with table layout
 *    - Print: Browser print dialog
 *    - Exports current filtered/sorted data
 *
 * 8. STOCK DISPLAY:
 *    - Shows total stock across all locations
 *    - Calculated from variations' qtyAvailable
 *    - Color coding: Red if below alert quantity
 *    - Supports single and variable products
 *    - Only shown for products with enableStock = true
 *
 * DATA FLOW:
 *
 * 1. PAGE LOAD:
 *    Browser → GET /api/products/list
 *    API fetches products with filters/pagination
 *    Returns: { products: [...], pagination: {...} }
 *    Page displays products in table
 *
 * 2. FILTER CHANGE:
 *    User types in filter → Debounced (500ms)
 *    Updates filter state
 *    Triggers fetchProducts() with new filters
 *    API returns filtered results
 *    Table updates
 *
 * 3. TOGGLE ACTIVE/INACTIVE:
 *    User clicks switch
 *    PUT /api/products/[id]/activate { isActive: true/false }
 *    API updates product.isActive
 *    Page refreshes product list
 *    Toast notification shows success
 *
 * 4. BULK ADD TO LOCATION:
 *    User selects products
 *    Clicks "Add to Location"
 *    Selects location from dropdown
 *    POST /api/products/bulk-add-location { productIds: [...], locationId: X }
 *    API creates VariationLocationDetails records with qty=0
 *    Toast shows success
 *    Page refreshes
 *
 * 5. BULK REMOVE FROM LOCATION:
 *    User selects products
 *    Clicks "Remove from Location"
 *    Selects location from dropdown
 *    POST /api/products/bulk-remove-location { productIds: [...], locationId: X }
 *    API validates no stock exists
 *    Soft-deletes VariationLocationDetails records
 *    Toast shows success/errors
 *    Page refreshes
 *
 * PERMISSION CHECKS:
 * - PRODUCT_VIEW: Required to view this page (checked in Sidebar)
 * - PRODUCT_CREATE: Show "Add Product" button
 * - PRODUCT_UPDATE: Show "Edit" button in actions dropdown
 * - PRODUCT_ACTIVATE: Show active/inactive toggle switch
 * - PRODUCT_DELETE: Show "Delete" option in actions dropdown
 * - PRODUCT_VIEW_PURCHASE_PRICE: Show purchase price column
 *
 * STATE MANAGEMENT:
 * - products: Array of products (current page)
 * - loading: Boolean for loading spinner
 * - searchTerm: Global search text
 * - activeFilter: "all" | "active" | "inactive"
 * - filters: Multi-column filter object
 * - sortState: { key, direction } for current sort
 * - currentPage: Current pagination page
 * - itemsPerPage: Number of items per page
 * - totalCount: Total products matching filters
 * - totalPages: Total pages for pagination
 * - selectedProductIds: Array of selected product IDs for bulk actions
 * - visibleColumns: Array of column keys to display
 *
 * API ENDPOINTS USED:
 * - GET /api/products/list - Fetch products with filters/pagination
 * - PUT /api/products/[id]/activate - Toggle active status
 * - POST /api/products/bulk-add-location - Add products to location
 * - POST /api/products/bulk-remove-location - Remove products from location
 * - GET /api/locations - Fetch business locations for bulk actions
 *
 * RELATED COMPONENTS:
 * - ProductFiltersPanel: Advanced filter UI
 * - ProductActionsDropdown: Per-product action menu (Edit, Delete, History)
 * - ColumnVisibilityToggle: Show/hide columns
 * - Pagination: Pagination controls
 * - AddToLocationModal: Bulk add to location dialog
 * - RemoveFromLocationModal: Bulk remove from location dialog
 * - SortableTableHead: Sortable column headers
 *
 * RELATED PAGES:
 * - /dashboard/products/add - Create new product
 * - /dashboard/products/[id]/edit - Edit existing product
 * - /dashboard/products/[id] - View product details with stock report
 * - /dashboard/products/[id]/history - View product transaction history
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Server-side pagination (only loads current page)
 * - Debounced search (prevents API spam)
 * - useCallback for memoized functions
 * - Lazy loading of product images
 * - Column visibility reduces render time
 *
 * RESPONSIVE DESIGN:
 * - Mobile: Stacked cards instead of table
 * - Tablet: Reduced columns, horizontal scroll
 * - Desktop: Full table with all columns
 */

"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { History, Pencil } from 'lucide-react'
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
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import ProductFiltersPanel, { ProductFilters } from '@/components/ProductFiltersPanel'
import { debounce } from '@/utils/debounce'

interface Product {
  id: number
  name: string
  type: string
  sku: string
  image: string | null
  enableStock: boolean
  alertQuantity: number | null
  isActive: boolean
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  unit: { id: number; name: string; shortName: string } | null
  tax: { id: number; name: string; amount: number } | null
  variations?: ProductVariation[]
  totalStock?: number | null
  purchasePrice?: number | null
  sellingPrice?: number | null
  createdAt: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
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
  const router = useRouter()
  const { can } = usePermissions()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('') // Separate state for search input (not auto-filtered)
  const [activeFilter, setActiveFilter] = useState<string>('all') // all, active, inactive

  // Minimum characters required for column search to trigger
  const MIN_SEARCH_CHARS = 4

  // Multi-column filter state (actual filters sent to API)
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    sku: '',
    categoryName: '',
    brandName: '',
    unitName: '',
    productType: '',
    stockMin: '',
    stockMax: '',
    taxName: ''
  })

  // Input values state (what user sees in inputs, may differ from filters until MIN_SEARCH_CHARS reached)
  const [filterInputs, setFilterInputs] = useState<Partial<ProductFilters>>({
    search: '',
    sku: '',
    categoryName: '',
    brandName: '',
    unitName: '',
    taxName: ''
  })

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  // Pagination state (server-side)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Column visibility state - Actions is now second (right after Product)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'product', 'actions', 'sku', 'status', 'category', 'brand', 'unit', 'type', 'tax'
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

  const PRODUCT_TYPE_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'single', label: 'Single' },
    { value: 'variable', label: 'Variable' },
    { value: 'combo', label: 'Combo' },
  ]

  useEffect(() => {
    fetchLocations()
  }, [])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, activeFilter, filters])

  // Update searchTerm, searchInput, and filterInputs when filters change externally (e.g., clear all)
  useEffect(() => {
    setSearchTerm(filters.search)
    setSearchInput(filters.search)
    // Sync filterInputs with filters for text-based fields
    setFilterInputs({
      search: filters.search,
      sku: filters.sku,
      categoryName: filters.categoryName,
      brandName: filters.brandName,
      unitName: filters.unitName,
      taxName: filters.taxName
    })
  }, [filters.search, filters.sku, filters.categoryName, filters.brandName, filters.unitName, filters.taxName])

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

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      // Add pagination parameters
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())

      // Add active filter
      if (activeFilter === 'active') {
        params.append('active', 'true')
      } else if (activeFilter === 'inactive') {
        params.append('active', 'false')
      }

      // Add multi-column filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value)
        }
      })

      if (sortState?.key && sortState.direction) {
        params.append('sortBy', sortState.key)
        params.append('sortDirection', sortState.direction)
      }

      const url = `/api/products/list${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        setProducts(Array.isArray(data.products) ? data.products : [])
        setSelectedProductIds([])
        if (data.pagination) {
          const nextTotalCount = data.pagination.totalCount ?? 0
          const nextTotalPages = data.pagination.totalPages ?? 0
          setTotalCount(nextTotalCount)
          setTotalPages(nextTotalPages)
          if (nextTotalPages > 0 && currentPage > nextTotalPages) {
            setCurrentPage(nextTotalPages)
          } else if (nextTotalPages === 0 && currentPage !== 1) {
            setCurrentPage(1)
          }
        } else {
          setTotalCount(data.products ? data.products.length : 0)
          setTotalPages(0)
          if (currentPage !== 1) {
            setCurrentPage(1)
          }
        }
      } else {
        setProducts([])
        setTotalCount(0)
        setTotalPages(0)
        setSelectedProductIds([])
        toast.error(data.error || 'Failed to load products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
      setTotalCount(0)
      setTotalPages(0)
      setSelectedProductIds([])
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [activeFilter, filters, currentPage, itemsPerPage, sortState])

  // Debounced fetch function to avoid excessive API calls
  const debouncedFetchProducts = useCallback(debounce(fetchProducts, 300), [fetchProducts])

  // Update fetchProducts to use debounced version for filter changes
  useEffect(() => {
    debouncedFetchProducts()
  }, [debouncedFetchProducts])

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
    if (product.totalStock !== undefined && product.totalStock !== null) {
      return Number(product.totalStock).toFixed(2)
    }
    return '0.00'
  }

  const paginatedProducts = products
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + paginatedProducts.length

  // Define available columns for visibility toggle - Actions is second
  const availableColumns: Column[] = [
    { id: 'product', label: 'Product', required: true },
    { id: 'actions', label: 'Actions', required: true },
    { id: 'sku', label: 'SKU' },
    { id: 'status', label: 'Status' },
    { id: 'category', label: 'Category' },
    { id: 'brand', label: 'Brand' },
    { id: 'unit', label: 'Unit' },
    { id: 'type', label: 'Type' },
    { id: 'tax', label: 'Tax' }
  ]

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  // Helper function to handle filter changes
  const handleFiltersChange = (newFilters: ProductFilters) => {
    setFilters(newFilters)
  }

  const handleSimpleFilterChange = (key: keyof ProductFilters, value: string) => {
    // Text-based filters - only update input display, require Enter to apply
    const textFilters: (keyof ProductFilters)[] = ['search', 'sku', 'categoryName', 'brandName', 'unitName', 'taxName']

    if (textFilters.includes(key)) {
      // Only update the input display value - actual filter applied on Enter
      setFilterInputs((prev) => ({
        ...prev,
        [key]: value,
      }))

      // Clear filter immediately when input is emptied
      if (value === '') {
        if (key === 'search') {
          setSearchTerm('')
        }
        setFilters((prev) => ({
          ...prev,
          [key]: '',
        }))
      }
      return
    }

    // Non-text filters (productType, stockMin, stockMax, etc.) - apply immediately
    if (key === 'search') {
      setSearchTerm(value)
    }
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Handle Enter key for column filters - applies the filter
  const handleColumnFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, key: keyof ProductFilters) => {
    if (e.key === 'Enter') {
      const value = filterInputs[key] ?? ''
      if (key === 'search') {
        setSearchTerm(value)
      }
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }))
    }
  }

  // Handle manual search button click
  const handleSearchClick = () => {
    setSearchTerm(searchInput)
    handleSimpleFilterChange('search', searchInput)
  }

  // Handle clearing search
  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    handleSimpleFilterChange('search', '')
  }

  // Handle Enter key in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchClick()
    }
  }

  const handleSort = (key: string) => {
    setSortState((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' }
        }
        if (prev.direction === 'desc') {
          return null
        }
      }
      return { key, direction: 'asc' }
    })
    setCurrentPage(1)
  }

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
      data: paginatedProducts,
      title: 'Products'
    })
    toast.success(`Exported ${paginatedProducts.length} products from current page to CSV`)
  }

  const handleExportExcel = () => {
    exportToExcel({
      filename: 'products',
      columns: getExportColumns(),
      data: paginatedProducts,
      title: 'Products'
    })
    toast.success(`Exported ${paginatedProducts.length} products from current page to Excel`)
  }

  const handleExportPDF = () => {
    exportToPDF({
      filename: 'products',
      columns: getExportColumns(),
      data: paginatedProducts,
      title: 'Products Export'
    })
    toast.success(`Exported ${paginatedProducts.length} products from current page to PDF`)
  }

  const handlePrint = () => {
    printTable({
      filename: 'products',
      columns: getExportColumns(),
      data: paginatedProducts,
      title: 'Products'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
      {/* Header Section with Gradient */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 dark:from-amber-100 dark:via-orange-300 dark:to-amber-100 bg-clip-text text-transparent">
              Products
            </h1>
            <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">Manage your inventory with ease</p>
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

      {/* Advanced Filters Panel */}
      <ProductFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isVisible={showAdvancedFilters}
        onToggleVisibility={() => setShowAdvancedFilters(!showAdvancedFilters)}
        activeFilterCount={getActiveFilterCount()}
      />

      {/* Search Bar and Filter - Modern Card Design */}
      <Card className="mb-6 border-slate-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500 transition-colors" />
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by product name, SKU, category, or brand... (Press Enter or click Search)"
                  className="pl-10 pr-10 h-11 transition-all"
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    title="Clear search"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleSearchClick}
                size="default"
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                Search
              </Button>
            </div>
            <div className="w-full md:w-56">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="h-11">
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
        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm">
          <ResultsInfo
            startIndex={startIndex}
            endIndex={Math.min(endIndex, totalCount)}
            totalItems={totalCount}
            itemName="products"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export buttons with modern styling */}
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

          <ItemsPerPage
            value={itemsPerPage}
            onChange={(value) => {
              setItemsPerPage(value)
              setCurrentPage(1)
            }}
            options={[10, 25, 50, 100]}
          />
        </div>
      </div>

      {loading ? (
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-gray-300 font-medium">Loading products...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <Card className="shadow-xl border-slate-200 dark:border-gray-700">
            <div className="overflow-auto max-h-[calc(100vh-350px)]">
              <Table noWrapper className="min-w-full">
                <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-orange-900 dark:to-orange-900/80 shadow-sm">
                  <TableRow className="bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-orange-900 dark:to-orange-900/80 hover:from-amber-100 hover:to-orange-50 dark:hover:from-orange-800 dark:hover:to-orange-800/80">
                <SortableTableHead className="w-12">
                  <Checkbox
                    checked={paginatedProducts.length > 0 && selectedProductIds.length === paginatedProducts.length}
                    onCheckedChange={handleSelectAll}
                    className="border-slate-400 dark:border-gray-500"
                  />
                </SortableTableHead>
                {visibleColumns.includes('product') && (
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Product
                  </SortableTableHead>
                )}
                {visibleColumns.includes('actions') && (
                  <SortableTableHead className="font-semibold text-slate-700 dark:text-gray-200">Actions</SortableTableHead>
                )}
                {visibleColumns.includes('sku') && (
                  <SortableTableHead
                    sortKey="sku"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    SKU
                  </SortableTableHead>
                )}
                {visibleColumns.includes('status') && (
                  <SortableTableHead
                    sortKey="isActive"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Status
                  </SortableTableHead>
                )}
                {visibleColumns.includes('category') && (
                  <SortableTableHead
                    sortKey="category.name"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Category
                  </SortableTableHead>
                )}
                {visibleColumns.includes('brand') && (
                  <SortableTableHead
                    sortKey="brand.name"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Brand
                  </SortableTableHead>
                )}
                {visibleColumns.includes('unit') && (
                  <SortableTableHead
                    sortKey="unit.shortName"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Unit
                  </SortableTableHead>
                )}
                                {visibleColumns.includes('stock') && (
                  <SortableTableHead className="font-semibold text-slate-700 dark:text-gray-200">Stock</SortableTableHead>
                )}
                {visibleColumns.includes('type') && (
                  <SortableTableHead
                    sortKey="type"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Type
                  </SortableTableHead>
                )}
                {visibleColumns.includes('tax') && (
                  <SortableTableHead
                    sortKey="tax.name"
                    currentSortKey={sortState?.key ?? null}
                    currentSortDirection={sortState?.direction ?? null}
                    onSort={handleSort}
                    className="font-semibold text-slate-700 dark:text-gray-200"
                  >
                    Tax
                  </SortableTableHead>
                )}
              </TableRow>
              <TableRow className="bg-slate-100/80 dark:bg-gray-700/50 text-xs hover:bg-slate-100/80 dark:hover:bg-gray-700/50">
                <TableCell className="bg-slate-100/80 dark:bg-gray-700/50"></TableCell>
                {visibleColumns.includes('product') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.search ?? ''}
                      onChange={(e) => handleSimpleFilterChange('search', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'search')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                )}
                {visibleColumns.includes('actions') && <TableCell className="bg-slate-100/80 dark:bg-gray-700/50"></TableCell>}
                {visibleColumns.includes('sku') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.sku ?? ''}
                      onChange={(e) => handleSimpleFilterChange('sku', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'sku')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs font-mono"
                    />
                  </TableCell>
                )}
                {visibleColumns.includes('status') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as 'all' | 'active' | 'inactive')}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {visibleColumns.includes('category') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.categoryName ?? ''}
                      onChange={(e) => handleSimpleFilterChange('categoryName', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'categoryName')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                )}
                {visibleColumns.includes('brand') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.brandName ?? ''}
                      onChange={(e) => handleSimpleFilterChange('brandName', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'brandName')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                )}
                {visibleColumns.includes('unit') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.unitName ?? ''}
                      onChange={(e) => handleSimpleFilterChange('unitName', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'unitName')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                )}
                {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && visibleColumns.includes('purchasePrice') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        value={filters.purchasePriceMin}
                        onChange={(e) => handleSimpleFilterChange('purchasePriceMin', e.target.value)}
                        placeholder="Min"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        value={filters.purchasePriceMax}
                        onChange={(e) => handleSimpleFilterChange('purchasePriceMax', e.target.value)}
                        placeholder="Max"
                        className="h-8 text-xs"
                      />
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('sellingPrice') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        value={filters.sellingPriceMin}
                        onChange={(e) => handleSimpleFilterChange('sellingPriceMin', e.target.value)}
                        placeholder="Min"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        value={filters.sellingPriceMax}
                        onChange={(e) => handleSimpleFilterChange('sellingPriceMax', e.target.value)}
                        placeholder="Max"
                        className="h-8 text-xs"
                      />
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('stock') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        value={filters.stockMin}
                        onChange={(e) => handleSimpleFilterChange('stockMin', e.target.value)}
                        placeholder="Min"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        value={filters.stockMax}
                        onChange={(e) => handleSimpleFilterChange('stockMax', e.target.value)}
                        placeholder="Max"
                        className="h-8 text-xs"
                      />
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('type') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Select
                      value={filters.productType || 'all'}
                      onValueChange={(value) => handleSimpleFilterChange('productType', value === 'all' ? '' : value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {visibleColumns.includes('tax') && (
                  <TableCell className="bg-slate-100/80 dark:bg-gray-700/50">
                    <Input
                      value={filterInputs.taxName ?? ''}
                      onChange={(e) => handleSimpleFilterChange('taxName', e.target.value)}
                      onKeyDown={(e) => handleColumnFilterKeyDown(e, 'taxName')}
                      placeholder="Type & press Enter..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-slate-500 dark:text-gray-400 font-medium">No products found</p>
                      {can(PERMISSIONS.PRODUCT_CREATE) && (
                        <p className="text-slate-400 dark:text-gray-500 text-sm">Click &quot;Add Product&quot; to create one</p>
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
                        ? 'bg-slate-50/50 dark:bg-gray-800/30 hover:bg-slate-100/50 dark:hover:bg-gray-700/30'
                        : 'hover:bg-blue-50/30 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                        className="border-slate-400 dark:border-gray-500"
                      />
                    </TableCell>
                    {visibleColumns.includes('product') && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover shadow-sm ring-1 ring-slate-200 dark:ring-gray-700"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 flex items-center justify-center text-amber-400 dark:text-orange-500 text-xs font-medium shadow-sm">
                              No img
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold truncate ${
                              product.isActive ? 'text-slate-900 dark:text-gray-100' : 'text-slate-500 dark:text-gray-500'
                            }`}>
                              {product.name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.includes('actions') && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Quick Edit Button */}
                          {can(PERMISSIONS.PRODUCT_UPDATE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              title="Edit Product"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Quick History Button */}
                          {product.enableStock && can(PERMISSIONS.PRODUCT_VIEW) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/dashboard/reports/stock-history-v2?productId=${product.id}`)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                              title="View Stock History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                          <ProductActionsDropdown
                            product={{
                              id: product.id,
                              name: product.name,
                              enableStock: product.enableStock
                            }}
                            onDelete={fetchProducts}
                          />
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.includes('sku') && (
                      <TableCell className="font-mono text-sm text-slate-700 dark:text-gray-300">
                        {product.sku}
                      </TableCell>
                    )}
                    {visibleColumns.includes('status') && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.isActive ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 shadow-sm">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 border-slate-300 dark:border-gray-600 shadow-sm">
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
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-500'}`}>
                        {product.category?.name || <span className="text-slate-400 dark:text-gray-600">-</span>}
                      </TableCell>
                    )}
                    {visibleColumns.includes('brand') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-500'}`}>
                        {product.brand?.name || <span className="text-slate-400 dark:text-gray-600">-</span>}
                      </TableCell>
                    )}
                    {visibleColumns.includes('unit') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-500'}`}>
                        {product.unit?.shortName || <span className="text-slate-400 dark:text-gray-600">-</span>}
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
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                            : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                        }`}>
                          {product.type}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.includes('tax') && (
                      <TableCell className={`text-sm ${product.isActive ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-500'}`}>
                        {product.tax ? `${product.tax.name} (${product.tax.amount}%)` : <span className="text-slate-400 dark:text-gray-600">-</span>}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* Bulk Action Buttons */}
          {selectedProductIds.length > 0 && (
            <div className="px-6 py-5 border-t border-slate-200 dark:border-gray-700 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/50 dark:to-orange-900/30">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 text-base px-3 py-1">
                      {selectedProductIds.length} selected
                    </Badge>
                  </div>
                  <Button
                    onClick={() => setSelectedProductIds([])}
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100"
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
            className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50/30 dark:from-orange-900/50 dark:to-orange-900/30"
          />
          </Card>
        </div>
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
