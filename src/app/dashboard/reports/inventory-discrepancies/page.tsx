'use client'

import { useState, useCallback } from 'react'
import {
  ArrowPathIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  printTable,
  ExportColumn,
} from '@/lib/exportUtils'
import { toast } from 'sonner'

interface DiscrepancyRow {
  productId: number
  product: string
  variation: string
  sku: string
  location: string
  onHand: number
  ledgerTotal: number
  difference: number
  internalDrift: number
  lastMovement: string | null
}

const SUPER_ADMIN_ROLES = ['Super Admin', 'System Administrator', 'Super Admin (Legacy)']

export default function InventoryDiscrepanciesPage() {
  const { hasAnyRole } = usePermissions()
  const isSuperAdmin = hasAnyRole(SUPER_ADMIN_ROLES)

  const [rows, setRows] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports/inventory-discrepancies')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load report')
      }
      setRows(json.data.rows)
      setGeneratedAt(json.data.generatedAt)
      setHasRun(true)
      if (json.data.rows.length === 0) {
        toast.success('No discrepancies found — inventory matches history.')
      } else {
        toast.warning(`${json.data.rows.length} discrepancy item(s) found.`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [])

  const exportColumns: ExportColumn[] = [
    { id: 'product', label: 'Product', getValue: (r) => r.product },
    { id: 'variation', label: 'Variation', getValue: (r) => r.variation },
    { id: 'sku', label: 'SKU', getValue: (r) => r.sku },
    { id: 'location', label: 'Location', getValue: (r) => r.location },
    { id: 'onHand', label: 'On-Hand', getValue: (r) => r.onHand },
    { id: 'ledgerTotal', label: 'Ledger Total', getValue: (r) => r.ledgerTotal },
    { id: 'difference', label: 'Difference', getValue: (r) => r.difference },
    { id: 'internalDrift', label: 'Internal Drift', getValue: (r) => r.internalDrift },
    {
      id: 'lastMovement',
      label: 'Last Movement',
      getValue: (r) => (r.lastMovement ? new Date(r.lastMovement).toLocaleString() : ''),
    },
  ]

  const exportOpts = {
    filename: 'inventory-discrepancies',
    columns: exportColumns,
    data: rows,
    title: 'Inventory Discrepancies',
  }

  const guardExport = () => {
    if (rows.length === 0) {
      toast.error('No data to export')
      return false
    }
    return true
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              The Inventory Discrepancies report is available to Super Admin only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const totalAbsDiff = rows.reduce((s, r) => s + Math.abs(r.difference), 0)

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
            Inventory Discrepancies
          </CardTitle>
          <CardDescription>
            Products where on-hand stock does not match the movement ledger (item history).
            Compares products that have movement history. Read-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="success"
              size="sm"
              className="gap-2"
              onClick={fetchData}
              disabled={loading}
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Checking…' : 'Check Now'}
            </Button>

            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
                onClick={() => guardExport() && exportToCSV(exportOpts)}
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
                onClick={() => guardExport() && exportToExcel(exportOpts)}
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
                onClick={() => guardExport() && exportToPDF(exportOpts)}
              >
                <DocumentTextIcon className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                onClick={() => guardExport() && printTable(exportOpts)}
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          {/* Summary */}
          {hasRun && (
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1">
                Discrepancies: <strong>{rows.length}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1">
                Total absolute difference: <strong>{totalAbsDiff}</strong>
              </span>
              {generatedAt && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1 text-gray-600 dark:text-gray-300">
                  Checked: {new Date(generatedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Results */}
          {!hasRun ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click <strong>Check Now</strong> to scan all products for inventory-vs-history
              discrepancies.
            </p>
          ) : rows.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 px-4 py-3 text-green-700 dark:text-green-300">
              <CheckCircleIcon className="h-5 w-5" />
              No discrepancies found — inventory matches history.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">Variation</th>
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold text-right">On-Hand</th>
                    <th className="px-3 py-2 font-semibold text-right">Ledger Total</th>
                    <th className="px-3 py-2 font-semibold text-right">Difference</th>
                    <th className="px-3 py-2 font-semibold text-right">Internal Drift</th>
                    <th className="px-3 py-2 font-semibold">Last Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.productId}-${r.location}-${i}`}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-3 py-2">{r.product}</td>
                      <td className="px-3 py-2">{r.variation}</td>
                      <td className="px-3 py-2">{r.sku}</td>
                      <td className="px-3 py-2">{r.location}</td>
                      <td className="px-3 py-2 text-right">{r.onHand}</td>
                      <td className="px-3 py-2 text-right">{r.ledgerTotal}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          r.difference !== 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500'
                        }`}
                      >
                        {r.difference > 0 ? `+${r.difference}` : r.difference}
                      </td>
                      <td className="px-3 py-2 text-right">{r.internalDrift}</td>
                      <td className="px-3 py-2">
                        {r.lastMovement ? new Date(r.lastMovement).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
