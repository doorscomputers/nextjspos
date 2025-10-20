'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  Package
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

export default function InventoryCorrectionsReportPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [corrections, setCorrections] = useState<InventoryCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReportSummary>({
    totalCorrections: 0,
    pendingCorrections: 0,
    approvedCorrections: 0,
    totalIncreases: 0,
    totalDecreases: 0,
    netChange: 0
  })

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view this report.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchCorrections()
  }, [])

  const fetchCorrections = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '10000' // Get all for reporting
      })

      const res = await fetch(`/api/inventory-corrections?${params}`)

      if (res.ok) {
        const data = await res.json()
        const filteredCorrections = data.corrections || []
        setCorrections(filteredCorrections)
        calculateSummary(filteredCorrections)
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
  }

  const calculateSummary = (data: InventoryCorrection[]) => {
    const pending = data.filter(c => c.status === 'pending').length
    const approved = data.filter(c => c.status === 'approved').length

    const increases = data
      .filter(c => c.difference > 0)
      .reduce((sum, c) => sum + c.difference, 0)

    const decreases = data
      .filter(c => c.difference < 0)
      .reduce((sum, c) => sum + Math.abs(c.difference), 0)

    const netChange = data.reduce((sum, c) => sum + c.difference, 0)

    setSummary({
      totalCorrections: data.length,
      pendingCorrections: pending,
      approvedCorrections: approved,
      totalIncreases: increases,
      totalDecreases: decreases,
      netChange
    })
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      expired: 'Expired',
      damaged: 'Damaged',
      missing: 'Missing',
      found: 'Found',
      count_error: 'Count Error',
      physical_inventory_count: 'Physical Inventory Count'
    }
    return labels[reason] || reason
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Define columns for DataTable
  const columns: DataTableColumn<InventoryCorrection>[] = useMemo(() => [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      filterType: 'date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString()
    },
    {
      accessorKey: 'location.name',
      header: 'Location',
      filterType: 'text',
      cell: ({ row }) => row.original.location.name
    },
    {
      accessorKey: 'product.name',
      header: 'Product',
      filterType: 'text',
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
      filterType: 'text',
      cell: ({ row }) => (row.original.productVariation.name === 'DUMMY' || row.original.productVariation.name === 'Default') ? '-' : row.original.productVariation.name
    },
    {
      accessorKey: 'systemCount',
      header: 'System',
      enableFiltering: false,
      cell: ({ row }) => <div className="text-right">{row.original.systemCount}</div>
    },
    {
      accessorKey: 'physicalCount',
      header: 'Physical',
      enableFiltering: false,
      cell: ({ row }) => <div className="text-right">{row.original.physicalCount}</div>
    },
    {
      accessorKey: 'difference',
      header: 'Difference',
      enableFiltering: false,
      cell: ({ row }) => (
        <div className="text-right">
          <span className={`font-medium ${row.original.difference > 0 ? 'text-green-600' : row.original.difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {row.original.difference > 0 ? '+' : ''}{row.original.difference}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      filterType: 'select',
      filterOptions: [
        { label: 'Physical Inventory Count', value: 'physical_inventory_count' },
        { label: 'Expired', value: 'expired' },
        { label: 'Damaged', value: 'damaged' },
        { label: 'Missing', value: 'missing' },
        { label: 'Found', value: 'found' },
        { label: 'Count Error', value: 'count_error' },
      ],
      cell: ({ row }) => <div className="text-sm">{getReasonLabel(row.original.reason)}</div>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      filterType: 'select',
      filterOptions: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
      ],
      cell: ({ row }) => getStatusBadge(row.original.status)
    },
    {
      accessorKey: 'createdByUser.username',
      header: 'Created By',
      filterType: 'text',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.createdByUser.firstName || row.original.createdByUser.username}
        </div>
      )
    },
    {
      accessorKey: 'approvedByUser.username',
      header: 'Approved By',
      filterType: 'text',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.approvedByUser
            ? (row.original.approvedByUser.firstName || row.original.approvedByUser.username)
            : '-'}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      enableFiltering: false,
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/dashboard/inventory-corrections/${row.original.id}`)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Details
        </button>
      )
    },
  ], [router])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Corrections Report</h1>
        <p className="text-gray-600 mt-2">Comprehensive analysis of inventory adjustments and corrections</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Corrections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{summary.totalCorrections}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-yellow-600">
              <Calendar className="h-4 w-4" />
              Pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{summary.pendingCorrections}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <FileText className="h-4 w-4" />
              Approved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary.approvedCorrections}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              Total Increases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">+{summary.totalIncreases}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-4 w-4" />
              Total Decreases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">-{summary.totalDecreases}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Net Change
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.netChange > 0 ? 'text-green-600' : summary.netChange < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {summary.netChange > 0 ? '+' : ''}{summary.netChange}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table with Advanced Filtering */}
      <Card>
        <CardHeader>
          <CardTitle>Correction Records</CardTitle>
          <CardDescription>
            Advanced filtering with sortable columns, column-level filters, and date range selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Loading report data...</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={corrections}
              searchPlaceholder="Search by product, location, or user..."
              enableGlobalFilter={true}
              enableColumnFilters={true}
              enableExport={true}
              exportFileName="inventory-corrections-report"
              enableColumnVisibility={true}
              pageSize={25}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
