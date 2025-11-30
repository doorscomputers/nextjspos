'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Users, UserPlus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  Scrolling,
  Toolbar,
  Item as ToolbarItem,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface SalesPersonnel {
  id: number
  employeeCode: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  mobile: string | null
  salesTarget: number
  commissionRate: number
  totalSalesCount: number
  totalRevenue: number
  isActive: boolean
  hireDate: string | null
  terminationDate: string | null
  createdAt: string
}

export default function SalesPersonnelPage() {
  const { can } = usePermissions()
  const [personnel, setPersonnel] = useState<SalesPersonnel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  // Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingPerson, setEditingPerson] = useState<SalesPersonnel | null>(null)
  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    salesTarget: '',
    commissionRate: '',
    hireDate: '',
    isActive: true
  })
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingPerson, setDeletingPerson] = useState<SalesPersonnel | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sales-personnel')
      const data = await response.json()
      if (response.ok) {
        setPersonnel(data.salesPersonnel || [])
      } else {
        toast.error(data.error || 'Failed to fetch sales personnel')
      }
    } catch (error) {
      console.error('Error fetching sales personnel:', error)
      toast.error('Failed to fetch sales personnel')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPersonnel()
    setRefreshing(false)
    toast.success('Sales personnel list refreshed')
  }

  const generateEmployeeCode = async () => {
    // Generate a unique code based on existing codes
    const existingCodes = personnel.map(p => p.employeeCode)
    let counter = 1
    let newCode = `SP-${String(counter).padStart(3, '0')}`

    while (existingCodes.includes(newCode)) {
      counter++
      newCode = `SP-${String(counter).padStart(3, '0')}`
    }

    return newCode
  }

  const handleOpenDialog = async (person?: SalesPersonnel) => {
    if (person) {
      setEditingPerson(person)
      setFormData({
        employeeCode: person.employeeCode,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email || '',
        mobile: person.mobile || '',
        salesTarget: person.salesTarget ? person.salesTarget.toString() : '',
        commissionRate: person.commissionRate ? person.commissionRate.toString() : '',
        hireDate: person.hireDate ? new Date(person.hireDate).toISOString().split('T')[0] : '',
        isActive: person.isActive
      })
    } else {
      setEditingPerson(null)
      const newCode = await generateEmployeeCode()
      setFormData({
        employeeCode: newCode,
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
        salesTarget: '',
        commissionRate: '',
        hireDate: '',
        isActive: true
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingPerson(null)
    setFormData({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      mobile: '',
      salesTarget: '',
      commissionRate: '',
      hireDate: '',
      isActive: true
    })
  }

  const handleSubmit = async () => {
    if (!formData.employeeCode.trim()) {
      toast.error('Employee code is required')
      return
    }
    if (!formData.firstName.trim()) {
      toast.error('First name is required')
      return
    }
    if (!formData.lastName.trim()) {
      toast.error('Last name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingPerson
        ? `/api/sales-personnel/${editingPerson.id}`
        : '/api/sales-personnel'

      const method = editingPerson ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingPerson ? 'Sales personnel updated successfully' : 'Sales personnel created successfully')
        handleCloseDialog()
        fetchPersonnel()
      } else {
        toast.error(data.error || 'Failed to save sales personnel')
      }
    } catch (error) {
      console.error('Error saving sales personnel:', error)
      toast.error('Failed to save sales personnel')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (person: SalesPersonnel) => {
    setDeletingPerson(person)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPerson) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/sales-personnel/${deletingPerson.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Sales personnel deleted successfully')
        setShowDeleteConfirm(false)
        setDeletingPerson(null)
        fetchPersonnel()
      } else {
        toast.error(data.error || 'Failed to delete sales personnel')
      }
    } catch (error) {
      console.error('Error deleting sales personnel:', error)
      toast.error('Failed to delete sales personnel')
    } finally {
      setDeleting(false)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Personnel')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.column?.dataField === 'salesTarget' || gridCell.column?.dataField === 'totalRevenue') {
          if (gridCell.rowType === 'data') {
            excelCell.numFmt = '₱#,##0.00'
          }
        }
        if (gridCell.column?.dataField === 'commissionRate') {
          if (gridCell.rowType === 'data') {
            excelCell.numFmt = '0.00%'
          }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Sales_Personnel_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Sales_Personnel_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const isActive = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    )
  }

  const currencyCellRender = (data: any) => {
    const value = data.value
    return (
      <span className="text-gray-900 dark:text-gray-100 font-medium">
        ₱{value ? parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
      </span>
    )
  }

  const percentageCellRender = (data: any) => {
    const value = data.value
    return (
      <span className="text-gray-900 dark:text-gray-100">
        {value ? `${parseFloat(value).toFixed(2)}%` : '0%'}
      </span>
    )
  }

  const actionsCellRender = (data: any) => {
    const person = data.data as SalesPersonnel
    return (
      <div className="flex items-center justify-center gap-2">
        {can(PERMISSIONS.SALES_PERSONNEL_UPDATE) && (
          <button
            onClick={() => handleOpenDialog(person)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50"
          >
            Edit
          </button>
        )}
        {can(PERMISSIONS.SALES_PERSONNEL_DELETE) && (
          <button
            onClick={() => handleDeleteClick(person)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors dark:text-red-400 dark:bg-red-900/30 dark:border-red-800 dark:hover:bg-red-900/50"
          >
            Delete
          </button>
        )}
      </div>
    )
  }

  if (!can(PERMISSIONS.SALES_PERSONNEL_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">You do not have permission to view sales personnel.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading sales personnel...</p>
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
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
                Sales Personnel
              </h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Manage your sales team and track performance metrics
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
            {can(PERMISSIONS.SALES_PERSONNEL_CREATE) && (
              <Button
                onClick={() => handleOpenDialog()}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add Sales Personnel
              </Button>
            )}
            <Button
              onClick={onExportingToPDF}
              disabled={personnel.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Total Personnel</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{personnel.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Active</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {personnel.filter(p => p.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Total Sales</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {personnel.reduce((sum, p) => sum + p.totalSalesCount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Total Revenue</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ₱{personnel.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-slate-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={personnel}
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
                placeholder="Search by name, code, email..."
              />
              <ColumnChooser enabled={true} mode="select" height={400}>
                <ColumnChooserSearch enabled={true} />
                <ColumnChooserSelection allowSelectAll={true} />
              </ColumnChooser>
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <Toolbar>
                <ToolbarItem name="searchPanel" />
                <ToolbarItem name="columnChooserButton" />
                <ToolbarItem name="exportButton" />
              </Toolbar>

              <Column
                dataField="employeeCode"
                caption="Code"
                width={100}
              />
              <Column
                dataField="fullName"
                caption="Name"
                minWidth={180}
              />
              <Column
                dataField="email"
                caption="Email"
                minWidth={180}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="mobile"
                caption="Mobile"
                width={130}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="salesTarget"
                caption="Sales Target"
                width={130}
                alignment="right"
                cellRender={currencyCellRender}
              />
              <Column
                dataField="commissionRate"
                caption="Commission"
                width={110}
                alignment="right"
                cellRender={percentageCellRender}
              />
              <Column
                dataField="totalSalesCount"
                caption="Total Sales"
                width={110}
                alignment="right"
                cellRender={(data) => (
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {data.value ? data.value.toLocaleString() : '0'}
                  </span>
                )}
              />
              <Column
                dataField="totalRevenue"
                caption="Total Revenue"
                width={140}
                alignment="right"
                cellRender={currencyCellRender}
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

              <Summary>
                <TotalItem column="totalSalesCount" summaryType="sum" displayFormat="Total: {0}" />
                <TotalItem column="totalRevenue" summaryType="sum" valueFormat="₱#,##0.00" displayFormat="Total: {0}" />
              </Summary>
            </DataGrid>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-slate-200 dark:border-gray-700">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingPerson ? 'Edit Sales Personnel' : 'Add New Sales Personnel'}
              </h2>
              <button
                onClick={handleCloseDialog}
                disabled={saving}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Dialog Body */}
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">Employee Code *</Label>
                  <Input
                    placeholder="e.g., SP-001"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    disabled={saving}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                      disabled={saving}
                    />
                    <Label className="text-gray-900 dark:text-gray-100">
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </Label>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">First Name *</Label>
                  <Input
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={saving}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">Last Name *</Label>
                  <Input
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={saving}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Mobile</Label>
                <Input
                  placeholder="+63 9XX XXX XXXX"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">Sales Target (₱)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.salesTarget}
                    onChange={(e) => setFormData({ ...formData, salesTarget: e.target.value })}
                    disabled={saving}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">Commission Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    disabled={saving}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Hire Date</Label>
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">
              <Button
                onClick={handleCloseDialog}
                disabled={saving}
                variant="outline"
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingPerson ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-slate-200 dark:border-gray-700">
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
                <Trash2 className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Delete Sales Personnel</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Are you sure you want to delete <strong>{deletingPerson.fullName}</strong>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This action cannot be undone. If they have linked sales, consider deactivating instead.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingPerson(null)
                }}
                disabled={deleting}
                variant="outline"
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
