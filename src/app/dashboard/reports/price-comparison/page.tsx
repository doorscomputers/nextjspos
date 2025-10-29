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
  [key: string]: any
}

export default function PriceComparisonReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PriceComparisonData[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const dataGridRef = useRef<DataGrid>(null)

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

  const renderVarianceCell = (cellData: any) => {
    const variance = cellData.value || 0
    if (variance === 0) {
      return <span className="text-gray-500">₱0.00</span>
    }
    return <span className="text-red-600 font-semibold">₱{variance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  const renderVariancePercentCell = (cellData: any) => {
    const percent = cellData.value || 0
    if (percent === 0) {
      return <span className="text-gray-500">0.00%</span>
    }
    const color = percent > 20 ? 'text-red-600 font-bold' : percent > 10 ? 'text-orange-600 font-semibold' : 'text-yellow-600'
    return <span className={color}>{percent.toFixed(2)}%</span>
  }

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
            <Export enabled={true} allowExportSelectedData={false} />

            <Column dataField="productName" caption="Product" width={250} fixed={true} fixedPosition="left" />
            <Column dataField="productSku" caption="SKU" width={120} fixed={true} fixedPosition="left" />
            <Column dataField="variationName" caption="Variation" width={150} fixed={true} fixedPosition="left" />
            <Column dataField="categoryName" caption="Category" width={150} fixed={true} fixedPosition="left" />
            <Column dataField="brandName" caption="Brand" width={150} fixed={true} fixedPosition="left" />

            <Column
              dataField="basePrice"
              caption="Base Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="costPrice"
              caption="Cost Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="minPrice"
              caption="Min Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="maxPrice"
              caption="Max Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="avgPrice"
              caption="Avg Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="priceVariance"
              caption="Variance Amount"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={140}
              cellRender={renderVarianceCell}
              sortOrder="desc"
            />

            <Column
              dataField="priceVariancePercent"
              caption="Variance %"
              dataType="number"
              format="#0.00'%'"
              width={120}
              cellRender={renderVariancePercentCell}
            />

            {/* Dynamic location columns */}
            {locations.map((location) => (
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
              <TotalItem
                column="avgPrice"
                summaryType="avg"
                valueFormat={{ type: 'currency', currency: 'PHP' }}
                displayFormat="Avg: {0}"
              />
              <TotalItem
                column="priceVariance"
                summaryType="avg"
                valueFormat={{ type: 'currency', currency: 'PHP' }}
                displayFormat="Avg Variance: {0}"
              />
            </Summary>

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
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
            📊 Understanding Price Variance
          </h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Variance Amount</strong>: Difference between highest and lowest price across locations</li>
            <li>• <strong>Variance %</strong>: Variance as percentage of base price</li>
            <li>• <strong className="text-red-600">High Variance (&gt;20%)</strong>: Requires review - pricing may be inconsistent</li>
            <li>• <strong className="text-orange-600">Medium Variance (10-20%)</strong>: Monitor - acceptable regional pricing</li>
            <li>• <strong className="text-yellow-600">Low Variance (&lt;10%)</strong>: Normal - minor pricing differences</li>
            <li>• Use filters to find products with highest variance for price standardization</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
