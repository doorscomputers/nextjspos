'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Receipt, Plus, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Item,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface Expense {
  id: number
  referenceNumber: string
  expenseDate: string
  amount: number
  paymentMethod: string
  payeeName: string
  description: string
  status: string
  categoryId: number
  locationId: number | null
  glAccountId: number | null
  category: {
    id: number
    name: string
  }
  location: {
    id: number
    name: string
  } | null
  glAccount: {
    id: number
    accountCode: string
    accountName: string
  } | null
  createdByUser: {
    id: number
    firstName: string
    lastName: string
    username: string
  }
  approvedByUser: {
    id: number
    firstName: string
    lastName: string
    username: string
  } | null
}

interface ExpenseCategory {
  id: number
  name: string
}

interface BusinessLocation {
  id: number
  name: string
}

interface GLAccount {
  id: number
  accountCode: string
  accountName: string
}

export default function ExpensesPage() {
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  // Custom Add/Edit Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    categoryId: '',
    locationId: '',
    expenseDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'cash',
    payeeName: '',
    description: '',
    glAccountId: ''
  })
  const [saving, setSaving] = useState(false)

  // Void dialog state
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    fetchExpenses()
    fetchCategories()
    fetchLocations()
    fetchGLAccounts()
  }, [])

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/expenses')
      const data = await response.json()
      if (response.ok) {
        setExpenses(Array.isArray(data) ? data : [])
      } else {
        toast.error('Failed to fetch expenses')
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to fetch expenses')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expenses/categories?activeOnly=true')
      const data = await response.json()
      if (response.ok) {
        setCategories(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations?activeOnly=true')
      const data = await response.json()
      if (response.ok) {
        setLocations(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchGLAccounts = async () => {
    try {
      const response = await fetch('/api/accounting/chart-of-accounts?accountType=expense')
      const data = await response.json()
      if (response.ok) {
        setGLAccounts(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching GL accounts:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchExpenses()
    setRefreshing(false)
    toast.success('Expenses refreshed')
  }

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        categoryId: expense.categoryId.toString(),
        locationId: expense.locationId?.toString() || '',
        expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
        amount: expense.amount.toString(),
        paymentMethod: expense.paymentMethod,
        payeeName: expense.payeeName,
        description: expense.description,
        glAccountId: expense.glAccountId?.toString() || ''
      })
    } else {
      setEditingExpense(null)
      setFormData({
        categoryId: '',
        locationId: '',
        expenseDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: 'cash',
        payeeName: '',
        description: '',
        glAccountId: ''
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingExpense(null)
    setFormData({
      categoryId: '',
      locationId: '',
      expenseDate: new Date().toISOString().split('T')[0],
      amount: '',
      paymentMethod: 'cash',
      payeeName: '',
      description: '',
      glAccountId: ''
    })
  }

  const handleSubmit = async () => {
    if (!formData.categoryId) {
      toast.error('Category is required')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    if (!formData.payeeName.trim()) {
      toast.error('Payee name is required')
      return
    }
    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }

    setSaving(true)
    try {
      const url = editingExpense
        ? `/api/expenses/${editingExpense.id}`
        : '/api/expenses'

      const method = editingExpense ? 'PUT' : 'POST'

      const body = {
        categoryId: parseInt(formData.categoryId),
        locationId: formData.locationId ? parseInt(formData.locationId) : null,
        expenseDate: formData.expenseDate,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        payeeName: formData.payeeName.trim(),
        description: formData.description.trim(),
        glAccountId: formData.glAccountId ? parseInt(formData.glAccountId) : null
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingExpense ? 'Expense updated successfully' : 'Expense created successfully')
        handleCloseDialog()
        fetchExpenses()
      } else {
        toast.error(data.error || 'Failed to save expense')
      }
    } catch (error) {
      console.error('Error saving expense:', error)
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (expense: Expense) => {
    if (!confirm(`Approve expense ${expense.referenceNumber}? This will post it to the accounting system.`)) {
      return
    }

    try {
      const response = await fetch(`/api/expenses/${expense.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Expense approved and posted successfully')
        fetchExpenses()
      } else {
        toast.error(data.error || 'Failed to approve expense')
      }
    } catch (error) {
      console.error('Error approving expense:', error)
      toast.error('Failed to approve expense')
    }
  }

  const handleOpenVoidDialog = (expense: Expense) => {
    setVoidingExpense(expense)
    setVoidReason('')
    setShowVoidDialog(true)
  }

  const handleCloseVoidDialog = () => {
    setShowVoidDialog(false)
    setVoidingExpense(null)
    setVoidReason('')
  }

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Void reason is required')
      return
    }

    if (!voidingExpense) return

    setVoiding(true)
    try {
      const response = await fetch(`/api/expenses/${voidingExpense.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: voidReason.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Expense voided successfully')
        handleCloseVoidDialog()
        fetchExpenses()
      } else {
        toast.error(data.error || 'Failed to void expense')
      }
    } catch (error) {
      console.error('Error voiding expense:', error)
      toast.error('Failed to void expense')
    } finally {
      setVoiding(false)
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Expenses')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Expenses_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const status = data.value
    let colorClasses = ''

    switch (status) {
      case 'draft':
        colorClasses = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        break
      case 'approved':
        colorClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        break
      case 'posted':
        colorClasses = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        break
      case 'void':
        colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        break
      default:
        colorClasses = 'bg-gray-100 text-gray-800'
    }

    return (
      <div className="flex items-center justify-center">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${colorClasses}`}>
          {status}
        </span>
      </div>
    )
  }

  const amountCellRender = (data: any) => {
    return (
      <div className="text-right font-semibold">
        {parseFloat(data.value).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </div>
    )
  }

  const dateCellRender = (data: any) => {
    return new Date(data.value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const locationCellRender = (data: any) => {
    return data.value || <span className="text-gray-400 italic">No Location</span>
  }

  const actionsCellRender = (data: any) => {
    const expense = data.data
    return (
      <div className="flex gap-2 justify-center flex-wrap">
        {expense.status === 'draft' && can(PERMISSIONS.EXPENSE_UPDATE) && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDialog(expense)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleApprove(expense)}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Approve
            </Button>
          </>
        )}
        {(expense.status === 'approved' || expense.status === 'posted') && can(PERMISSIONS.EXPENSE_DELETE) && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleOpenVoidDialog(expense)}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Void
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Expenses
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track and manage business expenses
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {can(PERMISSIONS.EXPENSE_CREATE) && (
              <Button
                onClick={() => handleOpenDialog()}
                className="gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 font-semibold text-base"
              >
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            <div className="mb-4 flex gap-2">
              <Button
                onClick={onExportingToPDF}
                variant="outline"
                size="sm"
              >
                Export to PDF
              </Button>
            </div>

            <DataGrid
              ref={dataGridRef}
              dataSource={expenses}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              columnAutoWidth={true}
              wordWrapEnabled={true}
              onExporting={onExporting}
            >
              <LoadPanel enabled={loading} />
              <SearchPanel visible={true} width={240} placeholder="Search expenses..." />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <Sorting mode="multiple" />
              <Scrolling mode="virtual" />
              <Paging enabled={true} defaultPageSize={20} />
              <Pager
                visible={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector={true}
                showNavigationButtons={true}
                showInfo={true}
              />
              <ColumnChooser enabled={true} mode="select" height={400}>
                <ColumnChooserSearch enabled={true} />
                <ColumnChooserSelection allowSelectAll={true} />
              </ColumnChooser>
              <Export enabled={true} allowExportSelectedData={false} />
              <Toolbar>
                <Item name="searchPanel" />
                <Item name="columnChooserButton" />
                <Item name="exportButton" />
              </Toolbar>

              <Column dataField="referenceNumber" caption="Reference #" width={150} />
              <Column
                dataField="expenseDate"
                caption="Date"
                width={120}
                dataType="date"
                cellRender={dateCellRender}
              />
              <Column dataField="category.name" caption="Category" width={150} />
              <Column dataField="location.name" caption="Location" width={150} cellRender={locationCellRender} />
              <Column
                dataField="amount"
                caption="Amount"
                width={120}
                dataType="number"
                cellRender={amountCellRender}
              />
              <Column dataField="payeeName" caption="Payee" width={150} />
              <Column dataField="paymentMethod" caption="Payment Method" width={130} />
              <Column
                dataField="status"
                caption="Status"
                width={100}
                cellRender={statusCellRender}
              />
              <Column
                caption="Actions"
                width={250}
                cellRender={actionsCellRender}
                allowFiltering={false}
                allowSorting={false}
                allowExporting={false}
              />
            </DataGrid>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        {showDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl my-8">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="categoryId">Category *</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => window.open('/dashboard/expenses/categories', '_blank')}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Category
                      </Button>
                    </div>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder={categories.length === 0 ? "No categories available" : "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No categories found. Click "Add Category" to create one.
                          </div>
                        ) : (
                          categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="locationId">Location (Optional)</Label>
                    <Select
                      value={formData.locationId || "none"}
                      onValueChange={(value) => setFormData({ ...formData, locationId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="Select location (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- No Location --</SelectItem>
                        {locations.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No locations found. Contact administrator to add locations.
                          </div>
                        ) : (
                          locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              {loc.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expenseDate">Date *</Label>
                    <Input
                      id="expenseDate"
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="bg-white border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="bg-white border-gray-300 text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payeeName">Payee Name *</Label>
                    <Input
                      id="payeeName"
                      value={formData.payeeName}
                      onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                      placeholder="Who was paid"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="glAccountId">GL Account (Optional)</Label>
                    <Select
                      value={formData.glAccountId || "none"}
                      onValueChange={(value) => setFormData({ ...formData, glAccountId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="Select GL account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Use Category Default --</SelectItem>
                        {glAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountCode} - {account.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter expense description"
                      rows={3}
                      className="bg-white border-gray-300 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <Button
                    onClick={handleCloseDialog}
                    variant="outline"
                    disabled={saving}
                    className="flex-1 h-11 font-semibold border-2 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {editingExpense ? 'Update Expense' : 'Create Expense'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Void Dialog */}
        {showVoidDialog && voidingExpense && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4 text-red-600">Void Expense</h2>

                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    You are about to void expense <strong>{voidingExpense.referenceNumber}</strong>.
                    This action will create a reversing journal entry.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="voidReason">Void Reason *</Label>
                    <Textarea
                      id="voidReason"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Enter reason for voiding this expense"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleVoid}
                    disabled={voiding}
                    variant="destructive"
                    className="flex-1"
                  >
                    {voiding ? 'Voiding...' : 'Void Expense'}
                  </Button>
                  <Button
                    onClick={handleCloseVoidDialog}
                    variant="outline"
                    disabled={voiding}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
