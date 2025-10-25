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
  Export,
  Summary,
  TotalItem,
  GroupPanel,
  Grouping,
  SearchPanel,
  FilterRow,
  Paging,
  Pager,
  Selection,
  MasterDetail
} from 'devextreme-react/data-grid'
import { formatCurrency } from '@/lib/currencyUtils'
import { toast } from 'sonner'
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface VarianceDetection {
  variationId: number
  locationId: number
  productId: number
  productName: string
  productSku: string
  variationName: string
  locationName: string
  ledgerBalance: number
  systemBalance: number
  physicalCount: number | null
  variance: number
  variancePercentage: number
  varianceType: 'overage' | 'shortage' | 'match'
  lastTransactionDate: Date | null
  lastTransactionType: string | null
  unitCost: number
  varianceValue: number
  requiresInvestigation: boolean
  autoFixable: boolean
  metadata?: {
    totalTransactions: number
    recentTransactionCount: number
    suspiciousActivity: boolean
  }
}

interface ReconciliationReport {
  reportDate: string
  businessId: number
  locationId?: number
  reconciliationType: string
  variances: VarianceDetection[]
  summary: {
    totalVariances: number
    overages: number
    shortages: number
    matches: number
    totalVarianceValue: number
    totalOverageValue: number
    totalShortageValue: number
    requiresInvestigation: number
    autoFixable: number
  }
  fixResults?: {
    fixed: number
    errors: string[]
    details: any[]
  }
}

interface BusinessLocation {
  id: number
  name: string
}

