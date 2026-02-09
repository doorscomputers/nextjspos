"use client"

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Paging,
  Pager,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  SearchPanel,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  LoadPanel,
  Scrolling,
  Selection
} from 'devextreme-react/data-grid'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

interface PivotRow {
  productId: number
  variationId: number
  productName: string
  productSku: string
  variationName: string
  variationSku: string
  supplier: string
  category: string
  brand: string
  unit: string
  lastDeliveryDate: string | null
  lastQtyDelivered: number
  lastPurchaseCost: number
  cost: number
  price: number
  mainStorePrice: number  // Retail price from Main Store location
  stockByLocation: Record<number, number>
  totalStock: number
  totalCost: number
  totalPrice: number
  isActive: boolean
}

interface LocationColumn {
  id: number
  name: string
}

export default function BranchStockPivotV2Page() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [locations, setLocations] = useState<LocationColumn[]>([])
  const [dataSource, setDataSource] = useState<any[]>([])
  const dataGridRef = useRef<DataGrid>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchText, setSearchText] = useState('')

  // Handle search - only apply when Enter is pressed or Search button clicked
  const handleSearch = () => {
    setSearchText(searchInput)
    if (dataGridRef.current?.instance) {
      dataGridRef.current.instance.searchByText(searchInput)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchText('')
    if (dataGridRef.current?.instance) {
      dataGridRef.current.instance.searchByText('')
    }
  }

  // Refresh the materialized view to get latest inventory data
  const refreshMaterializedView = async () => {
    try {
      console.log('🔄 [V2] Refreshing materialized view...')
      const response = await fetch('/api/products/refresh-stock-pivot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to refresh materialized view')
      }

      const data = await response.json()
      console.log('✅ [V2] Materialized view refreshed:', data.stats)
      return true
    } catch (error) {
      console.error('❌ [V2] Error refreshing materialized view:', error)
      // Don't fail the whole operation, just log the error
      return false
    }
  }

  const fetchStockData = async (refreshView: boolean = false) => {
    try {
      setLoading(true)
      setRefreshing(true)
      console.log('[Branch Stock Pivot V2] Fetching stock data...')

      // Refresh materialized view if requested (on manual refresh or initial load)
      if (refreshView) {
        await refreshMaterializedView()
      }

      const response = await fetch('/api/products/branch-stock-pivot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: 1,
          limit: 100, // Fetch reasonable amount for pagination
          sortKey: 'productName',
          sortOrder: 'asc',
          filters: {
            search: '',
            productName: '',
            productSku: '',
            variationName: '',
            variationSku: '',
            supplier: '',
            category: '',
            brand: '',
            isActive: 'all',
            locationFilters: {},
          },
          exportAll: true,
        }),
      })

      console.log('[Branch Stock Pivot V2] Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Branch Stock Pivot V2] Error response:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to fetch stock data')
      }

      const data = await response.json()
      console.log('[Branch Stock Pivot V2] Received data:', {
        rowsCount: data.rows?.length || 0,
        locationsCount: data.locations?.length || 0,
      })

      const rows: PivotRow[] = data.rows || []

      // Transform data for DevExtreme
      const transformedData = rows.map((row) => {
        const transformed: any = {
          productId: row.productId,
          variationId: row.variationId,
          itemCode: row.variationSku,
          itemName: row.productName,
          variation: row.variationName !== 'DUMMY' && row.variationName !== 'Default' ? row.variationName : '',
          supplier: row.supplier || '-',
          category: row.category || '-',
          brand: row.brand || '-',
          unit: row.unit,
          lastDeliveryDate: row.lastDeliveryDate ? new Date(row.lastDeliveryDate) : null,
          lastQtyDelivered: row.lastQtyDelivered,
          lastCost: row.cost, // Cost BEFORE the latest purchase (previous cost)
          cost: row.lastPurchaseCost, // Cost FROM the latest purchase (current cost)
          price: row.price, // Selling price
          mainStorePrice: row.mainStorePrice || row.price || 0, // Retail price from Main Store
          totalStock: row.totalStock,
          totalCost: row.totalCost,
          totalPrice: row.totalPrice, // Total selling price value
          isActive: row.isActive ? 'Active' : 'Inactive',
        }

        // Add location stock columns dynamically
        Object.keys(row.stockByLocation).forEach((locId) => {
          transformed[`location_${locId}`] = row.stockByLocation[parseInt(locId)] || 0
        })

        return transformed
      })

      setDataSource(transformedData)

      // Filter out inactive locations and locations with "Future" in the name
      const activeLocations = (data.locations || []).filter((loc: LocationColumn) => {
        const isFutureLocation = loc.name.toLowerCase().includes('future')
        return !isFutureLocation
      })

      setLocations(activeLocations)
    } catch (error) {
      console.error('[Branch Stock Pivot V2] Error fetching stock data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load stock data'
      toast.error(errorMessage)

      // Set empty data on error to avoid showing stale data
      setDataSource([])
      setLocations([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Auto-refresh materialized view on initial page load
  useEffect(() => {
    fetchStockData(true) // true = refresh the materialized view before fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onExporting = (e: any) => {
    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Branch Stock Pivot')

      exportToExcel({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          if (gridCell.rowType === 'data') {
            if (gridCell.column.dataField?.startsWith('location_')) {
              const value = gridCell.value || 0
              if (value > 10) {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'C6EFCE' },
                }
              } else if (value > 0) {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFEB9C' },
                }
              } else {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFC7CE' },
                }
              }
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer: any) => {
          saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'branch-stock-pivot-v2.xlsx')
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape', 'pt', 'a4')

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        autoTableOptions: {
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        },
      }).then(() => {
        doc.save('branch-stock-pivot-v2.pdf')
      })
      e.cancel = true
    }
  }

  const cellRender = (data: any) => {
    if (data.column.dataField?.startsWith('location_')) {
      const value = data.value || 0
      let bgColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      if (value > 10) {
        bgColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      } else if (value > 0) {
        bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      }
      return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor}`}>
          {value}
        </span>
      )
    }
    return data.text
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 dark:from-amber-100 dark:via-orange-300 dark:to-amber-100 bg-clip-text text-transparent">
            Branch Stock Pivot V2
          </h1>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            Advanced stock view with pivot grid, grouping, and real-time filtering
          </p>
        </div>
        <Button
          onClick={() => fetchStockData(true)}
          variant="outline"
          size="sm"
          disabled={refreshing || loading}
          className="shadow-sm hover:shadow-md transition-all bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-300 dark:border-green-700"
          title="Refresh inventory data from database (updates materialized view)"
        >
          <ArrowPathIcon className={`w-4 h-4 mr-2 text-green-600 dark:text-green-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-green-700 dark:text-green-300">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </div>

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-orange-900/20 p-6 rounded-lg shadow-lg border border-amber-200 dark:border-orange-800">
        {/* Custom Search Bar */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products... (Press Enter or click Search)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 pr-10"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
          </Button>
          {searchText && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              Searching: &quot;{searchText}&quot;
            </span>
          )}
        </div>

        <DataGrid
          ref={dataGridRef}
          dataSource={dataSource}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="variationId"
          onExporting={onExporting}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="branchStockPivotV2State-v2" />
          <LoadPanel enabled={true} />
          <Scrolling mode="standard" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={false} text={searchText} />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={10} />
          <Pager
            visible={true}
            displayMode="full"
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 30, 40, 50]}
            showInfo={true}
            showNavigationButtons={true}
          />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by category, supplier, or brand" />

          {/* Fixed Columns */}
          <Column
            dataField="itemCode"
            caption="Item Code"
            width={150}
            fixed={true}
            fixedPosition="left"
            cellRender={(data) => <span className="font-medium text-gray-900 dark:text-gray-100">{data.text}</span>}
          />
          <Column
            dataField="itemName"
            caption="Item Name"
            minWidth={200}
            cellRender={(data) => (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{data.data.itemName}</div>
                {data.data.variation && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{data.data.variation}</div>
                )}
              </div>
            )}
          />

          {/* Standard Columns */}
          <Column dataField="supplier" caption="Supplier" width={130} />
          <Column dataField="category" caption="Category" width={130} />
          <Column dataField="brand" caption="Brand" width={120} />
          <Column
            dataField="lastDeliveryDate"
            caption="Last Delivery"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
          />
          <Column
            dataField="lastQtyDelivered"
            caption="Last Qty"
            dataType="number"
            width={100}
            alignment="right"
          />
          <Column
            dataField="lastCost"
            caption="Last Cost (Previous)"
            dataType="number"
            format="₱#,##0.00"
            width={130}
            alignment="right"
            cssClass="bg-orange-50 dark:bg-orange-900/20"
          />
          <Column
            dataField="cost"
            caption="Cost (Latest Purchase)"
            dataType="number"
            format="₱#,##0.00"
            width={150}
            alignment="right"
            cssClass="bg-amber-50 dark:bg-amber-900/20"
          />
          <Column
            dataField="mainStorePrice"
            caption="Retail Price"
            dataType="number"
            format="₱#,##0.00"
            width={130}
            alignment="right"
            cssClass="bg-blue-50 dark:bg-blue-900/20"
          />
          {/* Dynamic Location Columns */}
          {locations.map((location) => (
            <Column
              key={location.id}
              dataField={`location_${location.id}`}
              caption={location.name}
              dataType="number"
              width={120}
              alignment="center"
              cssClass="bg-amber-50/50 dark:bg-amber-900/20"
              cellRender={cellRender}
            />
          ))}

          {/* Total Columns */}
          <Column
            dataField="totalStock"
            caption="Total Stock"
            dataType="number"
            width={120}
            alignment="center"
            cssClass="bg-green-50 dark:bg-green-900/20"
            cellRender={(data) => (
              <span className="px-3 py-1 inline-flex text-sm font-bold rounded-full bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100">
                {data.text}
              </span>
            )}
          />
          <Column
            dataField="totalCost"
            caption="Total Cost"
            dataType="number"
            format="₱#,##0.00"
            width={130}
            alignment="right"
            cssClass="bg-yellow-50 dark:bg-yellow-900/20"
          />
          <Column
            dataField="isActive"
            caption="Status"
            width={100}
            alignment="center"
            fixed={true}
            fixedPosition="right"
            cellRender={(data) => (
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  data.value === 'Active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                {data.text}
              </span>
            )}
          />

          {/* Summary Totals */}
          <Summary>
            <TotalItem column="itemCode" summaryType="count" displayFormat="Total: {0} items" />
            <TotalItem column="totalStock" summaryType="sum" valueFormat="#,##0" displayFormat="{0}" />
            <TotalItem column="totalCost" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="{0}" />
            {locations.map((location) => (
              <TotalItem
                key={location.id}
                column={`location_${location.id}`}
                summaryType="sum"
                valueFormat="#,##0"
                displayFormat="{0}"
              />
            ))}
          </Summary>
        </DataGrid>
      </div>
    </div>
  )
}
