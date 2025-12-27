'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS, isSuperAdmin, hasAccessToAllLocations } from '@/lib/rbac'
import { BookOpen, RefreshCw, Search, Info, X } from 'lucide-react'
import { StockHistoryEntry } from '@/types/product'
import { generateStockHistoryNarrative } from '@/utils/stockHistoryNarrative'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  Scrolling,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import { useRouter, useSearchParams } from 'next/navigation'

interface Product {
  id: number
  name: string
  sku: string
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string
}

interface Location {
  id: number
  name: string
}

// Flattened product option for SelectBox
interface ProductOption {
  id: number
  productId: number
  variationId: number
  displayName: string
  sku: string
}

export default function StockHistoryV3Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, user } = usePermissions()
  const [locations, setLocations] = useState<Location[]>([])
  const [history, setHistory] = useState<StockHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingProductFromUrl, setLoadingProductFromUrl] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)

  // Set default date range: first day of current month to today
  const getDefaultStartDate = () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return firstDayOfMonth.toISOString().split('T')[0]
  }

  const getDefaultEndDate = () => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  const [startDate, setStartDate] = useState(() => {
    const date = getDefaultStartDate()
    console.log('📅 Initializing Start Date:', date)
    return date
  })
  const [endDate, setEndDate] = useState(() => {
    const date = getDefaultEndDate()
    console.log('📅 Initializing End Date:', date)
    return date
  })

  console.log('🔍 Current State - Start Date:', startDate, 'End Date:', endDate)

  // Pre-defined date range functions
  const setDateRangeToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  const setDateRangeYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    setStartDate(dateStr)
    setEndDate(dateStr)
  }

  const setDateRangeThisWeek = () => {
    const now = new Date()
    const firstDayOfWeek = new Date(now)
    firstDayOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
    setStartDate(firstDayOfWeek.toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
  }

  const setDateRangeThisMonth = () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
  }

  const setDateRangeLastMonth = () => {
    const now = new Date()
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    setStartDate(firstDayOfLastMonth.toISOString().split('T')[0])
    setEndDate(lastDayOfLastMonth.toISOString().split('T')[0])
  }

  const setDateRangeThisYear = () => {
    const now = new Date()
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
    setStartDate(firstDayOfYear.toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
  }

  const setDateRangeAllTime = () => {
    setStartDate('')
    setEndDate('')
  }

  // Product autocomplete state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Get location object from ID
  const selectedLocation = locations.find(l => l.id === selectedLocationId) || null

  // Check if user has admin access (Super Admin, Admin, or All Branch Admin with ACCESS_ALL_LOCATIONS)
  const hasAdminAccess = isSuperAdmin(user) || hasAccessToAllLocations(user)

  // Debounced product search - ROCKET SCIENCE EDITION 🚀
  useEffect(() => {
    console.log('🚀 SEARCH USEEFFECT TRIGGERED')
    console.log('   Search Term:', `"${searchTerm}"`)
    console.log('   Trimmed Length:', searchTerm.trim().length)
    
    if (!searchTerm.trim()) {
      console.log('   ❌ Empty search term, clearing results')
      setSearchResults([])
      setShowDropdown(false)
      setSelectedIndex(0)
      return
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      console.log('   ⏹️ Clearing previous timeout')
      clearTimeout(searchTimeoutRef.current)
    }

    // Only search if 3+ characters
    if (searchTerm.trim().length < 3) {
      console.log('   ⚠️ Need at least 3 characters. Current:', searchTerm.trim().length)
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    console.log('   ⏳ Setting 300ms timeout for search...')
    
    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      console.log('🔥 300ms PASSED - EXECUTING SEARCH NOW!')
      console.log('   Search term:', searchTerm.trim())
      
      try {
        setSearchLoading(true)
        console.log('   📡 searchLoading set to TRUE')
        
        const url = `/api/products/search-async?q=${encodeURIComponent(searchTerm.trim())}&limit=50`
        console.log('   🌐 Fetching URL:', url)
        
        const response = await fetch(url)
        console.log('   ✅ Response received!')
        console.log('   Status:', response.status)
        console.log('   OK:', response.ok)

        if (response.ok) {
          const data = await response.json()
          console.log('   📦 Data received:', data)
          console.log('   📊 Number of results:', data.data?.length || 0)
          
          if (data.data && data.data.length > 0) {
            console.log('   🎉 FIRST 3 RESULTS:')
            data.data.slice(0, 3).forEach((item: any, idx: number) => {
              console.log(`      ${idx + 1}. ${item.displayName} (SKU: ${item.sku})`)
            })
          } else {
            console.log('   😢 No results found')
          }
          
          setSearchResults(data.data || [])
          setSelectedIndex(0)
          setShowDropdown(true)
          console.log('   ✅ Results set, dropdown should show NOW')
        } else {
          console.error('   ❌ Response not OK:', response.status, response.statusText)
          const errorText = await response.text()
          console.error('   ❌ Error body:', errorText)
          setSearchResults([])
          setShowDropdown(false)
        }
      } catch (error) {
        console.error('   💥 EXCEPTION during search:', error)
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setSearchLoading(false)
        console.log('   🏁 searchLoading set to FALSE')
        console.log('🚀 SEARCH COMPLETE\n')
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Scroll selected item into view
  const scrollToSelected = useCallback((index: number) => {
    setTimeout(() => {
      const selectedElement = dropdownRef.current?.querySelector(
        `[data-index="${index}"]`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    }, 0)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => {
          const newIndex = (prev + 1) % searchResults.length
          scrollToSelected(newIndex)
          return newIndex
        })
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => {
          const newIndex = (prev - 1 + searchResults.length) % searchResults.length
          scrollToSelected(newIndex)
          return newIndex
        })
        break

      case 'Enter':
        e.preventDefault()
        if (searchResults[selectedIndex]) {
          handleProductSelect(searchResults[selectedIndex])
        }
        break

      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSearchTerm('')
        break
    }
  }, [showDropdown, searchResults, selectedIndex, scrollToSelected])

  // Handle product selection
  const handleProductSelect = useCallback((product: ProductOption) => {
    console.log('🎯 PRODUCT SELECTED:', product)
    console.log('   Product ID:', product.productId)
    console.log('   Variation ID:', product.variationId)
    console.log('   Display Name:', product.displayName)
    console.log('   SKU:', product.sku)
    console.log('   ✅ Report will use Variation ID:', product.variationId, 'NOT the search text')
    setSelectedProduct(product)
    setSearchTerm('') // Clear search field after selection
    setSearchResults([])
    setShowDropdown(false)
    setSelectedIndex(0)
  }, [])

  // Clear selected product
  const handleClearSelection = useCallback(() => {
    console.log('🗑️ Clearing product selection')
    setSelectedProduct(null)
    setHistory([]) // Clear history when clearing selection
    searchInputRef.current?.focus()
  }, [])

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    setSearchResults([])
    setShowDropdown(false)
    setSelectedIndex(0)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize: Load locations first, then product from URL if present
  useEffect(() => {
    if (!can(PERMISSIONS.PRODUCT_VIEW)) {
      router.push('/dashboard')
      return
    }

    // Check if user has admin access
    if (!hasAdminAccess) {
      router.push('/dashboard/reports/stock-history-v2')
      return
    }

    const init = async () => {
      console.log('🚀 Initializing Stock History V3 (Admin) page...')

      setLoading(false) // Initial load complete

      // Step 2: Check for productId in URL and auto-load
      const productIdParam = searchParams.get('productId')
      if (productIdParam) {
        const productId = parseInt(productIdParam)
        console.log('🔍 Found productId in URL:', productId)
        console.log('⏳ Auto-loading product...')

        // Inline the product loading logic to avoid dependency issues
        try {
          setLoadingProductFromUrl(true)

          const response = await fetch(`/api/products/search-async?productId=${productId}`)
          console.log('📡 API Response status:', response.status)

          if (response.ok) {
            const data = await response.json()
            console.log('📊 API Data:', data)
            const products = data.data || []

            if (products.length > 0) {
              const productOption = products[0] as ProductOption
              console.log('✅ Product loaded:', productOption.displayName)

              setSelectedProduct(productOption)
              setSearchTerm(productOption.displayName)

              // Location will be auto-selected by fetchLocations when user data loads
              console.log('ℹ️ Product set, waiting for location to be auto-selected...')
            } else {
              console.error('❌ Product not found with ID:', productId)
            }
          } else {
            console.error('❌ API Error:', response.status, response.statusText)
          }
        } catch (error) {
          console.error('❌ Error loading product from URL:', error)
        } finally {
          setLoadingProductFromUrl(false)
        }
      } else {
        console.log('ℹ️ No productId in URL - manual search mode')
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load locations when user data becomes available
  useEffect(() => {
    if (user) {
      console.log('👤 User loaded, fetching locations for V3...')
      fetchLocations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchLocations = async () => {
    try {
      console.log('📍 Fetching locations for Stock History V3 (Admin)...')

      // Fetch user's assigned locations and primary location ID
      const userLocationsResponse = await fetch('/api/user-locations')
      const userLocationsData = await userLocationsResponse.json()
      const primaryLocationId = userLocationsData.primaryLocationId

      console.log('👤 User primary location ID:', primaryLocationId)
      console.log('📋 User has access to all locations:', userLocationsData.hasAccessToAll)

      // For stock-history-v3, show all accessible locations (for admins)
      const locationsList = userLocationsData.locations || []

      console.log('📋 All accessible locations for admin:', locationsList.length)

      if (locationsList.length === 0) {
        console.warn('⚠️ No accessible locations found')
        setLocations([])
        return
      }

      setLocations(locationsList)

      // Auto-select user's primary location if available, otherwise first location
      if (primaryLocationId && locationsList.find((loc: any) => loc.id === primaryLocationId)) {
        console.log('✅ Auto-selecting user primary location')
        setSelectedLocationId(primaryLocationId)
      } else {
        console.log('📌 Auto-selecting first accessible location')
        setSelectedLocationId(locationsList[0].id)
      }

    } catch (error) {
      console.error('❌ Error fetching locations:', error)
      setLocations([])
    }
  }

  const fetchStockHistory = useCallback(async () => {
    console.log('📊 FETCHING STOCK HISTORY...')
    console.log('   Selected Product:', selectedProduct)
    console.log('   Selected Location:', selectedLocation)
    console.log('   Start Date:', startDate)
    console.log('   End Date:', endDate)

    if (!selectedProduct || !selectedLocation) {
      console.log('   ❌ ABORT: Missing product or location')
      return
    }

    setLoadingHistory(true)
    try {
      const queryParams = new URLSearchParams({
        variationId: selectedProduct.variationId.toString(),
        locationId: selectedLocation.id.toString()
      })

      if (startDate) queryParams.append('startDate', startDate)
      if (endDate) queryParams.append('endDate', endDate)

      const apiUrl = `/api/products/${selectedProduct.productId}/stock-history?${queryParams.toString()}`
      console.log('   🌐 API URL:', apiUrl)

      const response = await fetch(apiUrl)
      console.log('   ✅ Response Status:', response.status, response.ok ? 'OK' : 'ERROR')

      const data = await response.json()
      console.log('   📦 Response Data:', data)

      if (response.ok) {
        console.log('   ✅ History Records:', data.history?.length || 0)
        setHistory(data.history || [])
      } else {
        console.error('   ❌ API Error:', data)
      }
    } catch (error) {
      console.error('   💥 Exception:', error)
    } finally {
      setLoadingHistory(false)
      console.log('📊 FETCH COMPLETE\n')
    }
  }, [selectedProduct, selectedLocation, startDate, endDate])

  useEffect(() => {
    if (selectedProduct && selectedLocation) {
      console.log('🔄 Triggering fetchStockHistory from useEffect')
      fetchStockHistory()
    }
  }, [selectedProduct, selectedLocation, startDate, endDate, fetchStockHistory])

  const handleRefresh = () => {
    fetchStockHistory()
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Stock History')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Stock_History_${selectedProduct?.displayName}_${selectedLocation?.name}_${new Date().toISOString()}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    if (dataGridRef.current) {
      exportToPDF({
        jsPDFDocument: doc,
        component: dataGridRef.current.instance,
      }).then(() => {
        doc.save(`Stock_History_${selectedProduct?.displayName}_${selectedLocation?.name}_${new Date().toISOString()}.pdf`)
      })
    }
  }

  // Calculate summary metrics
  const summaryMetrics = {
    totalPurchase: history.filter(h => h.transactionType === 'purchase').reduce((sum, h) => sum + h.quantityAdded, 0),
    openingStock: history.filter(h => h.transactionType === 'opening_stock').reduce((sum, h) => sum + h.quantityAdded, 0),
    totalSellReturn: history.filter(h => h.transactionType === 'sell_return').reduce((sum, h) => sum + h.quantityAdded, 0),
    transfersIn: history.filter(h => h.transactionType === 'transfer_in').reduce((sum, h) => sum + h.quantityAdded, 0),
    totalSold: history.filter(h => h.transactionType === 'sale').reduce((sum, h) => sum + h.quantityRemoved, 0),
    totalAdjustment: history.filter(h => h.transactionType === 'adjustment').reduce((sum, h) => sum + h.quantityRemoved, 0),
    totalPurchaseReturn: history.filter(h => h.transactionType === 'purchase_return' || h.transactionType === 'supplier_return').reduce((sum, h) => sum + h.quantityRemoved, 0),
    transfersOut: history.filter(h => h.transactionType === 'transfer_out').reduce((sum, h) => sum + h.quantityRemoved, 0),
    currentStock: history.length > 0 ? history[0].runningBalance : 0
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (loadingProductFromUrl) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading product details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock History Report V3 (Admin)</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Advanced stock history with all active locations access</p>
          </div>
          <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium">
            Admin Access
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Info Note */}
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-1">How Stock History is Calculated:</p>
              <p>This report shows the complete transaction history and calculates accurate stock levels based on:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-blue-800 dark:text-blue-300">
                <li><strong>Beginning Inventory:</strong> Initial stock when the product was added to the system</li>
                <li><strong>Inventory Corrections:</strong> Manual adjustments made by authorized users</li>
                <li><strong>All Transactions:</strong> Purchases, sales, transfers, and adjustments</li>
              </ul>
              <p className="mt-2">The "Quantity on Hand" shown after each transaction is the actual calculated stock level at that point in time.</p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Product:
                </label>

                {/* Selected Product Display */}
                {selectedProduct && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                          ✓ Selected: {selectedProduct.displayName}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                          SKU: {selectedProduct.sku} | Variation ID: {selectedProduct.variationId}
                        </p>
                        {searchParams.get('productId') && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                            📌 Auto-loaded from products page
                          </p>
                        )}
                      </div>
                      {!searchParams.get('productId') && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="flex-shrink-0 p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors"
                          title="Clear selection"
                        >
                          <X className="h-5 w-5 text-green-700 dark:text-green-300" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                      💡 Report will be generated using Product Variation ID: {selectedProduct.variationId}
                    </p>
                  </div>
                )}

                {/* Search Input */}
                {!selectedProduct && (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Type at least 3 characters to search by name or SKU
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder={loadingProductFromUrl ? "Loading product..." : "Search by name or SKU (min 3 chars)..."}
                        value={searchTerm}
                        onChange={(e) => {
                          const newValue = e.target.value
                          console.log('⌨️ TYPING DETECTED! New value:', `"${newValue}"`)
                          setSearchTerm(newValue)
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          if (searchResults.length > 0) {
                            setShowDropdown(true)
                          }
                        }}
                        disabled={loadingProductFromUrl}
                        className="pl-10 pr-10 text-base h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Search for a product"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          className="absolute right-3 top-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                          tabIndex={-1}
                        >
                          <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </button>
                      )}

                      {/* Loading indicator */}
                      {searchLoading && (
                        <div className="absolute right-12 top-3 text-sm text-gray-500">
                          Searching...
                        </div>
                      )}

                      {/* Dropdown Results */}
                      {showDropdown && searchResults.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto"
                        >
                          {searchResults.map((product, index) => {
                            const isSelected = index === selectedIndex

                            return (
                              <button
                                key={product.id}
                                type="button"
                                data-index={index}
                                onClick={() => handleProductSelect(product)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`
                                  w-full px-4 py-3 text-left flex justify-between items-center transition-colors
                                  ${isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-4 border-transparent'
                                  }
                                `}
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {product.displayName}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    SKU: <span className="font-mono">{product.sku}</span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="ml-4 text-blue-600 dark:text-blue-400 font-medium text-sm">
                                    Press Enter
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* No Results */}
                      {showDropdown && !searchLoading && searchResults.length === 0 && searchTerm.trim().length >= 3 && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            <p className="font-medium">No products found</p>
                            <p className="text-sm mt-1">
                              Try searching by SKU or product name
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Keyboard Hints */}
                      {showDropdown && searchResults.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
                          <span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                              ↑↓
                            </kbd>{' '}
                            Navigate
                          </span>
                          <span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                              Enter
                            </kbd>{' '}
                            Select
                          </span>
                          <span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                              Esc
                            </kbd>{' '}
                            Clear
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Business Location:
                </label>
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-medium">
                  ✓ All active locations available (Admin Access)
                </p>
                <SelectBox
                  items={locations}
                  value={selectedLocationId}
                  onValueChanged={(e) => setSelectedLocationId(e.value)}
                  displayExpr="name"
                  valueExpr="id"
                  searchEnabled={true}
                  placeholder="Select a location..."
                  showClearButton={true}
                  className="dx-theme-material-typography"
                  stylingMode="outlined"
                />
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Start Date:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  End Date:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Date Range Buttons */}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                Quick Date Ranges:
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={setDateRangeToday}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  Today
                </Button>
                <Button
                  onClick={setDateRangeYesterday}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  Yesterday
                </Button>
                <Button
                  onClick={setDateRangeThisWeek}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  This Week
                </Button>
                <Button
                  onClick={setDateRangeThisMonth}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  This Month
                </Button>
                <Button
                  onClick={setDateRangeLastMonth}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  Last Month
                </Button>
                <Button
                  onClick={setDateRangeThisYear}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  This Year
                </Button>
                <Button
                  onClick={setDateRangeAllTime}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                >
                  All Time
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                onClick={handleRefresh}
                disabled={!selectedProduct || !selectedLocation || loadingHistory}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                {loadingHistory ? 'Loading...' : 'Generate Report'}
              </Button>
              <Button
                onClick={onExportingToPDF}
                disabled={!history.length}
                className="bg-red-600 hover:bg-red-700 text-white font-medium border-2 border-red-700 hover:border-red-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                Export to PDF
              </Button>
              <Button
                onClick={() => {
                  setStartDate(getDefaultStartDate())
                  setEndDate(getDefaultEndDate())
                }}
                disabled={startDate === getDefaultStartDate() && endDate === getDefaultEndDate()}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Section */}
        {selectedProduct && selectedLocation && history.length > 0 && (
          <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Quantities In */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Quantities In</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Total Purchase</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.totalPurchase.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Opening Stock</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.openingStock.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Total Sell Return</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.totalSellReturn.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Stock Transfers (In)</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.transfersIn.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantities Out */}
                <div className="md:border-l md:border-r border-gray-200 dark:border-gray-700 md:px-8">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Quantities Out</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Total Sold</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.totalSold.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Total Stock Adjustment</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.totalAdjustment.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Total Purchase Return</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.totalPurchaseReturn.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Stock Transfers (Out)</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.transfersOut.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Totals</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Current stock</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {summaryMetrics.currentStock.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Story Narrative */}
        {selectedProduct && selectedLocation && history.length > 0 && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                <BookOpen className="w-5 h-5" />
                Understanding Your Stock Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
                {generateStockHistoryNarrative(
                  history,
                  selectedProduct.displayName,
                  selectedLocation.name
                ).split('\n').map((line, index) => {
                  if (line.startsWith('📊') || line.startsWith('✅') || line.startsWith('❌') || line.startsWith('🔢') || line.startsWith('⚠️') || line.startsWith('📝')) {
                    return <p key={index} className="font-semibold mb-2 text-gray-900 dark:text-white">{line}</p>
                  } else if (line.startsWith('- ')) {
                    return <p key={index} className="ml-4 mb-1">{line}</p>
                  } else if (line.trim() === '') {
                    return <div key={index} className="h-2" />
                  } else {
                    return <p key={index} className="mb-2">{line}</p>
                  }
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock History DataGrid */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading stock history...</p>
              </div>
            ) : !selectedProduct || !selectedLocation ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Please select a product and location to view stock history</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-300">No stock history found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <DataGrid
                  ref={dataGridRef}
                  dataSource={history}
                  showBorders={true}
                  showRowLines={true}
                  showColumnLines={true}
                  rowAlternationEnabled={true}
                  allowColumnReordering={true}
                  allowColumnResizing={true}
                  columnAutoWidth={false}
                  columnMinWidth={100}
                  wordWrapEnabled={true}
                  onExporting={onExporting}
                  className="dx-card"
                  width="100%"
                >
                  <LoadPanel enabled={true} />
                  <Scrolling mode="virtual" />
                  <Paging defaultPageSize={20} />
                  <Pager
                    visible={true}
                    displayMode="full"
                    showPageSizeSelector={true}
                    allowedPageSizes={[10, 20, 50, 100]}
                    showInfo={true}
                    showNavigationButtons={true}
                  />
                  <FilterRow visible={true} />
                  <HeaderFilter visible={true} />
                  <SearchPanel visible={true} width={240} placeholder="Search..." />
                  <ColumnChooser enabled={true} mode="select" height={400}>
                    <ColumnChooserSearch enabled={true} />
                    <ColumnChooserSelection allowSelectAll={true} />
                  </ColumnChooser>
                  <Sorting mode="multiple" />
                  <Export enabled={true} allowExportSelectedData={false} />
                  <Toolbar>
                    <Item name="searchPanel" />
                    <Item name="columnChooserButton" />
                    <Item name="exportButton" />
                  </Toolbar>

                  <Column
                    dataField="transactionTypeLabel"
                    caption="Type"
                    width={150}
                  />
                  <Column
                    dataField="quantityChange"
                    caption="Quantity Change"
                    width={150}
                    cellRender={(data) => {
                      const entry = data.data as StockHistoryEntry
                      if (entry.quantityAdded > 0) {
                        return <span className="text-green-600 dark:text-green-400 font-semibold">+{entry.quantityAdded.toFixed(2)}</span>
                      } else if (entry.quantityRemoved > 0) {
                        return <span className="text-red-600 dark:text-red-400 font-semibold">-{entry.quantityRemoved.toFixed(2)}</span>
                      } else {
                        return <span className="text-gray-400">0.00</span>
                      }
                    }}
                  />
                  <Column
                    dataField="runningBalance"
                    caption="New Quantity"
                    width={150}
                    format={{ type: 'fixedPoint', precision: 2 }}
                    cellRender={(data) => (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {data.value.toFixed(2)}
                      </span>
                    )}
                  />
                  <Column
                    dataField="date"
                    caption="Date"
                    dataType="date"
                    width={150}
                    format="MM/dd/yyyy"
                  />
                  <Column
                    dataField="referenceNumber"
                    caption="Reference No"
                    width={150}
                  />
                  <Column
                    dataField="createdBy"
                    caption="Customer/Supplier"
                    minWidth={200}
                  />
                </DataGrid>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

