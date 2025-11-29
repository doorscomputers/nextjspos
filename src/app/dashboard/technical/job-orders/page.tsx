'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Wrench, Plus, DollarSign } from 'lucide-react'
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
  MasterDetail,
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

interface JobOrder {
  id: number
  jobNumber: string
  jobDate: string
  customerName: string | null
  productName: string
  serviceTypeName: string
  technicianName: string | null
  status: string
  paymentStatus: string
  laborCost: number
  partsCost: number
  totalCost: number
  paidAmount: number
  parts: any[]
  payments: any[]
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  diagnosed: { label: 'Diagnosed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  estimate_provided: { label: 'Estimate Provided', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  estimate_approved: { label: 'Approved', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  quality_checked: { label: 'QC Passed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  closed: { label: 'Closed', color: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Unpaid', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

export default function JobOrdersPage() {
  const { status } = useSession()
  const { can } = usePermissions()
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  const fetchJobOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/job-orders')
      const data = await response.json()
      if (response.ok) {
        setJobOrders(Array.isArray(data) ? data : data.jobOrders || [])
      } else {
        toast.error(data.error || 'Failed to fetch job orders')
      }
    } catch (error) {
      console.error('Error fetching job orders:', error)
      toast.error('Failed to fetch job orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Wait for session to be loaded
    if (status === 'loading') return

    // Only fetch once
    if (hasFetched) return

    // Session is loaded, now fetch data
    setHasFetched(true)
    fetchJobOrders()
  }, [status, hasFetched, fetchJobOrders])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchJobOrders()
    setRefreshing(false)
    toast.success('Job orders refreshed')
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Job Orders')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Job_Orders_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Job_Orders_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const status = data.value as string
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

    return (
      <div className="flex items-center justify-center">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    )
  }

  const paymentStatusCellRender = (data: any) => {
    const status = data.value as string
    const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending

    return (
      <div className="flex items-center justify-center">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
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

  const renderJobOrderDetails = (data: any) => {
    const jobOrder = data.data as JobOrder

    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cost Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Cost Breakdown</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Labor Cost:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    ₱{jobOrder.laborCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Parts Cost:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    ₱{jobOrder.partsCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Cost:</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ₱{jobOrder.totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600 dark:text-gray-400">Paid Amount:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ₱{jobOrder.paidAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    ₱{(jobOrder.totalCost - jobOrder.paidAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Payments ({jobOrder.payments?.length || 0})
            </h3>
            {jobOrder.payments && jobOrder.payments.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Method</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {jobOrder.payments.map((payment: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {payment.paymentMethod}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                          ₱{payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">No payments recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* Parts Used */}
        {jobOrder.parts && jobOrder.parts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Parts Used ({jobOrder.parts.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Part Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobOrder.parts.map((part: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{part.partName}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">{part.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                        ₱{part.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        ₱{(part.quantity * part.unitPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show loading while session is loading OR data is loading
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading job orders...</p>
        </div>
      </div>
    )
  }

  // Check permission only after session is loaded
  if (status === 'authenticated' && !can(PERMISSIONS.JOB_ORDER_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view job orders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
                Job Orders
              </h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Manage repair and service job orders
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {can(PERMISSIONS.JOB_ORDER_CREATE) && (
              <Button
                onClick={() => window.location.href = '/dashboard/technical/job-orders/create'}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Job Order
              </Button>
            )}
            <Button
              onClick={onExportingToPDF}
              disabled={jobOrders.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-slate-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={jobOrders}
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
              <Scrolling mode="virtual" />
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
                placeholder="Search job orders..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />
              <MasterDetail
                enabled={true}
                render={renderJobOrderDetails}
              />

              <Column
                dataField="jobNumber"
                caption="Job #"
                minWidth={130}
              />
              <Column
                dataField="jobDate"
                caption="Date"
                minWidth={120}
                dataType="date"
                format="dd/MM/yyyy"
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
                dataField="productName"
                caption="Product"
                minWidth={200}
              />
              <Column
                dataField="serviceTypeName"
                caption="Service Type"
                minWidth={180}
              />
              <Column
                dataField="technicianName"
                caption="Technician"
                minWidth={150}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || 'Unassigned'}
                  </span>
                )}
              />
              <Column
                dataField="status"
                caption="Status"
                minWidth={140}
                alignment="center"
                cellRender={statusCellRender}
              />
              <Column
                dataField="totalCost"
                caption="Total"
                minWidth={120}
                dataType="number"
                alignment="right"
                cellRender={currencyCellRender}
              />
              <Column
                dataField="paymentStatus"
                caption="Payment"
                minWidth={120}
                alignment="center"
                cellRender={paymentStatusCellRender}
              />

              <Summary>
                <TotalItem
                  column="totalCost"
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
