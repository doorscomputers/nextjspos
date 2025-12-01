'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, DollarSign, Printer, XCircle, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
  Scrolling,
  ColumnChooser,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface ServicePayment {
  id: number
  paymentNumber: string
  paymentDate: string
  jobOrderNumber: string
  customerName: string | null
  amount: number
  paymentMethod: string
  referenceNumber: string | null
  receivedBy: string
  isVoided: boolean
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
}

interface JobOrder {
  id: number
  jobOrderNumber: string
  customerName: string | null
  totalCost: number
  paidAmount: number
  paymentStatus: string
}

interface BusinessLocation {
  id: number
  name: string
}

export default function ServicePaymentsPage() {
  const { can, user } = usePermissions()
  const [payments, setPayments] = useState<ServicePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    voidedPayments: 0,
    todayPayments: 0,
  })
  const dataGridRef = useRef<DataGrid>(null)

  // Add Payment Dialog State
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    jobOrderId: '',
    locationId: '',
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    // Wait for user session to be loaded before checking permissions
    if (!user) return

    if (!can(PERMISSIONS.SERVICE_PAYMENT_VIEW)) {
      toast.error('You do not have permission to view service payments')
      setLoading(false) // Stop loading when permission denied
      return
    }
    fetchPayments()
  }, [user])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/service-payments')
      const data = await response.json()
      if (response.ok) {
        const paymentsData = Array.isArray(data) ? data : data.payments || []
        setPayments(paymentsData)

        // Calculate stats
        const activePayments = paymentsData.filter((p: ServicePayment) => !p.isVoided)
        const totalAmount = activePayments.reduce((sum: number, p: ServicePayment) => sum + p.amount, 0)
        const voidedCount = paymentsData.filter((p: ServicePayment) => p.isVoided).length

        const today = new Date().toDateString()
        const todayCount = activePayments.filter((p: ServicePayment) =>
          new Date(p.paymentDate).toDateString() === today
        ).length

        setStats({
          totalPayments: activePayments.length,
          totalAmount: totalAmount,
          voidedPayments: voidedCount,
          todayPayments: todayCount,
        })
      } else {
        toast.error(data.error || 'Failed to fetch payments')
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to fetch payments')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPayments()
    setRefreshing(false)
    toast.success('Payments refreshed')
  }

  // Fetch job orders with unpaid balance
  const fetchJobOrders = async () => {
    try {
      const response = await fetch('/api/job-orders?paymentStatus=unpaid,partial')
      const data = await response.json()
      if (response.ok) {
        // Filter job orders that have remaining balance
        const ordersWithBalance = (data.jobOrders || []).filter(
          (jo: JobOrder) => Number(jo.totalCost) > Number(jo.paidAmount)
        )
        setJobOrders(ordersWithBalance)
      }
    } catch (error) {
      console.error('Error fetching job orders:', error)
    }
  }

  // Fetch locations
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  // Open add payment dialog
  const handleOpenAddPayment = async () => {
    await Promise.all([fetchJobOrders(), fetchLocations()])
    setPaymentForm({
      jobOrderId: '',
      locationId: '',
      amount: '',
      paymentMethod: 'cash',
      referenceNumber: '',
      notes: '',
    })
    setShowAddPaymentDialog(true)
  }

  // Get selected job order's remaining balance
  const getSelectedJobOrderBalance = () => {
    if (!paymentForm.jobOrderId) return 0
    const jo = jobOrders.find(j => j.id === parseInt(paymentForm.jobOrderId))
    if (!jo) return 0
    return Number(jo.totalCost) - Number(jo.paidAmount)
  }

  // Submit payment
  const handleSubmitPayment = async () => {
    if (!paymentForm.jobOrderId || !paymentForm.locationId || !paymentForm.amount) {
      toast.error('Please fill in all required fields')
      return
    }

    const amount = parseFloat(paymentForm.amount)
    if (amount <= 0) {
      toast.error('Amount must be greater than zero')
      return
    }

    const balance = getSelectedJobOrderBalance()
    if (amount > balance) {
      toast.error(`Amount cannot exceed remaining balance of ₱${balance.toFixed(2)}`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/service-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobOrderId: parseInt(paymentForm.jobOrderId),
          locationId: parseInt(paymentForm.locationId),
          paymentDate: new Date().toISOString(),
          amount: amount,
          paymentMethod: paymentForm.paymentMethod,
          referenceNumber: paymentForm.referenceNumber || null,
          notes: paymentForm.notes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Payment recorded successfully')
        setShowAddPaymentDialog(false)
        fetchPayments()
      } else {
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      console.error('Error submitting payment:', error)
      toast.error('Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoidPayment = async (paymentId: number) => {
    if (!confirm('Are you sure you want to void this payment?')) {
      return
    }

    const voidReason = prompt('Please enter the reason for voiding this payment:')
    if (!voidReason || !voidReason.trim()) {
      toast.error('Void reason is required')
      return
    }

    try {
      const response = await fetch(`/api/service-payments/${paymentId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: voidReason.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Payment voided successfully')
        fetchPayments()
      } else {
        toast.error(data.error || 'Failed to void payment')
      }
    } catch (error) {
      console.error('Error voiding payment:', error)
      toast.error('Failed to void payment')
    }
  }

  const handlePrintReceipt = (paymentId: number) => {
    window.open(`/api/service-payments/${paymentId}/receipt`, '_blank')
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Service Payments')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Service_Payments_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    if (dataGridRef.current) {
      exportToPDF({
        jsPDFDocument: doc,
        component: dataGridRef.current.instance,
      }).then(() => {
        doc.save(`Service_Payments_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const isVoided = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isVoided
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}
        >
          {isVoided ? 'Voided' : 'Active'}
        </span>
      </div>
    )
  }

  const currencyCellRender = (data: any) => {
    return (
      <span className="text-gray-900 dark:text-gray-100">
        ₱{data.value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    )
  }

  const actionsCellRender = (data: any) => {
    const payment = data.data as ServicePayment

    return (
      <div className="flex items-center justify-center gap-2">
        {can(PERMISSIONS.SERVICE_RECEIPT_PRINT) && !payment.isVoided && (
          <button
            onClick={() => handlePrintReceipt(payment.id)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50"
          >
            <Printer className="w-4 h-4 mr-1" />
            Print
          </button>
        )}
        {can(PERMISSIONS.SERVICE_PAYMENT_VOID) && !payment.isVoided && (
          <button
            onClick={() => handleVoidPayment(payment.id)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors dark:text-red-400 dark:bg-red-900/30 dark:border-red-800 dark:hover:bg-red-900/50"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Void
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin dark:border-amber-900 dark:border-t-amber-400"></div>
          <p className="mt-4 text-amber-700 font-medium dark:text-amber-300">Loading payments...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.SERVICE_PAYMENT_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view service payments.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 bg-clip-text text-transparent dark:from-amber-100 dark:via-orange-300 dark:to-amber-100">
                Service Payments
              </h1>
            </div>
            <p className="text-amber-700 text-sm sm:text-base dark:text-amber-300">
              Manage service and repair payments
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleOpenAddPayment}
              variant="default"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Payment
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={onExportingToPDF}
              disabled={payments.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                  <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Payments</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                  <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    ₱{stats.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Today's Payments</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.todayPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900/30">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Voided</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.voidedPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-amber-200 overflow-hidden dark:bg-amber-900/30 dark:border-amber-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={payments}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExporting}
              className="dx-card"
              width="100%"
              keyExpr="id"
            >
              <LoadPanel enabled={true} />
              <Scrolling mode="standard" />
              <Paging defaultPageSize={10} />
              <Pager
                visible={true}
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 30, 40, 50]}
                showInfo={true}
                showNavigationButtons={true}
              />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel
                visible={true}
                width={300}
                placeholder="Search payments..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />

              <Column
                dataField="paymentNumber"
                caption="Payment #"
                minWidth={140}
              />
              <Column
                dataField="paymentDate"
                caption="Date"
                minWidth={120}
                dataType="date"
                format="dd/MM/yyyy"
              />
              <Column
                dataField="jobOrderNumber"
                caption="Job Order #"
                minWidth={140}
              />
              <Column
                dataField="customerName"
                caption="Customer"
                minWidth={180}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || 'Walk-in'}
                  </span>
                )}
              />
              <Column
                dataField="amount"
                caption="Amount"
                minWidth={130}
                dataType="number"
                alignment="right"
                cellRender={currencyCellRender}
              />
              <Column
                dataField="paymentMethod"
                caption="Method"
                minWidth={120}
              />
              <Column
                dataField="referenceNumber"
                caption="Reference #"
                minWidth={150}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="receivedBy"
                caption="Received By"
                minWidth={150}
              />
              <Column
                dataField="isVoided"
                caption="Status"
                width={110}
                alignment="center"
                cellRender={statusCellRender}
              />
              <Column
                caption="Actions"
                width={180}
                alignment="center"
                cellRender={actionsCellRender}
                allowExporting={false}
              />

              <Summary>
                <TotalItem
                  column="amount"
                  summaryType="sum"
                  valueFormat={{ type: 'currency', currency: 'PHP' }}
                />
              </Summary>
            </DataGrid>
          </div>
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-amber-900 dark:text-amber-100">
              Add Payment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Job Order Selection */}
            <div className="space-y-2">
              <Label htmlFor="jobOrder" className="font-medium">
                Job Order <span className="text-red-500">*</span>
              </Label>
              <Select
                value={paymentForm.jobOrderId}
                onValueChange={(value) => setPaymentForm({ ...paymentForm, jobOrderId: value, amount: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job order" />
                </SelectTrigger>
                <SelectContent>
                  {jobOrders.length === 0 ? (
                    <SelectItem value="none" disabled>No job orders with balance</SelectItem>
                  ) : (
                    jobOrders.map((jo) => (
                      <SelectItem key={jo.id} value={jo.id.toString()}>
                        {jo.jobOrderNumber} - {jo.customerName || 'Walk-in'} (Balance: ₱{(Number(jo.totalCost) - Number(jo.paidAmount)).toFixed(2)})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Show remaining balance when job order selected */}
            {paymentForm.jobOrderId && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Remaining Balance:</span>{' '}
                  <span className="text-lg font-bold">₱{getSelectedJobOrderBalance().toFixed(2)}</span>
                </p>
              </div>
            )}

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location" className="font-medium">
                Location <span className="text-red-500">*</span>
              </Label>
              <Select
                value={paymentForm.locationId}
                onValueChange={(value) => setPaymentForm({ ...paymentForm, locationId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="font-medium">
                Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="Enter payment amount"
                className="text-lg"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="font-medium">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  <SelectItem value="maya">Maya</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber" className="font-medium">
                Reference Number
              </Label>
              <Input
                id="referenceNumber"
                type="text"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                placeholder="Enter reference number (optional)"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Enter notes (optional)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPayment}
              disabled={submitting || !paymentForm.jobOrderId || !paymentForm.locationId || !paymentForm.amount}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
