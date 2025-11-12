"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EyeIcon, CurrencyDollarIcon, FunnelIcon, XMarkIcon, CheckCircleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currencyUtils'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  Selection,
  Summary,
  TotalItem,
  ColumnChooser,
  StateStoring,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface AccountsPayable {
  id: number
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  paidAmount: number
  balanceAmount: number
  status: string
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  purchase: {
    id: number
    purchaseOrderNumber: string
  } | null
}

interface AgingData {
  current: number
  days30: number
  days60: number
  days90: number
  days90Plus: number
  total: number
}

export default function AccountsPayablePage() {
  const { can } = usePermissions()
  const router = useRouter()
  const dataGridRef = useRef<DataGrid>(null)

  const [payables, setPayables] = useState<AccountsPayable[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [agingData, setAgingData] = useState<AgingData | null>(null)

  // Batch payment state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedPayableIds, setSelectedPayableIds] = useState<number[]>([])

  // Payment details dialog state
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const [selectedPayableForDetails, setSelectedPayableForDetails] = useState<AccountsPayable | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  useEffect(() => {
    fetchPayables()
  }, [statusFilter, dateFilter, customStartDate, customEndDate])

  const getDateRange = (filter: string) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    const result = { start: '', end: '' }

    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    switch (filter) {
      case 'today':
        result.start = todayStr
        result.end = todayStr
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = formatDate(yesterday)
        result.start = yesterdayStr
        result.end = yesterdayStr
        break
      case 'this_week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        result.start = formatDate(weekStart)
        result.end = todayStr
        break
      case 'last_week':
        const lastWeekStart = new Date(today)
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6)
        result.start = formatDate(lastWeekStart)
        result.end = formatDate(lastWeekEnd)
        break
      case 'this_month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        result.start = formatDate(monthStart)
        result.end = todayStr
        break
      case 'last_month':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        result.start = formatDate(lastMonthStart)
        result.end = formatDate(lastMonthEnd)
        break
      case 'this_quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1)
        result.start = formatDate(quarterStart)
        result.end = todayStr
        break
      case 'last_quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear()
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3
        const lastQuarterStart = new Date(lastQuarterYear, lastQuarterMonth, 1)
        const lastQuarterEnd = new Date(lastQuarterYear, lastQuarterMonth + 3, 0)
        result.start = formatDate(lastQuarterStart)
        result.end = formatDate(lastQuarterEnd)
        break
      case 'this_year':
        const yearStart = new Date(today.getFullYear(), 0, 1)
        result.start = formatDate(yearStart)
        result.end = todayStr
        break
      case 'last_year':
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1)
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31)
        result.start = formatDate(lastYearStart)
        result.end = formatDate(lastYearEnd)
        break
      case 'custom':
        if (customStartDate) result.start = customStartDate
        if (customEndDate) result.end = customEndDate
        break
    }

    return result
  }

  const fetchPayables = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '100', // Fetch more for client-side filtering
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      // NOTE: Date filtering is done client-side to avoid timezone issues
      // Do NOT send startDate/endDate to API

      const response = await fetch(`/api/accounts-payable?${params}`)
      const data = await response.json()

      if (response.ok) {
        let fetchedPayables = data.payables || []

        // Apply client-side date filter to fix timezone issues
        const dateRange = getDateRange(dateFilter)
        if (dateRange.start || dateRange.end) {
          fetchedPayables = fetchedPayables.filter((payable: AccountsPayable) => {
            const invoiceDate = new Date(payable.invoiceDate)
            const year = invoiceDate.getFullYear()
            const month = String(invoiceDate.getMonth() + 1).padStart(2, '0')
            const day = String(invoiceDate.getDate()).padStart(2, '0')
            const invoiceDateStr = `${year}-${month}-${day}`

            if (dateRange.start && invoiceDateStr < dateRange.start) {
              return false
            }
            if (dateRange.end && invoiceDateStr > dateRange.end) {
              return false
            }
            return true
          })
        }

        setPayables(fetchedPayables)
        setAgingData(data.aging || null)
      } else {
        toast.error(data.error || 'Failed to fetch accounts payable')
      }
    } catch (error) {
      console.error('Error fetching accounts payable:', error)
      toast.error('Failed to fetch accounts payable')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = today.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    if (dataGridRef.current) {
      dataGridRef.current.instance.clearFilter()
    }
  }

  // Batch payment functions
  const toggleBatchMode = () => {
    const newBatchMode = !batchMode
    setBatchMode(newBatchMode)
    setSelectedPayableIds([])

    if (!newBatchMode && dataGridRef.current) {
      dataGridRef.current.instance.clearSelection()
    }
  }

  const onSelectionChanged = useCallback((e: any) => {
    if (batchMode) {
      const selectedRowsData = e.selectedRowsData as AccountsPayable[]
      setSelectedPayableIds(selectedRowsData.map(p => p.id))
    }
  }, [batchMode])

  const selectAllUnpaid = () => {
    if (dataGridRef.current) {
      const unpaidPayables = payables.filter(p => p.balanceAmount > 0 && p.status !== 'paid')
      dataGridRef.current.instance.selectRows(unpaidPayables.map(p => p.id), false)
    }
  }

  const deselectAll = () => {
    if (dataGridRef.current) {
      dataGridRef.current.instance.clearSelection()
    }
    setSelectedPayableIds([])
  }

  const proceedWithBatchPayment = () => {
    if (selectedPayableIds.length === 0) {
      toast.error('Please select at least one invoice to pay')
      return
    }

    // Check if all selected payables are from the same supplier
    const selectedPayableData = payables.filter(p => selectedPayableIds.includes(p.id))
    const supplierIds = [...new Set(selectedPayableData.map(p => p.supplier.id))]

    if (supplierIds.length > 1) {
      toast.error('All selected invoices must be from the same supplier')
      return
    }

    // Navigate to batch payment page
    const apIds = selectedPayableIds.join(',')
    router.push(`/dashboard/payments/batch?apIds=${apIds}`)
  }

  const getTotalSelected = () => {
    return payables
      .filter(p => selectedPayableIds.includes(p.id))
      .reduce((sum, p) => sum + p.balanceAmount, 0)
  }

  const viewPaymentDetails = async (payable: AccountsPayable) => {
    setSelectedPayableForDetails(payable)
    setShowPaymentDetails(true)
    setLoadingPayments(true)

    try {
      // Fetch payments for this accounts payable
      const response = await fetch(`/api/payments?accountsPayableId=${payable.id}`)
      const data = await response.json()

      if (response.ok) {
        setPaymentHistory(data.payments || [])
      } else {
        toast.error('Failed to fetch payment details')
        setPaymentHistory([])
      }
    } catch (error) {
      console.error('Error fetching payment details:', error)
      toast.error('Failed to fetch payment details')
      setPaymentHistory([])
    } finally {
      setLoadingPayments(false)
    }
  }

  const handlePrintPaymentHistory = () => {
    if (!selectedPayableForDetails) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to print')
      return
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment History - ${selectedPayableForDetails.invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #000;
            }
            h1 {
              text-align: center;
              color: #333;
              margin-bottom: 30px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #333;
              border-bottom: 2px solid #333;
              padding-bottom: 5px;
            }
            .invoice-details {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .detail-item {
              margin-bottom: 10px;
            }
            .detail-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 2px;
            }
            .detail-value {
              font-size: 14px;
              font-weight: bold;
              color: #000;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
              font-size: 12px;
              text-transform: uppercase;
            }
            td {
              font-size: 13px;
            }
            .amount {
              color: #16a34a;
              font-weight: bold;
            }
            .no-payments {
              text-align: center;
              padding: 20px;
              color: #666;
              font-style: italic;
            }
            @media print {
              body {
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>Payment History</h1>

          <div class="section">
            <div class="section-title">Invoice Details</div>
            <div class="invoice-details">
              <div class="detail-item">
                <div class="detail-label">Invoice Number</div>
                <div class="detail-value">${selectedPayableForDetails.invoiceNumber}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Supplier</div>
                <div class="detail-value">${selectedPayableForDetails.supplier.name}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Total Amount</div>
                <div class="detail-value">${formatCurrency(selectedPayableForDetails.amount)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value">${selectedPayableForDetails.status.replace('_', ' ').toUpperCase()}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Paid Amount</div>
                <div class="detail-value" style="color: #16a34a;">${formatCurrency(selectedPayableForDetails.paidAmount)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Balance Due</div>
                <div class="detail-value" style="color: #dc2626;">${formatCurrency(selectedPayableForDetails.balanceAmount)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Invoice Date</div>
                <div class="detail-value">${formatDate(selectedPayableForDetails.invoiceDate)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Due Date</div>
                <div class="detail-value">${formatDate(selectedPayableForDetails.dueDate)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Payment Transactions</div>
            ${paymentHistory.length === 0 ? `
              <div class="no-payments">No payments recorded yet</div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentHistory.map((payment: any) => `
                    <tr>
                      <td>${payment.paymentNumber}</td>
                      <td>${formatDate(payment.paymentDate)}</td>
                      <td style="text-transform: capitalize;">${payment.paymentMethod.replace('_', ' ')}</td>
                      <td class="amount">${formatCurrency(payment.amount)}</td>
                      <td>${payment.transactionReference || payment.chequeNumber || '-'}</td>
                      <td>${payment.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const handleExportPaymentHistoryToPDF = () => {
    if (!selectedPayableForDetails || paymentHistory.length === 0) return

    const doc = new jsPDF('l', 'mm', 'a4')

    // Add title
    doc.setFontSize(18)
    doc.text(`Payment History - ${selectedPayableForDetails.invoiceNumber}`, 14, 20)

    // Add invoice details
    doc.setFontSize(10)
    doc.text(`Supplier: ${selectedPayableForDetails.supplier.name}`, 14, 30)
    doc.text(`Total: ${formatCurrency(selectedPayableForDetails.amount)} | Paid: ${formatCurrency(selectedPayableForDetails.paidAmount)} | Balance: ${formatCurrency(selectedPayableForDetails.balanceAmount)}`, 14, 36)

    // Create table data
    const tableData = paymentHistory.map((payment: any) => [
      payment.paymentNumber,
      formatDate(payment.paymentDate),
      payment.paymentMethod.replace('_', ' ').toUpperCase(),
      formatCurrency(payment.amount),
      payment.transactionReference || payment.chequeNumber || '-',
      payment.notes || '-'
    ])

    // Add table using autoTable
    ;(doc as any).autoTable({
      head: [['Payment #', 'Date', 'Method', 'Amount', 'Reference', 'Notes']],
      body: tableData,
      startY: 42,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 }
    })

    doc.save(`payment_history_${selectedPayableForDetails.invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // DevExtreme Export Handlers
  const onExportingToExcel = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Accounts Payable')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `accounts_payable_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const handleExportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    if (dataGridRef.current) {
      exportToPDF({
        jsPDFDocument: doc,
        component: dataGridRef.current.instance,
      }).then(() => {
        doc.save(`accounts_payable_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const handleExportToCSV = () => {
    if (dataGridRef.current) {
      // Use Excel export functionality but save with CSV extension
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Accounts Payable')

      exportToExcel({
        component: dataGridRef.current.instance,
        worksheet,
        autoFilterEnabled: false,
      }).then(() => {
        workbook.csv.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'text/csv' }),
            `accounts_payable_${new Date().toISOString().split('T')[0]}.csv`
          )
        })
      })
    }
  }

  // Custom Cell Renderers
  const invoiceNumberCellRender = (data: any) => {
    return (
      <span className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
        {data.value}
      </span>
    )
  }

  const supplierCellRender = (data: any) => {
    const supplier = data.data.supplier
    return (
      <div>
        <div className="font-medium text-foreground">{supplier.name}</div>
        {supplier.mobile && (
          <div className="text-xs text-muted-foreground">{supplier.mobile}</div>
        )}
      </div>
    )
  }

  const dueDateCellRender = (data: any) => {
    const daysOverdue = getDaysOverdue(data.value)
    const isPaid = data.data.status === 'paid'

    return (
      <div>
        <div className="text-sm text-muted-foreground">{formatDate(data.value)}</div>
        {daysOverdue > 0 && !isPaid && (
          <div className="text-xs font-medium text-red-600 dark:text-red-400">
            {daysOverdue} days overdue
          </div>
        )}
      </div>
    )
  }

  const currencyCellRender = (data: any) => {
    return (
      <span className="font-semibold text-foreground">
        {formatCurrency(data.value)}
      </span>
    )
  }

  const paidAmountCellRender = (data: any) => {
    return (
      <span className="font-medium text-green-600 dark:text-green-500">
        {formatCurrency(data.value)}
      </span>
    )
  }

  const balanceCellRender = (data: any) => {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        {formatCurrency(data.value)}
      </span>
    )
  }

  const statusCellRender = (data: any) => {
    const statusConfig: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'unpaid': { variant: 'destructive', label: 'Unpaid' },
      'partially_paid': { variant: 'secondary', label: 'Partially Paid' },
      'paid': { variant: 'default', label: 'Paid' },
      'overdue': { variant: 'destructive', label: 'Overdue' },
    }
    const config = statusConfig[data.value] || { variant: 'outline', label: data.value }

    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const actionsCellRender = (data: any) => {
    const payable = data.data as AccountsPayable

    if (batchMode) {
      return (
        <span className="text-sm text-muted-foreground">
          {selectedPayableIds.includes(payable.id) ? 'Selected' : ''}
        </span>
      )
    }

    if (payable.status === 'paid' || payable.balanceAmount <= 0) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => viewPaymentDetails(payable)}
          className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
        >
          <EyeIcon className="h-4 w-4" />
          View Payments
        </Button>
      )
    }

    return (
      <Link href={`/dashboard/payments/new?apId=${payable.id}`}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
        >
          <CurrencyDollarIcon className="h-4 w-4" />
          Pay
        </Button>
      </Link>
    )
  }

  // Selection filter - only allow unpaid invoices in batch mode
  const isRowSelectable = (data: any) => {
    const payable = data.data as AccountsPayable
    return payable.balanceAmount > 0 && payable.status !== 'paid'
  }

  if (!can(PERMISSIONS.ACCOUNTS_PAYABLE_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          You do not have permission to view accounts payable.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-muted-foreground font-medium">Loading accounts payable...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage supplier payables with DevExtreme</p>
        </div>
        {can(PERMISSIONS.PAYMENT_CREATE) && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={batchMode ? "destructive" : "default"}
              onClick={toggleBatchMode}
              className="gap-2"
            >
              {batchMode ? (
                <>
                  <XMarkIcon className="w-5 h-5" />
                  Cancel Batch
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Batch Payment
                </>
              )}
            </Button>
            {!batchMode && (
              <Link href="/dashboard/payments/new">
                <Button variant="success" className="gap-2">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Make Payment
                </Button>
              </Link>
            )}
            {batchMode && selectedPayableIds.length > 0 && (
              <Button
                onClick={proceedWithBatchPayment}
                variant="default"
                className="gap-2"
              >
                <CurrencyDollarIcon className="w-5 h-5" />
                Pay {selectedPayableIds.length} Invoice{selectedPayableIds.length > 1 ? 's' : ''} ({formatCurrency(getTotalSelected())})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Batch Mode Banner */}
      {batchMode && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Batch Payment Mode</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Select multiple invoices from the same supplier to pay them together in one transaction
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllUnpaid}
                  className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
                >
                  Select All Unpaid
                </Button>
                {selectedPayableIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    className="gap-2 hover:border-orange-500 hover:text-orange-700 dark:hover:text-orange-400"
                  >
                    Deselect All
                  </Button>
                )}
              </div>
            </div>
            {selectedPayableIds.length > 0 && (
              <div className="mt-4 p-3 bg-white dark:bg-blue-900/50 rounded-lg border border-blue-300 dark:border-blue-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Selected Invoices</p>
                    <p className="font-bold text-blue-900 dark:text-blue-100">{selectedPayableIds.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Balance</p>
                    <p className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency(getTotalSelected())}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <Button
                      onClick={proceedWithBatchPayment}
                      variant="default"
                      className="w-full sm:w-auto gap-2"
                    >
                      Proceed to Payment
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aging Summary Cards */}
      {agingData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-500">{formatCurrency(agingData.current)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">1-30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(agingData.days30)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">31-60 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(agingData.days60)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">61-90 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(agingData.days90)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">90+ Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(agingData.days90Plus)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(agingData.total)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5" />
              Filters
            </CardTitle>
            {(statusFilter !== 'all' || dateFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
                <XMarkIcon className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="last_quarter">Last Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="last_year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExportToCSV} className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
          <PrinterIcon className="h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => dataGridRef.current?.instance.exportToExcel(false)} className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
          <PrinterIcon className="h-4 w-4" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportToPDF} className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
          <PrinterIcon className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* DevExtreme DataGrid */}
      <Card className="shadow-xl border-border overflow-hidden">
        <CardContent className="p-0">
          <DataGrid
            ref={dataGridRef}
            dataSource={payables}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            hoverStateEnabled={true}
            onExporting={onExportingToExcel}
            onSelectionChanged={onSelectionChanged}
            className="dx-card"
            width="100%"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="accountsPayableGrid" />

            <Paging defaultPageSize={20} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />

            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel
              visible={true}
              width={300}
              placeholder="Search invoices, suppliers..."
            />
            <Sorting mode="multiple" />
            <ColumnChooser enabled={true} mode="select" />
            <Export enabled={true} allowExportSelectedData={false} />

            {batchMode && (
              <Selection
                mode="multiple"
                showCheckBoxesMode="always"
                selectAllMode="allPages"
              />
            )}

            <Column
              dataField="invoiceNumber"
              caption="Invoice #"
              minWidth={150}
              cellRender={invoiceNumberCellRender}
            />

            <Column
              dataField="supplier.name"
              caption="Supplier"
              minWidth={200}
              cellRender={supplierCellRender}
            />

            <Column
              dataField="invoiceDate"
              caption="Invoice Date"
              dataType="date"
              format="MMM dd, yyyy"
              minWidth={130}
            />

            <Column
              dataField="dueDate"
              caption="Due Date"
              dataType="date"
              minWidth={150}
              cellRender={dueDateCellRender}
            />

            <Column
              dataField="amount"
              caption="Amount"
              dataType="number"
              format="currency"
              minWidth={120}
              cellRender={currencyCellRender}
            />

            <Column
              dataField="paidAmount"
              caption="Paid"
              dataType="number"
              format="currency"
              minWidth={120}
              cellRender={paidAmountCellRender}
            />

            <Column
              dataField="balanceAmount"
              caption="Balance"
              dataType="number"
              format="currency"
              minWidth={120}
              cellRender={balanceCellRender}
            />

            <Column
              dataField="status"
              caption="Status"
              minWidth={130}
              cellRender={statusCellRender}
            />

            <Column
              caption="Actions"
              minWidth={150}
              allowFiltering={false}
              allowSorting={false}
              cellRender={actionsCellRender}
            />

            {/* Summary Row */}
            <Summary>
              <TotalItem
                column="invoiceNumber"
                summaryType="count"
                displayFormat="{0} invoices"
              />
              <TotalItem
                column="amount"
                summaryType="sum"
                valueFormat="currency"
              />
              <TotalItem
                column="paidAmount"
                summaryType="sum"
                valueFormat="currency"
              />
              <TotalItem
                column="balanceAmount"
                summaryType="sum"
                valueFormat="currency"
              />
            </Summary>
          </DataGrid>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={showPaymentDetails} onOpenChange={setShowPaymentDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
          </DialogHeader>
          {selectedPayableForDetails && (
            <div className="space-y-6">
              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice Number</p>
                      <p className="font-semibold text-foreground">{selectedPayableForDetails.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Supplier</p>
                      <p className="font-semibold text-foreground">{selectedPayableForDetails.supplier.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="font-semibold text-foreground">{formatCurrency(selectedPayableForDetails.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div>{statusCellRender({ value: selectedPayableForDetails.status })}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-sm text-muted-foreground">Paid Amount</p>
                      <p className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(selectedPayableForDetails.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Balance Due</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(selectedPayableForDetails.balanceAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice Date</p>
                      <p className="font-medium text-foreground">{formatDate(selectedPayableForDetails.invoiceDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium text-foreground">{formatDate(selectedPayableForDetails.dueDate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment History Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? (
                    <p className="text-center text-muted-foreground py-8">Loading payment history...</p>
                  ) : paymentHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No payments recorded yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Payment #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Method</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reference</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {paymentHistory.map((payment: any) => (
                            <tr key={payment.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3 text-sm font-medium text-foreground">{payment.paymentNumber}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                                {payment.paymentMethod.replace('_', ' ')}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-500">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {payment.transactionReference || payment.chequeNumber || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {payment.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPaymentHistory}
                  className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPaymentHistoryToPDF}
                  disabled={paymentHistory.length === 0}
                  className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentDetails(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
