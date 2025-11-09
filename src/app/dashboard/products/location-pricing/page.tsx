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
  Selection,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Scrolling,
  Button as GridButton,
} from 'devextreme-react/data-grid'
import { SelectBox, Button, NumberBox, LoadPanel } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface Location {
  id: number
  name: string
}

interface Unit {
  id: number
  name: string
  shortName: string
}

interface Product {
  id: number
  name: string
  sku: string
}

interface LocationPrice {
  compositeKey: string
  productId: number
  productName: string
  productSKU: string
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

export default function LocationPricingPage() {
  const { can, hasAnyRole, user } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priceData, setPriceData] = useState<LocationPrice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const dataGridRef = useRef<DataGrid>(null)

  // Manual change tracking
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map())
  const [hasChanges, setHasChanges] = useState(false)

  // Permission checks
  const canEdit =
    can(PERMISSIONS.PRODUCT_UPDATE) ||
    can(PERMISSIONS.PRODUCT_PRICE_EDIT)
  const isSuperAdmin = hasAnyRole(['Super Admin'])
  const isAdmin = hasAnyRole(['Admin'])
  const canAccessAllLocations = isSuperAdmin || isAdmin

  const buildRowKey = useCallback((productId: number, locationId: number, unitId: number) => {
    return `${productId}-${locationId}-${unitId}`
  }, [])

  useEffect(() => {
    if (canEdit) {
      fetchInitialData()
    } else {
      setLoading(false)
    }
  }, [canEdit])

  async function fetchInitialData() {
    try {
      setLoading(true)

      // Fetch products
      const productsRes = await fetch('/api/products/search?query=')
      if (!productsRes.ok) throw new Error('Failed to fetch products')
      const productsData = await productsRes.json()
      setProducts(productsData.products || [])

      // Fetch locations
      const locationsRes = await fetch('/api/locations')
      if (!locationsRes.ok) throw new Error('Failed to fetch locations')
      const locationsData = await locationsRes.json()
      setLocations(locationsData || [])

      setLoading(false)
    } catch (error) {
      console.error('Error fetching initial data:', error)
      notify('Failed to load data', 'error', 3000)
      setLoading(false)
    }
  }

  async function fetchProductLocationPrices(productId: number) {
    try {
      setLoading(true)

      const res = await fetch(`/api/products/${productId}/location-prices`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch location prices')
      }

      const data = await res.json()
      const prices = data.prices || []

      // Build composite key for each row
      const pricesWithKeys = prices.map((price: any) => ({
        ...price,
        compositeKey: buildRowKey(productId, price.locationId, price.unitId),
      }))

      setPriceData(pricesWithKeys)
      setPendingChanges(new Map())
      setHasChanges(false)
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching product location prices:', error)
      notify(error.message || 'Failed to load location prices', 'error', 3000)
      setLoading(false)
    }
  }

  const handleProductChange = useCallback((e: any) => {
    const productId = e.value
    setSelectedProduct(productId)

    if (productId) {
      // Clear pending changes when switching products
      if (hasChanges) {
        const confirmSwitch = confirm(
          'You have unsaved changes. Switching products will discard these changes. Continue?'
        )
        if (!confirmSwitch) {
          return
        }
      }

      fetchProductLocationPrices(productId)
    } else {
      setPriceData([])
      setPendingChanges(new Map())
      setHasChanges(false)
    }
  }, [hasChanges])

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
    setPriceData(prev => {
      return prev.map(row =>
        row.compositeKey === e.key ? { ...row, ...e.data } : row
      )
    })
  }, [])

  async function handleSave() {
    if (!selectedProduct || pendingChanges.size === 0) {
      notify('No changes to save', 'warning', 2000)
      return
    }

    try {
      setSaving(true)

      // Build prices array from pending changes
      const prices = Array.from(pendingChanges.values()).map(change => ({
        locationId: change.locationId,
        unitId: change.unitId,
        purchasePrice: parseFloat(change.purchasePrice),
        sellingPrice: parseFloat(change.sellingPrice),
      }))

      const res = await fetch(`/api/products/${selectedProduct}/location-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save prices')
      }

      const data = await res.json()

      // Update grid with saved prices
      const savedPrices = data.prices || []
      const pricesWithKeys = savedPrices.map((price: any) => ({
        ...price,
        compositeKey: buildRowKey(selectedProduct, price.locationId, price.unitId),
      }))

      setPriceData(pricesWithKeys)
      setPendingChanges(new Map())
      setHasChanges(false)
      setSaving(false)

      notify(`Saved ${prices.length} price changes successfully`, 'success', 3000)
    } catch (error: any) {
      console.error('Error saving prices:', error)
      notify(error.message || 'Failed to save prices', 'error', 3000)
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!hasChanges) {
      return
    }

    if (confirm('Discard all unsaved changes?')) {
      // Reload prices from server
      if (selectedProduct) {
        fetchProductLocationPrices(selectedProduct)
      }
    }
  }

  const onExporting = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Location Pricing')

    exportDataGrid({
      component: e.component,
      worksheet: worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer: any) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          'Location_Pricing.xlsx'
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Access Denied</p>
          <p className="mt-1 text-sm">
            You do not have permission to edit location pricing.
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
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Location-Specific Pricing
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Set different purchase and selling prices per location and unit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Selector */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Select Product:
            </label>
            <div className="flex-1 max-w-md">
              <SelectBox
                dataSource={products}
                displayExpr="name"
                valueExpr="id"
                searchEnabled={true}
                searchMode="contains"
                searchExpr={['name', 'sku']}
                placeholder="Choose a product..."
                value={selectedProduct}
                onValueChanged={handleProductChange}
                showClearButton={true}
                itemRender={(item: any) => (
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                  </div>
                )}
              />
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-orange-600 font-medium">
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
      <div className="flex-1 overflow-hidden bg-gray-50 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto h-full">
          {selectedProduct ? (
            <DataGrid
              ref={dataGridRef}
              dataSource={priceData}
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
                dataField="locationName"
                caption="Location"
                groupIndex={0}
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

              <Column
                dataField="multiplier"
                caption="Unit Multiplier"
                dataType="number"
                format={{ type: 'fixedPoint', precision: 2 }}
                width={120}
                allowEditing={false}
                visible={false}
              />

              <Summary>
                <TotalItem
                  column="locationName"
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
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No product selected
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a product from the dropdown above to view and edit location-specific pricing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
