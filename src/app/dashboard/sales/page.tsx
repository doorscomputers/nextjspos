"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { EyeIcon, XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import SalesInvoicePrint from '@/components/SalesInvoicePrint'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Paging,
  SearchPanel,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  LoadPanel,
  Scrolling,
  Selection,
  Toolbar,
  Item as ToolbarItem,
  Summary,
  TotalItem
} from 'devextreme-react/data-grid'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  status: string
  notes: string | null
  createdAt: string
  customer: {
    id: number
    name: string
    mobile: string | null
  } | null
  items: {
    id: number
    quantity: number
    unitPrice: number
    serialNumbers: any
  }[]
  payments: {
    id: number
    paymentMethod: string
    amount: number
  }[]
}

interface GridSale {
  id: number
  invoiceNumber: string
  saleDate: Date
  customerName: string
  customerMobile: string | null
  itemCount: number
  subtotal: number
  discountAmount: number
  totalAmount: number
  paymentSummary: string
  status: string
  statusBadge: string
}

export default function SalesPage() {
  const { can } = usePermissions()
  const [sales, setSales] = useState<Sale[]>([])
  const [gridData, setGridData] = useState<GridSale[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const dataGridRef = useRef<DataGrid>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalSales, setTotalSales] = useState(0)

  // Reprint state
  const [showReprintModal, setShowReprintModal] = useState(false)
  const [saleToReprint, setSaleToReprint] = useState<any>(null)

  useEffect(() => {
    fetchSales()
  }, [statusFilter, currentPage, itemsPerPage])

  const fetchSales = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Fetch all for DevExtreme to handle pagination
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/sales?${params}`)
      const data = await response.json()

      if (response.ok) {
        setSales(data.sales || [])
        setTotalSales(data.total || 0)

        // Transform data for DevExtreme DataGrid
        const transformedData: GridSale[] = (data.sales || []).map((sale: Sale) => ({
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleDate: new Date(sale.saleDate),
          customerName: sale.customer?.name || 'Walk-in Customer',
          customerMobile: sale.customer?.mobile || null,
          itemCount: sale.items.length,
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          totalAmount: sale.totalAmount,
          paymentSummary: sale.payments.length > 0
            ? sale.payments.map(p => `${getPaymentMethodLabel(p.paymentMethod)}: ${formatCurrency(p.amount)}`).join(', ')
            : 'No payment',
          status: sale.status,
          statusBadge: sale.status,
        }))

        setGridData(transformedData)
      } else {
        toast.error(data.error || 'Failed to fetch sales')
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast.error('Failed to fetch sales')
    } finally {
      setLoading(false)
    }
  }

  const handleReprintReceipt = async (saleId: number) => {
    try {
      // Fetch sale details from reprint API
      const response = await fetch(`/api/sales/${saleId}/reprint`)

      if (!response.ok) {
        throw new Error('Failed to fetch sale details')
      }

      const data = await response.json()

      // Open reprint modal with sale data
      setSaleToReprint(data.receipt)
      setShowReprintModal(true)

      toast.success('Receipt loaded for reprinting')
    } catch (error: any) {
      console.error('Error fetching sale for reprint:', error)
      toast.error(error.message || 'Failed to load receipt')
    }
  }

  const handleVoidSale = async (saleId: number, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to void sale ${invoiceNumber}? Stock will be restored.`)) {
      return
    }

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Sale voided successfully')
        fetchSales()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to void sale')
      }
    } catch (error) {
      console.error('Error voiding sale:', error)
      toast.error('Failed to void sale')
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'cash': 'Cash',
      'card': 'Card',
      'bank_transfer': 'Bank Transfer',
      'cheque': 'Cheque',
      'other': 'Other',
    }
    return labels[method] || method
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'completed': 'default',
      'pending': 'secondary',
      'voided': 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return '0.00'
    }
    return Number(amount).toFixed(2)
  }

  // DevExtreme Export Handler
  const onExporting = (e: any) => {
    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Sales')

      exportToExcel({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          if (gridCell.rowType === 'data' && gridCell.column.dataField === 'status') {
            const status = gridCell.value
            if (status === 'completed') {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'C6EFCE' },
              }
            } else if (status === 'voided') {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC7CE' },
              }
            } else if (status === 'pending') {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEB9C' },
              }
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer: any) => {
          saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `sales_${new Date().toISOString().split('T')[0]}.xlsx`)
          toast.success('Excel exported successfully')
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape', 'pt', 'a4')

      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('SALES REPORT', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, 55, { align: 'center' })

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        topLeft: { x: 20, y: 70 },
        autoTableOptions: {
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { top: 70 },
        },
      }).then(() => {
        doc.save(`sales_${new Date().toISOString().split('T')[0]}.pdf`)
        toast.success('PDF exported successfully')
      })
      e.cancel = true
    }
  }

  // Custom cell renderers
  const customerCellRender = (data: any) => {
    return (
      <div>
        <div className="font-medium text-gray-900 dark:text-gray-100">{data.data.customerName}</div>
        {data.data.customerMobile && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{data.data.customerMobile}</div>
        )}
      </div>
    )
  }

  const statusCellRender = (data: any) => {
    return getStatusBadge(data.value)
  }

  const actionsCellRender = (data: any) => {
    const sale = sales.find(s => s.id === data.data.id)
    if (!sale) return null

    return (
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/sales/${sale.id}`}>
          <Button
            size="sm"
            title="View Details"
            className="gap-1 px-2 has-[>svg]:px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium border-2 border-blue-700 hover:border-blue-800 shadow-sm hover:shadow-md transition-all"
          >
            <EyeIcon className="w-4 h-4" />
            View
          </Button>
        </Link>
        {can(PERMISSIONS.SELL_VIEW) && (
          <Button
            size="sm"
            onClick={() => handleReprintReceipt(sale.id)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium border-2 border-purple-700 hover:border-purple-800 shadow-sm hover:shadow-md transition-all gap-1"
            title="Reprint Receipt"
          >
            <PrinterIcon className="w-4 h-4" />
            Re-Print
          </Button>
        )}
        {can(PERMISSIONS.SELL_DELETE) && sale.status !== 'voided' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVoidSale(sale.id, sale.invoiceNumber)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Void Sale"
          >
            <XMarkIcon className="w-4 h-4" />
          </Button>
        )}
      </div>
    )
  }

  if (!can(PERMISSIONS.SELL_VIEW) && !can(PERMISSIONS.SELL_VIEW_OWN)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view sales.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your sales transactions</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Status:</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <DataGrid
          ref={dataGridRef}
          dataSource={gridData}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="id"
          onExporting={onExporting}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
          hoverStateEnabled={true}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="salesListState" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="onClick" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search sales..." highlightCaseSensitive={false} />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={20} />

          <Toolbar>
            <ToolbarItem name="searchPanel" />
            <ToolbarItem name="exportButton" />
            <ToolbarItem name="columnChooserButton" />
          </Toolbar>

          {/* Fixed Columns */}
          <Column
            dataField="invoiceNumber"
            caption="Invoice #"
            width={150}
            fixed={true}
            fixedPosition="left"
            cellRender={(data) => <span className="font-medium text-blue-600 dark:text-blue-400">{data.text}</span>}
          />

          {/* Standard Columns */}
          <Column
            dataField="saleDate"
            caption="Sale Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
            sortOrder="desc"
          />
          <Column
            dataField="customerName"
            caption="Customer"
            minWidth={200}
            cellRender={customerCellRender}
          />
          <Column
            dataField="itemCount"
            caption="Items"
            dataType="number"
            width={80}
            alignment="center"
            cellRender={(data) => (
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                {data.text}
              </span>
            )}
          />
          <Column
            dataField="subtotal"
            caption="Subtotal"
            dataType="number"
            format="#,##0.00"
            width={120}
            alignment="right"
          />
          <Column
            dataField="discountAmount"
            caption="Discount"
            dataType="number"
            format="#,##0.00"
            width={100}
            alignment="right"
          />
          <Column
            dataField="totalAmount"
            caption="Total"
            dataType="number"
            format="#,##0.00"
            width={120}
            alignment="right"
            cssClass="bg-green-50 dark:bg-green-900/20"
            cellRender={(data) => (
              <span className="font-semibold text-green-800 dark:text-green-300">
                {formatCurrency(data.value)}
              </span>
            )}
          />
          <Column
            dataField="paymentSummary"
            caption="Payment"
            minWidth={200}
            cellRender={(data) => (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {data.value}
              </div>
            )}
          />
          <Column
            dataField="status"
            caption="Status"
            width={120}
            alignment="center"
            cellRender={statusCellRender}
          />

          {/* Actions Column */}
          <Column
            caption="Actions"
            width={180}
            alignment="center"
            fixed={true}
            fixedPosition="right"
            cellRender={actionsCellRender}
            allowExporting={false}
            allowFiltering={false}
            allowSorting={false}
          />

          {/* Summary Totals */}
          <Summary>
            <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0} sales" />
            <TotalItem column="subtotal" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="discountAmount" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
            <TotalItem column="totalAmount" summaryType="sum" valueFormat="#,##0.00" displayFormat="{0}" />
          </Summary>
        </DataGrid>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> Use the search bar to find sales quickly. Click column headers to sort.
            Use the export button to download as Excel or PDF. Right-click column headers to access filtering options.
          </p>
        </div>
      </div>

      {/* Reprint Modal */}
      {saleToReprint && (
        <SalesInvoicePrint
          sale={saleToReprint}
          isOpen={showReprintModal}
          isReprint={true}
          onClose={() => {
            setShowReprintModal(false)
            setSaleToReprint(null)
          }}
        />
      )}
    </div>
  )
}
