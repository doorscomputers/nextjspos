"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  BanknotesIcon,
  MapPinIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  MasterDetail,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'
import 'devextreme/dist/css/dx.light.css'

interface SalesTodayData {
  summary: {
    date: string
    totalSales: number
    totalAmount: number
    totalSubtotal: number
    totalTax: number
    totalDiscount: number
    totalCOGS: number
    grossProfit: number
    grossMargin: number
  }
  paymentMethods: {
    cash: { amount: number; percentage: number }
    credit: { amount: number; percentage: number }
    digital: {
      amount: number
      percentage: number
      breakdown: {
        card: number
        mobilePayment: number
        bankTransfer: number
      }
    }
    cheque: { amount: number; percentage: number }
    total: number
  }
  paymentBreakdown: Array<{
    method: string
    amount: number
    count: number
    percentage: number
  }>
  discountBreakdown: {
    senior: number
    pwd: number
    regular: number
    total: number
  }
  sales: Array<{
    id: number
    invoiceNumber: string
    saleDate: string
    customer: string
    customerId: number | null
    totalAmount: number
    discountAmount: number
    discountType: string | null
    notes: string
    payments: Array<{ method: string; amount: number }>
    itemCount: number
    items: Array<{
      productName: string
      variationName: string
      sku: string
      quantity: number
      unitPrice: number
      total: number
      discountAmount: number
      remark: string
      serialNumbers: string
    }>
  }>
}

