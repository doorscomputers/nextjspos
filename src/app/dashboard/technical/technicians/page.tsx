'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Users, UserPlus, Award, Clock, TrendingUp, Plus } from 'lucide-react'
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
  Editing,
  Popup,
  Form as DxForm,
  RequiredRule,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface Technician {
  id: number
  employeeCode: string
  firstName: string
  lastName: string
  email: string | null
  mobile: string | null
  position: string
  specialization: string
  certifications: string | null
  skillLevel: string
  hourlyRate: number
  isAvailable: boolean
  isActive: boolean
  jobsCompleted: number
  avgRepairTimeHours: number
  customerRating: number
  assignedJobOrders: any[]
  createdAt: string
}

export default function TechniciansPage() {
  const { can, user } = usePermissions()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalTechnicians: 0,
    availableTechnicians: 0,
    avgRating: 0,
    totalJobsCompleted: 0,
  })
  const dataGridRef = useRef<DataGrid>(null)

  useEffect(() => {
    // Wait for user session to be loaded before checking permissions
    if (!user) return

    if (!can(PERMISSIONS.TECHNICIAN_VIEW)) {
      toast.error('You do not have permission to view technicians')
      setLoading(false) // Stop loading when permission denied
      return
    }
    fetchTechnicians()
  }, [user])

  const fetchTechnicians = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/technicians')
      const data = await response.json()
      if (response.ok) {
        const techData = Array.isArray(data) ? data : data.technicians || []
        setTechnicians(techData)

        // Calculate stats
        const available = techData.filter((t: Technician) => t.isAvailable).length
        const totalJobs = techData.reduce((sum: number, t: Technician) => sum + (t.jobsCompleted || 0), 0)
        const avgRating = techData.length > 0
          ? techData.reduce((sum: number, t: Technician) => sum + (t.customerRating || 0), 0) / techData.length
          : 0

        setStats({
          totalTechnicians: techData.length,
          availableTechnicians: available,
          avgRating: avgRating,
          totalJobsCompleted: totalJobs,
        })
      } else {
        toast.error(data.error || 'Failed to fetch technicians')
      }
    } catch (error) {
      console.error('Error fetching technicians:', error)
      toast.error('Failed to fetch technicians')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTechnicians()
    setRefreshing(false)
    toast.success('Technicians list refreshed')
  }

  const handleToggleAvailability = async (technicianId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/technicians/${technicianId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Technician marked as ${!currentStatus ? 'available' : 'unavailable'}`)
        fetchTechnicians()
      } else {
        toast.error(data.error || 'Failed to update availability')
      }
    } catch (error) {
      console.error('Error updating availability:', error)
      toast.error('Failed to update availability')
    }
  }

  const onRowInserted = async (e: any) => {
    try {
      const response = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: e.data.employeeCode,
          firstName: e.data.firstName,
          lastName: e.data.lastName,
          email: e.data.email,
          mobile: e.data.mobile,
          position: e.data.position,
          specialization: e.data.specialization,
          primarySpecialization: e.data.specialization || 'General',
          isActive: e.data.isActive !== undefined ? e.data.isActive : true,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Technician created successfully')
        fetchTechnicians()
      } else {
        toast.error(data.error || 'Failed to create technician')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error creating technician:', error)
      toast.error('Failed to create technician')
      e.cancel = true
    }
  }

  const onRowUpdated = async (e: any) => {
    try {
      const response = await fetch(`/api/technicians/${e.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: e.data.employeeCode,
          firstName: e.data.firstName,
          lastName: e.data.lastName,
          email: e.data.email,
          mobile: e.data.mobile,
          position: e.data.position,
          specialization: e.data.specialization,
          primarySpecialization: e.data.specialization,
          isActive: e.data.isActive,
          isAvailable: e.data.isAvailable,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Technician updated successfully')
        fetchTechnicians()
      } else {
        toast.error(data.error || 'Failed to update technician')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error updating technician:', error)
      toast.error('Failed to update technician')
      e.cancel = true
    }
  }

  const onRowRemoved = async (e: any) => {
    try {
      const response = await fetch(`/api/technicians/${e.key}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Technician deleted successfully')
      } else {
        toast.error(data.error || 'Failed to delete technician')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error deleting technician:', error)
      toast.error('Failed to delete technician')
      e.cancel = true
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Technicians')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Technicians_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Technicians_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const availabilityCellRender = (data: any) => {
    const isAvailable = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isAvailable
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {isAvailable ? 'Available' : 'Busy'}
        </span>
      </div>
    )
  }

  const statusCellRender = (data: any) => {
    const isActive = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    )
  }

  const ratingCellRender = (data: any) => {
    const rating = data.value || 0
    return (
      <div className="flex items-center justify-center gap-1">
        <Award className="w-4 h-4 text-yellow-500" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {rating.toFixed(1)}
        </span>
      </div>
    )
  }

  const actionsCellRender = (data: any) => {
    const technician = data.data as Technician
    return (
      <div className="flex items-center justify-center gap-2">
        {can(PERMISSIONS.TECHNICIAN_EDIT) && (
          <button
            onClick={() => handleToggleAvailability(technician.id, technician.isAvailable)}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              technician.isAvailable
                ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800 dark:hover:bg-red-900/50'
                : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800 dark:hover:bg-emerald-900/50'
            }`}
          >
            {technician.isAvailable ? 'Mark Busy' : 'Mark Available'}
          </button>
        )}
      </div>
    )
  }

  const renderAssignedJobsDetail = (data: any) => {
    const jobs = data.data.assignedJobOrders || []

    if (jobs.length === 0) {
      return (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No assigned job orders
        </div>
      )
    }

    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-950/50">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Assigned Job Orders ({jobs.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-amber-200 dark:divide-amber-700">
            <thead className="bg-amber-100 dark:bg-amber-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Job #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-amber-900/30 divide-y divide-amber-200 dark:divide-amber-700">
              {jobs.map((job: any, index: number) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {job.jobNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {job.customerName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {job.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {job.serviceTypeName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : job.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
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
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin dark:border-amber-900 dark:border-t-amber-400"></div>
          <p className="mt-4 text-amber-700 font-medium dark:text-amber-300">Loading technicians...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.TECHNICIAN_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view technicians.</p>
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
              <Users className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 bg-clip-text text-transparent dark:from-amber-100 dark:via-orange-300 dark:to-amber-100">
                Technicians
              </h1>
            </div>
            <p className="text-amber-700 text-sm sm:text-base dark:text-amber-300">
              Manage technical service employees
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => dataGridRef.current?.instance.addRow()}
              variant="default"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Technician
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
              disabled={technicians.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>

        {/* Performance Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                  <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Technicians</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalTechnicians}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                  <UserPlus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Available</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.availableTechnicians}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Rating</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.avgRating.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Jobs Completed</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalJobsCompleted}</p>
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
              dataSource={technicians}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExporting}
              onRowInserted={onRowInserted}
              onRowUpdated={onRowUpdated}
              onRowRemoved={onRowRemoved}
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
                placeholder="Search technicians..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />
              <MasterDetail
                enabled={true}
                render={renderAssignedJobsDetail}
              />

              <Editing
                mode="popup"
                allowAdding={true}
                allowUpdating={true}
                allowDeleting={true}
                useIcons={true}
              >
                <Popup
                  title="Technician Details"
                  showTitle={true}
                  width={700}
                  height="auto"
                />
                <DxForm>
                  <Item dataField="employeeCode" />
                  <Item dataField="firstName" />
                  <Item dataField="lastName" />
                  <Item dataField="email" />
                  <Item dataField="mobile" />
                  <Item dataField="position" />
                  <Item dataField="specialization" />
                  <Item dataField="isActive" />
                  <Item dataField="isAvailable" />
                </DxForm>
              </Editing>

              <Column
                dataField="employeeCode"
                caption="Employee Code"
                minWidth={130}
              >
                <RequiredRule message="Employee code is required" />
              </Column>
              <Column
                dataField="firstName"
                caption="First Name"
                minWidth={150}
              >
                <RequiredRule message="First name is required" />
              </Column>
              <Column
                dataField="lastName"
                caption="Last Name"
                minWidth={150}
              >
                <RequiredRule message="Last name is required" />
              </Column>
              <Column
                dataField="position"
                caption="Position"
                minWidth={150}
              >
                <RequiredRule message="Position is required" />
              </Column>
              <Column
                dataField="specialization"
                caption="Specialization"
                minWidth={180}
              >
                <RequiredRule message="Specialization is required" />
              </Column>
              <Column
                dataField="skillLevel"
                caption="Skill Level"
                minWidth={120}
              />
              <Column
                dataField="jobsCompleted"
                caption="Jobs Completed"
                minWidth={130}
                dataType="number"
                alignment="center"
              />
              <Column
                dataField="avgRepairTimeHours"
                caption="Avg Repair Time (hrs)"
                minWidth={150}
                dataType="number"
                alignment="center"
                format={{ type: 'fixedPoint', precision: 1 }}
              />
              <Column
                dataField="customerRating"
                caption="Rating"
                minWidth={100}
                dataType="number"
                alignment="center"
                cellRender={ratingCellRender}
              />
              <Column
                dataField="isAvailable"
                caption="Availability"
                width={130}
                alignment="center"
                cellRender={availabilityCellRender}
              />
              <Column
                dataField="isActive"
                caption="Status"
                width={100}
                alignment="center"
                cellRender={statusCellRender}
              />
              <Column
                caption="Actions"
                width={150}
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
