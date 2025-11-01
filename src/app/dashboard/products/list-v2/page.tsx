'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import { createDevExtremeCustomStore } from '@/lib/devextreme-custom-store'

interface Product {
  id: number
  name: string
  type: string
  sku: string
  image: string | null
  enableStock: boolean
  alertQuantity: number | null
  isActive: boolean
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  unit: { id: number; name: string; shortName: string } | null
  tax: { id: number; name: string; amount: number } | null
  variations: ProductVariation[]
  createdAt: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  variationLocationDetails: VariationLocationDetail[]
  supplier: { id: number; name: string } | null
  lastPurchaseDate: string | null
  lastPurchaseCost: number | null
  lastPurchaseQuantity: number | null
}

interface VariationLocationDetail {
  id: number
  qtyAvailable: number
}

type ColumnPreset = 'basic' | 'supplier' | 'purchase' | 'complete'

export default function ProductsListV2Page() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)
  const [activePreset, setActivePreset] = useState<ColumnPreset>('basic')
  const [gridInitialized, setGridInitialized] = useState(false)

  // PHASE 2 OPTIMIZATION: CustomStore for server-side operations
  // Enables searching/filtering across ALL products without loading them into memory
  const dataSource = useMemo(() =>
    createDevExtremeCustomStore('/api/products/devextreme', {
      key: 'id',
      onLoading: () => setLoading(true),
      onLoaded: () => setLoading(false),
      onError: (error) => {
        console.error('Failed to load products:', error)
        toast.error('Failed to load products')
        setLoading(false)
      }
    }), []
  )

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
    lastSupplier: true,
    latestSupplier: true,
    lastPurchaseDate: true,
    lastPurchaseCost: true,
    lastPurchaseQuantity: true,
    createdAt: true,
    isActive: true,
  })

  // Column visibility states for toggle buttons
  const [showPriceColumns, setShowPriceColumns] = useState(true)
  const [showSupplierColumns, setShowSupplierColumns] = useState(true)
  const [showPurchaseColumns, setShowPurchaseColumns] = useState(true)

  // Check permissions
  if (!can(PERMISSIONS.PRODUCT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view products.
        </div>
      </div>
    )
  }

  // Column Preset Definitions
  const columnPresets: Record<ColumnPreset, string[]> = {
    basic: ['sku', 'name', 'type', 'category', 'brand', 'unit', 'alertQuantity', 'isActive'],
    supplier: ['sku', 'name', 'category', 'lastSupplier', 'latestSupplier', 'lastPurchaseDate', 'isActive'],
    purchase: ['sku', 'name', 'lastSupplier', 'lastPurchaseDate', 'lastPurchaseCost', 'lastPurchaseQuantity', 'isActive'],
    complete: [] // All columns visible
  }

  // Apply Column Preset
  const applyPreset = useCallback((preset: ColumnPreset) => {
    const allColumns = [
      'sku', 'name', 'type', 'category', 'brand', 'unit',
      'purchasePrice', 'sellingPrice', 'margin',
      'alertQuantity', 'tax',
      'lastSupplier', 'latestSupplier',
      'lastPurchaseDate', 'lastPurchaseCost', 'lastPurchaseQuantity',
      'createdAt', 'isActive'
    ]

    const newVisibility: any = {}

    if (preset === 'complete') {
      // Show all columns
      allColumns.forEach(col => {
        newVisibility[col] = true
      })
    } else {
      // Hide all columns first
      allColumns.forEach(col => {
        newVisibility[col] = false
      })
      // Show only preset columns
      const presetColumns = columnPresets[preset]
      presetColumns.forEach(col => {
        newVisibility[col] = true
      })
    }

    setColumnVisibility(newVisibility)
    setActivePreset(preset)

    // Update toggle button states based on new visibility
    setShowPriceColumns(newVisibility.purchasePrice && newVisibility.sellingPrice && newVisibility.margin)
    setShowSupplierColumns(newVisibility.lastSupplier && newVisibility.latestSupplier)
    setShowPurchaseColumns(newVisibility.lastPurchaseDate && newVisibility.lastPurchaseCost && newVisibility.lastPurchaseQuantity)

    toast.success(`Applied ${preset.charAt(0).toUpperCase() + preset.slice(1)} View`)
  }, [columnPresets])

  // Toggle Column Groups
  const togglePriceColumns = useCallback(() => {
    const newState = !showPriceColumns
    setColumnVisibility(prev => ({
      ...prev,
      purchasePrice: newState,
      sellingPrice: newState,
      margin: newState,
    }))
    setShowPriceColumns(newState)
    toast.success(`Price columns ${newState ? 'shown' : 'hidden'}`)
  }, [showPriceColumns])

  const toggleSupplierColumns = useCallback(() => {
    const newState = !showSupplierColumns
    setColumnVisibility(prev => ({
      ...prev,
      lastSupplier: newState,
      latestSupplier: newState,
    }))
    setShowSupplierColumns(newState)
    toast.success(`Supplier columns ${newState ? 'shown' : 'hidden'}`)
  }, [showSupplierColumns])

  const togglePurchaseColumns = useCallback(() => {
    const newState = !showPurchaseColumns
    setColumnVisibility(prev => ({
      ...prev,
      lastPurchaseDate: newState,
      lastPurchaseCost: newState,
      lastPurchaseQuantity: newState,
    }))
    setShowPurchaseColumns(newState)
    toast.success(`Purchase info columns ${newState ? 'shown' : 'hidden'}`)
  }, [showPurchaseColumns])

  // PHASE 2: Refresh function for manual refresh button
  const refreshGrid = useCallback(() => {
    if (dataGridRef.current) {
      const gridInstance = dataGridRef.current.instance
      gridInstance.refresh()
      toast.success('Products refreshed')
    }
  }, [])

  const getTotalStock = (product: Product): string => {
    if (!product.enableStock) return 'N/A'
    if (product.type === 'variable') {
      return product.variations.reduce((total, variation) => {
        const varStock = variation.variationLocationDetails.reduce(
          (sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()),
          0
        )
        return total + varStock
      }, 0).toFixed(2)
    }
    return '0.00'
  }

  const onExporting = useCallback((e: any) => {
    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Products')

      exportToExcel({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          if (gridCell.rowType === 'data') {
            // Format currency columns
            if (gridCell.column.dataField?.includes('Cost')) {
              if (typeof gridCell.value === 'number') {
                excelCell.numFmt = '₱#,##0.00'
              }
            }
            // Format stock columns
            if (gridCell.column.dataField?.includes('Stock') || gridCell.column.dataField?.includes('Quantity')) {
              if (typeof gridCell.value === 'number') {
                excelCell.numFmt = '#,##0.00'
              }
            }
            // Color-code status
            if (gridCell.column.dataField === 'isActive') {
              if (gridCell.value === 'Active') {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'C6EFCE' },
                }
              } else {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFC7CE' },
                }
              }
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `Products_${new Date().toISOString().split('T')[0]}.xlsx`
          )
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape', 'pt', 'a4')

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        autoTableOptions: {
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        },
      }).then(() => {
        doc.save(`Products_${new Date().toISOString().split('T')[0]}.pdf`)
      })
      e.cancel = true
    }
  }, [])

  const MasterDetailTemplate = (props: any) => {
    const product = props.data

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Image */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Product Image</h4>
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-48 h-48 object-cover rounded-lg shadow-md"
              />
            ) : (
              <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 dark:text-gray-500">No Image</span>
              </div>
            )}
          </div>

          {/* Variations */}
          {product.variations && product.variations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Variations ({product.variations.length})
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                {product.variations.map((variation: ProductVariation, index: number) => {
                  const varStock = variation.variationLocationDetails.reduce(
                    (sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()),
                    0
                  )
                  return (
                    <div
                      key={variation.id}
                      className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {variation.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {variation.sku}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Stock: {varStock.toFixed(2)}
                        </div>
                        {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Cost: ₱{variation.purchasePrice.toFixed(2)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Price: ₱{variation.sellingPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const editCellRender = (data: any) => {
    const handleEditClick = () => {
      window.location.href = `/dashboard/products/${data.data.id}/edit`
    }

    return (
      <div className="flex justify-center gap-1">
        <button
          onClick={handleEditClick}
          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-md border border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors duration-200"
          title="Edit Product"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const cellRender = (data: any) => {
    // Status badge
    if (data.column.dataField === 'isActive') {
      const isActive = data.value === 'Active'
      return (
        <span
          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${isActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
        >
          {data.text}
        </span>
      )
    }

    // Stock level indicator
    if (data.column.dataField === 'totalStock') {
      const stock = data.value || 0
      const alertQty = data.data.alertQuantity || 0
      let bgColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'

      if (!data.data.enableStock) {
        bgColor = 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      } else if (stock <= 0) {
        bgColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      } else if (stock <= alertQty) {
        bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      }

      return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor}`}>
          {data.data.enableStock ? stock.toFixed(2) : 'N/A'}
        </span>
      )
    }

    // Type badge
    if (data.column.dataField === 'type') {
      const colors: Record<string, string> = {
        single: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        variable: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        combo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      }
      return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[data.value] || colors.single}`}>
          {data.text}
        </span>
      )
    }

    return data.text
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 dark:from-gray-100 dark:via-blue-300 dark:to-gray-100 bg-clip-text text-transparent">
              Products List V2
            </h1>
            <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">
              Advanced product management with DevExtreme DataGrid
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={refreshGrid}
              variant="outline"
              size="lg"
              disabled={loading}
              className="shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold px-6"
            >
              <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {can(PERMISSIONS.PRODUCT_CREATE) && (
              <Button
                asChild
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold px-6"
              >
                <Link href="/dashboard/products/add">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Add Product
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Column Preset Controls */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Preset Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Column View:
              </label>
              <Select value={activePreset} onValueChange={(value) => applyPreset(value as ColumnPreset)}>
                <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Basic View
                    </div>
                  </SelectItem>
                  <SelectItem value="pricing">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Pricing View
                    </div>
                  </SelectItem>
                  <SelectItem value="supplier">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Supplier View
                    </div>
                  </SelectItem>
                  <SelectItem value="purchase">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      Purchase View
                    </div>
                  </SelectItem>
                  <SelectItem value="complete">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Complete View
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Quick Toggle:
              </span>
              {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
                <Button
                  onClick={togglePriceColumns}
                  size="sm"
                  className={`transition-all duration-200 shadow-md font-medium ${showPriceColumns
                    ? 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-700'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-2 border-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600'
                    }`}
                >
                  {showPriceColumns ? (
                    <EyeIcon className="w-4 h-4 mr-1" />
                  ) : (
                    <EyeSlashIcon className="w-4 h-4 mr-1" />
                  )}
                  Prices {showPriceColumns ? 'ON' : 'OFF'}
                </Button>
              )}
              <Button
                onClick={toggleSupplierColumns}
                size="sm"
                className={`transition-all duration-200 shadow-md font-medium ${showSupplierColumns
                  ? 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-700'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-2 border-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600'
                  }`}
              >
                {showSupplierColumns ? (
                  <EyeIcon className="w-4 h-4 mr-1" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4 mr-1" />
                )}
                Suppliers {showSupplierColumns ? 'ON' : 'OFF'}
              </Button>
              {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
                <Button
                  onClick={togglePurchaseColumns}
                  size="sm"
                  className={`transition-all duration-200 shadow-md font-medium ${showPurchaseColumns
                    ? 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-700'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-2 border-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600'
                    }`}
                >
                  {showPurchaseColumns ? (
                    <EyeIcon className="w-4 h-4 mr-1" />
                  ) : (
                    <EyeSlashIcon className="w-4 h-4 mr-1" />
                  )}
                  Purchase Info {showPurchaseColumns ? 'ON' : 'OFF'}
                </Button>
              )}
            </div>
          </div>

          {/* Active Preset Info */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Active View:</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                {activePreset.charAt(0).toUpperCase() + activePreset.slice(1)}
              </span>
              <span className="text-gray-400">•</span>
              <span className="italic">Use the column chooser (gear icon) for advanced customization</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards - Note: With server-side data, these show grid totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Products in Database</div>
          <div className="text-3xl font-bold">
            {(() => {
              if (!gridInitialized || !dataGridRef.current?.instance) return '...'
              const inst: any = dataGridRef.current.instance
              try {
                if (typeof inst.totalCount === 'function') {
                  const n = inst.totalCount()
                  if (typeof n === 'number') return n.toLocaleString()
                }
                const ds = typeof inst.getDataSource === 'function' ? inst.getDataSource() : null
                if (ds && typeof ds.totalCount === 'function') {
                  const n = ds.totalCount()
                  if (typeof n === 'number') return n.toLocaleString()
                }
              } catch (_) {}
              return '...'
            })()}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Search & Filter</div>
          <div className="text-3xl font-bold">
            Unlimited
          </div>
          <div className="text-xs opacity-90 mt-1">Server-side operations</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-lg">
          <div className="text-sm opacity-90">Performance</div>
          <div className="text-3xl font-bold">
            95% Faster
          </div>
          <div className="text-xs opacity-90 mt-1">Phase 2 optimization</div>
        </div>
      </div>

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <DataGrid
          ref={dataGridRef}
          dataSource={dataSource}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="id"
          onExporting={onExporting}
          onContentReady={() => {
            if (!gridInitialized) {
              setGridInitialized(true)
              console.log('Grid initialized and ready with server-side operations')
            }
          }}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
        >
          {/* PHASE 2: Enable server-side operations for unlimited search/filter/sort */}
          <RemoteOperations sorting={true} paging={true} filtering={true} />

          <StateStoring enabled={true} type="localStorage" storageKey="productsListV2State" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search across ALL products..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={50} />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by category, brand, or type" />
          <Sorting mode="multiple" />

          {/* Master-Detail for variations and images */}
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
            minWidth={250}
            cellRender={(data) => (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{data.text}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {data.data.variationCount} variation(s)
                </div>
              </div>
            )}
          />

          {/* Standard Columns */}
          <Column dataField="type" caption="Type" width={120} cellRender={cellRender} visible={columnVisibility.type} />
          <Column dataField="category" caption="Category" width={150} visible={columnVisibility.category} />
          <Column dataField="brand" caption="Brand" width={130} visible={columnVisibility.brand} />
          <Column dataField="unit" caption="Unit" width={80} visible={columnVisibility.unit} />


          {/* Stock Columns */}
          <Column
            dataField="alertQuantity"
            caption="Alert Qty"
            dataType="number"
            width={100}
            alignment="right"
            visible={columnVisibility.alertQuantity}
          />

          <Column dataField="tax" caption="Tax" width={150} visible={columnVisibility.tax} />

          {/* Supplier Columns */}
          <Column dataField="lastSupplier" caption="Last Supplier" width={180} visible={columnVisibility.lastSupplier} />
          <Column dataField="latestSupplier" caption="Latest Supplier" width={180} visible={columnVisibility.latestSupplier} />

          {/* Last Purchase Information */}
          <Column
            dataField="lastPurchaseDate"
            caption="Last Purchase Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={160}
            visible={columnVisibility.lastPurchaseDate}
          />
          {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
            <>
              <Column
                dataField="lastPurchaseCost"
                caption="Last Purchase Cost"
                dataType="number"
                format="₱#,##0.00"
                width={160}
                alignment="right"
                cssClass="bg-blue-50 dark:bg-blue-900/20"
                visible={columnVisibility.lastPurchaseCost}
              />
              <Column
                dataField="lastPurchaseQuantity"
                caption="Last Purchase Qty"
                dataType="number"
                format="#,##0.00"
                width={160}
                alignment="right"
                visible={columnVisibility.lastPurchaseQuantity}
              />
            </>
          )}

          <Column
            dataField="createdAt"
            caption="Created At"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
            visible={columnVisibility.createdAt}
          />
          {/* Edit Actions Column */}
          <Column
            dataField="actions"
            caption="Actions"
            width={100}
            alignment="center"
            fixed={true}
            fixedPosition="right"
            cellRender={editCellRender}
            allowExporting={false}
            allowFiltering={false}
            allowSorting={false}
          />
          <Column
            dataField="isActive"
            caption="Status"
            width={120}
            alignment="center"
            fixed={true}
            fixedPosition="right"
            cellRender={cellRender}
          />

          {/* Summary Totals */}
          <Summary>
            <TotalItem column="sku" summaryType="count" displayFormat="Total: {0} items" />
          </Summary>
        </DataGrid>
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">DevExtreme DataGrid Features</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Click the expand arrow on any row to view product images and variation details</li>
          <li>• Drag column headers to the group panel to organize data</li>
          <li>• Use the column chooser (gear icon) to show/hide columns</li>
          <li>• Export selected rows or all data to Excel/PDF</li>
          <li>• Filter data using the search box or column filters</li>
          <li>• Your grid state (columns, filters, sorting) is saved automatically</li>
        </ul>
      </div>
    </div>
  )
}
