'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Users, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Editing,
  Popup,
  Form,
  RequiredRule,
  EmailRule,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface Customer {
  id: number
  name: string
  email: string | null
  mobile: string | null
  address: string | null
  creditLimit: number | null
  isActive: boolean
  createdAt: string
}

export default function CustomersPage() {
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  // Custom Add/Edit Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    address: '',
    creditLimit: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/customers')
      const data = await response.json()
      if (response.ok) {
        setCustomers(Array.isArray(data) ? data : data.customers || [])
      } else {
        toast.error('Failed to fetch customers')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCustomers()
    setRefreshing(false)
    toast.success('Customer list refreshed')
  }

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        name: customer.name,
        email: customer.email || '',
        mobile: customer.mobile || '',
        address: customer.address || '',
        creditLimit: customer.creditLimit ? customer.creditLimit.toString() : ''
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        name: '',
        email: '',
        mobile: '',
        address: '',
        creditLimit: ''
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingCustomer(null)
    setFormData({
      name: '',
      email: '',
      mobile: '',
      address: '',
      creditLimit: ''
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers'

      const method = editingCustomer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully')
        handleCloseDialog()
        fetchCustomers()
      } else {
        toast.error(data.error || 'Failed to save customer')
      }
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Customers')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Customers_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Customers_${new Date().toISOString().split('T')[0]}.pdf`)
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

  const actionsCellRender = (data: any) => {
    const customer = data.data as Customer
    return (
      <div className="flex items-center justify-center gap-2">
        {can(PERMISSIONS.CUSTOMER_UPDATE) && (
          <button
            onClick={() => handleOpenDialog(customer)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50"
          >
            Edit
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading customers...</p>
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
                Customers
              </h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Manage your customer database with DevExtreme
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
            {can(PERMISSIONS.CUSTOMER_CREATE) && (
              <Button
                onClick={() => handleOpenDialog()}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add Customer
              </Button>
            )}
            <Button
              onClick={onExportingToPDF}
              disabled={customers.length === 0}
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
              dataSource={customers}
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
                placeholder="Search by name, email, or mobile..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />

              <Column
                dataField="name"
                caption="Customer Name"
                minWidth={200}
              />
              <Column
                dataField="email"
                caption="Email"
                minWidth={200}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="mobile"
                caption="Mobile"
                minWidth={150}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="address"
                caption="Address"
                minWidth={250}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />

              {/* Credit Limit Column - Only visible with permission */}
              {can(PERMISSIONS.CUSTOMER_CREDIT_LIMIT_VIEW) && (
                <Column
                  dataField="creditLimit"
                  caption="Credit Limit"
                  minWidth={150}
                  alignment="right"
                  cellRender={(data) => (
                    <span className={data.value ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}>
                      {data.value ? `₱${parseFloat(data.value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Unlimited'}
                    </span>
                  )}
                />
              )}

              <Column
                dataField="isActive"
                caption="Status"
                width={120}
                alignment="center"
                cellRender={statusCellRender}
              />
              <Column
                caption="Actions"
                width={120}
                alignment="center"
                cellRender={actionsCellRender}
                allowExporting={false}
              />
            </DataGrid>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Customer Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-slate-200 dark:border-gray-700">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
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
            <div className="px-6 py-4 space-y-4">
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Customer Name *</Label>
                <Input
                  placeholder="Enter customer name..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Email (Optional)</Label>
                <Input
                  type="email"
                  placeholder="Enter email..."
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Mobile (Optional)</Label>
                <Input
                  placeholder="Enter mobile number..."
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Address (Optional)</Label>
                <Textarea
                  placeholder="Enter address..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  disabled={saving}
                  className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Credit Limit Field - Only visible with proper permissions */}
              {can(PERMISSIONS.CUSTOMER_CREDIT_LIMIT_VIEW) && (
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">
                    Credit Limit (Optional)
                    {!can(PERMISSIONS.CUSTOMER_CREDIT_LIMIT_EDIT) && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(View Only)</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter maximum credit limit (e.g., 50000.00)"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    disabled={saving || !can(PERMISSIONS.CUSTOMER_CREDIT_LIMIT_EDIT)}
                    className="mt-1.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum outstanding AR balance allowed. Leave empty for unlimited credit.
                  </p>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={saving}
                className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>{editingCustomer ? 'Update Customer' : 'Create Customer'}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
