'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Toolbar,
  Item,
  Summary,
  TotalItem,
  GroupPanel,
  Grouping,
} from 'devextreme-react/data-grid'
import { Button } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface Location {
  id: number
  name: string
}

interface PriceComparisonData {
  productVariationId: number
  productName: string
  productSku: string
  variationName: string
  categoryName: string
  brandName: string
  basePrice: number
  costPrice: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  priceVariance: number
  priceVariancePercent: number
  hasVariance: boolean
  latestPurchaseDate: string | null
  [key: string]: any
}

export default function PriceComparisonReportPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PriceComparisonData[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const dataGridRef = useRef<DataGrid>(null)
  const displayLocations = useMemo(
    () => locations.filter((location) => location.name?.toLowerCase() !== 'main warehouse'),
    [locations]
  )

  const hasAccess = can(PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW)

  useEffect(() => {
    if (hasAccess) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [hasAccess])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports/price-comparison')
      const result = await response.json()

      if (response.ok && result.success) {
        setData(result.data)
        setLocations(result.metadata.locations)
      } else {
        notify(result.error || 'Failed to fetch price comparison data', 'error', 3000)
      }
    } catch (error) {
      console.error('Fetch data error:', error)
      notify('Failed to fetch price comparison data', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Price Comparison')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'price-comparison-report.xlsx')
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

  const renderDateCell = (cellData: any) => {
    const dateValue = cellData.value
    if (!dateValue) {
      return <span className="text-gray-400 italic">Not purchased yet</span>
    }
    const date = new Date(dateValue)
    return <span>{date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
  }

  // Handler for Edit Price button
  const handleEditPrice = useCallback((sku: string) => {
    router.push(`/dashboard/products/simple-price-editor?sku=${encodeURIComponent(sku)}`)
  }, [router])

  // Render Edit Price button
  const renderEditPriceCell = useCallback((cellData: any) => {
    const sku = cellData.data?.productSku
    return (
      <button
        onClick={() => handleEditPrice(sku)}
        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
        title={`Edit prices for ${sku}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit Price
      </button>
    )
  }, [handleEditPrice])

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view price comparison reports.
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
          <p className="text-gray-600 dark:text-gray-400">Loading price comparison report...</p>
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
            Price Comparison Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Compare product prices across all locations and identify variances
          </p>
        </div>

        {/* DataGrid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <DataGrid
            ref={dataGridRef}
            dataSource={data}
            keyExpr="productVariationId"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            allowColumnFixing={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            onExporting={handleExport}
            className="dx-theme-material-typography"
          >
            <Grouping autoExpandAll={false} />
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search products..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Paging defaultPageSize={20} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[20, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <ColumnChooser enabled={true} mode="select" height={400}>
              <ColumnChooserSearch enabled={true} />
              <ColumnChooserSelection allowSelectAll={true} />
            </ColumnChooser>
            <Export enabled={true} allowExportSelectedData={false} />

            <Column dataField="productName" caption="Product" width={250} fixed={true} fixedPosition="left" />
            <Column dataField="productSku" caption="SKU" width={120} fixed={true} fixedPosition="left" />
            <Column
              caption="Action"
              width={110}
              fixed={true}
              fixedPosition="left"
              cellRender={renderEditPriceCell}
              allowFiltering={false}
              allowSorting={false}
              allowHeaderFiltering={false}
              allowExporting={false}
            />
            <Column dataField="categoryName" caption="Category" width={150} fixed={true} fixedPosition="left" />
            <Column dataField="brandName" caption="Brand" width={150} fixed={true} fixedPosition="left" />

            <Column
              dataField="latestPurchaseDate"
              caption="Latest Purchase"
              dataType="date"
              width={140}
              cellRender={renderDateCell}
              sortOrder="desc"
              allowSorting={true}
            />

            <Column
              dataField="costPrice"
              caption="Cost Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            {/* Dynamic location columns */}
            {displayLocations.map((location) => (
              <Column
                key={location.id}
                dataField={`location_${location.id}`}
                caption={location.name}
                dataType="number"
                format={{ type: 'currency', currency: 'PHP' }}
                width={140}
                cellRender={renderPriceCell}
              />
            ))}

            <Summary>
              <TotalItem column="productName" summaryType="count" displayFormat="Total: {0} products" />
            </Summary>

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item location="after">
                <Button
                  text="Refresh"
                  icon="refresh"
                  onClick={fetchData}
                  stylingMode="text"
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
            💡 How to Use
          </h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Cost Price</strong>: The purchase cost (for reference)</li>
            <li>• <strong>Location Columns</strong>: Show the selling price at each branch</li>
            <li>• Click <strong>"Edit Price"</strong> to update prices for any product</li>
            <li>• Use the search bar or column filters to find specific products</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
