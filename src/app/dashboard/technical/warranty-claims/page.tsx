'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, FileText, Plus, CheckCircle, XCircle, Search, UserCheck, ClipboardCheck } from 'lucide-react'
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
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface WarrantyClaim {
  id: number
  claimNumber: string
  claimDate: string
  customerName: string | null
  productName: string
  serialNumber: string | null
  status: string
  isUnderWarranty: boolean
  issueDescription: string
  technicianName: string | null
  estimatedCost: number | null
  actualCost: number | null
  jobOrders: any[]
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: FileText },
  accepted: { label: 'Accepted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  inspected: { label: 'Inspected', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Search },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: ClipboardCheck },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  job_created: { label: 'Job Created', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: UserCheck },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
}

export default function WarrantyClaimsPage() {
  const { can, user } = usePermissions()
  const [claims, setClaims] = useState<WarrantyClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
  })
  const dataGridRef = useRef<DataGrid>(null)

  useEffect(() => {
    // Wait for user session to be loaded before checking permissions
    if (!user) return

    if (!can(PERMISSIONS.WARRANTY_CLAIM_VIEW)) {
      toast.error('You do not have permission to view warranty claims')
      setLoading(false) // Stop loading when permission denied
      return
    }
    fetchClaims()
  }, [user])

  const fetchClaims = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/warranty-claims')
      const data = await response.json()
      if (response.ok) {
        const claimsData = Array.isArray(data) ? data : data.claims || []
        setClaims(claimsData)

        // Calculate stats
        const pending = claimsData.filter((c: WarrantyClaim) => c.status === 'pending').length
        const approved = claimsData.filter((c: WarrantyClaim) => c.status === 'approved').length
        const rejected = claimsData.filter((c: WarrantyClaim) => c.status === 'rejected').length

        setStats({
          totalClaims: claimsData.length,
          pendingClaims: pending,
          approvedClaims: approved,
          rejectedClaims: rejected,
        })
      } else {
        toast.error(data.error || 'Failed to fetch warranty claims')
      }
    } catch (error) {
      console.error('Error fetching warranty claims:', error)
      toast.error('Failed to fetch warranty claims')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchClaims()
    setRefreshing(false)
    toast.success('Warranty claims refreshed')
  }

  const handleStatusChange = async (claimId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/warranty-claims/${claimId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Claim ${newStatus} successfully`)
        fetchClaims()
      } else {
        toast.error(data.error || `Failed to ${newStatus} claim`)
      }
    } catch (error) {
      console.error(`Error changing claim status:`, error)
      toast.error(`Failed to ${newStatus} claim`)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Warranty Claims')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Warranty_Claims_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Warranty_Claims_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const status = data.value as string
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    const Icon = config.icon

    return (
      <div className="flex items-center justify-center gap-2">
        <Icon className="w-4 h-4" />
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    )
  }

  const warrantyCellRender = (data: any) => {
    const isUnderWarranty = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isUnderWarranty
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {isUnderWarranty ? 'Valid' : 'Expired'}
        </span>
      </div>
    )
  }

  const actionsCellRender = (data: any) => {
    const claim = data.data as WarrantyClaim

    return (
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {claim.status === 'pending' && can(PERMISSIONS.WARRANTY_CLAIM_ACCEPT) && (
          <button
            onClick={() => handleStatusChange(claim.id, 'accepted')}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50"
          >
            Accept
          </button>
        )}
        {claim.status === 'accepted' && can(PERMISSIONS.WARRANTY_CLAIM_INSPECT) && (
          <button
            onClick={() => handleStatusChange(claim.id, 'inspected')}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors dark:text-purple-400 dark:bg-purple-900/30 dark:border-purple-800 dark:hover:bg-purple-900/50"
          >
            Inspect
          </button>
        )}
        {claim.status === 'inspected' && can(PERMISSIONS.WARRANTY_CLAIM_APPROVE) && (
          <>
            <button
              onClick={() => handleStatusChange(claim.id, 'approved')}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800 dark:hover:bg-emerald-900/50"
            >
              Approve
            </button>
            <button
              onClick={() => handleStatusChange(claim.id, 'rejected')}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors dark:text-red-400 dark:bg-red-900/30 dark:border-red-800 dark:hover:bg-red-900/50"
            >
              Reject
            </button>
          </>
        )}
        {claim.status === 'approved' && can(PERMISSIONS.JOB_ORDER_CREATE) && (
          <button
            onClick={() => window.location.href = `/dashboard/technical/job-orders/create?claimId=${claim.id}`}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800 dark:hover:bg-indigo-900/50"
          >
            Create Job
          </button>
        )}
      </div>
    )
  }

  const renderClaimDetails = (data: any) => {
    const claim = data.data as WarrantyClaim

    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Issue Description */}
          <div className="col-span-2">
            <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Issue Description</h3>
            <p className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              {claim.issueDescription || 'No description provided'}
            </p>
          </div>

          {/* Cost Information */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Cost Information</h3>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Estimated Cost:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {claim.estimatedCost ? `₱${claim.estimatedCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Actual Cost:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {claim.actualCost ? `₱${claim.actualCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Technician Assignment */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Technician</h3>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-900 dark:text-gray-100">
                {claim.technicianName || 'Not assigned yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Job Orders */}
        {claim.jobOrders && claim.jobOrders.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
              Related Job Orders ({claim.jobOrders.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Job #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Service Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {claim.jobOrders.map((job: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {job.jobNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {job.serviceTypeName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {job.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        ₱{job.totalCost?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading warranty claims...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.WARRANTY_CLAIM_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view warranty claims.</p>
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
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
                Warranty Claims
              </h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Manage warranty claims with workflow tracking
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
            {can(PERMISSIONS.WARRANTY_CLAIM_CREATE) && (
              <Button
                onClick={() => window.location.href = '/dashboard/technical/warranty-claims/create'}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Claim
              </Button>
            )}
            <Button
              onClick={onExportingToPDF}
              disabled={claims.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Claims</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <FileText className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.pendingClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.approvedClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900/30">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.rejectedClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-slate-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={claims}
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
                placeholder="Search claims..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />
              <MasterDetail
                enabled={true}
                render={renderClaimDetails}
              />

              <Column
                dataField="claimNumber"
                caption="Claim #"
                minWidth={130}
              />
              <Column
                dataField="claimDate"
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
                dataField="serialNumber"
                caption="Serial #"
                minWidth={150}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="isUnderWarranty"
                caption="Warranty Status"
                minWidth={140}
                alignment="center"
                cellRender={warrantyCellRender}
              />
              <Column
                dataField="status"
                caption="Status"
                minWidth={150}
                alignment="center"
                cellRender={statusCellRender}
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
                caption="Actions"
                minWidth={180}
                alignment="center"
                cellRender={actionsCellRender}
                allowExporting={false}
              />
            </DataGrid>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