export default function ReconciliationReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedVariations, setSelectedVariations] = useState<number[]>([])
  const [investigatingVariation, setInvestigatingVariation] = useState<number | null>(null)

  // Permission check
  if (!can(PERMISSIONS.REPORT_VIEW)) {
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
    fetchReconciliation()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchReconciliation = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }

      const response = await fetch(`/api/reports/reconciliation?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch reconciliation report')
      }

      const result = await response.json()
      setReport(result.report)

      toast.success('Reconciliation report loaded')
    } catch (error: any) {
      console.error('Error fetching reconciliation:', error)
      toast.error(error.message || 'Failed to load reconciliation report')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation])

  const handleAutoFix = async () => {
    if (!can(PERMISSIONS.INVENTORY_CORRECTION)) {
      toast.error('You do not have permission to fix variances')
      return
    }

    if (!confirm('Auto-fix all small variances (≤5% and ≤10 units)?\n\nThis will create correction transactions.')) {
      return
    }

    try {
      setFixing(true)

      const params = new URLSearchParams()
      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }
      params.append('autoFix', 'true')

      const response = await fetch(`/api/reports/reconciliation?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to auto-fix variances')
      }

      const result = await response.json()

      if (result.report?.fixResults) {
        const { fixed, errors } = result.report.fixResults
        if (fixed > 0) {
          toast.success(`Successfully fixed ${fixed} variance(s)`)
        }
        if (errors.length > 0) {
          toast.error(`${errors.length} error(s) occurred during auto-fix`)
        }
      }

      // Reload report
      await fetchReconciliation()

    } catch (error: any) {
      console.error('Error auto-fixing:', error)
      toast.error(error.message || 'Failed to auto-fix variances')
    } finally {
      setFixing(false)
    }
  }

  const handleManualFix = async () => {
    if (!can(PERMISSIONS.INVENTORY_CORRECTION)) {
      toast.error('You do not have permission to fix variances')
      return
    }

    if (selectedVariations.length === 0) {
      toast.error('Please select variances to fix')
      return
    }

    if (!confirm(`Fix ${selectedVariations.length} selected variance(s)?\n\nThis will create correction transactions.`)) {
      return
    }

    try {
      setFixing(true)

      const response = await fetch('/api/reports/reconciliation/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variationIds: selectedVariations,
          locationId: selectedLocation !== 'all' ? parseInt(selectedLocation) : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fix variances')
      }

      const result = await response.json()

      if (result.fixResults) {
        const { fixed, errors } = result.fixResults
        if (fixed > 0) {
          toast.success(`Successfully fixed ${fixed} variance(s)`)
        }
        if (errors.length > 0) {
          toast.error(`${errors.length} error(s) occurred`)
        }
      }

      // Clear selection and reload
      setSelectedVariations([])
      await fetchReconciliation()

    } catch (error: any) {
      console.error('Error fixing variances:', error)
      toast.error(error.message || 'Failed to fix variances')
    } finally {
      setFixing(false)
    }
  }

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }
      params.append('format', 'csv')

      window.open(`/api/reports/reconciliation?${params.toString()}`, '_blank')
      toast.success('CSV export started')
    } catch (error) {
      toast.error('Failed to export CSV')
    }
  }

  const renderDetailTemplate = (data: any) => {
    const variance = data.data as VarianceDetection

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
              Transaction History
            </h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Total Transactions:</span>{' '}
                {variance.metadata?.totalTransactions || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Recent (30d):</span>{' '}
                {variance.metadata?.recentTransactionCount || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Last Transaction:</span>{' '}
                {variance.lastTransactionDate
                  ? new Date(variance.lastTransactionDate).toLocaleDateString()
                  : 'N/A'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Last Type:</span>{' '}
                {variance.lastTransactionType || 'N/A'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
              Variance Analysis
            </h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Variance Amount:</span>{' '}
                <span className={variance.variance > 0 ? 'text-green-600' : 'text-red-600'}>
                  {variance.variance > 0 ? '+' : ''}{variance.variance}
                </span>
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Variance Value:</span>{' '}
                <span className={variance.varianceValue > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(variance.varianceValue)}
                </span>
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Auto-Fixable:</span>{' '}
                {variance.autoFixable ? (
                  <span className="text-green-600 font-medium">YES</span>
                ) : (
                  <span className="text-orange-600 font-medium">NO - Requires Investigation</span>
                )}
              </p>
              {variance.metadata?.suspiciousActivity && (
                <p className="text-red-600 font-medium">
                  ⚠️ Suspicious activity detected
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Stock Reconciliation Detective
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Detect and fix discrepancies between ledger and system stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportToCSV}
            disabled={loading || !report}
            variant="outline"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={fetchReconciliation}
            disabled={loading}
            variant="outline"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Location Filter */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Location
              </label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2 md:col-span-3">
              {can(PERMISSIONS.INVENTORY_CORRECTION) && (
                <>
                  <Button
                    onClick={handleAutoFix}
                    disabled={loading || fixing || !report || report.summary.autoFixable === 0}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <WrenchScrewdriverIcon className="w-4 h-4 mr-2" />
                    Auto-Fix Small Variances ({report?.summary.autoFixable || 0})
                  </Button>
                  <Button
                    onClick={handleManualFix}
                    disabled={loading || fixing || selectedVariations.length === 0}
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Fix Selected ({selectedVariations.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Variances</p>
                  <p className="text-3xl font-bold mt-2">
                    {report.summary.totalVariances}
                  </p>
                </div>
                <ExclamationTriangleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Requires Investigation</p>
                  <p className="text-3xl font-bold mt-2">
                    {report.summary.requiresInvestigation}
                  </p>
                </div>
                <MagnifyingGlassIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Auto-Fixable</p>
                  <p className="text-3xl font-bold mt-2">
                    {report.summary.autoFixable}
                  </p>
                </div>
                <ShieldCheckIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Variance Value</p>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(Math.abs(report.summary.totalVarianceValue))}
                  </p>
                </div>
                <DocumentTextIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Variances Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Variances</CardTitle>
        </CardHeader>
        <CardContent>
          <DataGrid
            dataSource={report?.variances || []}
            showBorders={true}
            columnAutoWidth={true}
            allowColumnResizing={true}
            height={600}
            keyExpr="variationId"
            onSelectionChanged={(e) => {
              const keys = e.selectedRowKeys as number[]
              setSelectedVariations(keys)
            }}
          >
            <Selection mode="multiple" showCheckBoxesMode="always" />
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search variances..." />
            <FilterRow visible={true} />
            <Paging enabled={true} defaultPageSize={50} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[25, 50, 100]}
              showNavigationButtons={true}
            />

            <Grouping autoExpandAll={false} />

            <Column
              dataField="locationName"
              caption="Location"
              width={150}
              groupIndex={0}
            />
            <Column
              dataField="productName"
              caption="Product"
              width={200}
            />
            <Column
              dataField="productSku"
              caption="SKU"
              width={100}
            />
            <Column
              dataField="variationName"
              caption="Variation"
              width={120}
            />
            <Column
              dataField="ledgerBalance"
              caption="Ledger Balance"
              dataType="number"
              format="#,##0.00"
              alignment="right"
              width={130}
            />
            <Column
              dataField="systemBalance"
              caption="System Balance"
              dataType="number"
              format="#,##0.00"
              alignment="right"
              width={130}
            />
            <Column
              dataField="variance"
              caption="Variance"
              dataType="number"
              format="#,##0.00"
              alignment="right"
              width={100}
              cellRender={(cellData: any) => (
                <span className={cellData.value > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {cellData.value > 0 ? '+' : ''}{cellData.value.toFixed(2)}
                </span>
              )}
            />
            <Column
              dataField="variancePercentage"
              caption="Variance %"
              dataType="number"
              format="#,##0.00"
              alignment="right"
              width={110}
              cellRender={(cellData: any) => (
                <span className={Math.abs(cellData.value) > 5 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                  {cellData.value.toFixed(2)}%
                </span>
              )}
            />
            <Column
              dataField="varianceValue"
              caption="Variance Value"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={130}
              cellRender={(cellData: any) => (
                <span className={cellData.value > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(cellData.value)}
                </span>
              )}
            />
            <Column
              dataField="varianceType"
              caption="Type"
              width={100}
              cellRender={(cellData: any) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  cellData.value === 'overage'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {cellData.value.toUpperCase()}
                </span>
              )}
            />
            <Column
              dataField="autoFixable"
              caption="Auto-Fixable"
              width={110}
              cellRender={(cellData: any) => (
                cellData.value ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-orange-600" />
                )
              )}
            />

            <Summary>
              <TotalItem column="variance" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="varianceValue" summaryType="sum" valueFormat="₱#,##0.00" />
            </Summary>

            <MasterDetail
              enabled={true}
              render={renderDetailTemplate}
            />

            <Export enabled={true} allowExportSelectedData={true} />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About Stock Reconciliation
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              <strong>Ledger vs System:</strong> Compares StockTransaction ledger balance with VariationLocationDetails system balance.
            </p>
            <p>
              <strong>Auto-Fix Criteria:</strong> Variance ≤ 5% AND absolute variance ≤ 10 units AND variance value ≤ ₱1,000
            </p>
            <p>
              <strong>Investigation Required:</strong> Variance &gt; 5% OR absolute variance &gt; 10 units OR variance value &gt; ₱1,000
            </p>
            <p className="mt-2">
              <strong>Variance Types:</strong>
            </p>
            <ul className="list-disc list-inside ml-4">
              <li><strong>Overage</strong> - System balance is higher than ledger (unexpected stock)</li>
              <li><strong>Shortage</strong> - System balance is lower than ledger (missing stock)</li>
            </ul>
            <p className="mt-2 text-orange-700 dark:text-orange-300 font-medium">
              ⚠️ Always investigate variances before fixing. Auto-fix should only be used for small, expected variances.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