export default function CashierSalesTodayPage() {
  const { can } = usePermissions()
  const { data: session } = useSession()

  if (!can(PERMISSIONS.REPORT_SALES_TODAY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view this report</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesTodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocationName, setUserLocationName] = useState<string>("Loading...")

  useEffect(() => {
    fetchUserLocationAndReport()
  }, [])

  const fetchUserLocationAndReport = async () => {
    try {
      setLoading(true)

      // Get user's assigned location
      const locationResponse = await fetch("/api/user-locations")
      if (!locationResponse.ok) {
        throw new Error("Failed to fetch user location")
      }

      const locationData = await locationResponse.json()
      const userLocations = locationData.locations || []

      if (userLocations.length === 0) {
        setUserLocationName("No Location Assigned")
        setReportData(null)
        setLoading(false)
        return
      }

      // Use first assigned location (cashiers typically have one location)
      const userLocation = userLocations[0]
      setUserLocationName(userLocation.name)

      // Fetch sales report for this location
      const reportResponse = await fetch(
        `/api/reports/sales-today?locationId=${userLocation.id}`
      )

      if (!reportResponse.ok) {
        throw new Error("Failed to fetch sales report")
      }

      const data = await reportResponse.json()
      setReportData(data)
    } catch (error) {
      console.error("Error fetching cashier sales report:", error)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Today')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === 'data') {
          if (gridCell.column.dataField === 'totalAmount' || gridCell.column.dataField === 'discountAmount') {
            excelCell.numFmt = '₱#,##0.00'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `cashier-sales-today-${userLocationName}-${new Date().toISOString().split("T")[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const renderMasterDetail = (data: any) => {
    const sale = data.data
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Sale Items:</h4>
        <DataGrid
          dataSource={sale.items}
          showBorders={true}
          showRowLines={true}
          columnAutoWidth={true}
        >
          <Column dataField="productName" caption="Product" minWidth={200} />
          <Column dataField="variationName" caption="Variation" width={120} />
          <Column dataField="sku" caption="SKU" width={120} />
          <Column
            dataField="quantity"
            caption="Qty"
            dataType="number"
            format="#,##0.##"
            alignment="right"
            width={80}
          />
          <Column
            dataField="unitPrice"
            caption="Unit Price"
            dataType="number"
            format="₱#,##0.00"
            alignment="right"
            width={120}
          />
          <Column
            dataField="discountAmount"
            caption="Discount"
            dataType="number"
            format="₱#,##0.00"
            alignment="right"
            width={100}
            cellRender={(cellData: any) => {
              const discount = cellData.value
              if (!discount || discount === 0) return <span className="text-gray-400">-</span>
              return (
                <span className="text-orange-600 dark:text-orange-400">
                  -{formatCurrency(discount)}
                </span>
              )
            }}
          />
          <Column
            dataField="total"
            caption="Total"
            dataType="number"
            format="₱#,##0.00"
            alignment="right"
            width={120}
            cssClass="font-semibold"
          />
          <Column
            dataField="serialNumbers"
            caption="Serial Numbers"
            minWidth={180}
            cellRender={(cellData: any) => {
              const serials = cellData.value
              if (!serials) return <span className="text-gray-400">-</span>
              return (
                <span className="text-xs text-gray-600 dark:text-gray-400" title={serials}>
                  {serials.length > 40 ? serials.substring(0, 40) + '...' : serials}
                </span>
              )
            }}
          />
          <Column
            dataField="remark"
            caption="Remark"
            minWidth={150}
            cellRender={(cellData: any) => {
              const remark = cellData.value
              if (!remark) return <span className="text-gray-400">-</span>
              return (
                <span className="text-xs text-gray-600 dark:text-gray-400" title={remark}>
                  {remark.length > 30 ? remark.substring(0, 30) + '...' : remark}
                </span>
              )
            }}
          />
        </DataGrid>
      </div>
    )
  }

  const renderPaymentMethods = (data: any) => {
    return (
      <div className="flex flex-wrap gap-1">
        {data.value.map((payment: any, idx: number) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {payment.method}
          </Badge>
        ))}
      </div>
    )
  }

  const renderDiscountType = (data: any) => {
    if (!data.value || data.data.discountAmount === 0) {
      return <span className="text-gray-400 dark:text-gray-600">-</span>
    }
    return (
      <span className="text-orange-600 dark:text-orange-400">
        -{formatCurrency(data.data.discountAmount)}
        {data.value && (
          <Badge variant="outline" className="ml-1 text-xs">
            {data.value}
          </Badge>
        )}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">No sales data available for today</p>
      </div>
    )
  }

  const { summary, paymentMethods, paymentBreakdown, discountBreakdown, sales } = reportData

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cashier Sales Report - Today</h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Location: <span className="font-semibold text-gray-900 dark:text-white">{userLocationName}</span>
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{summary.date}</p>
        </div>

        <div className="flex gap-2">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalSales}</div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Transactions completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Cash Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(paymentMethods.cash.amount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {paymentMethods.cash.percentage.toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Digital Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(paymentMethods.digital.amount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {paymentMethods.digital.percentage.toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Cheque Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(paymentMethods.cheque.amount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {paymentMethods.cheque.percentage.toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Credit / Charge Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(paymentMethods.credit.amount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {paymentMethods.credit.percentage.toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Discounts Given</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(summary.totalDiscount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {summary.totalSales > 0 ? `Avg: ${formatCurrency(summary.totalDiscount / summary.totalSales)}` : 'No discounts'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5" />
            Payment Methods Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentBreakdown.map((payment) => (
              <div
                key={payment.method}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{payment.method}</span>
                  <Badge variant="outline">{payment.count}</Badge>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(payment.amount)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {payment.percentage.toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discount Breakdown */}
      {discountBreakdown.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Discount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Senior Citizen</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(discountBreakdown.senior)}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">PWD</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(discountBreakdown.pwd)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Regular Discount</p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {formatCurrency(discountBreakdown.regular)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Transactions DataGrid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Sales Transactions</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({sales.length} sales)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <DataGrid
              dataSource={sales}
              keyExpr="id"
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
              <StateStoring enabled={true} type="localStorage" storageKey="cashier-sales-today-grid" />
              <SearchPanel visible={true} width={240} placeholder="Search invoice, customer..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />

              <Column
                dataField="invoiceNumber"
                caption="Invoice #"
                width={140}
              />
              <Column
                dataField="notes"
                caption="Remarks"
                minWidth={150}
                cellRender={(cellData: any) => {
                  const notes = cellData.value
                  if (!notes) return <span className="text-gray-400">-</span>
                  return (
                    <span className="text-gray-700 dark:text-gray-300 text-sm" title={notes}>
                      {notes.length > 30 ? notes.substring(0, 30) + '...' : notes}
                    </span>
                  )
                }}
              />
              <Column
                dataField="saleDate"
                caption="Time"
                dataType="datetime"
                format="shortTime"
                width={100}
              />
              <Column
                dataField="customer"
                caption="Customer"
                minWidth={150}
              />
              <Column
                dataField="totalAmount"
                caption="Amount"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={130}
                cssClass="font-semibold"
              />
              <Column
                dataField="discountType"
                caption="Discount"
                width={140}
                alignment="right"
                cellRender={renderDiscountType}
              />
              <Column
                dataField="payments"
                caption="Payment"
                width={180}
                allowFiltering={false}
                allowSorting={false}
                cellRender={renderPaymentMethods}
              />
              <Column
                dataField="itemCount"
                caption="Items"
                dataType="number"
                alignment="center"
                width={80}
              />

              <MasterDetail
                enabled={true}
                render={renderMasterDetail}
              />

              <Summary>
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="discountAmount" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="Total Discount: {0}" />
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
