'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, PencilIcon } from '@heroicons/react/24/outline'
import DataGrid, {
    Column,
    Export,
    FilterRow,
    Grouping,
    GroupPanel,
    Pager,
    Paging,
    SearchPanel,
    Summary,
    TotalItem,
    Sorting,
    HeaderFilter,
    ColumnChooser,
    ColumnFixing,
    StateStoring,
    LoadPanel,
    Scrolling,
    Selection,
    MasterDetail,
    RemoteOperations,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import CustomStore from 'devextreme/data/custom_store'

interface Product {
    id: number
    name: string
    type: string
    sku: string
    image: string | null
    enableStock: boolean
    alertQuantity: number | null
    isActive: boolean
    purchasePrice: number
    sellingPrice: number
    totalStock: number
    category: { id: number; name: string } | null
    brand: { id: number; name: string } | null
    unit: { id: number; name: string; shortName: string } | null
    tax: { id: number; name: string; amount: number } | null
    createdAt: string
    updatedAt: string
}

type ColumnPreset = 'basic' | 'supplier' | 'purchase' | 'complete'

export default function ProductsListV2OptimizedPage() {
    const { can } = usePermissions()
    const [loading, setLoading] = useState(true)
    const [activePreset, setActivePreset] = useState<ColumnPreset>('basic')
    const [gridInitialized, setGridInitialized] = useState(false)

    // Individual column visibility states
    const [columnVisibility, setColumnVisibility] = useState({
        sku: true,
        name: true,
        type: true,
        category: true,
        brand: true,
        unit: true,
        alertQuantity: true,
        tax: true,
        purchasePrice: true,
        sellingPrice: true,
        totalStock: true,
        createdAt: true,
        isActive: true,
    })

    // Create custom store for server-side operations
    const dataSource = new CustomStore({
        key: 'id',
        load: async (loadOptions) => {
            try {
                setLoading(true)

                const params = new URLSearchParams()

                // Pagination
                if (loadOptions.skip) params.append('skip', loadOptions.skip.toString())
                if (loadOptions.take) params.append('take', loadOptions.take.toString())

                // Sorting
                if (loadOptions.sort && Array.isArray(loadOptions.sort) && loadOptions.sort.length > 0) {
                    const sort = loadOptions.sort[0] as any
                    params.append('sortBy', sort.selector || sort)
                    params.append('sortOrder', sort.desc ? 'desc' : 'asc')
                }

                // Filtering
                if (loadOptions.filter) {
                    const filters = loadOptions.filter
                    if (Array.isArray(filters)) {
                        filters.forEach(filter => {
                            if (filter[0] && filter[1] && filter[2] !== undefined) {
                                const [field, operator, value] = filter
                                if (field === 'search' && value) {
                                    params.append('search', value.toString())
                                } else if (field === 'isActive' && value !== null) {
                                    params.append('isActive', value.toString())
                                } else if (field === 'type' && value) {
                                    params.append('productType', value.toString())
                                } else if (field === 'category.name' && value) {
                                    params.append('categoryId', value.toString())
                                } else if (field === 'brand.name' && value) {
                                    params.append('brandId', value.toString())
                                } else if (field === 'enableStock' && value !== null) {
                                    params.append('enableStock', value.toString())
                                } else if (field === 'totalStock' && value !== undefined) {
                                    if (operator === '>=') {
                                        params.append('stockMin', value.toString())
                                    } else if (operator === '<=') {
                                        params.append('stockMax', value.toString())
                                    }
                                }
                            }
                        })
                    }
                }

                const response = await fetch(`/api/products/route-optimized-v2?${params.toString()}`)

                if (!response.ok) {
                    throw new Error('Failed to fetch products')
                }

                const data = await response.json()

                return {
                    data: data.data,
                    totalCount: data.totalCount
                }
            } catch (error) {
                console.error('Error loading products:', error)
                toast.error('Failed to load products')
                return { data: [], totalCount: 0 }
            } finally {
                setLoading(false)
            }
        }
    })

    // Column presets
    const columnPresets = {
        basic: {
            name: 'Basic View',
            columns: ['sku', 'name', 'type', 'category', 'brand', 'isActive']
        },
        supplier: {
            name: 'Supplier View',
            columns: ['sku', 'name', 'category', 'brand', 'lastSupplier', 'latestSupplier', 'isActive']
        },
        purchase: {
            name: 'Purchase View',
            columns: ['sku', 'name', 'category', 'brand', 'lastPurchaseDate', 'lastPurchaseCost', 'lastPurchaseQuantity', 'isActive']
        },
        complete: {
            name: 'Complete View',
            columns: ['sku', 'name', 'type', 'category', 'brand', 'unit', 'alertQuantity', 'tax', 'purchasePrice', 'sellingPrice', 'totalStock', 'createdAt', 'isActive']
        }
    }

    const handlePresetChange = (preset: ColumnPreset) => {
        setActivePreset(preset)
        const presetColumns = columnPresets[preset].columns

        const newVisibility = { ...columnVisibility }
        Object.keys(newVisibility).forEach(key => {
            newVisibility[key as keyof typeof newVisibility] = presetColumns.includes(key)
        })
        setColumnVisibility(newVisibility)
    }

    const handleExport = useCallback(async (format: 'excel' | 'pdf') => {
        try {
            if (format === 'excel') {
                const workbook = new Workbook()
                const worksheet = workbook.addWorksheet('Products')

                // Add headers
                const headers = [
                    'SKU', 'Name', 'Type', 'Category', 'Brand', 'Unit',
                    'Alert Qty', 'Tax', 'Purchase Price', 'Selling Price',
                    'Total Stock', 'Active', 'Created At'
                ]
                worksheet.addRow(headers)

                // Style headers
                const headerRow = worksheet.getRow(1)
                headerRow.font = { bold: true }
                headerRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                }

                // Add data (you might want to fetch all data for export)
                const response = await fetch('/api/products/route-optimized-v2?take=10000')
                const data = await response.json()

                data.data.forEach((product: Product) => {
                    worksheet.addRow([
                        product.sku,
                        product.name,
                        product.type,
                        product.category?.name || '',
                        product.brand?.name || '',
                        product.unit?.name || '',
                        product.alertQuantity || '',
                        product.tax?.name || '',
                        product.purchasePrice,
                        product.sellingPrice,
                        product.totalStock,
                        product.isActive ? 'Yes' : 'No',
                        new Date(product.createdAt).toLocaleDateString()
                    ])
                })

                // Auto-fit columns
                worksheet.columns.forEach(column => {
                    column.width = 15
                })

                const buffer = await workbook.xlsx.writeBuffer()
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                saveAs(blob, `products-${new Date().toISOString().split('T')[0]}.xlsx`)

                toast.success('Products exported to Excel successfully')
            } else if (format === 'pdf') {
                // PDF export implementation
                toast.info('PDF export coming soon')
            }
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export products')
        }
    }, [])

    const dataGridRef = useRef<any>(null)

    const handleRefresh = useCallback(() => {
        if (dataGridRef.current) {
            dataGridRef.current.instance.refresh()
        }
    }, [])

    const MasterDetailTemplate = ({ data }: { data: Product }) => (
        <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Product Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="font-medium">SKU:</span> {data.sku}
                </div>
                <div>
                    <span className="font-medium">Type:</span> {data.type}
                </div>
                <div>
                    <span className="font-medium">Category:</span> {data.category?.name || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Brand:</span> {data.brand?.name || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Unit:</span> {data.unit?.name || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Tax:</span> {data.tax?.name || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Alert Quantity:</span> {data.alertQuantity || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Total Stock:</span> {data.totalStock}
                </div>
                <div>
                    <span className="font-medium">Purchase Price:</span> ${data.purchasePrice}
                </div>
                <div>
                    <span className="font-medium">Selling Price:</span> ${data.sellingPrice}
                </div>
                <div>
                    <span className="font-medium">Created:</span> {new Date(data.createdAt).toLocaleDateString()}
                </div>
                <div>
                    <span className="font-medium">Status:</span>
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${data.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                        {data.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
        </div>
    )

    if (!can(PERMISSIONS.PRODUCT_VIEW)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Access Denied
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You don't have permission to view products.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Products List V2 (Optimized)
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Server-side pagination, filtering, and sorting for optimal performance
                    </p>
                </div>

                <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
                    {can(PERMISSIONS.PRODUCT_CREATE) && (
                        <Link href="/dashboard/products/add">
                            <Button className="w-full sm:w-auto">
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Add Product
                            </Button>
                        </Link>
                    )}

                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        className="w-full sm:w-auto"
                    >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Column Presets */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Column Presets
                    </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                    {Object.entries(columnPresets).map(([key, preset]) => (
                        <Button
                            key={key}
                            variant={activePreset === key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePresetChange(key as ColumnPreset)}
                        >
                            {preset.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Export Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Export Options
                    </h3>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('excel')}
                    >
                        Export to Excel
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('pdf')}
                    >
                        Export to PDF
                    </Button>
                </div>
            </div>

            {/* Optimized DataGrid with Server-Side Operations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Products Grid (Server-Side Optimized)
                </h2>

                <DataGrid
                    ref={dataGridRef}
                    dataSource={dataSource}
                    showBorders={true}
                    columnAutoWidth={true}
                    rowAlternationEnabled={true}
                    height={700}
                    keyExpr="id"
                    onExporting={(e) => {
                        if (e.format === 'xlsx') {
                            handleExport('excel')
                        } else if (e.format === 'pdf') {
                            handleExport('pdf')
                        }
                    }}
                    onContentReady={() => {
                        if (!gridInitialized) {
                            setGridInitialized(true)
                            console.log('Optimized grid initialized and ready')
                        }
                    }}
                    wordWrapEnabled={false}
                    allowColumnReordering={true}
                    allowColumnResizing={true}
                >
                    <RemoteOperations
                        filtering={true}
                        sorting={true}
                        paging={true}
                        grouping={false}
                    />

                    <StateStoring enabled={true} type="localStorage" storageKey="productsListV2OptimizedState" />
                    <LoadPanel enabled={true} />
                    <Scrolling mode="virtual" />
                    <Selection mode="multiple" showCheckBoxesMode="always" />
                    <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
                    <ColumnChooser enabled={true} mode="select" />
                    <ColumnFixing enabled={true} />
                    <SearchPanel visible={true} width={300} placeholder="Search products..." />
                    <FilterRow visible={true} />
                    <HeaderFilter visible={true} />
                    <Paging defaultPageSize={50} />
                    <Grouping autoExpandAll={false} />
                    <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by category, brand, or type" />
                    <Sorting mode="multiple" />

                    {/* Master-Detail for product details */}
                    <MasterDetail enabled={true} component={MasterDetailTemplate} />

                    {/* Fixed Columns */}
                    <Column
                        dataField="sku"
                        caption="SKU"
                        width={150}
                        fixed={true}
                        fixedPosition="left"
                        cellRender={(data) => <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{data.text}</span>}
                    />
                    <Column
                        dataField="name"
                        caption="Product Name"
                        minWidth={200}
                        cellRender={(data) => (
                            <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{data.text}</span>
                                {!data.data.isActive && (
                                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        )}
                    />
                    <Column
                        dataField="type"
                        caption="Type"
                        width={100}
                        cellRender={(data) => (
                            <span className={`px-2 py-1 text-xs rounded ${data.text === 'single'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                }`}>
                                {data.text}
                            </span>
                        )}
                    />
                    <Column
                        dataField="category.name"
                        caption="Category"
                        width={150}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>}
                    />
                    <Column
                        dataField="brand.name"
                        caption="Brand"
                        width={150}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>}
                    />
                    <Column
                        dataField="unit.name"
                        caption="Unit"
                        width={100}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>}
                    />
                    <Column
                        dataField="alertQuantity"
                        caption="Alert Qty"
                        width={100}
                        dataType="number"
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>}
                    />
                    <Column
                        dataField="tax.name"
                        caption="Tax"
                        width={120}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>}
                    />
                    <Column
                        dataField="purchasePrice"
                        caption="Purchase Price"
                        width={120}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">${data.text}</span>}
                    />
                    <Column
                        dataField="sellingPrice"
                        caption="Selling Price"
                        width={120}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">${data.text}</span>}
                    />
                    <Column
                        dataField="totalStock"
                        caption="Total Stock"
                        width={100}
                        dataType="number"
                        cellRender={(data) => (
                            <span className={`font-mono ${Number(data.text) <= 0
                                ? 'text-red-600 dark:text-red-400'
                                : Number(data.text) <= (data.data.alertQuantity || 0)
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-green-600 dark:text-green-400'
                                }`}>
                                {data.text}
                            </span>
                        )}
                    />
                    <Column
                        dataField="isActive"
                        caption="Active"
                        width={80}
                        dataType="boolean"
                        cellRender={(data) => (
                            <span className={`px-2 py-1 text-xs rounded ${data.text
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                {data.text ? 'Yes' : 'No'}
                            </span>
                        )}
                    />
                    <Column
                        dataField="createdAt"
                        caption="Created"
                        width={120}
                        dataType="datetime"
                        format="MMM dd, yyyy"
                        cellRender={(data) => <span className="text-gray-600 dark:text-gray-400">{data.text}</span>}
                    />
                    <Column
                        caption="Actions"
                        width={120}
                        allowSorting={false}
                        allowFiltering={false}
                        cellRender={(data) => (
                            <div className="flex space-x-1">
                                <Link href={`/dashboard/products/${data.data.id}`}>
                                    <Button size="sm" variant="outline">
                                        <PencilIcon className="h-3 w-3" />
                                    </Button>
                                </Link>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        // Toggle active status
                                        console.log('Toggle active status for product:', data.data.id)
                                    }}
                                >
                                    {data.data.isActive ? <EyeSlashIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
                                </Button>
                            </div>
                        )}
                    />
                </DataGrid>
            </div>
        </div>
    )
}
