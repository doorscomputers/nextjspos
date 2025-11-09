'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import DataGrid, {
  Column,
  Editing,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Scrolling,
} from 'devextreme-react/data-grid'
import { Button, LoadPanel } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface Location {
  id: number
  name: string
}

interface ProductPrice {
  productId: number
  productName: string
  productSKU: string
  prices: LocationPrice[]
}

interface LocationPrice {
  compositeKey: string
  locationId: number
  locationName: string
  unitId: number
  unitName: string
  unitShortName: string
  purchasePrice: number
  sellingPrice: number
  isLocationSpecific: boolean
  multiplier: number
}

export default function MyLocationPricingPage() {
  const { can, user } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userLocation, setUserLocation] = useState<Location | null>(null)
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([])
  const [flatPriceData, setFlatPriceData] = useState<any[]>([])
  const dataGridRef = useRef<DataGrid>(null)

  // Manual change tracking
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map())
  const [hasChanges, setHasChanges] = useState(false)

  // Retry utility for network requests
  const fetchWithRetry = async (url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          credentials: 'include',
        })

        // If successful or client error (4xx), return immediately
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response
        }

        // Server error (5xx) - retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff, max 5s
          console.log(`Attempt ${attempt} failed with status ${response.status}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        return response
      } catch (error: any) {
        lastError = error

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          console.log(`Network error on attempt ${attempt}, retrying in ${delay}ms...`, error.message)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Network request failed after retries')
  }

  // Permission checks
  const canEdit =
    can(PERMISSIONS.PRODUCT_UPDATE) ||
    can(PERMISSIONS.PRODUCT_PRICE_EDIT)

  const buildRowKey = useCallback((productId: number, locationId: number, unitId: number) => {
    return `${productId}-${locationId}-${unitId}`
  }, [])

  useEffect(() => {
    if (canEdit && user) {
      fetchUserLocation()
    } else {
      setLoading(false)
    }
  }, [canEdit, user])

  async function fetchUserLocation() {
    try {
      setLoading(true)

      const res = await fetchWithRetry('/api/user-locations', {
        method: 'GET',
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error('User locations fetch error:', res.status, errorText)
        throw new Error(`Failed to fetch assigned location: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const allLocations = data.locations || []

      // Filter out "Main Warehouse" locations (not selling locations)
      const sellingLocations = allLocations.filter((loc: any) =>
        !loc.name.toLowerCase().includes('main warehouse') &&
        !loc.name.toLowerCase().includes('warehouse')
      )

      // Automatically use the first assigned SELLING location
      if (sellingLocations.length > 0) {
        const location = sellingLocations[0]
        setUserLocation(location)
        await fetchLocationPrices(location.id)
      } else {
        // User only has warehouse locations assigned (not selling locations)
        setUserLocation(null)
      }

      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching user location:', error)
      notify(
        error.message || 'Failed to load user location. Please refresh the page.',
        'error',
        5000
      )
      setLoading(false)
    }
  }

  async function fetchLocationPrices(locationId: number) {
    try {
      setLoading(true)

      const res = await fetchWithRetry(`/api/locations/${locationId}/prices`, {
        method: 'GET',
      })

      if (!res.ok) {
        let errorMessage = 'Failed to fetch location prices'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          const errorText = await res.text()
          console.error('Location prices fetch error (non-JSON):', errorText)
          errorMessage = `Server error: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      const products = data.products || []

      setProductPrices(products)

      // Flatten for DataGrid
      const flatData: any[] = []
      products.forEach((product: ProductPrice) => {
        product.prices.forEach((price: LocationPrice) => {
          flatData.push({
            ...price,
            productId: product.productId,
            productName: product.productName,
            productSKU: product.productSKU,
            compositeKey: buildRowKey(product.productId, price.locationId, price.unitId),
          })
        })
      })

      setFlatPriceData(flatData)
      setPendingChanges(new Map())
      setHasChanges(false)
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching location prices:', error)
      notify(
        error.message || 'Failed to load location prices. Please try again.',
        'error',
        5000
      )
      setFlatPriceData([])
      setLoading(false)
    }
  }


  const onRowUpdating = useCallback((e: any) => {
    const key = e.key
    const newData = { ...e.oldData, ...e.newData }

    // Validate prices
    if (newData.sellingPrice < newData.purchasePrice) {
      notify('Selling price cannot be less than purchase price', 'error', 3000)
      e.cancel = true
      return
    }

    if (newData.purchasePrice < 0 || newData.sellingPrice < 0) {
      notify('Prices cannot be negative', 'error', 3000)
      e.cancel = true
      return
    }

    // Track the change
    setPendingChanges(prev => {
      const updated = new Map(prev)
      updated.set(key, newData)
      return updated
    })
    setHasChanges(true)
  }, [])

  const onRowUpdated = useCallback((e: any) => {
    // Update local data
    setFlatPriceData(prev => {
      return prev.map(row =>
        row.compositeKey === e.key ? { ...row, ...e.data } : row
      )
    })
  }, [])

  async function handleSave() {
    if (!userLocation || pendingChanges.size === 0) {
      notify('No changes to save', 'warning', 2000)
      return
    }

    try {
      setSaving(true)

      // Group changes by product
      const productChangesMap = new Map<number, any[]>()

      pendingChanges.forEach((change) => {
        const productId = change.productId
        if (!productChangesMap.has(productId)) {
          productChangesMap.set(productId, [])
        }

        productChangesMap.get(productId)!.push({
          locationId: change.locationId,
          unitId: change.unitId,
          purchasePrice: parseFloat(change.purchasePrice),
          sellingPrice: parseFloat(change.sellingPrice),
        })
      })

      // Build request body
      const productPrices = Array.from(productChangesMap.entries()).map(([productId, prices]) => ({
        productId,
        prices,
      }))

      const res = await fetchWithRetry(`/api/locations/${userLocation.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ productPrices }),
      })

      if (!res.ok) {
        let errorMessage = 'Failed to save prices'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          const errorText = await res.text()
          console.error('Save prices error (non-JSON):', errorText)
          errorMessage = `Server error: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      // Reload prices
      await fetchLocationPrices(userLocation.id)
      setSaving(false)

      notify(`Saved ${pendingChanges.size} price changes successfully`, 'success', 3000)
    } catch (error: any) {
      console.error('Error saving prices:', error)
      notify(
        error.message || 'Failed to save prices. Please try again.',
        'error',
        5000
      )
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!hasChanges) {
      return
    }

    if (confirm('Discard all unsaved changes?')) {
      // Reload prices from server
      if (userLocation) {
        fetchLocationPrices(userLocation.id)
      }
    }
  }

  const onExporting = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('My Location Pricing')

    exportDataGrid({
      component: e.component,
      worksheet: worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer: any) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          'My_Location_Pricing.xlsx'
        )
      })
    })
  }, [])

  const calculateProfitMargin = useCallback((purchasePrice: number, sellingPrice: number) => {
    if (purchasePrice === 0) return 0
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100
  }, [])

  const renderProfitMarginCell = useCallback((cellData: any) => {
    const margin = calculateProfitMargin(cellData.data.purchasePrice, cellData.data.sellingPrice)
    const color = margin < 0 ? 'red' : margin < 10 ? 'orange' : 'green'
    return (
      <span style={{ color, fontWeight: 'bold' }}>
        {margin.toFixed(2)}%
      </span>
    )
  }, [calculateProfitMargin])

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900 p-4 text-red-800 dark:text-red-200">
          <p className="font-semibold">Access Denied</p>
          <p className="mt-1 text-sm">
            You do not have permission to edit location pricing.
          </p>
        </div>
      </div>
    )
  }

  if (!loading && !userLocation) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900 p-4 text-yellow-800 dark:text-yellow-200">
          <p className="font-semibold">No Selling Location Assigned</p>
          <p className="mt-1 text-sm">
            You only have warehouse locations assigned. This page is for selling locations only.
          </p>
          <p className="mt-2 text-sm font-medium">
            Please contact your administrator to assign you to a selling location (e.g., Store, Branch, Outlet).
          </p>
          <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
            Note: Warehouses are for inventory storage only and do not sell products directly to customers.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <LoadPanel
        visible={loading || saving}
        message={saving ? 'Saving changes...' : 'Loading...'}
        showIndicator={true}
        showPane={true}
        shading={true}
        closeOnOutsideClick={false}
      />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                My Location Pricing
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Edit prices for <span className="font-semibold text-gray-700 dark:text-gray-300">{userLocation?.name}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Location:
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {userLocation?.name}
              </span>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  {pendingChanges.size} unsaved change(s)
                </span>
                <Button
                  text="Save Changes"
                  type="success"
                  onClick={handleSave}
                  disabled={saving}
                  icon="save"
                />
                <Button
                  text="Cancel"
                  type="normal"
                  onClick={handleCancel}
                  disabled={saving}
                  icon="revert"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto h-full">
          <DataGrid
            ref={dataGridRef}
            dataSource={flatPriceData}
            keyExpr="compositeKey"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={true}
            height="100%"
            onRowUpdating={onRowUpdating}
            onRowUpdated={onRowUpdated}
            onExporting={onExporting}
          >
            <Grouping contextMenuEnabled={true} />
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Scrolling mode="virtual" rowRenderingMode="virtual" />
            <Paging defaultPageSize={50} />
            <Pager
              visible={true}
              allowedPageSizes={[25, 50, 100, 'all']}
              showPageSizeSelector={true}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Editing
              mode="cell"
              allowUpdating={true}
              useIcons={true}
            />

            <Export enabled={true} allowExportSelectedData={false} />

            <Column
              dataField="productName"
              caption="Product"
              groupIndex={0}
              allowEditing={false}
            />

            <Column
              dataField="productSKU"
              caption="SKU"
              width={120}
              allowEditing={false}
            />

            <Column
              dataField="unitName"
              caption="Unit"
              width={120}
              allowEditing={false}
            />

            <Column
              dataField="purchasePrice"
              caption="Purchase Price"
              dataType="number"
              format={{ type: 'fixedPoint', precision: 2 }}
              width={140}
            />

            <Column
              dataField="sellingPrice"
              caption="Selling Price"
              dataType="number"
              format={{ type: 'fixedPoint', precision: 2 }}
              width={140}
            />

            <Column
              caption="Profit Margin"
              width={120}
              allowEditing={false}
              cellRender={renderProfitMarginCell}
              calculateCellValue={(rowData: any) =>
                calculateProfitMargin(rowData.purchasePrice, rowData.sellingPrice)
              }
            />

            <Column
              dataField="isLocationSpecific"
              caption="Custom Price?"
              dataType="boolean"
              width={120}
              allowEditing={false}
              trueText="Yes"
              falseText="No (Global)"
            />

            <Summary>
              <TotalItem
                column="productName"
                summaryType="count"
                displayFormat="{0} prices"
              />
            </Summary>

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="exportButton" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>
    </div>
  )
}
