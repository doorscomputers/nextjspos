'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Package, Plus, Trash2, Edit2, FolderPlus, Search, X, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import 'devextreme/dist/css/dx.light.css'

interface PackageCategory {
  id: number
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  _count?: { packages: number }
}

interface PackageTemplateItem {
  id: number
  productId: number
  productVariationId: number
  quantity: number
  originalPrice: number
  customPrice: number
  product: {
    id: number
    name: string
    sku: string
    imageUrl?: string
  }
}

interface PackageTemplate {
  id: number
  name: string
  description: string | null
  sku: string | null
  categoryId: number | null
  targetPrice: number
  isActive: boolean
  createdBy: number
  createdAt: string
  category: { id: number; name: string } | null
  creator: { id: number; firstName: string; lastName: string; username: string }
  items: PackageTemplateItem[]
  _count?: { items: number }
}

interface ProductVariation {
  id: number
  productId: number
  name: string
  subSku: string
  defaultPurchasePrice: number
  defaultSellingPrice: number
  product: {
    id: number
    name: string
    sku: string
  }
}

export default function PackageTemplatesPage() {
  const { can } = usePermissions()
  const [categories, setCategories] = useState<PackageCategory[]>([])
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const dataGridRef = useRef<DataGrid>(null)

  // Category Dialog state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PackageCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryFromTemplate, setCategoryFromTemplate] = useState(false) // Track if opened from template dialog

  // Template Dialog state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PackageTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    sku: '',
    categoryId: '',
    isActive: true
  })
  const [templateItems, setTemplateItems] = useState<Array<{
    productId: number
    productVariationId: number
    quantity: number
    cost: number
    markupPercent: number
    customPrice: number
    productName: string
    productSku: string
  }>>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductVariation[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingItem, setDeletingItem] = useState<{ type: 'category' | 'template'; item: PackageCategory | PackageTemplate } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [catRes, templatesRes] = await Promise.all([
        fetch('/api/package-categories'),
        fetch('/api/package-templates')
      ])

      const catData = await catRes.json()
      const templatesData = await templatesRes.json()

      if (catRes.ok) {
        setCategories(catData.categories || [])
      }
      if (templatesRes.ok) {
        setTemplates(templatesData.templates || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch package templates')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  // Category handlers
  const openCategoryDialog = (category?: PackageCategory, fromTemplate: boolean = false) => {
    setCategoryFromTemplate(fromTemplate)
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, description: category.description || '' })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
    }
    setShowCategoryDialog(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required')
      return
    }

    setSavingCategory(true)
    try {
      const url = editingCategory
        ? `/api/package-categories/${editingCategory.id}`
        : '/api/package-categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      })

      const data = await response.json()
      if (response.ok) {
        toast.success(editingCategory ? 'Category updated' : 'Category created')
        setShowCategoryDialog(false)

        // If created from template dialog, auto-select the new category
        if (!editingCategory && categoryFromTemplate && data.category) {
          setTemplateForm(prev => ({ ...prev, categoryId: data.category.id.toString() }))
        }

        // Refresh categories list
        const catRes = await fetch('/api/package-categories')
        const catData = await catRes.json()
        if (catRes.ok) {
          setCategories(catData.categories || [])
        }

        setCategoryFromTemplate(false)
      } else {
        toast.error(data.error || 'Failed to save category')
      }
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Failed to save category')
    } finally {
      setSavingCategory(false)
    }
  }

  // Template handlers
  const openTemplateDialog = (template?: PackageTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        name: template.name,
        description: template.description || '',
        sku: template.sku || '',
        categoryId: template.categoryId?.toString() || '',
        isActive: template.isActive
      })
      setTemplateItems(template.items.map(item => {
        const cost = Number(item.originalPrice) // originalPrice stores cost
        const customPrice = Number(item.customPrice)
        const markupPercent = cost > 0 ? Math.round(((customPrice - cost) / cost) * 100) : 0
        return {
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantity: Number(item.quantity),
          cost,
          markupPercent,
          customPrice,
          productName: item.product.name,
          productSku: item.product.sku
        }
      }))
    } else {
      setEditingTemplate(null)
      setTemplateForm({
        name: '',
        description: '',
        sku: '',
        categoryId: activeTab !== 'all' ? activeTab : '',
        isActive: true
      })
      setTemplateItems([])
    }
    setProductSearch('')
    setProductResults([])
    setShowTemplateDialog(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (templateItems.length === 0) {
      toast.error('Add at least one item to the package')
      return
    }

    setSavingTemplate(true)
    try {
      const url = editingTemplate
        ? `/api/package-templates/${editingTemplate.id}`
        : '/api/package-templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      const targetPrice = templateItems.reduce((sum, item) => sum + (item.customPrice * item.quantity), 0)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templateForm,
          targetPrice,
          items: templateItems.map(item => ({
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
            originalPrice: item.cost, // Store cost as originalPrice
            customPrice: item.customPrice
          }))
        })
      })

      const data = await response.json()
      if (response.ok) {
        toast.success(editingTemplate ? 'Package template updated' : 'Package template created')
        setShowTemplateDialog(false)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  // Product search - searches active products regardless of stock
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([])
      return
    }

    setSearchingProducts(true)
    try {
      // Use the legacy 'q' parameter for fuzzy search on active products
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=30`)
      const data = await response.json()

      if (response.ok && data.products) {
        // Flatten products with variations into a single list for easy selection
        const flattened: ProductVariation[] = []
        for (const product of data.products) {
          if (product.variations && product.variations.length > 0) {
            for (const v of product.variations) {
              flattened.push({
                id: v.id,
                productId: product.id,
                name: v.name || '',
                subSku: v.sku || '',
                defaultPurchasePrice: v.defaultPurchasePrice || 0,
                defaultSellingPrice: v.defaultSellingPrice || 0,
                product: {
                  id: product.id,
                  name: product.name,
                  sku: v.sku || ''
                }
              })
            }
          }
        }
        setProductResults(flattened.slice(0, 20))
      } else {
        setProductResults([])
      }
    } catch (error) {
      console.error('Error searching products:', error)
      setProductResults([])
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (productSearch) {
        searchProducts(productSearch)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [productSearch, searchProducts])

  const addProductToTemplate = (variation: ProductVariation) => {
    const existingIndex = templateItems.findIndex(item => item.productVariationId === variation.id)
    if (existingIndex >= 0) {
      toast.error('Product already added')
      return
    }

    // Construct display name and SKU
    const displayName = variation.product.name + (variation.name ? ` - ${variation.name}` : '')
    const displaySku = variation.subSku || variation.product.sku || `VAR-${variation.id}`

    const cost = Number(variation.defaultPurchasePrice) || 0
    const defaultMarkup = 30 // Default 30% markup
    const customPrice = Math.round(cost * (1 + defaultMarkup / 100))

    setTemplateItems([...templateItems, {
      productId: variation.productId,
      productVariationId: variation.id,
      quantity: 1,
      cost,
      markupPercent: defaultMarkup,
      customPrice,
      productName: displayName,
      productSku: displaySku
    }])
    setProductSearch('')
    setProductResults([])
  }

  const removeProductFromTemplate = (index: number) => {
    setTemplateItems(templateItems.filter((_, i) => i !== index))
  }

  const updateTemplateItem = (index: number, field: 'quantity' | 'markupPercent' | 'customPrice', value: number) => {
    const updated = [...templateItems]
    if (field === 'markupPercent') {
      updated[index].markupPercent = value
      // Recalculate custom price based on cost and markup
      updated[index].customPrice = Math.round(updated[index].cost * (1 + value / 100))
    } else if (field === 'customPrice') {
      updated[index].customPrice = value
      // Recalculate markup based on cost and custom price
      if (updated[index].cost > 0) {
        updated[index].markupPercent = Math.round(((value - updated[index].cost) / updated[index].cost) * 100)
      }
    } else {
      updated[index][field] = value
    }
    setTemplateItems(updated)
  }

  // Delete handlers
  const handleDelete = async () => {
    if (!deletingItem) return

    setDeleting(true)
    try {
      const url = deletingItem.type === 'category'
        ? `/api/package-categories/${deletingItem.item.id}`
        : `/api/package-templates/${deletingItem.item.id}`

      const response = await fetch(url, { method: 'DELETE' })
      const data = await response.json()

      if (response.ok) {
        toast.success(`${deletingItem.type === 'category' ? 'Category' : 'Template'} deleted`)
        setShowDeleteConfirm(false)
        setDeletingItem(null)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  // Duplicate template
  const duplicateTemplate = (template: PackageTemplate) => {
    setEditingTemplate(null)
    setTemplateForm({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      sku: '',
      categoryId: template.categoryId?.toString() || '',
      isActive: true
    })
    setTemplateItems(template.items.map(item => {
      const cost = Number(item.originalPrice) // originalPrice stores cost
      const customPrice = Number(item.customPrice)
      const markupPercent = cost > 0 ? Math.round(((customPrice - cost) / cost) * 100) : 0
      return {
        productId: item.productId,
        productVariationId: item.productVariationId,
        quantity: Number(item.quantity),
        cost,
        markupPercent,
        customPrice,
        productName: item.product.name,
        productSku: item.product.sku
      }
    }))
    setShowTemplateDialog(true)
  }

  // Filter templates by category
  const filteredTemplates = activeTab === 'all'
    ? templates
    : templates.filter(t => t.categoryId?.toString() === activeTab)

  // Calculate totals
  const totalCost = templateItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0)
  const totalCustom = templateItems.reduce((sum, item) => sum + (item.customPrice * item.quantity), 0)
  const totalProfit = totalCustom - totalCost
  const avgMarkup = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : '0'

  // Export handlers
  const handleExport = (format: 'excel' | 'csv') => {
    const dataGrid = dataGridRef.current?.instance
    if (!dataGrid) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Package Templates')

    exportToExcel({
      component: dataGrid,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `package-templates.${format === 'excel' ? 'xlsx' : 'csv'}`)
      })
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-purple-600" />
          <div>
            <h1 className="text-xl font-bold">Package Templates</h1>
            <p className="text-sm text-muted-foreground">
              Pre-defined product bundles with custom pricing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {can(PERMISSIONS.PACKAGE_TEMPLATE_CREATE) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCategoryDialog()}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => openTemplateDialog()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Package
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
              <TabsTrigger
                value="all"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:bg-transparent"
              >
                All ({templates.length})
              </TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id.toString()}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:bg-transparent"
                >
                  {cat.name} ({templates.filter(t => t.categoryId === cat.id).length})
                  {can(PERMISSIONS.PACKAGE_TEMPLATE_EDIT) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        openCategoryDialog(cat)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-4">
              <DataGrid
                ref={dataGridRef}
                dataSource={filteredTemplates}
                showBorders={true}
                rowAlternationEnabled={true}
                columnAutoWidth={true}
                allowColumnReordering={true}
                wordWrapEnabled={true}
              >
                <LoadPanel enabled={loading} />
                <SearchPanel visible={true} width={240} placeholder="Search templates..." />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <Sorting mode="multiple" />
                <Paging defaultPageSize={20} />
                <Pager
                  showPageSizeSelector={true}
                  allowedPageSizes={[10, 20, 50, 100]}
                  showInfo={true}
                  showNavigationButtons={true}
                />
                <Export enabled={true} allowExportSelectedData={false} />

                <Column dataField="name" caption="Package Name" width={200} />
                <Column
                  dataField="category.name"
                  caption="Category"
                  width={120}
                  cellRender={({ data }: { data: PackageTemplate }) => (
                    <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {data.category?.name || 'Uncategorized'}
                    </span>
                  )}
                />
                <Column
                  dataField="targetPrice"
                  caption="Package Price"
                  width={120}
                  dataType="number"
                  format={{ type: 'currency', precision: 2 }}
                  cellRender={({ data }: { data: PackageTemplate }) => (
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(data.targetPrice))}
                    </span>
                  )}
                />
                <Column
                  dataField="_count.items"
                  caption="Items"
                  width={80}
                  alignment="center"
                  cellRender={({ data }: { data: PackageTemplate }) => (
                    <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                      {data.items?.length || data._count?.items || 0}
                    </span>
                  )}
                />
                <Column
                  dataField="isActive"
                  caption="Status"
                  width={100}
                  cellRender={({ data }: { data: PackageTemplate }) => (
                    <span className={`px-2 py-1 rounded-full text-xs ${data.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {data.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                />
                <Column
                  caption="Actions"
                  width={150}
                  alignment="center"
                  cellRender={({ data }: { data: PackageTemplate }) => (
                    <div className="flex items-center justify-center gap-1">
                      {can(PERMISSIONS.PACKAGE_TEMPLATE_CREATE) && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 hover:border-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-950"
                          onClick={() => duplicateTemplate(data)}
                          title="Duplicate Package"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {can(PERMISSIONS.PACKAGE_TEMPLATE_EDIT) && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950"
                          onClick={() => openTemplateDialog(data)}
                          title="Edit Package"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {can(PERMISSIONS.PACKAGE_TEMPLATE_DELETE) && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                          onClick={() => {
                            setDeletingItem({ type: 'template', item: data })
                            setShowDeleteConfirm(true)
                          }}
                          title="Delete Package"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                />

                <Toolbar>
                  <ToolbarItem location="after">
                    <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                      Export Excel
                    </Button>
                  </ToolbarItem>
                </Toolbar>
              </DataGrid>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Gaming, Office, Budget"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancel</Button>
            <Button variant="success" onClick={handleSaveCategory} disabled={savingCategory}>
              {savingCategory ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Package Template' : 'Create Package Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Package Name *</Label>
                <Input
                  id="tpl-name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., Gaming Desktop Build A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-category">Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={templateForm.categoryId || 'none'}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, categoryId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => openCategoryDialog(undefined, true)}
                    title="Quick Add Category"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-sku">SKU (Optional)</Label>
                <Input
                  id="tpl-sku"
                  value={templateForm.sku}
                  onChange={(e) => setTemplateForm({ ...templateForm, sku: e.target.value })}
                  placeholder="e.g., PKG-GAMING-001"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="tpl-active"
                  checked={templateForm.isActive}
                  onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isActive: checked })}
                />
                <Label htmlFor="tpl-active">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {/* Product Search */}
            <div className="space-y-2">
              <Label>Add Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name or SKU..."
                />
                {searchingProducts && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>
              {productSearch.length >= 2 && !searchingProducts && productResults.length === 0 && (
                <div className="text-sm text-gray-500 py-2 text-center border rounded-md bg-gray-50 dark:bg-gray-800">
                  No products found for "{productSearch}"
                </div>
              )}
              {productResults.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto bg-white dark:bg-gray-900">
                  {productResults.map((variation) => (
                    <div
                      key={variation.id}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center"
                      onClick={() => addProductToTemplate(variation)}
                    >
                      <div>
                        <span className="font-medium">{variation.product.name}</span>
                        {variation.name && <span className="text-gray-500"> - {variation.name}</span>}
                        <span className="text-xs text-gray-400 ml-2">[{variation.subSku || variation.product.sku}]</span>
                      </div>
                      <span className="text-orange-600 font-medium">
                        Cost: {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(variation.defaultPurchasePrice) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <Label>Package Items ({templateItems.length})</Label>
              {templateItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-md">
                  No items added. Search and add products above.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-center w-16">Qty</th>
                        <th className="p-2 text-right w-24">Cost</th>
                        <th className="p-2 text-center w-24">Markup %</th>
                        <th className="p-2 text-right w-28">Sell Price</th>
                        <th className="p-2 text-right w-28">Line Total</th>
                        <th className="p-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-gray-500">{item.productSku}</div>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="1"
                              className="w-14 text-center"
                              value={item.quantity}
                              onChange={(e) => updateTemplateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            />
                          </td>
                          <td className="p-2 text-right text-orange-600 font-medium">
                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(item.cost)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                className="w-16 text-center"
                                value={item.markupPercent}
                                onChange={(e) => updateTemplateItem(index, 'markupPercent', parseInt(e.target.value) || 0)}
                              />
                              <span className="ml-1 text-gray-500">%</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              className="w-24 text-right"
                              value={item.customPrice}
                              onChange={(e) => updateTemplateItem(index, 'customPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                            />
                          </td>
                          <td className="p-2 text-right font-medium text-green-600">
                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(item.customPrice * item.quantity)}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => removeProductFromTemplate(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary */}
            {templateItems.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                  <span className="text-orange-600 font-medium">
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalCost)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Package Price:</span>
                  <span className="text-green-600">
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalCustom)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Profit:</span>
                  <span className={`font-medium ${totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-purple-600">
                  <span>Average Markup:</span>
                  <span className="font-semibold">{avgMarkup}%</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button variant="success" onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete this {deletingItem?.type}?
            {deletingItem?.type === 'category' && ' This will not delete the templates in this category.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
