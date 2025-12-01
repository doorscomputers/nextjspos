'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, DollarSign, Printer, XCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
            <Link href="/dashboard/technical/job-orders">
              <Button
                variant="default"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </Button>
            </Link>
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
    </div>
  )
}
