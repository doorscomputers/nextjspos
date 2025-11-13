"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import { MapPinIcon, CalendarIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Pager,
  Export,
  Summary,
  TotalItem,
  StateStoring,
  ColumnChooser,
  Grouping,
  GroupPanel,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'

export default function CashierSalesPerItemPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.SALES_REPORT_PER_ITEM)) {
    return <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">Access denied</p></div>
  }

  const [loading, setLoading] = useState(false)
  const [userLocationName, setUserLocationName] = useState("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState({ totalQuantitySold: 0, totalRevenue: 0 })

  useEffect(() => {
    fetchUserLocation()
  }, [])

  const fetchUserLocation = async () => {
    const res = await fetch("/api/user-locations")
    if (res.ok) {
      const data = await res.json()
      if (data.locations?.length > 0) {
        setUserLocationName(data.locations[0].name)
        setUserLocationId(data.locations[0].id)
      }
    }
  }

  const fetchReport = async () => {
    if (!userLocationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/sales-per-item?locationId=${userLocationId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setItems(data.items || [])
      setSummary(data.summary || { totalQuantitySold: 0, totalRevenue: 0 })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userLocationId) fetchReport()
  }, [userLocationId, startDate, endDate])

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Per Item')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (gridCell.column.dataField === 'totalRevenue' || gridCell.column.dataField === 'averagePrice') {
            excelCell.numFmt = '₱#,##0.00'
          }
          if (gridCell.column.dataField === 'quantitySold') {
            excelCell.numFmt = '#,##0.##'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `sales-per-item-${userLocationName}-${startDate}-to-${endDate}.xlsx`)
      })
    })
    e.cancel = true
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Per Item (Cashier)</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Location: <strong>{userLocationName}</strong></span>
            </div>
          </div>
          <div className="flex gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Card - Revenue Only */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.totalRevenue)}</div>
          <p className="text-xs text-gray-500 mt-1">From {items.length} product(s) sold</p>
        </CardContent>
      </Card>

      {/* DevExtreme DataGrid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Items Sold</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({items.length} products)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <DataGrid
              dataSource={items}
              keyExpr="productId"
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExporting}
            >
              <StateStoring enabled={true} type="localStorage" storageKey="cashier-sales-per-item-grid" />
              <SearchPanel visible={true} width={240} placeholder="Search product or SKU..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />

              <Column
                dataField="productName"
                caption="Product Name"
                minWidth={200}
              />
              <Column
                dataField="sku"
                caption="SKU"
                width={150}
              />
              <Column
                dataField="category"
                caption="Category"
                width={120}
                visible={false}
              />
              <Column
                dataField="quantitySold"
                caption="Qty Sold"
                dataType="number"
                format="#,##0.##"
                alignment="right"
                width={100}
              />
              <Column
                dataField="averagePrice"
                caption="Avg Price"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={120}
              />
              <Column
                dataField="totalRevenue"
                caption="Total Revenue"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cssClass="font-semibold"
              />
              <Column
                dataField="totalProfit"
                caption="Profit"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={120}
                visible={false}
              />
              <Column
                dataField="profitMargin"
                caption="Margin %"
                dataType="number"
                format="#,##0.0"
                alignment="right"
                width={100}
                visible={false}
              />

              <Summary>
                <TotalItem column="quantitySold" summaryType="sum" valueFormat="#,##0.##" />
                <TotalItem column="totalRevenue" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="totalProfit" summaryType="sum" valueFormat="₱#,##0.00" />
              </Summary>

              <Paging defaultPageSize={20} />
              <Pager
                visible={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector={true}
                showInfo={true}
                showNavigationButtons={true}
              />

              <Export enabled={true} allowExportSelectedData={false} />

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="searchPanel" />
                <Item name="exportButton" />
                <Item name="columnChooserButton" />
              </Toolbar>
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
