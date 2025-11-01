'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  Package,
  Download,
  RefreshCw
} from 'lucide-react'
import { DataTable, DataTableColumn } from '@/components/DataTable'

interface InventoryCorrection {
  id: number
  systemCount: number
  physicalCount: number
  difference: number
  reason: string
  status: string
  createdAt: string
  approvedAt: string | null
  product: {
    name: string
    sku: string
  }
  productVariation: {
    name: string
  }
  location: {
    name: string
  }
  createdByUser: {
    username: string
    firstName: string | null
    lastName: string | null
  }
  approvedByUser: {
    username: string
    firstName: string | null
    lastName: string | null
  } | null
}

interface ReportSummary {
  totalCorrections: number
  pendingCorrections: number
  approvedCorrections: number
  totalIncreases: number
  totalDecreases: number
  netChange: number
}

export default function InventoryCorrectionsReportPageOptimized() {
  const router = useRouter()
  const { can } = usePermissions()
  const [corrections, setCorrections] = useState<InventoryCorrection[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState<ReportSummary>({
    totalCorrections: 0,
    pendingCorrections: 0,
    approvedCorrections: 0,
    totalIncreases: 0,
    totalDecreases: 0,
    netChange: 0
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    status: '',
    locationId: ''
  })

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You do not have permission to view this report.</p>
        </div>
      </div>
    )
  }

  // Fetch corrections with pagination
  const fetchCorrections = useCallback(async (page: number = 1, limit: number = 50) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (filters.status) {
        params.append('status', filters.status)
      }

      if (filters.locationId) {
        params.append('locationId', filters.locationId)
      }

      const res = await fetch(`/api/inventory-corrections?${params}`)

      if (res.ok) {
        const data = await res.json()
        setCorrections(data.corrections || [])
        setCurrentPage(data.pagination?.page || page)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalCount(data.pagination?.total || 0)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to fetch corrections')
      }
    } catch (error) {
      console.error('Error fetching corrections:', error)
      toast.error('Failed to fetch corrections')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Generate full report summary (lazy load)
  const generateReport = useCallback(async () => {
    try {
      setGenerating(true)
      
      // Fetch summary data only (not full records)
      const params = new URLSearchParams({
        page: '1',
        limit: '10000' // Get all for summary calculation
      })

      if (filters.status) {
        params.append('status', filters.status)
      }

      if (filters.locationId) {
        params.append('locationId', filters.locationId)
      }

      const res = await fetch(`/api/inventory-corrections?${params}`)

      if (res.ok) {
        const data = await res.json()
        const allCorrections = data.corrections || []
        calculateSummary(allCorrections)
        toast.success('Report generated successfully')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }, [filters])

  const calculateSummary = (data: InventoryCorrection[]) => {
    const summary: ReportSummary = {
      totalCorrections: data.length,
      pendingCorrections: data.filter(c => c.status === 'pending').length,
      approvedCorrections: data.filter(c => c.status === 'approved').length,
      totalIncreases: data.filter(c => c.difference > 0).reduce((sum, c) => sum + c.difference, 0),
      totalDecreases: Math.abs(data.filter(c => c.difference < 0).reduce((sum, c) => sum + c.difference, 0)),
      netChange: data.reduce((sum, c) => sum + c.difference, 0)
    }
    setSummary(summary)
  }

  // Load first page on mount (not all data)
  useEffect(() => {
    fetchCorrections(1, 50)
  }, [fetchCorrections])

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchCorrections(page, 50)
  }

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  // Columns definition
  const columns: DataTableColumn<InventoryCorrection>[] = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.id}</span>
    },
    {
      accessorKey: 'product.name',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product.name}</div>
          <div className="text-xs text-gray-500">{row.original.product.sku}</div>
        </div>
      )
    },
    {
      accessorKey: 'productVariation.name',
      header: 'Variation',
      cell: ({ row }) => row.original.productVariation.name
    },
    {
      accessorKey: 'location.name',
      header: 'Location',
      cell: ({ row }) => row.original.location.name
    },
    {
      accessorKey: 'systemCount',
      header: 'System Count',
      cell: ({ row }) => <span className="font-mono">{row.original.systemCount}</span>
    },
    {
      accessorKey: 'physicalCount',
      header: 'Physical Count',
      cell: ({ row }) => <span className="font-mono">{row.original.physicalCount}</span>
    },
    {
      accessorKey: 'difference',
      header: 'Difference',
      cell: ({ row }) => {
        const diff = row.original.difference
        const isPositive = diff > 0
        return (
          <span className={`font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{diff}
          </span>
        )
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status
        const variants: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          approved: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800'
        }
        return (
          <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        )
      }
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => <span className="text-sm">{row.original.reason || 'N/A'}</span>
    },
    {
      accessorKey: 'createdByUser',
      header: 'Created By',
      cell: ({ row }) => {
        const user = row.original.createdByUser
        return (
          <div>
            <div className="font-medium">{user.username}</div>
            {(user.firstName || user.lastName) && (
              <div className="text-xs text-gray-500">
                {[user.firstName, user.lastName].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return (
          <div>
            <div>{date.toLocaleDateString()}</div>
            <div className="text-xs text-gray-500">{date.toLocaleTimeString()}</div>
          </div>
        )
      }
    }
  ], [])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Inventory Corrections Report (Optimized)
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Server-side pagination for optimal performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={generateReport}
            disabled={generating}
            variant="outline"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Full Report
              </>
            )}
          </Button>
          <Button
            onClick={() => fetchCorrections(currentPage, 50)}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Corrections</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCorrections.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">All time corrections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pendingCorrections.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Increases</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{summary.totalIncreases.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Stock increases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Decreases</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{summary.totalDecreases.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Stock decreases</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter corrections by status and location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Location</label>
              <input
                type="text"
                value={filters.locationId}
                onChange={(e) => handleFilterChange('locationId', e.target.value)}
                placeholder="Location ID"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table with Pagination */}
      <Card>
        <CardHeader>
          <CardTitle>Correction Records</CardTitle>
          <CardDescription>
            Showing {corrections.length} of {totalCount.toLocaleString()} corrections (Page {currentPage} of {totalPages})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading corrections...</p>
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={corrections}
                searchPlaceholder="Search by product, location, or user..."
                enableGlobalFilter={true}
                enableColumnFilters={true}
                enableExport={true}
                exportFileName="inventory-corrections-report"
                enableColumnVisibility={true}
                pageSize={50}
              />
              
              {/* Custom Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(currentPage - 1) * 50 + 1} to {Math.min(currentPage * 50, totalCount)} of {totalCount.toLocaleString()} corrections
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
