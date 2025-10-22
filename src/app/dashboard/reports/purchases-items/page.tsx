"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"
import { toast } from "sonner"
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
  Selection,
} from 'devextreme-react/data-grid'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
// @ts-ignore - file-saver types not available
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

interface PurchaseItemsReportData {
  items: any[]
  summary: {
    totalItems: number
    totalQuantityOrdered: number
    totalQuantityReceived: number
    totalValue: number
    totalReceivedValue: number
    averageUnitCost: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

interface PurchaseItem {
  id: number
  productName: string
  variationName: string
  sku: string
  purchaseOrderNumber: string
  purchaseDate: string
  expectedDeliveryDate: string | null
  supplier: string
  supplierId: number
  location: string
  locationId: number
  status: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  itemTotal: number
  receivedTotal: number
  requiresSerial: boolean
}

export default function PurchaseItemsReportPage() {
  const [reportData, setReportData] = useState<PurchaseItemsReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [dataSource, setDataSource] = useState<PurchaseItem[]>([])

  // Filter states
  const [locationId, setLocationId] = useState("all")
  const [supplierId, setSupplierId] = useState("all")
  const [status, setStatus] = useState("all")
  const [productName, setProductName] = useState("")
  const [sku, setSku] = useState("")
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")

  // Dropdown data
  const [locations, setLocations] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  useEffect(() => {
    fetchLocations()
    fetchSuppliers()
    fetchReport()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      const data = await response.json()
      setLocations(data.locations || data)
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      const data = await response.json()
      setSuppliers(data.suppliers || data)
    } catch (error) {
      console.error("Failed to fetch suppliers:", error)
      setSuppliers([])
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", "1")
      params.append("limit", "10000") // Fetch all for DevExtreme to handle pagination

      if (locationId !== "all") params.append("locationId", locationId)
      if (supplierId !== "all") params.append("supplierId", supplierId)
      if (status !== "all") params.append("status", status)
      if (productName) params.append("productName", productName)
      if (sku) params.append("sku", sku)
      if (purchaseOrderNumber) params.append("purchaseOrderNumber", purchaseOrderNumber)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (minAmount) params.append("minAmount", minAmount)
      if (maxAmount) params.append("maxAmount", maxAmount)

      const response = await fetch(`/api/reports/purchases/items?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.items) {
        setReportData(data)
        setDataSource(data.items)
      } else {
        console.error("API Error:", data.error || data.details || "Unknown error")
        setReportData(null)
        setDataSource([])
        toast.error(data.error || "Failed to load report data")
      }
    } catch (error) {
      console.error("Failed to fetch report:", error)
      setReportData(null)
      setDataSource([])
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchReport()
  }

  const handleReset = () => {
    setLocationId("all")
    setSupplierId("all")
    setStatus("all")
    setProductName("")
    setSku("")
    setPurchaseOrderNumber("")
    setStartDate("")
    setEndDate("")
    setMinAmount("")
    setMaxAmount("")
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      COMPLETED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
  }

  const onExporting = (e: any) => {
    const timestamp = new Date().toISOString().split("T")[0]

    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Purchase Items Report')

      exportToExcel({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          // Apply header formatting
          if (gridCell.rowType === 'header') {
            excelCell.font = { bold: true, color: { argb: 'FFFFFF' } }
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '2980B9' },
            }
          }
          // Apply summary row formatting
          if (gridCell.rowType === 'totalFooter') {
            excelCell.font = { bold: true }
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'E8F5E9' },
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer: any) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `purchase-items-report-${timestamp}.xlsx`
          )
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape', 'pt', 'a4')

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        autoTableOptions: {
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          footStyles: { fillColor: [232, 245, 233], fontStyle: 'bold' },
        },
      } as any).then(() => {
        doc.save(`purchase-items-report-${timestamp}.pdf`)
      })
      e.cancel = true
    }
  }

  const statusCellRender = (data: any) => {
    return (
      <Badge className={getStatusColor(data.value)}>
        {data.value}
      </Badge>
    )
  }

  const serialCellRender = (data: any) => {
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
        data.value
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      }`}>
        {data.value ? 'Yes' : 'No'}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Purchase Items Report
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Detailed view of all purchased items across purchase orders
          </p>
        </div>
        <Button
          onClick={fetchReport}
          variant="outline"
          size="sm"
          disabled={loading}
          className="shadow-sm hover:shadow-md transition-all"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FunnelIcon className="w-5 h-5 mr-2" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Location</label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Supplier</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Product Name</label>
                <Input
                  type="text"
                  placeholder="Search product..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">SKU</label>
                <Input
                  type="text"
                  placeholder="Search SKU..."
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">PO Number</label>
                <Input
                  type="text"
                  placeholder="Search PO number..."
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Min Item Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Max Item Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                size="default"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                    Apply Filters
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                size="default"
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Reset Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reportData.summary.totalItems.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Qty Ordered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalQuantityOrdered)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Qty Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalQuantityReceived)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalValue)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Received Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.totalReceivedValue)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Avg Unit Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatNumber(reportData.summary.averageUnitCost)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <DataGrid
          dataSource={dataSource}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="id"
          onExporting={onExporting}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
          noDataText="No purchase items found. Try adjusting your filters."
        >
          <StateStoring enabled={true} type="localStorage" storageKey="purchaseItemsReportState" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search purchase items..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={50} />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by status, supplier, or location" />

