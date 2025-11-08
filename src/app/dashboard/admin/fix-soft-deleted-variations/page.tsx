'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DataGrid, {
  Column,
  Selection,
  Paging,
  SearchPanel,
  Toolbar,
  Item as ToolbarItem,
  Export,
  Sorting
} from 'devextreme-react/data-grid'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface DeletedVariation {
  variationId: number
  variationName: string
  variationSku: string
  isDefault: boolean
  deletedAt: string | null
}

interface AffectedProduct {
  productId: number
  productName: string
  productSku: string
  productType: string
  categoryName: string
  isActive: boolean
  enableStock: boolean
  createdAt: string
  updatedAt: string
  deletedVariations: DeletedVariation[]
}

interface IssuesData {
  totalAffected: number
  totalDeletedVariations: number
  issues: AffectedProduct[]
}

export default function FixSoftDeletedVariationsPage() {
  const { can, hasRole, user } = usePermissions()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [data, setData] = useState<IssuesData | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [lastScan, setLastScan] = useState<Date | null>(null)
  const [fixResult, setFixResult] = useState<string | null>(null)

  // Check permissions
  useEffect(() => {
    if (!can(PERMISSIONS.SUPER_ADMIN)) {
      router.push('/dashboard')
    }
  }, [can, router])

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchIssues()
    }
  }, [user])

  const fetchIssues = async () => {
    setScanning(true)
    setFixResult(null)
    try {
      const response = await fetch('/api/admin/fix-soft-deleted-variations')
      const result = await response.json()

      if (result.success) {
        setData(result)
        setLastScan(new Date())
      } else {
        alert('Error: ' + (result.error || 'Failed to scan for issues'))
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
      alert('Failed to scan for issues')
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }

  const handleFix = async () => {
    if (selectedProductIds.length === 0) {
      alert('Please select at least one product to fix')
      return
    }

    if (!confirm(`Are you sure you want to restore ${selectedProductIds.length} product(s)?\n\nThis will restore all soft-deleted variations for the selected products and refresh the stock view.`)) {
      return
    }

    setFixing(true)
    setFixResult(null)

    try {
      const response = await fetch('/api/admin/fix-soft-deleted-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProductIds })
      })

      const result = await response.json()

      if (result.success) {
        setFixResult(`✅ Success: ${result.message}`)
        setSelectedProductIds([])
        // Refresh the list after 2 seconds
        setTimeout(() => {
          fetchIssues()
        }, 2000)
      } else {
        setFixResult(`❌ Error: ${result.error || 'Failed to fix variations'}`)
      }
    } catch (error) {
      console.error('Error fixing variations:', error)
      setFixResult('❌ Error: Failed to fix variations')
    } finally {
      setFixing(false)
    }
  }

  const handleFixAll = async () => {
    if (!data || data.issues.length === 0) {
      alert('No issues to fix')
      return
    }

    if (!confirm(`⚠️ FIX ALL PRODUCTS?\n\nThis will restore ${data.totalDeletedVariations} soft-deleted variation(s) across ${data.totalAffected} product(s).\n\nAre you absolutely sure?`)) {
      return
    }

    const allProductIds = data.issues.map(p => p.productId)
    setSelectedProductIds(allProductIds)

    // Small delay to update UI
    setTimeout(() => {
      handleFix()
    }, 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheckIcon className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Fix Soft-Deleted Variations
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Super Admin Tool - Detect and restore product variations that were accidentally soft-deleted
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                What This Tool Does
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                This tool detects <strong>active products</strong> that have <strong>soft-deleted variations</strong>.
                This usually happens when a product is edited and variations are accidentally marked as deleted.
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Impact:</strong> Products with soft-deleted variations won't appear in inventory reports,
                stock views, or sales/purchase screens, even though they have stock and are marked as active.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Affected Products</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {data?.totalAffected || 0}
                </p>
              </div>
              {data && data.totalAffected > 0 ? (
                <XCircleIcon className="w-12 h-12 text-red-500" />
              ) : (
                <CheckCircleIcon className="w-12 h-12 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Deleted Variations</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {data?.totalDeletedVariations || 0}
                </p>
              </div>
              <ExclamationTriangleIcon className="w-12 h-12 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Scan</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {lastScan ? lastScan.toLocaleTimeString() : 'Never'}
                </p>
              </div>
              <ArrowPathIcon className="w-12 h-12 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          onClick={fetchIssues}
          disabled={scanning}
          variant="outline"
          className="gap-2"
        >
          <ArrowPathIcon className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan for Issues'}
        </Button>

        {data && data.totalAffected > 0 && (
          <>
            <Button
              onClick={handleFix}
              disabled={fixing || selectedProductIds.length === 0}
              variant="default"
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {fixing ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Fix Selected ({selectedProductIds.length})
                </>
              )}
            </Button>

            <Button
              onClick={handleFixAll}
              disabled={fixing}
              variant="destructive"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Fix All ({data.totalAffected})
            </Button>
          </>
        )}
      </div>

      {/* Fix Result */}
      {fixResult && (
        <Card className={`mb-6 ${fixResult.startsWith('✅') ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}>
          <CardContent className="pt-6">
            <p className={`${fixResult.startsWith('✅') ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'}`}>
              {fixResult}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Grid */}
      {data && data.issues.length > 0 ? (
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">
              Products with Soft-Deleted Variations
            </CardTitle>
            <CardDescription>
              Select products to restore their variations. This will make them visible in inventory reports again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataGrid
              dataSource={data.issues}
              keyExpr="productId"
              showBorders={true}
              rowAlternationEnabled={true}
              selectedRowKeys={selectedProductIds}
              onSelectionChanged={(e) => setSelectedProductIds(e.selectedRowKeys)}
            >
              <Selection mode="multiple" showCheckBoxesMode="always" />
              <Paging defaultPageSize={20} />
              <SearchPanel visible={true} />
              <Sorting mode="multiple" />
              <Export enabled={true} fileName="soft-deleted-variations" />

              <Column
                dataField="productId"
                caption="Product ID"
                width={100}
              />
              <Column
                dataField="productName"
                caption="Product Name"
                width={250}
              />
              <Column
                dataField="productSku"
                caption="SKU"
                width={120}
              />
              <Column
                dataField="productType"
                caption="Type"
                width={100}
              />
              <Column
                dataField="categoryName"
                caption="Category"
                width={150}
              />
              <Column
                dataField="deletedVariations"
                caption="Deleted Variations"
                cellRender={(data) => {
                  const variations = data.value as DeletedVariation[]
                  return (
                    <div className="text-sm">
                      <span className="font-semibold text-red-600">{variations.length}</span>
                      {' '}variation(s): {variations.map(v => v.variationName).join(', ')}
                    </div>
                  )
                }}
              />
              <Column
                dataField="updatedAt"
                caption="Last Updated"
                width={180}
                dataType="datetime"
              />

              <Toolbar>
                <ToolbarItem name="searchPanel" />
                <ToolbarItem name="exportButton" />
              </Toolbar>
            </DataGrid>
          </CardContent>
        </Card>
      ) : data && data.issues.length === 0 ? (
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <CardContent className="py-12 text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-900 dark:text-green-200 mb-2">
              All Clear!
            </h3>
            <p className="text-green-800 dark:text-green-300">
              No products found with soft-deleted variations. Everything looks good!
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
