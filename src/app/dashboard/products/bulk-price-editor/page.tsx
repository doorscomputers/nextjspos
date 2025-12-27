'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Editing,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Toolbar,
  Item,
  Selection,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Scrolling,
} from 'devextreme-react/data-grid'
import { SelectBox, Button, NumberBox, Popup } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface Location {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  price: number
  cost: number
  categoryName?: string
  brandName?: string
}

interface PriceData {
  compositeKey: string
  productVariationId: number
  productName: string
  productSku: string
  variationName: string
  locationId: number
  locationName: string
  basePrice: number
  costPrice: number
  sellingPrice: number | null
  pricePercentage: number | null
  calculatedPrice?: number
  profitMargin?: number
}

interface PriceChange {
  productVariationId: number
  locationId: number
  sellingPrice: number | null
  pricePercentage?: number | null
}

export default function BulkPriceEditorPage() {
  const { can, hasAnyRole } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])
  const [pricingStrategy, setPricingStrategy] = useState<string>('fallback')
  const dataGridRef = useRef<DataGrid>(null)

  // Manual change tracking
  const [pendingChanges, setPendingChanges] = useState<Map<string, PriceChange>>(new Map())
  const [hasGridChanges, setHasGridChanges] = useState(false)

  // Bulk markup/margin state
  const [bulkPercentage, setBulkPercentage] = useState<number>(20)
  const [calculationType, setCalculationType] = useState<'markup' | 'margin'>('markup')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{ applyToAll: boolean; count: number } | null>(null)

  // 3-step confirmation state
  const [confirmationStep, setConfirmationStep] = useState<number>(0) // 0 = none, 1, 2, 3
  const [step1DialogVisible, setStep1DialogVisible] = useState(false)
  const [step2DialogVisible, setStep2DialogVisible] = useState(false)
  const [step3DialogVisible, setStep3DialogVisible] = useState(false)

  // Refs for button focusing
  const step1NoButtonRef = useRef<any>(null)
  const step2NoButtonRef = useRef<any>(null)
  const step3NoButtonRef = useRef<any>(null)

  const hasEditAll = can(PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
  const hasEdit = can(PERMISSIONS.PRODUCT_PRICE_EDIT)
  const hasBulkEdit = can(PERMISSIONS.PRODUCT_PRICE_BULK_EDIT)
  const hasAccess = hasEditAll || hasEdit || hasBulkEdit
  const canMultiLocation = can(PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE)
  // Only Super Admin can use Bulk Apply Pricing (Markup/Margin) section
  const showBulkApplySection = hasAnyRole(['Super Admin', 'System Administrator', 'Super Admin (Legacy)'])

  const buildRowKey = useCallback((productVariationId: number, locationId: number) => {
    return `${productVariationId}-${locationId}`
  }, [])

  const getLocationName = useCallback(
    (locationId: number) => locations.find(loc => loc.id === locationId)?.name || `Location #${locationId}`,
    [locations]
  )

  const toggleLocationSelection = useCallback((locationId: number) => {
    setSelectedLocations(prev => {
      if (prev.includes(locationId)) {
        return prev.filter(id => id !== locationId)
      }
      return [...prev, locationId]
    })
  }, [])

  const toggleAllLocations = useCallback(() => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([])
    } else {
      setSelectedLocations(locations.map(loc => loc.id))
    }
  }, [locations, selectedLocations])

  useEffect(() => {
    if (hasAccess) {
      fetchInitialData()
    } else {
      setLoading(false)
    }
  }, [hasAccess])

  // Log priceData changes
  useEffect(() => {
    if (priceData.length > 0) {
      console.log('🔄 priceData updated:', priceData.length, 'records')
    }
  }, [priceData])

  // Poll DevExtreme for changes every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (dataGridRef.current?.instance) {
        const hasChanges = dataGridRef.current.instance.hasEditData()
        if (hasChanges !== hasGridChanges) {
          console.log('📊 Grid changes detected:', hasChanges)
          setHasGridChanges(hasChanges)
        }
      }
    }, 500)

    return () => clearInterval(interval)
  }, [hasGridChanges])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch locations (excluding Main Warehouse)
      const locationsResponse = await fetch('/api/locations')
      const locationsResult = await locationsResponse.json()
      if (locationsResponse.ok && locationsResult.success) {
        // Filter out Main Warehouse
        const sellingLocations = locationsResult.data.filter((loc: Location) =>
          !loc.name.toLowerCase().includes('main warehouse')
        )
        setLocations(sellingLocations)
      }

      // Fetch pricing strategy
      const settingsResponse = await fetch('/api/settings/pricing')
      const settingsResult = await settingsResponse.json()
      if (settingsResponse.ok && settingsResult.success) {
        setPricingStrategy(settingsResult.data.pricingStrategy)
      }

      // Fetch price data
      await fetchPriceData()
    } catch (error) {
      console.error('Fetch initial data error:', error)
      notify('Failed to load initial data', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const fetchPriceData = async () => {
    try {
      const response = await fetch('/api/products/bulk-prices')
      const result = await response.json()

      if (response.ok && result.success && Array.isArray(result.data)) {
        // EXCLUDE Main Warehouse - it doesn't sell products
        const filteredData = result.data.filter((item: any) =>
          item && item.locationName && !item.locationName.toLowerCase().includes('main warehouse')
        )

        const data = filteredData.map((item: any, index: number) => {
          // Ensure required fields exist
          const productVariationId = item.productVariationId || index
          const locationId = item.locationId || index

          return {
            ...item,
            compositeKey: `${productVariationId}-${locationId}`,
            productVariationId,
            locationId,
            calculatedPrice: calculatePrice(item),
            profitMargin: calculateProfitMargin(item),
          }
        })

        console.log(`📊 Loaded ${data.length} price records (excluded ${result.data.length - filteredData.length} Main Warehouse items)`)

        // Set the data - this should trigger the DataGrid to update
        setPriceData(data)
        setPendingChanges(new Map())

        // Show success notification
        notify(`Loaded ${data.length} price records successfully`, 'success', 2000)

        // Show notification if Main Warehouse was filtered out
        const excludedCount = result.data.length - filteredData.length
        if (excludedCount > 0) {
          console.log(`Excluded ${excludedCount} Main Warehouse products from price editor`)
        }
      } else {
        console.error('❌ API Error:', result.error)
        setPriceData([]) // Set empty array on error
        notify(`API Error: ${result.error || 'Failed to fetch price data'}`, 'error', 5000)
      }
    } catch (error) {
      console.error('💥 Fetch price data error:', error)
      setPriceData([]) // Set empty array on error
      notify('Network error: Failed to fetch price data', 'error', 3000)
    }
  }

  const calculatePrice = (item: any): number => {
    if (!item) return 0

    try {
      if (pricingStrategy === 'percentage' && item.pricePercentage !== null && item.pricePercentage !== undefined) {
        const basePrice = Number(item.basePrice) || 0
        const percentage = Number(item.pricePercentage) || 0
        return basePrice * (1 + percentage / 100)
      }

      const sellingPrice = Number(item.sellingPrice) || 0
      const basePrice = Number(item.basePrice) || 0

      return sellingPrice || basePrice || 0
    } catch (error) {
      console.warn('Error calculating price:', error, item)
      return 0
    }
  }

  const calculateProfitMargin = (item: any): number => {
    if (!item) return 0

    try {
      const price = calculatePrice(item)
      const costPrice = Number(item.costPrice) || 0

      if (price > 0 && costPrice > 0) {
        return ((price - costPrice) / price) * 100
      }
      return 0
    } catch (error) {
      console.warn('Error calculating profit margin:', error, item)
      return 0
    }
  }

  // Handle cell value changes - immediate tracking for batch editing mode
  const handleCellValueChanged = useCallback((e: any) => {
    try {
      console.log('🔔 onCellValueChanged fired!', e)

      // Validate event data
      if (!e || !e.data || !e.column) {
        console.warn('Invalid cell change event:', e)
        return
      }

      // e.data contains the full row data with the updated value
      // e.value is the new value, e.previousValue is the old value
      const rowData = e.data
      const columnName = e.column?.dataField

      console.log('📊 Event details:', {
        columnName,
        newValue: e.value,
        oldValue: e.previousValue,
        rowData: rowData
      })

      // Only track changes to sellingPrice or pricePercentage
      if (!columnName || (columnName !== 'sellingPrice' && columnName !== 'pricePercentage')) {
        console.log('⏭️ Skipping - not a price column')
        return
      }

      // Validate required fields
      if (rowData.productVariationId === undefined || rowData.locationId === undefined) {
        console.warn('Missing required fields in row data:', rowData)
        return
      }

      const key = buildRowKey(rowData.productVariationId, rowData.locationId)

      // Create change record
      const change: PriceChange = {
        productVariationId: rowData.productVariationId,
        locationId: rowData.locationId,
        sellingPrice: rowData.sellingPrice,
        pricePercentage: rowData.pricePercentage,
      }

      setPendingChanges(prev => {
        const next = new Map(prev)
        next.set(key, change)
        console.log('✅ Change tracked! Total changes:', next.size)
        return next
      })

      console.log('📝 Change tracked:', key, change, `(${columnName} changed from ${e.previousValue} to ${e.value})`)
    } catch (error) {
      console.error('Error in handleCellValueChanged:', error, e)
    }
  }, [buildRowKey])

  const handleSavePrices = async () => {
    if (!dataGridRef.current) return

    try {
      setSaving(true)

      // Check if locations are selected
      if (selectedLocations.length === 0) {
        notify('Please select at least one location to update', 'warning', 3000)
        setSaving(false)
        return
      }

      const gridInstance = dataGridRef.current.instance

      // NEW APPROACH: Always try to get selected rows data, regardless of change detection
      console.log('🔄 Getting selected rows from grid...')

      let selectedRowsData: any[] = []

      // Method 1: Try getSelectedRowsData() if available
      try {
        if (typeof gridInstance.getSelectedRowsData === 'function') {
          selectedRowsData = gridInstance.getSelectedRowsData()
          console.log('✅ getSelectedRowsData() result:', selectedRowsData)
        }
      } catch (e) {
        console.warn('Method 1 failed:', e)
      }

      // Method 2: Fallback to getting visible rows and filtering by selection
      try {
        if (selectedRowsData.length === 0) {
          const visibleRows = gridInstance.getVisibleRows()
          selectedRowsData = visibleRows
            .filter(row => row.data && row.isSelected)
            .map(row => row.data)
          console.log('✅ Filtered visible rows result:', selectedRowsData)
        }
      } catch (e) {
        console.warn('Method 2 failed:', e)
      }

      // Method 3: If still no selection, get all rows from our local state (no API calls)
      if (selectedRowsData.length === 0) {
        selectedRowsData = priceData
        console.log('✅ All rows fallback result (from local state):', selectedRowsData)
      }

      if (selectedRowsData.length === 0) {
        notify('No products found to update. Please select products using the checkboxes in the grid.', 'warning', 4000)
        setSaving(false)
        return
      }

      // If we got data from fallback method (not actual selection), show info message
      const fromLocalState = selectedRowsData === priceData
      if (fromLocalState) {
        notify('Using all loaded products since no specific products were selected.', 'info', 3000)
      }

      console.log(`💾 Processing ${selectedRowsData.length} products for ${selectedLocations.length} locations`)

      // Build updates array from selected rows
      const updates: any[] = []

      selectedRowsData.forEach((rowData: any) => {
        if (!rowData.productVariationId || !rowData.locationId) {
          console.warn('Skipping invalid row:', rowData)
          return
        }

        const targetLocations = selectedLocations.filter((locId: number) => locId !== rowData.locationId)

        updates.push({
          productVariationId: rowData.productVariationId,
          locationId: rowData.locationId,
          sellingPrice: rowData.sellingPrice,
          pricePercentage: rowData.pricePercentage,
          targetLocationIds: targetLocations.length > 0 ? targetLocations : undefined,
        })
      })

      if (updates.length === 0) {
        notify('No valid products to update', 'info', 2000)
        setSaving(false)
        return
      }

      // Validate updates structure
      console.log('🔍 Updates structure validation:')
      updates.forEach((update, index) => {
        console.log(`Update ${index}:`, update)
        if (!update.productVariationId) {
          console.error(`❌ Update ${index} missing productVariationId`)
        }
        if (!update.locationId) {
          console.error(`❌ Update ${index} missing locationId`)
        }
      })

      // Show confirmation for multi-location updates
      if (selectedLocations.length > 1) {
        const locationNames = selectedLocations.map(id => getLocationName(id)).join(', ')
        const confirmed = window.confirm(
          `You are about to update ${updates.length} product price(s) across ${selectedLocations.length} locations:\n\n${locationNames}\n\nThis action will save the current prices shown in the grid. Continue?`
        )

        if (!confirmed) {
          setSaving(false)
          return
        }
      }

      console.log(`🚀 Sending ${updates.length} price updates to server:`, updates)

      // First test the simple test API
      console.log('🧪 Testing simple API first...')
      try {
        const testResponse = await fetch('/api/test-bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        })
        console.log('🧪 Test API response status:', testResponse.status)
        const testResult = await testResponse.json()
        console.log('🧪 Test API response:', testResult)
      } catch (testError) {
        console.error('🧪 Test API error:', testError)
      }

      // Now try the real API
      console.log('🚀 Now trying real API...')
      const response = await fetch('/api/products/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      console.log('📡 API Response status:', response.status)

      const result = await response.json()
      console.log('📦 API Response data:', result)

      if (response.ok && result.success) {
        const locationNames = selectedLocations.map(id => getLocationName(id)).join(', ')
        notify(
          `✅ Successfully saved prices for ${updates.length} product(s) across ${selectedLocations.length} location(s): ${locationNames}`,
          'success',
          5000
        )

        // Clear pending changes
        setPendingChanges(new Map())
        setHasGridChanges(false)

        // Refresh data
        await fetchPriceData()

        // Reset grid editing state
        const gridInstance = dataGridRef.current.instance
        if (gridInstance) {
          try {
            gridInstance.cancelEditData() // This clears the batch editing changes
          } catch (e) {
            console.warn('Could not cancel edit data:', e)
          }
        }
      } else {
        // Enhanced error reporting
        const errorMessage = result.error || 'Failed to update prices'
        console.error('❌ Save failed:', {
          status: response.status,
          error: errorMessage,
          details: result.details || result,
          errors: result.data?.errors
        })

        notify(errorMessage, 'error', 5000)

        if (result.data?.errors?.length > 0) {
          console.error('Bulk update errors:', result.data.errors)
          result.data.errors.forEach((err: any, index: number) => {
            console.error(`Error ${index + 1}:`, err)
          })
        }
      }
    } catch (error) {
      console.error('Save prices error:', error)
      notify('Failed to save prices', 'error', 3000)
    } finally {
      setSaving(false)
    }
  }

  // Step 1: Show confirmation dialog before applying pricing
  const handleBulkApplyPricing = (applyToAll: boolean) => {
    const gridInstance = dataGridRef.current?.instance
    if (!gridInstance) return

    const percentage = bulkPercentage
    if (isNaN(percentage) || percentage < -100) {
      notify('Please enter a valid percentage', 'error', 3000)
      return
    }

    // Get selected rows or all rows
    let rowsToUpdate: any[] = []
    if (applyToAll) {
      rowsToUpdate = priceData.filter((item) => Number(item.costPrice) > 0)
    } else {
      const selectedKeys = gridInstance.getSelectedRowKeys()
      if (selectedKeys.length === 0) {
        notify('Please select at least one product', 'warning', 3000)
        return
      }
      rowsToUpdate = priceData.filter((item) =>
        selectedKeys.includes(item.compositeKey) && Number(item.costPrice) > 0
      )
    }

    if (rowsToUpdate.length === 0) {
      notify('No products with cost price found to update', 'warning', 3000)
      return
    }

    // Start 3-step confirmation process
    setPendingUpdate({ applyToAll, count: rowsToUpdate.length })
    setConfirmationStep(1)
    setStep1DialogVisible(true)
  }

  // Step 2: Apply pricing after confirmation
  const applyBulkPricing = () => {
    const gridInstance = dataGridRef.current?.instance
    if (!gridInstance || !pendingUpdate) return

    const percentage = bulkPercentage
    const { applyToAll } = pendingUpdate

    // Get selected rows or all rows
    let rowsToUpdate: any[] = []
    if (applyToAll) {
      rowsToUpdate = priceData
    } else {
      const selectedKeys = gridInstance.getSelectedRowKeys()
      rowsToUpdate = priceData.filter((item) =>
        selectedKeys.includes(item.compositeKey)
      )
    }

    // Apply pricing calculation
    let updatedCount = 0
    rowsToUpdate.forEach((row) => {
      const costPrice = Number(row.costPrice)
      if (costPrice > 0) {
        let newPrice: number

        if (calculationType === 'markup') {
          // Markup % = (Selling - Cost) / Cost × 100
          // Selling = Cost × (1 + Markup% / 100)
          newPrice = costPrice * (1 + percentage / 100)
        } else {
          // Margin % = (Selling - Cost) / Selling × 100
          // Selling = Cost / (1 - Margin% / 100)
          const marginDecimal = percentage / 100
          if (marginDecimal >= 1) {
            notify('Margin percentage must be less than 100%', 'error', 3000)
            setShowConfirmDialog(false)
            setPendingUpdate(null)
            return
          }
          newPrice = costPrice / (1 - marginDecimal)
        }

        // Round to 2 decimal places
        newPrice = Math.round(newPrice * 100) / 100

        // Update the row in the grid - use composite key
        gridInstance.cellValue(gridInstance.getRowIndexByKey(row.compositeKey), 'sellingPrice', newPrice)
        updatedCount++
      }
    })

    // Close dialog and show success
    setShowConfirmDialog(false)
    setPendingUpdate(null)

    notify(
      `Applied ${calculationType} of ${percentage}% to ${updatedCount} product${updatedCount !== 1 ? 's' : ''}`,
      'success',
      3000
    )
  }

  // 3-Step Confirmation Handlers
  const handleStep1Confirm = () => {
    setStep1DialogVisible(false)
    setConfirmationStep(2)
    setStep2DialogVisible(true)
  }

  const handleStep2Confirm = () => {
    setStep2DialogVisible(false)
    setConfirmationStep(3)
    setStep3DialogVisible(true)
  }

  const handleStep3Confirm = () => {
    setStep3DialogVisible(false)
    setConfirmationStep(0)
    // Proceed with actual price update
    applyBulkPricing()
  }

  // Cancel any confirmation step
  const cancelConfirmation = () => {
    setStep1DialogVisible(false)
    setStep2DialogVisible(false)
    setStep3DialogVisible(false)
    setConfirmationStep(0)
    setPendingUpdate(null)
  }

  // Cancel confirmation (legacy function)
  const cancelBulkPricing = () => {
    cancelConfirmation()
  }

  const handleExport = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Bulk Prices')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'bulk-prices.xlsx')
      })
    })
  }, [])

  const renderPriceCell = (cellData: any) => {
    const price = cellData.value
    if (price === null || price === undefined) {
      return <span className="text-gray-400 italic">Not set</span>
    }
    return <span>₱{Number(price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  const renderPercentageCell = (cellData: any) => {
    const percentage = cellData.value
    if (percentage === null || percentage === undefined) {
      return <span className="text-gray-400 italic">-</span>
    }
    const color = percentage >= 0 ? 'text-green-600' : 'text-red-600'
    return <span className={color}>{percentage > 0 ? '+' : ''}{Number(percentage).toFixed(2)}%</span>
  }

  const renderProfitMarginCell = (cellData: any) => {
    const margin = cellData.value || 0
    let colorClass = 'text-gray-600'
    if (margin > 30) colorClass = 'text-green-600 font-semibold'
    else if (margin > 15) colorClass = 'text-green-500'
    else if (margin > 0) colorClass = 'text-yellow-600'
    else colorClass = 'text-red-600 font-semibold'

    return <span className={colorClass}>{margin.toFixed(2)}%</span>
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to edit product prices.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading bulk price editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Bulk Price Editor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Edit prices for multiple products and locations simultaneously
          </p>
        </div>

        {/* Location Selection Panel */}
        {canMultiLocation && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <span className="text-2xl">📍</span>
                  Select Target Locations
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Choose which locations will receive price updates when you edit and save changes
                </p>

                {/* Location Checkboxes */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <input
                      type="checkbox"
                      id="select-all-locations"
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedLocations.length === locations.length}
                      onChange={toggleAllLocations}
                    />
                    <label htmlFor="select-all-locations" className="text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                      Select All Locations ({locations.length})
                    </label>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {locations.map(location => (
                      <label key={location.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedLocations.includes(location.id)}
                          onChange={() => toggleLocationSelection(location.id)}
                        />
                        <span>{location.name}</span>
                      </label>
                    ))}
                  </div>

                  {selectedLocations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ✓ {selectedLocations.length} location{selectedLocations.length !== 1 ? 's' : ''} selected
                        {selectedLocations.length > 0 && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                            ({selectedLocations.map(id => getLocationName(id)).join(', ')})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Debug Info - Remove after testing */}
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-xs">
                  <div className="font-mono">
                    <div>Has Grid Changes: {hasGridChanges ? 'Yes' : 'No'}</div>
                    <div>Pending Changes: {pendingChanges.size}</div>
                    <div>Selected Locations: {selectedLocations.length}</div>
                    <div>Saving: {saving ? 'Yes' : 'No'}</div>
                    <div>Button Disabled: {(saving || selectedLocations.length === 0) ? 'Yes' : 'No'}</div>
                    <div className="mt-2 text-green-600 dark:text-green-400">
                      ✅ Save button is always enabled when locations are selected
                    </div>
                  </div>
                </div>

                {/* Save Price Changes Button */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSavePrices}
                    disabled={saving || selectedLocations.length === 0}
                    className={`
                      px-6 py-3 rounded-lg font-semibold text-white shadow-lg transition-all duration-200
                      ${saving || selectedLocations.length === 0
                        ? 'bg-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-green-600 hover:bg-green-700 hover:shadow-xl transform hover:scale-105'
                      }
                    `}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving Changes...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Price Changes
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Changes Indicator */}
        {pendingChanges.size > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                {pendingChanges.size} unsaved price change{pendingChanges.size !== 1 ? 's' : ''} pending
              </span>
            </div>
          </div>
        )}

        {/* Bulk Pricing Controls */}
        <div
          className={`${showBulkApplySection ? '' : 'hidden'} bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-md p-6 mb-6`}
        >
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-2xl">🏷️</span>
                Bulk Apply Pricing
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Apply markup or margin percentage to selected products or all products
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Main Warehouse excluded (non-selling location)</span>
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Calculation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Calculation Type
                </label>
                <SelectBox
                  items={[
                    { value: 'markup', text: 'Markup %' },
                    { value: 'margin', text: 'Margin %' },
                  ]}
                  displayExpr="text"
                  valueExpr="value"
                  value={calculationType}
                  onValueChanged={(e) => setCalculationType(e.value)}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  width={150}
                />
              </div>

              {/* Percentage Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Percentage
                </label>
                <NumberBox
                  value={bulkPercentage}
                  onValueChanged={(e) => setBulkPercentage(e.value)}
                  format="#0.00'%'"
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  width={120}
                  min={-100}
                  max={999}
                  showSpinButtons={true}
                  step={5}
                />
              </div>

              {/* Apply Buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  text="Apply to Selected"
                  icon="check"
                  type="default"
                  onClick={() => handleBulkApplyPricing(false)}
                  stylingMode="contained"
                  className="dx-theme-material-typography"
                  width={160}
                />
                <Button
                  text="Apply to All"
                  icon="selectall"
                  type="normal"
                  onClick={() => handleBulkApplyPricing(true)}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  width={160}
                />
              </div>
            </div>
          </div>

          {/* Formula Helper */}
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <strong className="text-blue-700 dark:text-blue-300">Markup Formula:</strong>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Selling Price = Cost × (1 + Markup% ÷ 100)
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-1 italic">
                  Example: Cost ₱100, Markup 20% → Selling ₱120
                </p>
              </div>
              <div>
                <strong className="text-indigo-700 dark:text-indigo-300">Margin Formula:</strong>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Selling Price = Cost ÷ (1 - Margin% ÷ 100)
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-1 italic">
                  Example: Cost ₱100, Margin 20% → Selling ₱125
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* DataGrid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <DataGrid
            ref={dataGridRef}
            dataSource={priceData}
            keyExpr="compositeKey"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onExporting={handleExport}
            onCellValueChanged={handleCellValueChanged}
            className="dx-theme-material-typography"
          >
            <Grouping autoExpandAll={false} />
            <GroupPanel visible={true} />
            <SearchPanel
              visible={true}
              width={240}
              placeholder="Search all columns..."
              searchVisibleColumnsOnly={false}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Selection mode="multiple" showCheckBoxesMode="always" />
            <Scrolling
              mode="virtual"
              rowRenderingMode="virtual"
              columnRenderingMode="virtual"
              showScrollbar="always"
              useNative="auto"
              scrollByContent={true}
              scrollByThumb={true}
            />
            <Paging defaultPageSize={100} />
            <Pager
              visible={true}
              displayMode="full"
              showPageSizeSelector={true}
              allowedPageSizes={[20, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <ColumnChooser enabled={true} mode="select" height={400}>
              <ColumnChooserSearch enabled={true} />
              <ColumnChooserSelection allowSelectAll={true} />
            </ColumnChooser>
            <Export enabled={true} allowExportSelectedData={true} />
            <Editing
              mode="batch"
              allowUpdating={true}
              selectTextOnEditStart={true}
              startEditAction="click"
            />

            <Column dataField="productName" caption="Product" width={250} allowEditing={false} />
            <Column dataField="productSku" caption="SKU" width={120} allowEditing={false} />
            <Column dataField="variationName" caption="Variation" width={150} allowEditing={false} />
            <Column dataField="locationName" caption="Location" width={150} allowEditing={false} groupIndex={0} />

            <Column
              dataField="basePrice"
              caption="Base Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              allowEditing={false}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="costPrice"
              caption="Cost Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              allowEditing={false}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="sellingPrice"
              caption="Selling Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={130}
              cellRender={renderPriceCell}
              editorOptions={{
                format: { type: 'currency', currency: 'PHP' },
                min: 0,
              }}
            />

            {pricingStrategy === 'percentage' && (
              <Column
                dataField="pricePercentage"
                caption="Price %"
                dataType="number"
                format="#0.00'%'"
                width={100}
                cellRender={renderPercentageCell}
                editorOptions={{
                  format: "#0.00'%'",
                }}
              />
            )}

            <Column
              dataField="calculatedPrice"
              caption="Calculated Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={140}
              allowEditing={false}
              cellRender={renderPriceCell}
              calculateCellValue={(rowData: any) => calculatePrice(rowData)}
            />

            <Column
              dataField="profitMargin"
              caption="Profit Margin"
              dataType="number"
              format="#0.00'%'"
              width={120}
              allowEditing={false}
              cellRender={renderProfitMarginCell}
              calculateCellValue={(rowData: any) => calculateProfitMargin(rowData)}
            />

            <Summary>
              <TotalItem column="productName" summaryType="count" displayFormat="Total: {0} items" />
              <TotalItem
                column="profitMargin"
                summaryType="avg"
                valueFormat="#0.00'%'"
                displayFormat="Avg Margin: {0}"
              />
            </Summary>

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item location="after">
                <Button
                  text="Refresh"
                  icon="refresh"
                  onClick={fetchPriceData}
                  stylingMode="text"
                  className="dx-theme-material-typography"
                />
              </Item>
              <Item location="after">
                <Button
                  text={saving ? 'Saving...' : `Save All Changes${pendingChanges.size > 0 ? ` (${pendingChanges.size})` : ''}`}
                  icon="save"
                  type="success"
                  onClick={handleSavePrices}
                  disabled={saving || pendingChanges.size === 0 || selectedLocations.length === 0}
                  stylingMode="contained"
                  className="dx-theme-material-typography"
                />
              </Item>
              <Item name="exportButton" />
          </Toolbar>
        </DataGrid>
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 Quick Tips
          </h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Location Selection:</strong> Select target locations above - price changes will apply to all checked locations</li>
            <li>• <strong>Edit Prices:</strong> Click any cell in "Selling Price" column to edit prices manually</li>
            <li>• <strong>Save Changes:</strong> Use the green "Save Price Changes" button to save your edits to selected locations</li>
            {showBulkApplySection && (
              <>
                <li>• <strong>Bulk Pricing (Super Admin):</strong> Select products (checkboxes) and click "Apply to Selected" to apply markup/margin</li>
                <li>• <strong>Markup vs Margin:</strong> Markup adds % to cost, Margin ensures % profit in final price</li>
              </>
            )}
            <li>• <strong>Search Panel:</strong> Use the search box to filter across all columns instantly</li>
            <li>• <strong>Column Filters:</strong> Click column headers to filter individual columns</li>
            <li>• <strong>Header Filters:</strong> Use dropdown filters on each column for advanced filtering</li>
            <li>• Group by location to see all products for each branch</li>
            <li>• <strong>Performance:</strong> Grid uses virtual scrolling for smooth handling of thousands of records</li>
            <li>• Export to Excel for offline editing and analysis</li>
            <li>• Changes are tracked - pending changes are shown in yellow banner</li>
            <li>• Current Strategy: <strong>{pricingStrategy.toUpperCase()}</strong></li>
          </ul>
        </div>

        {/* Step 1 Confirmation Dialog - Basic Warning */}
        <Popup
          visible={step1DialogVisible}
          onHiding={cancelConfirmation}
          onShown={() => {
            // Focus the "No" button when dialog opens
            setTimeout(() => {
              if (step1NoButtonRef.current) {
                step1NoButtonRef.current.instance.focus()
              }
            }, 100)
          }}
          dragEnabled={false}
          closeOnOutsideClick={false}
          showTitle={true}
          title="⚠️ Step 1 of 3: Basic Warning"
          width={600}
          height="auto"
          className="dx-theme-material-typography"
        >
          <div className="p-4">
            {/* Warning Message */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    ⚠️ BULK PRICE UPDATE INITIATED
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    You are about to modify {pendingUpdate?.count || 0} product prices. This action will affect customer pricing.
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Details */}
            <div className="space-y-3 mb-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {calculationType === 'markup' ? 'Markup' : 'Margin'} {bulkPercentage}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {pendingUpdate?.applyToAll ? 'All Products in Grid' : 'Selected Products Only'}
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {pendingUpdate?.count || 0} Products
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  📍 You are on Step 1 of 3 confirmations
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  Two additional warnings will follow. Each step requires explicit confirmation.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                text="No, Cancel This Action"
                type="normal"
                stylingMode="contained"
                onClick={cancelConfirmation}
                className="dx-theme-material-typography bg-red-500 text-white hover:bg-red-600"
                width={180}
                ref={step1NoButtonRef}
              />
              <Button
                text="Yes, Continue to Step 2"
                type="default"
                stylingMode="outlined"
                onClick={handleStep1Confirm}
                className="dx-theme-material-typography"
                width={180}
              />
            </div>
          </div>
        </Popup>

        {/* Step 2 Confirmation Dialog - Detailed Impact */}
        <Popup
          visible={step2DialogVisible}
          onHiding={cancelConfirmation}
          onShown={() => {
            // Focus the "No" button when dialog opens
            setTimeout(() => {
              if (step2NoButtonRef.current) {
                step2NoButtonRef.current.instance.focus()
              }
            }, 100)
          }}
          dragEnabled={false}
          closeOnOutsideClick={false}
          showTitle={true}
          title="⚠️ Step 2 of 3: Impact Analysis"
          width={650}
          height="auto"
          className="dx-theme-material-typography"
        >
          <div className="p-4">
            {/* Serious Warning Message */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 dark:border-orange-600 p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    🚨 FINANCIAL IMPACT WARNING
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    This pricing change will have real financial consequences on sales, revenue, and customer relationships.
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Impact Analysis */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Calculation Type</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {calculationType === 'markup' ? 'Markup' : 'Margin'} {bulkPercentage}%
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Products Affected</div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {pendingUpdate?.count || 0} products
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Formula Applied:</div>
                <div className="text-sm text-blue-700 dark:text-blue-300 font-mono">
                  {calculationType === 'markup'
                    ? `New Price = Cost × (1 + ${bulkPercentage}% ÷ 100)`
                    : `New Price = Cost ÷ (1 - ${bulkPercentage}% ÷ 100)`}
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded">
                <div className="flex items-center text-sm text-red-800 dark:text-red-200">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong>⚠️ IMPORTANT:</strong> This action cannot be easily undone. You will need to manually reverse each price change if this is an error.
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  📍 You are on Step 2 of 3 confirmations
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  One final warning will appear after this. Consider the financial impact carefully.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                text="No, Do Not Update Prices"
                type="normal"
                stylingMode="contained"
                onClick={cancelConfirmation}
                className="dx-theme-material-typography bg-red-500 text-white hover:bg-red-600"
                width={180}
                ref={step2NoButtonRef}
              />
              <Button
                text="Yes, I Understand - Continue"
                type="default"
                stylingMode="outlined"
                onClick={handleStep2Confirm}
                className="dx-theme-material-typography"
                width={200}
              />
            </div>
          </div>
        </Popup>

        {/* Step 3 Confirmation Dialog - Final Irreversible Action */}
        <Popup
          visible={step3DialogVisible}
          onHiding={cancelConfirmation}
          onShown={() => {
            // Focus the "No" button when dialog opens
            setTimeout(() => {
              if (step3NoButtonRef.current) {
                step3NoButtonRef.current.instance.focus()
              }
            }, 100)
          }}
          dragEnabled={false}
          closeOnOutsideClick={false}
          showTitle={true}
          title="⚠️ Step 3 of 3: FINAL CONFIRMATION"
          width={700}
          height="auto"
          className="dx-theme-material-typography"
        >
          <div className="p-4">
            {/* Critical Warning Message */}
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    🚨 FINAL WARNING - IRREVERSIBLE ACTION
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    This is your last chance to cancel. Once confirmed, pricing changes will be applied immediately to {pendingUpdate?.count || 0} products.
                  </p>
                </div>
              </div>
            </div>

            {/* Final Impact Summary */}
            <div className="space-y-4 mb-6">
              <div className="bg-gray-900 text-white p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-xl font-bold mb-2">ACTION SUMMARY</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Operation</div>
                      <div className="text-lg font-semibold">{calculationType === 'markup' ? 'Markup' : 'Margin'} {bulkPercentage}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Products</div>
                      <div className="text-lg font-semibold text-yellow-400">{pendingUpdate?.count || 0} items</div>
                    </div>
                  </div>
                  {pendingUpdate?.applyToAll && (
                    <div className="mt-3 text-red-400 text-sm font-semibold">
                      📍 This will apply to ALL products in the grid
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 p-4 rounded">
                <div className="flex items-center text-center text-sm text-yellow-800 dark:text-yellow-200">
                  <svg className="h-8 w-8 mr-3 flex-shrink-0 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-lg">FINAL CONFIRMATION REQUIRED</strong><br/>
                    Clicking "Yes, Apply Changes" will immediately execute the price update.<br/>
                    There is no undo button. You will need to manually reverse changes if needed.
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  📍 This is Step 3 of 3 (Final Warning)
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  After this confirmation, the price update will be executed immediately.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                text="🚫 NO! CANCEL THIS ACTION"
                type="normal"
                stylingMode="contained"
                onClick={cancelConfirmation}
                className="dx-theme-material-typography bg-red-600 text-white hover:bg-red-700 font-bold"
                width={200}
                ref={step3NoButtonRef}
              />
              <Button
                text="✅ YES, APPLY CHANGES NOW"
                type="default"
                stylingMode="contained"
                onClick={handleStep3Confirm}
                className="dx-theme-material-typography bg-green-600 text-white hover:bg-green-700 font-bold"
                width={220}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  )
}
