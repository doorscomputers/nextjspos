'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, FolderTree, Plus } from 'lucide-react'
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
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  Scrolling,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface ExpenseCategory {
  id: number
  name: string
  description: string | null
  glAccountId: number | null
  glAccount: {
    id: number
    accountCode: string
    accountName: string
  } | null
  isActive: boolean
  _count?: {
    expenses: number
  }
  createdAt: string
}

interface GLAccount {
  id: number
  accountCode: string
  accountName: string
}

export default function ExpenseCategoriesPage() {
  const { can } = usePermissions()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  // Custom Add/Edit Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    glAccountId: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCategories()
    fetchGLAccounts()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/expenses/categories')
      const data = await response.json()
      if (response.ok) {
        setCategories(Array.isArray(data) ? data : [])
      } else {
        toast.error('Failed to fetch expense categories')
      }
    } catch (error) {
      console.error('Error fetching expense categories:', error)
      toast.error('Failed to fetch expense categories')
    } finally {
      setLoading(false)
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
    await fetchCategories()
    setRefreshing(false)
    toast.success('Categories refreshed')
  }

  const handleOpenDialog = (category?: ExpenseCategory) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        description: category.description || '',
        glAccountId: category.glAccountId?.toString() || ''
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: '',
        description: '',
        glAccountId: ''
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingCategory(null)
    setFormData({
      name: '',
      description: '',
      glAccountId: ''
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingCategory
        ? `/api/expenses/categories/${editingCategory.id}`
        : '/api/expenses/categories'

      const method = editingCategory ? 'PUT' : 'POST'

      const body = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        glAccountId: formData.glAccountId ? parseInt(formData.glAccountId) : null
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully')
        handleCloseDialog()
        fetchCategories()
      } else {
        toast.error(data.error || 'Failed to save category')
      }
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (category: ExpenseCategory) => {
    try {
      const response = await fetch(`/api/expenses/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive })
      })

      if (response.ok) {
        toast.success(`Category ${!category.isActive ? 'activated' : 'deactivated'} successfully`)
        fetchCategories()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update category status')
      }
    } catch (error) {
      console.error('Error updating category status:', error)
      toast.error('Failed to update category status')
    }
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Expense Categories')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Expense_Categories_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Expense_Categories_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const isActive = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    )
  }

  const glAccountCellRender = (data: any) => {
    const glAccount = data.data.glAccount
    if (!glAccount) {
      return <span className="text-gray-400 italic">Not set</span>
    }
    return (
      <div>
        <div className="font-semibold">{glAccount.accountCode}</div>
        <div className="text-sm text-gray-500">{glAccount.accountName}</div>
      </div>
    )
  }

  const actionsCellRender = (data: any) => {
    const category = data.data
    return (
      <div className="flex gap-2 justify-center">
        {can(PERMISSIONS.EXPENSE_UPDATE) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenDialog(category)}
          >
            Edit
          </Button>
        )}
        {can(PERMISSIONS.EXPENSE_UPDATE) && (
          <Button
            size="sm"
            variant={category.isActive ? 'destructive' : 'default'}
            onClick={() => handleToggleStatus(category)}
          >
            {category.isActive ? 'Deactivate' : 'Activate'}
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
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <FolderTree className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Expense Categories
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage expense categories and GL account mappings
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
                className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Add Category
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
              dataSource={categories}
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
              <SearchPanel visible={true} width={240} placeholder="Search categories..." />
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
              <Export enabled={true} allowExportSelectedData={false} />

              <Column dataField="name" caption="Category Name" width={200} />
              <Column dataField="description" caption="Description" width={250} />
              <Column
                dataField="glAccount"
                caption="GL Account"
                width={200}
                cellRender={glAccountCellRender}
                allowFiltering={false}
                allowSorting={false}
              />
              <Column
                dataField="_count.expenses"
                caption="Expenses"
                width={100}
                alignment="center"
                dataType="number"
              />
              <Column
                dataField="isActive"
                caption="Status"
                width={120}
                cellRender={statusCellRender}
                alignment="center"
              />
              <Column
                caption="Actions"
                width={200}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Category Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter category name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter description (optional)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="glAccountId">GL Account (Expense)</Label>
                    <Select
                      value={formData.glAccountId}
                      onValueChange={(value) => setFormData({ ...formData, glAccountId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select GL account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- None --</SelectItem>
                        {glAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountCode} - {account.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </Button>
                  <Button
                    onClick={handleCloseDialog}
                    variant="outline"
                    disabled={saving}
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
