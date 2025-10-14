'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardDocumentCheckIcon,
  EyeIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface QCInspection {
  id: number
  inspectionNumber: string
  inspectionDate: string
  status: string
  overallResult: string | null
  purchaseReceipt: {
    grnNumber: string
    purchase: {
      purchaseOrderNumber: string
      supplier: {
        name: string
      }
    }
  }
  _count: {
    items: number
    checkItems: number
  }
}

export default function QCInspectionsPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [inspections, setInspections] = useState<QCInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchInspections()
  }, [statusFilter])

  const fetchInspections = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const res = await fetch(`/api/qc-inspections?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch inspections')

      const data = await res.json()
      setInspections(data.data || [])
    } catch (error: any) {
      console.error('Error fetching inspections:', error)
      toast.error('Failed to load QC inspections')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Pending</Badge>
      case 'inspected':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Inspected</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getResultBadge = (result: string | null) => {
    if (!result) return null

    switch (result) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Passed</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      case 'conditional':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Conditional</Badge>
      default:
        return <Badge>{result}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredInspections = inspections.filter(inspection => {
    const searchLower = searchTerm.toLowerCase()
    return (
      inspection.inspectionNumber.toLowerCase().includes(searchLower) ||
      inspection.purchaseReceipt.grnNumber.toLowerCase().includes(searchLower) ||
      inspection.purchaseReceipt.purchase.purchaseOrderNumber.toLowerCase().includes(searchLower) ||
      inspection.purchaseReceipt.purchase.supplier.name.toLowerCase().includes(searchLower)
    )
  })

  if (!can(PERMISSIONS.QC_INSPECTION_VIEW)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view QC inspections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="w-8 h-8" />
            Quality Control Inspections
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage quality control inspections for received goods
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectItem value="all" className="text-gray-900 dark:text-white">All Statuses</SelectItem>
              <SelectItem value="pending" className="text-gray-900 dark:text-white">Pending</SelectItem>
              <SelectItem value="inspected" className="text-gray-900 dark:text-white">Inspected</SelectItem>
              <SelectItem value="approved" className="text-gray-900 dark:text-white">Approved</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="text"
            placeholder="Search by inspection #, GRN #, PO #, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[300px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          />
        </div>
      </div>

      {/* Inspections List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading QC inspections...
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No QC inspections found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Inspection #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    GRN / PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Items / Checks
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInspections.map((inspection) => (
                  <tr
                    key={inspection.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {inspection.inspectionNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(inspection.inspectionDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {inspection.purchaseReceipt.grnNumber}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {inspection.purchaseReceipt.purchase.purchaseOrderNumber}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {inspection.purchaseReceipt.purchase.supplier.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(inspection.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getResultBadge(inspection.overallResult)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {inspection._count.items} items / {inspection._count.checkItems} checks
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/qc-inspections/${inspection.id}`)}
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
