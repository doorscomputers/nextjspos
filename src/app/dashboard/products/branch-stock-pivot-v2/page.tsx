"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Paging,
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
  cost: number
  price: number
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
  const [locations, setLocations] = useState<LocationColumn[]>([])
  const [dataSource, setDataSource] = useState<any[]>([])

  const fetchStockData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/products/branch-stock-pivot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: 1,
          limit: 10000, // Fetch all for DevExtreme to handle pagination
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

      if (!response.ok) {
        throw new Error('Failed to fetch stock data')
      }

      const data = await response.json()
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
          cost: row.cost,
          price: row.price,
          totalStock: row.totalStock,
          totalCost: row.totalCost,
          totalPrice: row.totalPrice,
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
      console.error('Error fetching stock data:', error)
      toast.error('Failed to load stock data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStockData()
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Branch Stock Pivot V2
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Advanced stock view with pivot grid, grouping, and real-time filtering
          </p>
        </div>
        <Button
          onClick={fetchStockData}
          variant="outline"
          size="sm"
          className="shadow-sm hover:shadow-md transition-all"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Products</div>
          <div className="text-3xl font-bold">{dataSource.length.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Locations</div>
          <div className="text-3xl font-bold">{locations.length}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Stock</div>
          <div className="text-3xl font-bold">
            {dataSource.reduce((sum, row) => sum + (row.totalStock || 0), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Total Inventory Value</div>
          <div className="text-2xl font-bold">
            ₱{dataSource.reduce((sum, row) => sum + (row.totalPrice || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <DataGrid
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
          <StateStoring enabled={true} type="localStorage" storageKey="branchStockPivotV2State" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search products..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={50} />
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
            dataField="cost"
            caption="Cost"
            dataType="number"
            format="₱#,##0.00"
            width={100}
            alignment="right"
          />
          <Column
            dataField="price"
            caption="Price"
            dataType="number"
            format="₱#,##0.00"
            width={100}
            alignment="right"
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
              cssClass="bg-blue-50 dark:bg-blue-900/20"
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
            dataField="totalPrice"
            caption="Total Price"
            dataType="number"
            format="₱#,##0.00"
            width={130}
            alignment="right"
            cssClass="bg-indigo-50 dark:bg-indigo-900/20"
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
            <TotalItem column="totalPrice" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="{0}" />
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
