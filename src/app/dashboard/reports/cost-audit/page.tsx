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
import { Button, SelectBox } from 'devextreme-react'
import notify from 'devextreme/ui/notify'
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface CostAuditData {
  productVariationId: number
  productName: string
  productSku: string
  variationName: string
  categoryName: string
  brandName: string
  locationName: string
  costPrice: number
  basePrice: number
  sellingPrice: number
  qtyAvailable: number
  grossProfitAmount: number
  grossProfitPercent: number
  markupPercent: number
  isBelowCost: boolean
  isLowMargin: boolean
  isHighMargin: boolean
  hasIssue: boolean
  inventoryValue: number
  costValue: number
}

const filterOptions = [
  { value: 'all', text: 'All Products' },
  { value: 'issues', text: 'Issues Only (Below Cost + Low Margin)' },
  { value: 'below_cost', text: 'Below Cost' },
  { value: 'low_margin', text: 'Low Margin (<15%)' },
  { value: 'high_margin', text: 'High Margin (>50%)' },
  { value: 'healthy', text: 'Healthy (15-50%)' },
]

export default function CostAuditReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState<CostAuditData[]>([])
  const [filteredData, setFilteredData] = useState<CostAuditData[]>([])
  const [selectedFilter, setSelectedFilter] = useState('all')
  const dataGridRef = useRef<DataGrid>(null)

  const hasAccess = can(PERMISSIONS.PRODUCT_COST_AUDIT_VIEW)

  useEffect(() => {
    if (hasAccess) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [hasAccess])

  useEffect(() => {
    applyFilter(selectedFilter)
  }, [selectedFilter, allData])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports/cost-audit')
      const result = await response.json()

      if (response.ok && result.success) {
        setAllData(result.data)
        setFilteredData(result.data)
      } else {
        notify(result.error || 'Failed to fetch cost audit data', 'error', 3000)
      }
    } catch (error) {
      console.error('Fetch data error:', error)
      notify('Failed to fetch cost audit data', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = (filterValue: string) => {
    let filtered = [...allData]

    switch (filterValue) {
      case 'issues':
        filtered = allData.filter((item) => item.hasIssue)
        break
      case 'below_cost':
        filtered = allData.filter((item) => item.isBelowCost)
        break
      case 'low_margin':
        filtered = allData.filter((item) => item.isLowMargin)
        break
      case 'high_margin':
        filtered = allData.filter((item) => item.isHighMargin)
        break
      case 'healthy':
        filtered = allData.filter((item) => !item.hasIssue && !item.isHighMargin)
        break
      default:
        filtered = allData
    }

    setFilteredData(filtered)
  }

  const handleExport = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Cost Audit')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'cost-audit-report.xlsx')
      })
    })
  }, [])

  const renderPriceCell = (cellData: any) => {
    const price = cellData.value
    return <span>₱{Number(price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  const renderMarginCell = (cellData: any) => {
    const margin = cellData.value || 0
    let colorClass = 'text-gray-600'

    if (margin < 0) colorClass = 'text-red-600 font-bold'
    else if (margin < 15) colorClass = 'text-orange-600 font-semibold'
    else if (margin > 50) colorClass = 'text-blue-600 font-semibold'
    else colorClass = 'text-green-600'

    return <span className={colorClass}>{margin.toFixed(2)}%</span>
  }

  const renderIssueCell = (cellData: any) => {
    const hasIssue = cellData.value
    const rowData = cellData.data

    if (rowData.isBelowCost) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">BELOW COST</span>
    }
    if (rowData.isLowMargin) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-semibold">LOW MARGIN</span>
    }
    if (rowData.isHighMargin) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">HIGH MARGIN</span>
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">HEALTHY</span>
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view cost audit reports.
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
          <p className="text-gray-600 dark:text-gray-400">Loading cost audit report...</p>
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
            Cost Audit Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze cost vs pricing to identify below-cost sales and margin issues
          </p>
        </div>

        {/* Filter Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter:
            </label>
            <SelectBox
              items={filterOptions}
              displayExpr="text"
              valueExpr="value"
              value={selectedFilter}
              onValueChanged={(e) => setSelectedFilter(e.value)}
              stylingMode="outlined"
              className="dx-theme-material-typography"
              width={300}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredData.length} of {allData.length} items
            </div>
          </div>
        </div>

        {/* DataGrid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <DataGrid
            ref={dataGridRef}
            dataSource={filteredData}
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
            <Paging defaultPageSize={50} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[20, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <Export enabled={true} allowExportSelectedData={false} />

            <Column dataField="productName" caption="Product" width={250} />
            <Column dataField="productSku" caption="SKU" width={120} />
            <Column dataField="variationName" caption="Variation" width={150} />
            <Column dataField="categoryName" caption="Category" width={150} />
            <Column dataField="brandName" caption="Brand" width={150} />
            <Column dataField="locationName" caption="Location" width={150} groupIndex={0} />

            <Column
              dataField="costPrice"
              caption="Cost Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="basePrice"
              caption="Base Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={120}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="sellingPrice"
              caption="Selling Price"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={130}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="grossProfitAmount"
              caption="Gross Profit"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={130}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="grossProfitPercent"
              caption="Margin %"
              dataType="number"
              format="#0.00'%'"
              width={100}
              cellRender={renderMarginCell}
              sortOrder="asc"
            />

            <Column
              dataField="markupPercent"
              caption="Markup %"
              dataType="number"
              format="#0.00'%'"
              width={100}
              cellRender={renderMarginCell}
            />

            <Column
              dataField="qtyAvailable"
              caption="Stock Qty"
              dataType="number"
              width={100}
            />

            <Column
              dataField="inventoryValue"
              caption="Inventory Value"
              dataType="number"
              format={{ type: 'currency', currency: 'PHP' }}
              width={140}
              cellRender={renderPriceCell}
            />

            <Column
              dataField="hasIssue"
              caption="Status"
              width={130}
              cellRender={renderIssueCell}
              allowFiltering={false}
            />

            <Summary>
              <TotalItem column="productName" summaryType="count" displayFormat="Total: {0} items" />
              <TotalItem
                column="grossProfitPercent"
                summaryType="avg"
                valueFormat="#0.00'%'"
                displayFormat="Avg Margin: {0}"
              />
              <TotalItem
                column="inventoryValue"
                summaryType="sum"
                valueFormat={{ type: 'currency', currency: 'PHP' }}
                displayFormat="Total Value: {0}"
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
            💡 Understanding Cost Audit Indicators
          </h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong className="text-red-600">BELOW COST</strong>: Selling price is less than cost price - IMMEDIATE ATTENTION REQUIRED</li>
            <li>• <strong className="text-orange-600">LOW MARGIN</strong>: Gross profit margin below 15% - Review pricing strategy</li>
            <li>• <strong className="text-blue-600">HIGH MARGIN</strong>: Gross profit margin above 50% - May indicate premium pricing or outdated cost</li>
            <li>• <strong className="text-green-600">HEALTHY</strong>: Margin between 15-50% - Normal operating range</li>
            <li>• <strong>Margin %</strong>: (Selling Price - Cost) / Selling Price × 100</li>
            <li>• <strong>Markup %</strong>: (Selling Price - Cost) / Cost × 100</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
