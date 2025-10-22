'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
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
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'

interface ProductSupplierData {
  productId: number
  productName: string
  productSku: string
  productType: string
  category: string
  categoryId: number | null
  brand: string
  unit: string
  variationName: string
  variationSku: string
  supplierId: number | null
  supplierName: string
  supplierContact: string
  latestCost: number
  lastQtyDelivered: number
  lastDeliveryDate: string | null
  daysSinceLastDelivery: number | null
  hasHistory: boolean
}

interface Summary {
  totalProducts: number
  productsWithHistory: number
  productsWithoutHistory: number
  uniqueSuppliers: number
  totalValue: number
  averageDaysSinceDelivery: number
}

export default function ProductsSuppliersReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<ProductSupplierData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Check permissions
  if (!can(PERMISSIONS.REPORT_VIEW) && !can(PERMISSIONS.PRODUCT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view this report.
        </div>
      </div>
    )
  }

  const canViewCost = can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) || can(PERMISSIONS.PURCHASE_VIEW_COST)

  // Fetch categories and suppliers for filters
  const fetchFilters = async () => {
    try {
      const [categoriesRes, suppliersRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/suppliers'),
      ])

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData.categories || [])
      }

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json()
        setSuppliers(suppliersData.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  const fetchReport = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (selectedCategory) params.append('categoryId', selectedCategory)
      if (selectedSupplier) params.append('supplierId', selectedSupplier)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/reports/products-suppliers?${params}`)
      const result = await response.json()

      if (response.ok) {
        setDataSource(result.data)
        setSummary(result.summary)
        toast.success(`Loaded ${result.data.length} products`)
      } else {
        toast.error(result.error || 'Failed to load report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilters()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [selectedCategory, selectedSupplier])

  const handleSearch = () => {
    fetchReport()
  }

  const onExporting = useCallback((e: any) => {
    if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Products-Suppliers')

      // Add title
      worksheet.mergeCells('A1:P1')
      const titleRow = worksheet.getRow(1)
      titleRow.getCell(1).value = 'Products with Latest Suppliers Report'
      titleRow.getCell(1).font = { size: 16, bold: true }
      titleRow.getCell(1).alignment = { horizontal: 'center' }
      titleRow.height = 30

      // Add generation date
      worksheet.mergeCells('A2:P2')
      const dateRow = worksheet.getRow(2)
      dateRow.getCell(1).value = `Generated: ${new Date().toLocaleString()}`
      dateRow.getCell(1).alignment = { horizontal: 'center' }
      dateRow.height = 20

      exportToExcel({
        component: e.component,
        worksheet,
        topLeftCell: { row: 4, column: 1 },
        autoFilterEnabled: true,
        customizeCell: ({ gridCell, excelCell }: any) => {
          if (gridCell.rowType === 'data') {
            // Format currency columns
            if (
              gridCell.column.dataField === 'latestCost' ||
              gridCell.column.dataField === 'lastQtyDelivered'
            ) {
              if (typeof gridCell.value === 'number') {
                excelCell.numFmt = '#,##0.00'
              }
            }
            // Format date columns
            if (gridCell.column.dataField === 'lastDeliveryDate') {
              if (gridCell.value) {
                excelCell.numFmt = 'yyyy-mm-dd'
              }
            }
            // Color-code products without history
            if (gridCell.column.dataField === 'supplierName') {
              if (gridCell.value === 'No Purchase History') {
                excelCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF3CD' }, // Yellow
                }
              }
            }
          }
        },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `Products-Suppliers-Report_${new Date().toISOString().split('T')[0]}.xlsx`
          )
        })
      })
      e.cancel = true
    } else if (e.format === 'pdf') {
      const doc = new jsPDF('landscape', 'pt', 'a4')

      // Add title
      doc.setFontSize(16)
      doc.text('Products with Latest Suppliers Report', doc.internal.pageSize.getWidth() / 2, 30, {
        align: 'center',
      })
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, 50, {
        align: 'center',
      })

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        autoTableOptions: {
          startY: 60,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 50 }, // SKU
            1: { cellWidth: 80 }, // Product Name
            2: { cellWidth: 60 }, // Supplier
            3: { cellWidth: 40 }, // Cost
            4: { cellWidth: 35 }, // Qty
            5: { cellWidth: 50 }, // Date
          },
        },
      }).then(() => {
        doc.save(`Products-Suppliers-Report_${new Date().toISOString().split('T')[0]}.pdf`)
      })
      e.cancel = true
    }
  }, [])

  const cellRender = (data: any) => {
    // Supplier name with indicator
    if (data.column.dataField === 'supplierName') {
      if (data.value === 'No Purchase History') {
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {data.text}
          </span>
        )
      }
      return (
        <span className="font-medium text-gray-900 dark:text-gray-100">{data.text}</span>
      )
    }

    // Product type badge
    if (data.column.dataField === 'productType') {
      const colors: Record<string, string> = {
        single: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        variable: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        combo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      }
      return (
        <span
          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
            colors[data.value] || colors.single
          }`}
        >
          {data.text}
        </span>
      )
    }

    // Days since delivery with color coding
    if (data.column.dataField === 'daysSinceLastDelivery') {
      if (data.value === null) return '-'

      let bgColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      if (data.value > 180) {
        bgColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      } else if (data.value > 90) {
        bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      }

      return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor}`}>
          {data.text} days
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
          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="shadow-md hover:shadow-lg transition-all"
            >
              <Link href="/dashboard/reports">
                <ArrowLeftIcon className="w-5 h-5" />
                Back to Reports
              </Link>
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 dark:from-gray-100 dark:via-blue-300 dark:to-gray-100 bg-clip-text text-transparent">
                Products with Latest Suppliers
              </h1>
              <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">
                View which suppliers last delivered each product and recent costs
              </p>
            </div>
          </div>
          <Button
            onClick={fetchReport}
            variant="outline"
            size="lg"
            className="shadow-md hover:shadow-lg transition-all"
            disabled={loading}
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Supplier
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Product
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Product name or SKU..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              className="w-full"
              disabled={loading}
            >
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
            <div className="text-sm opacity-90">Total Products</div>
            <div className="text-3xl font-bold">{summary.totalProducts.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white shadow-lg">
            <div className="text-sm opacity-90">With History</div>
            <div className="text-3xl font-bold">{summary.productsWithHistory.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg text-white shadow-lg">
            <div className="text-sm opacity-90">Without History</div>
            <div className="text-3xl font-bold">{summary.productsWithoutHistory.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
            <div className="text-sm opacity-90">Unique Suppliers</div>
            <div className="text-3xl font-bold">{summary.uniqueSuppliers.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white shadow-lg">
            <div className="text-sm opacity-90">Avg Days Since Delivery</div>
            <div className="text-3xl font-bold">{summary.averageDaysSinceDelivery}</div>
          </div>
        </div>
      )}

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <DataGrid
          dataSource={dataSource}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="productId"
          onExporting={onExporting}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="productsSupplierReportState" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search in results..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={50} />
          <Grouping autoExpandAll={false} />
          <GroupPanel
            visible={true}
            emptyPanelText="Drag column headers here to group by category, supplier, or brand"
          />
          <Sorting mode="multiple" />

          {/* Product Information */}
          <Column
            dataField="productSku"
            caption="SKU"
            width={150}
            fixed={true}
            fixedPosition="left"
            cellRender={(data) => (
              <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{data.text}</span>
            )}
          />
          <Column
            dataField="productName"
            caption="Product Name"
            minWidth={250}
            cellRender={(data) => (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{data.text}</div>
                {data.data.variationName !== '-' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Variation: {data.data.variationName}
                  </div>
                )}
              </div>
            )}
          />
          <Column dataField="productType" caption="Type" width={120} cellRender={cellRender} />
          <Column dataField="category" caption="Category" width={150} />
          <Column dataField="brand" caption="Brand" width={130} />
          <Column dataField="unit" caption="Unit" width={80} />

          {/* Supplier Information */}
          <Column
            dataField="supplierName"
            caption="Latest Supplier"
            minWidth={200}
            cellRender={cellRender}
          />
          <Column dataField="supplierContact" caption="Contact" minWidth={200} visible={false} />

          {/* Cost & Quantity - Only show if user has permission */}
          {canViewCost && (
            <Column
              dataField="latestCost"
              caption="Latest Cost"
              dataType="number"
              format="₱#,##0.00"
              width={130}
              alignment="right"
              cssClass="bg-blue-50 dark:bg-blue-900/20"
            />
          )}
          <Column
            dataField="lastQtyDelivered"
            caption="Last Qty Delivered"
            dataType="number"
            format="#,##0.00"
            width={150}
            alignment="right"
          />
          {canViewCost && (
            <Column
              dataField="totalValue"
              caption="Last Delivery Value"
              dataType="number"
              format="₱#,##0.00"
              width={160}
              alignment="right"
              cssClass="bg-green-50 dark:bg-green-900/20"
              calculateCellValue={(data: ProductSupplierData) => {
                return data.latestCost * data.lastQtyDelivered
              }}
            />
          )}

          {/* Date Information */}
          <Column
            dataField="lastDeliveryDate"
            caption="Last Delivery Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={150}
          />
          <Column
            dataField="daysSinceLastDelivery"
            caption="Days Since Delivery"
            width={170}
            alignment="center"
            cellRender={cellRender}
          />

          {/* Summary Totals */}
          <Summary>
            <TotalItem column="productSku" summaryType="count" displayFormat="Total: {0} products" />
            <TotalItem column="lastQtyDelivered" summaryType="sum" valueFormat="#,##0.00" />
            {canViewCost && <TotalItem column="totalValue" summaryType="sum" valueFormat="₱#,##0.00" />}
          </Summary>
        </DataGrid>
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Report Features</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Shows the most recent supplier who delivered each product</li>
          <li>• Displays the latest purchase cost and quantity from the last delivery</li>
          <li>• Products without purchase history are highlighted in yellow</li>
          <li>• Days since last delivery are color-coded (green: recent, yellow: 90+ days, red: 180+ days)</li>
          <li>• Use filters to narrow down by category or supplier</li>
          <li>• Export to Excel or PDF for external analysis</li>
          <li>• Drag column headers to the group panel to organize data</li>
        </ul>
      </div>
    </div>
  )
}
