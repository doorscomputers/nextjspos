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
import 'devextreme/dist/css/dx.light.css'

interface JournalEntry {
  date: string
  invoiceNumber: string
  customer: string
  account: string
  debit: number
  credit: number
}

export default function CashierSalesJournalPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.SALES_REPORT_JOURNAL)) {
    return <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">Access denied</p></div>
  }

  const [loading, setLoading] = useState(false)
  const [userLocationName, setUserLocationName] = useState("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [journal, setJournal] = useState<JournalEntry[]>([])

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

  const fetchJournal = async () => {
    if (!userLocationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/sales-journal?locationId=${userLocationId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setJournal(data.journal || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userLocationId) fetchJournal()
  }, [userLocationId, startDate, endDate])

  const handlePrint = () => {
    window.print()
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Journal')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (gridCell.column.dataField === 'debit' || gridCell.column.dataField === 'credit') {
            excelCell.numFmt = '₱#,##0.00'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `cashier-sales-journal-${userLocationName}-${startDate}-to-${endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const renderDebit = (data: any) => {
    return data.value > 0 ? formatCurrency(data.value) : <span className="text-gray-400 dark:text-gray-600">-</span>
  }

  const renderCredit = (data: any) => {
    return data.value > 0 ? formatCurrency(data.value) : <span className="text-gray-400 dark:text-gray-600">-</span>
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Journal (Cashier)</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Location: <strong className="text-gray-900 dark:text-white">{userLocationName}</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
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
            <div className="flex gap-2 items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Journal DataGrid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Sales Journal Entries</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({journal.length} entries)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <DataGrid
              dataSource={journal}
              keyExpr="invoiceNumber"
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
              <StateStoring enabled={true} type="localStorage" storageKey="cashier-sales-journal-grid" />
              <SearchPanel visible={true} width={240} placeholder="Search invoice, customer, account..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />

              <Column
                dataField="date"
                caption="Date"
                dataType="date"
                format="dd/MM/yyyy"
                width={120}
                groupIndex={0}
              />
              <Column
                dataField="invoiceNumber"
                caption="Invoice #"
                width={140}
              />
              <Column
                dataField="customer"
                caption="Customer"
                minWidth={150}
              />
              <Column
                dataField="account"
                caption="Account"
                minWidth={150}
              />
              <Column
                dataField="debit"
                caption="Debit"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cellRender={renderDebit}
              />
              <Column
                dataField="credit"
                caption="Credit"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cellRender={renderCredit}
              />

              <Summary>
                <TotalItem column="debit" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="credit" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total Entries: {0}" />
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
