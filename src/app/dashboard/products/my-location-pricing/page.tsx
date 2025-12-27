'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import DataGrid, {
  Column,
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
import { LoadPanel } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface Location {
  id: number
  name: string
}

interface PriceRow {
  compositeKey: string
  productId: number
  productName: string
  productSKU: string
  unitId: number
  unitName: string
  unitShortName: string
  sellingPrice: number
  profitMargin: number
}

export default function MyLocationPricingPage() {
  const { can, user } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<Location | null>(null)
  const [priceData, setPriceData] = useState<PriceRow[]>([])
  const dataGridRef = useRef<DataGrid>(null)

  // Permission checks
  const canView =
    can(PERMISSIONS.PRODUCT_VIEW) ||
    can(PERMISSIONS.PRODUCT_PRICE_EDIT)

  useEffect(() => {
    if (canView && user) {
      fetchUserLocation()
    } else {
      setLoading(false)
    }
  }, [canView, user])

  async function fetchUserLocation() {
    try {
      setLoading(true)

      const res = await fetch('/api/user-locations')

      if (!res.ok) {
        throw new Error(`Failed to fetch assigned location: ${res.status}`)
      }

      const data = await res.json()
      const allLocations = data.locations || []

      // Filter out warehouse locations (not selling locations)
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
        setUserLocation(null)
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error fetching user location:', error)
      notify(
        error.message || 'Failed to load user location',
        'error',
        5000
      )
      setLoading(false)
    }
  }

  async function fetchLocationPrices(locationId: number) {
    try {
      setLoading(true)

      const res = await fetch(`/api/locations/${locationId}/prices`)

      if (!res.ok) {
        let errorMessage = 'Failed to fetch location prices'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = `Server error: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      const products = data.products || []

      // Flatten for DataGrid and calculate profit margin
      const flatData: PriceRow[] = []
      products.forEach((product: any) => {
        product.prices.forEach((price: any) => {
          const purchasePrice = parseFloat(price.purchasePrice)
          const sellingPrice = parseFloat(price.sellingPrice)
          const profitMargin = purchasePrice > 0
            ? ((sellingPrice - purchasePrice) / purchasePrice) * 100
            : 0

          flatData.push({
            compositeKey: `${product.productId}-${price.unitId}`,
            productId: product.productId,
            productName: product.productName,
            productSKU: product.productSKU,
            unitId: price.unitId,
            unitName: price.unitName,
            unitShortName: price.unitShortName,
            sellingPrice: sellingPrice,
            profitMargin: profitMargin,
          })
        })
      })

      setPriceData(flatData)
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching location prices:', error)
      notify(
        error.message || 'Failed to load location prices',
        'error',
        5000
      )
      setPriceData([])
      setLoading(false)
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
          `${userLocation?.name}_Pricing_List.xlsx`
        )
      })
    })
  }, [userLocation])

  const renderProfitMarginCell = useCallback((cellData: any) => {
    const margin = cellData.value
    const color = margin < 0 ? 'red' : margin < 10 ? 'orange' : 'green'
    return (
      <span style={{ color, fontWeight: 'bold' }}>
        {margin.toFixed(2)}%
      </span>
    )
  }, [])

  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900 p-4 text-red-800 dark:text-red-200">
          <p className="font-semibold">Access Denied</p>
          <p className="mt-1 text-sm">
            You do not have permission to view product pricing.
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
        visible={loading}
        message="Loading pricing data..."
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
                View-only price list for <span className="font-semibold text-gray-700 dark:text-gray-300">{userLocation?.name}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>Location:</strong> {userLocation?.name} |
              <strong className="ml-2">Total Products:</strong> {priceData.length} |
              <strong className="ml-2">Tip:</strong> Use the Simple Price Editor to update prices
            </span>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto h-full">
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
            wordWrapEnabled={false}
            height="100%"
            onExporting={onExporting}
          >
            <Grouping contextMenuEnabled={true} />
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search products..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Scrolling mode="virtual" rowRenderingMode="virtual" />
            <Paging defaultPageSize={100} />
            <Pager
              visible={true}
              displayMode="full"
              allowedPageSizes={[50, 100, 200, 'all']}
              showPageSizeSelector={true}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Export enabled={true} allowExportSelectedData={false} />

            <Column
              dataField="productName"
              caption="Product"
              groupIndex={0}
            />

            <Column
              dataField="productSKU"
              caption="SKU"
              width={150}
            />

            <Column
              dataField="unitName"
              caption="Unit"
              width={120}
            />

            <Column
              dataField="sellingPrice"
              caption="Selling Price"
              dataType="number"
              format={{ type: 'fixedPoint', precision: 2 }}
              width={140}
            />

            <Column
              dataField="profitMargin"
              caption="Profit Margin"
              width={130}
              cellRender={renderProfitMarginCell}
              alignment="center"
            />

            <Summary>
              <TotalItem
                column="productName"
                summaryType="count"
                displayFormat="{0} products"
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
