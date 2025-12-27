"use client"

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Summary,
  TotalItem,
  GroupPanel,
  Grouping,
  SearchPanel,
  FilterRow,
  Paging,
  Pager,
  Toolbar,
  Item as ToolbarItem
} from 'devextreme-react/data-grid'
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip as PieTooltip,
  Export as PieExport
} from 'devextreme-react/pie-chart'
import { formatCurrency } from '@/lib/currencyUtils'
import { toast } from 'sonner'
import {
  CurrencyDollarIcon,
  CubeIcon,
  ChartBarIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'

interface ValuationData {
  productName: string
  productSku: string
  variationName: string
  variationSku: string
  categoryName: string
  locationName?: string
  currentQty: number
  unitCost: number
  totalValue: number
  method: string
}

interface Summary {
  totalInventoryValue: number
  totalQuantity: number
  itemCount: number
  averageUnitCost: number
  valuationMethod: string
}

interface CategoryBreakdown {
  categoryName: string
  itemCount: number
  totalQuantity: number
  totalValue: number
}

export default function InventoryValuationReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [valuations, setValuations] = useState<ValuationData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedMethod, setSelectedMethod] = useState<string>('avco')
  const [groupByCategory, setGroupByCategory] = useState(true)

  // Permission check
  if (!can(PERMISSIONS.PRODUCT_VIEW)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">You do not have permission to view this report.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    if (locations.length > 0) {
      fetchValuationReport()
    }
  }, [selectedLocation, selectedMethod, groupByCategory, locations])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        const fetchedLocations = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.locations)
              ? data.locations
              : []
        setLocations(fetchedLocations)
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
      toast.error('Failed to load locations')
    }
  }

  const fetchValuationReport = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }
      params.append('method', selectedMethod)
      params.append('groupByCategory', groupByCategory.toString())

      const response = await fetch(`/api/reports/inventory-valuation?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch valuation report')
      }

      const data = await response.json()

      setValuations(data.valuations || [])
      setSummary(data.summary || null)
      setCategoryBreakdown(data.categoryBreakdown || [])

      toast.success('Valuation report generated successfully')
    } catch (error: any) {
      console.error('Error fetching valuation report:', error)
      toast.error(error.message || 'Failed to generate valuation report')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation, selectedMethod, groupByCategory])

  const getMethodDisplay = (method: string) => {
    switch (method) {
      case 'fifo': return 'FIFO (First In, First Out)'
      case 'lifo': return 'LIFO (Last In, First Out)'
      case 'avco': return 'Weighted Average Cost'
      default: return method.toUpperCase()
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Inventory Valuation Report
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            View inventory value using different costing methods
          </p>
        </div>
        <Button
          onClick={fetchValuationReport}
          disabled={loading}
          variant="outline"
        >
          <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location Filter */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Location
              </label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valuation Method */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Valuation Method
              </label>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                  <SelectItem value="lifo">LIFO (Last In, First Out)</SelectItem>
                  <SelectItem value="avco">Weighted Average Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Group By Category */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Group By Category
              </label>
              <Select
                value={groupByCategory.toString()}
                onValueChange={(value) => setGroupByCategory(value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Inventory Value</p>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(summary.totalInventoryValue)}
                  </p>
                </div>
                <CurrencyDollarIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Quantity</p>
                  <p className="text-3xl font-bold mt-2">
                    {summary.totalQuantity.toLocaleString()}
                  </p>
                </div>
                <CubeIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Item Count</p>
                  <p className="text-3xl font-bold mt-2">
                    {summary.itemCount.toLocaleString()}
                  </p>
                </div>
                <ChartBarIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Avg. Unit Cost</p>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(summary.averageUnitCost)}
                  </p>
                </div>
                <DocumentArrowDownIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown Chart */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              dataSource={categoryBreakdown}
              height={350}
            >
              <Series
                argumentField="categoryName"
                valueField="totalValue"
              >
                <Label visible={true} customizeText={(point: any) => `${formatCurrency(point.value)}`}>
                  <Connector visible={true} width={1} />
                </Label>
              </Series>
              <Legend
                verticalAlignment="bottom"
                horizontalAlignment="center"
              />
              <PieTooltip
                enabled={true}
                customizeTooltip={(point: any) => ({
                  text: `${point.argumentText}: ${formatCurrency(point.value)}`
                })}
              />
              <PieExport enabled={true} />
            </PieChart>
          </CardContent>
        </Card>
      )}

      {/* Valuation Data Grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>
              Valuation Details - {getMethodDisplay(selectedMethod)}
            </CardTitle>
            {summary && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {summary.itemCount} products valued at {formatCurrency(summary.totalInventoryValue)}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DataGrid
            dataSource={valuations}
            showBorders={true}
            columnAutoWidth={true}
            allowColumnResizing={true}
            height={600}
            keyExpr="variationSku"
          >
            <GroupPanel visible={groupByCategory} />
            <SearchPanel visible={true} width={240} placeholder="Search products..." />
            <FilterRow visible={true} />
            <ColumnChooser enabled={true} mode="select" height={400}>
              <ColumnChooserSearch enabled={true} />
              <ColumnChooserSelection allowSelectAll={true} />
            </ColumnChooser>
            <Paging enabled={true} defaultPageSize={50} />
            <Pager
              visible={true}
              displayMode="full"
              showPageSizeSelector={true}
              allowedPageSizes={[25, 50, 100, 200]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <Toolbar>
              <ToolbarItem name="groupPanel" />
              <ToolbarItem name="searchPanel" />
              <ToolbarItem name="columnChooserButton" />
            </Toolbar>

            {groupByCategory && <Grouping autoExpandAll={false} />}

            <Column
              dataField="categoryName"
              caption="Category"
              groupIndex={groupByCategory ? 0 : undefined}
            />
            <Column dataField="productName" caption="Product" width={200} />
            <Column dataField="productSku" caption="Product SKU" width={120} />
            <Column dataField="variationName" caption="Variation" width={150} />
            <Column dataField="variationSku" caption="Variation SKU" width={120} />
            {selectedLocation === 'all' && (
              <Column dataField="locationName" caption="Location" width={150} />
            )}
            <Column
              dataField="currentQty"
              caption="Qty on Hand"
              dataType="number"
              format="#,##0.##"
              alignment="right"
              width={120}
            />
            <Column
              dataField="unitCost"
              caption="Unit Cost"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={120}
            />
            <Column
              dataField="totalValue"
              caption="Total Value"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={150}
            />

            <Summary>
              <TotalItem column="currentQty" summaryType="sum" valueFormat="#,##0.##" />
              <TotalItem column="totalValue" summaryType="sum" valueFormat="₱#,##0.00" />
            </Summary>

            <Export enabled={true} allowExportSelectedData={false} />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About {getMethodDisplay(selectedMethod)}
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {selectedMethod === 'fifo' && (
              <>
                <strong>FIFO (First In, First Out)</strong> assumes that the oldest inventory is sold first.
                This method typically results in higher inventory values during periods of inflation.
                Best for: Perishable goods, retail businesses.
              </>
            )}
            {selectedMethod === 'lifo' && (
              <>
                <strong>LIFO (Last In, First Out)</strong> assumes that the newest inventory is sold first.
                This method can provide tax advantages during inflation but is not allowed under IFRS.
                Best for: Non-perishables in inflationary environments.
              </>
            )}
            {selectedMethod === 'avco' && (
              <>
                <strong>Weighted Average Cost</strong> calculates the average cost of all units available for sale.
                This method smooths out price fluctuations and is simple to calculate.
                Best for: Commodities, bulk items, and most general inventory.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