          {/* Product Information */}
          <Column
            dataField="productName"
            caption="Product"
            minWidth={200}
            fixed={true}
            fixedPosition="left"
            cellRender={(data) => <span className="font-medium text-gray-900 dark:text-gray-100">{data.text}</span>}
          />
          <Column
            dataField="variationName"
            caption="Variation"
            width={150}
          />
          <Column
            dataField="sku"
            caption="SKU"
            width={130}
            cellRender={(data) => <span className="font-mono text-sm">{data.text}</span>}
          />

          {/* Purchase Order Information */}
          <Column
            dataField="purchaseOrderNumber"
            caption="PO Number"
            width={150}
            cellRender={(data) => <span className="font-medium text-blue-600 dark:text-blue-400">{data.text}</span>}
          />
          <Column
            dataField="purchaseDate"
            caption="PO Date"
            dataType="date"
            width={120}
            format="MMM dd, yyyy"
          />
          <Column
            dataField="expectedDeliveryDate"
            caption="Expected Delivery"
            dataType="date"
            width={140}
            format="MMM dd, yyyy"
            cellRender={(data) => data.value ? data.text : <span className="text-gray-400">N/A</span>}
          />

          {/* Supplier and Location */}
          <Column
            dataField="supplier"
            caption="Supplier"
            width={150}
          />
          <Column
            dataField="location"
            caption="Location"
            width={150}
          />

          {/* Status */}
          <Column
            dataField="status"
            caption="Status"
            width={140}
            alignment="center"
            cellRender={statusCellRender}
          />

          {/* Quantities */}
          <Column
            dataField="quantityOrdered"
            caption="Qty Ordered"
            dataType="number"
            width={120}
            alignment="right"
            format="#,##0.00"
          />
          <Column
            dataField="quantityReceived"
            caption="Qty Received"
            dataType="number"
            width={130}
            alignment="right"
            format="#,##0.00"
          />

          {/* Costs and Totals */}
          <Column
            dataField="unitCost"
            caption="Unit Cost"
            dataType="number"
            width={120}
            alignment="right"
            format="#,##0.00"
          />
          <Column
            dataField="itemTotal"
            caption="Item Total"
            dataType="number"
            width={130}
            alignment="right"
            format="#,##0.00"
            cssClass="bg-yellow-50 dark:bg-yellow-900/20"
          />
          <Column
            dataField="receivedTotal"
            caption="Received Total"
            dataType="number"
            width={140}
            alignment="right"
            format="#,##0.00"
            cssClass="bg-green-50 dark:bg-green-900/20"
          />

          {/* Serial */}
          <Column
            dataField="requiresSerial"
            caption="Serial?"
            width={100}
            alignment="center"
            cellRender={serialCellRender}
          />

          {/* Summary Totals */}
          <Summary>
            <TotalItem column="productName" summaryType="count" displayFormat="Total: {0} items" />
            <TotalItem column="quantityOrdered" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="quantityReceived" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="itemTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="receivedTotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="unitCost" summaryType="avg" valueFormat="#,##0.00" displayFormat="Avg: {0}" />
          </Summary>
        </DataGrid>
      </div>
    </div>
  )
}
