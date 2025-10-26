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
} from 'devextreme-react/data-grid'
import { SelectBox, Button, NumberBox, Popup } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import confirm from 'devextreme/ui/dialog'
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

export default function BulkPriceEditorPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [pricingStrategy, setPricingStrategy] = useState<string>('fallback')
  const dataGridRef = useRef<DataGrid>(null)

  // Bulk markup/margin state
  const [bulkPercentage, setBulkPercentage] = useState<number>(20)
  const [calculationType, setCalculationType] = useState<'markup' | 'margin'>('markup')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{ applyToAll: boolean; count: number } | null>(null)

  const hasEditAll = can(PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
  const hasEdit = can(PERMISSIONS.PRODUCT_PRICE_EDIT)
  const hasBulkEdit = can(PERMISSIONS.PRODUCT_PRICE_BULK_EDIT)
  const hasAccess = hasEditAll || hasEdit || hasBulkEdit

  useEffect(() => {
    if (hasAccess) {
      fetchInitialData()
    } else {
      setLoading(false)
    }
  }, [hasAccess])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch locations
      const locationsResponse = await fetch('/api/locations')
      const locationsResult = await locationsResponse.json()
      if (locationsResponse.ok && locationsResult.success) {
        setLocations(locationsResult.data)
        if (locationsResult.data.length > 0) {
          setSelectedLocationId(locationsResult.data[0].id)
        }
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

      if (response.ok && result.success) {
        // EXCLUDE Main Warehouse - it doesn't sell products
        const filteredData = result.data.filter((item: any) =>
          !item.locationName.toLowerCase().includes('main warehouse')
        )

        const data = filteredData.map((item: any) => ({
          ...item,
          calculatedPrice: calculatePrice(item),
          profitMargin: calculateProfitMargin(item),
        }))
        setPriceData(data)

        // Show notification if Main Warehouse was filtered out
        const excludedCount = result.data.length - filteredData.length
        if (excludedCount > 0) {
          console.log(`Excluded ${excludedCount} Main Warehouse products from price editor`)
        }
      } else {
        notify(result.error || 'Failed to fetch price data', 'error', 3000)
      }
    } catch (error) {
      console.error('Fetch price data error:', error)
      notify('Failed to fetch price data', 'error', 3000)
    }
  }

  const calculatePrice = (item: any): number => {
    if (pricingStrategy === 'percentage' && item.pricePercentage !== null) {
      return item.basePrice * (1 + item.pricePercentage / 100)
    }
    return item.sellingPrice || item.basePrice
  }

  const calculateProfitMargin = (item: any): number => {
    const price = calculatePrice(item)
    if (price > 0 && item.costPrice > 0) {
      return ((price - item.costPrice) / price) * 100
    }
    return 0
  }

  const handleSavePrices = async () => {
    if (!dataGridRef.current) return

    try {
      setSaving(true)
      const gridInstance = dataGridRef.current.instance

      // Get all modified rows
      const changes = gridInstance.option('editing.changes') || []
      if (changes.length === 0) {
        notify('No changes to save', 'info', 2000)
        return
      }

      // Build updates array
      const updates = changes
        .filter((change: any) => change.type === 'update')
        .map((change: any) => {
          const rowData = { ...change.data }
          return {
            productVariationId: change.key.productVariationId || rowData.productVariationId,
            locationId: change.key.locationId || rowData.locationId,
            sellingPrice: rowData.sellingPrice,
            pricePercentage: rowData.pricePercentage,
          }
        })

      if (updates.length === 0) {
        notify('No price changes detected', 'info', 2000)
        return
      }

      // Send bulk update request
      const response = await fetch('/api/products/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        notify(result.message || 'Prices updated successfully', 'success', 3000)
        gridInstance.option('editing.changes', []) // Clear changes
        await fetchPriceData() // Refresh data
      } else {
        notify(result.error || 'Failed to update prices', 'error', 3000)
        if (result.data?.errors?.length > 0) {
          console.error('Bulk update errors:', result.data.errors)
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
        selectedKeys.some(
          (key: any) =>
            key.productVariationId === item.productVariationId &&
            key.locationId === item.locationId
        ) && Number(item.costPrice) > 0
      )
    }

    if (rowsToUpdate.length === 0) {
      notify('No products with cost price found to update', 'warning', 3000)
      return
    }

    // Show confirmation dialog
    setPendingUpdate({ applyToAll, count: rowsToUpdate.length })
    setShowConfirmDialog(true)
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
        selectedKeys.some(
          (key: any) =>
            key.productVariationId === item.productVariationId &&
            key.locationId === item.locationId
        )
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

        // Update the row in the grid
        const rowKey = { productVariationId: row.productVariationId, locationId: row.locationId }
        gridInstance.cellValue(gridInstance.getRowIndexByKey(rowKey), 'sellingPrice', newPrice)
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

  // Cancel confirmation
  const cancelBulkPricing = () => {
    setShowConfirmDialog(false)
    setPendingUpdate(null)
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

        {/* Bulk Pricing Controls */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-md p-6 mb-6">
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
            keyExpr={(data) => `${data.productVariationId}-${data.locationId}`}
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onExporting={handleExport}
            className="dx-theme-material-typography"
          >
            <Grouping autoExpandAll={false} />
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search products..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Selection mode="multiple" showCheckBoxesMode="always" />
            <Paging defaultPageSize={50} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[20, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />
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
                  text={saving ? 'Saving...' : 'Save All Changes'}
                  icon="save"
                  type="success"
                  onClick={handleSavePrices}
                  disabled={saving}
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
            <li>• <strong>Bulk Pricing:</strong> Select products (checkboxes) and click "Apply to Selected" to apply markup/margin</li>
            <li>• <strong>Markup vs Margin:</strong> Markup adds % to cost, Margin ensures % profit in final price</li>
            <li>• Click any cell in "Selling Price" column to edit prices manually</li>
            <li>• Use filters and search to find specific products quickly</li>
            <li>• Group by location to see all products for each branch</li>
            <li>• Export to Excel for offline editing and analysis</li>
            <li>• Changes are saved in batch when you click "Save All Changes"</li>
            <li>• Current Strategy: <strong>{pricingStrategy.toUpperCase()}</strong></li>
          </ul>
        </div>

        {/* Confirmation Dialog */}
        <Popup
          visible={showConfirmDialog}
          onHiding={cancelBulkPricing}
          dragEnabled={false}
          closeOnOutsideClick={false}
          showTitle={true}
          title="⚠️ Confirm Bulk Price Update"
          width={550}
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
                    Double Confirmation Required
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    You are about to update prices for multiple products. Please review carefully before proceeding.
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Calculation Type</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {calculationType === 'markup' ? 'Markup' : 'Margin'} {bulkPercentage}%
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Products to Update</div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {pendingUpdate?.count || 0} products
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Formula:</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {calculationType === 'markup'
                    ? `New Price = Cost × (1 + ${bulkPercentage}% ÷ 100)`
                    : `New Price = Cost ÷ (1 - ${bulkPercentage}% ÷ 100)`}
                </div>
              </div>

              {pendingUpdate?.applyToAll && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded">
                  <div className="flex items-center text-sm text-red-800 dark:text-red-200">
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <strong>Warning: Applying to ALL products in the grid!</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                text="Cancel"
                type="normal"
                stylingMode="outlined"
                onClick={cancelBulkPricing}
                className="dx-theme-material-typography"
                width={120}
              />
              <Button
                text="Yes, Update Prices"
                type="default"
                stylingMode="contained"
                onClick={applyBulkPricing}
                className="dx-theme-material-typography"
                width={180}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  )
}
