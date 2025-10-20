"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowPathIcon, CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import PivotGrid, {
  FieldChooser,
  FieldPanel,
  Export,
  Scrolling,
  LoadPanel,
} from 'devextreme-react/pivot-grid'
import PivotGridDataSource from 'devextreme/ui/pivot_grid/data_source'
import { exportPivotGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

// Import DevExtreme styles
import 'devextreme/dist/css/dx.light.css'

interface AnalyticsFilters {
  startDate: string
  endDate: string
  locationIds: number[]
  categoryIds: number[]
  brandIds: number[]
}

interface MetadataOption {
  id: number
  name: string
}

interface AnalyticsMetadata {
  locations: MetadataOption[]
  categories: MetadataOption[]
  brands: MetadataOption[]
  totalSales: number
  totalRevenue: number
  totalProfit: number
  totalQuantity: number
  totalStockValue: number
  totalStockItems: number
}

export default function DashboardV2Page() {
  const { can } = usePermissions()
  const [showFilters, setShowFilters] = useState(false)
  const [dataSource, setDataSource] = useState<PivotGridDataSource | null>(null)
  const [metadata, setMetadata] = useState<AnalyticsMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<AnalyticsFilters>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    locationIds: [],
    categoryIds: [],
    brandIds: [],
  })

  const hasAccess = can(PERMISSIONS.DASHBOARD_VIEW)

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/dashboard/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const data = await response.json()

      // Configure PivotGrid DataSource
      const pivotDataSource = new PivotGridDataSource({
        fields: [
          // Row Fields - Product Hierarchy
          {
            caption: 'Category',
            dataField: 'categoryName',
            area: 'row',
            expanded: true,
            sortOrder: 'asc',
          },
          {
            caption: 'Brand',
            dataField: 'brandName',
            area: 'row',
            expanded: false,
            sortOrder: 'asc',
          },
          {
            caption: 'Product',
            dataField: 'productName',
            area: 'row',
            expanded: false,
            sortOrder: 'asc',
          },
          {
            caption: 'Variation',
            dataField: 'variationName',
            area: 'row',
            expanded: false,
            visible: false,
          },

          // Column Fields - Time Dimensions
          {
            caption: 'Year',
            dataField: 'year',
            area: 'column',
            expanded: true,
            sortOrder: 'desc',
          },
          {
            caption: 'Quarter',
            dataField: 'quarter',
            area: 'column',
            expanded: true,
            sortOrder: 'desc',
          },
          {
            caption: 'Month',
            dataField: 'monthName',
            area: 'column',
            expanded: false,
            sortOrder: 'desc',
          },
          {
            caption: 'Day',
            dataField: 'day',
            area: 'column',
            expanded: false,
            visible: false,
          },
          {
            caption: 'Day of Week',
            dataField: 'dayOfWeek',
            area: 'column',
            expanded: false,
            visible: false,
          },

          // Filter Fields
          {
            caption: 'Location',
            dataField: 'locationName',
            area: 'filter',
          },
          {
            caption: 'Cashier',
            dataField: 'cashierName',
            area: 'filter',
            visible: can(PERMISSIONS.SALES_REPORT_PER_CASHIER),
          },
          {
            caption: 'Payment Method',
            dataField: 'paymentMethod',
            area: 'filter',
          },
          {
            caption: 'Unit',
            dataField: 'unitName',
            area: 'filter',
            visible: false,
          },

          // Data Fields - Metrics
          {
            caption: 'Revenue',
            dataField: 'revenue',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: {
              type: 'currency',
              precision: 2,
              currency: 'PHP',
            },
          },
          {
            caption: 'Quantity Sold',
            dataField: 'quantity',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: '#,##0',
          },
          {
            caption: 'Profit',
            dataField: 'profit',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: {
              type: 'currency',
              precision: 2,
              currency: 'PHP',
            },
            visible: can(PERMISSIONS.REPORT_PROFITABILITY),
          },
          {
            caption: 'Cost',
            dataField: 'cost',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: {
              type: 'currency',
              precision: 2,
              currency: 'PHP',
            },
            visible: can(PERMISSIONS.PURCHASE_VIEW_COST),
          },
          {
            caption: 'Avg Profit Margin %',
            dataField: 'profitMargin',
            dataType: 'number',
            summaryType: 'avg',
            area: 'data',
            format: '#,##0.00',
            visible: can(PERMISSIONS.REPORT_PROFITABILITY),
          },
          {
            caption: 'Discount',
            dataField: 'discount',
            dataType: 'number',
            summaryType: 'sum',
            area: 'data',
            format: {
              type: 'currency',
              precision: 2,
              currency: 'PHP',
            },
            visible: false,
          },
          {
            caption: 'Avg Unit Price',
            dataField: 'unitPrice',
            dataType: 'number',
            summaryType: 'avg',
            area: 'data',
            format: {
              type: 'currency',
              precision: 2,
              currency: 'PHP',
            },
            visible: false,
          },
          {
            caption: 'Transaction Count',
            dataField: 'saleId',
            dataType: 'number',
            summaryType: 'count',
            area: 'data',
            format: '#,##0',
            visible: false,
          },
        ],
        store: data.salesData,
      })

      setDataSource(pivotDataSource)
      setMetadata(data.metadata)
      toast.success('Analytics data loaded successfully')
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess) {
      fetchAnalyticsData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess])

  // Permission check - show access denied if user doesn't have permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don&apos;t have permission to view this dashboard.</p>
        </div>
      </div>
    )
  }

  const handleExport = (e: { component: unknown }) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Dashboard Analytics')

    exportPivotGrid({
      component: e.component,
      worksheet,
      customizeCell: ({ pivotCell, excelCell }: { pivotCell: { type: string; dataField?: string; value?: number }; excelCell: { font?: { bold?: boolean; color?: { argb: string } }; fill?: { type: string; pattern: string; fgColor: { argb: string } } } }) => {
        // Style header cells
        if (pivotCell.type === 'D') {
          excelCell.font = { bold: true }
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F2F2F2' }
          }
        }
        // Style data cells with conditional formatting
        if (pivotCell.type === 'data') {
          const value = pivotCell.value
          if (pivotCell.dataField === 'profit' && value < 0) {
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC7CE' }
            }
            excelCell.font = { color: { argb: '9C0006' } }
          } else if (pivotCell.dataField === 'profit' && value > 0) {
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'C6EFCE' }
            }
            excelCell.font = { color: { argb: '006100' } }
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `dashboard-analytics-${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Analytics V2
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            Multi-dimensional sales & inventory analysis with interactive pivot grid
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
          >
            <FunnelIcon className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button
            onClick={fetchAnalyticsData}
            variant="outline"
            size="sm"
            className="shadow-sm hover:shadow-md transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            <FunnelIcon className="w-5 h-5 inline mr-2" />
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Locations
              </label>
              <select
                multiple
                value={filters.locationIds.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value))
                  setFilters({ ...filters, locationIds: selected })
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                size={3}
              >
                <option value="">All Locations</option>
                {metadata?.locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={fetchAnalyticsData}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {metadata && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
            <div className="text-xs md:text-sm opacity-90">Total Sales</div>
            <div className="text-xl md:text-3xl font-bold">{metadata.totalSales.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
            <div className="text-xs md:text-sm opacity-90">Revenue</div>
            <div className="text-lg md:text-2xl font-bold">
              ₱{metadata.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          {can(PERMISSIONS.REPORT_PROFITABILITY) && (
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
              <div className="text-xs md:text-sm opacity-90">Profit</div>
              <div className="text-lg md:text-2xl font-bold">
                ₱{metadata.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
            <div className="text-xs md:text-sm opacity-90">Items Sold</div>
            <div className="text-xl md:text-3xl font-bold">{metadata.totalQuantity.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
            <div className="text-xs md:text-sm opacity-90">Stock Value</div>
            <div className="text-lg md:text-2xl font-bold">
              ₱{metadata.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-4 md:p-6 rounded-lg text-white shadow-lg">
            <div className="text-xs md:text-sm opacity-90">Stock Items</div>
            <div className="text-xl md:text-3xl font-bold">{metadata.totalStockItems.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* PivotGrid */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Interactive Pivot Analysis
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag fields between areas to customize your analysis. Right-click on cells for more options.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics data...</p>
            </div>
          </div>
        ) : dataSource ? (
          <PivotGrid
            id="dashboard-pivot"
            dataSource={dataSource}
            allowSortingBySummary={true}
            allowFiltering={true}
            showBorders={true}
            showColumnTotals={true}
            showRowTotals={true}
            showColumnGrandTotals={true}
            showRowGrandTotals={true}
            height={600}
            wordWrapEnabled={false}
            allowExpandAll={true}
            onExporting={handleExport}
            className="text-gray-900 dark:text-gray-100"
          >
            <FieldPanel
              showColumnFields={true}
              showRowFields={true}
              showDataFields={true}
              showFilterFields={true}
              allowFieldDragging={true}
              visible={true}
            />
            <FieldChooser
              enabled={true}
              height={400}
              applyChangesMode="onDemand"
            />
            <Scrolling mode="virtual" />
            <LoadPanel enabled={true} />
            <Export enabled={true} fileName="dashboard-analytics" />
          </PivotGrid>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-600 dark:text-gray-400">No data available. Try adjusting your filters.</p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">How to use the Pivot Grid:</h3>
        <ul className="text-xs md:text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>Drag field names between Row, Column, Filter, and Data areas to reorganize your analysis</li>
          <li>Click on field headers to sort or filter data</li>
          <li>Click the expand/collapse icons to drill down into details</li>
          <li>Use the Field Chooser button (grid icon) to show/hide fields</li>
          <li>Right-click on cells to access additional options</li>
          <li>Click the Export button to download your analysis to Excel with formatting preserved</li>
        </ul>
      </div>
    </div>
  )
}
