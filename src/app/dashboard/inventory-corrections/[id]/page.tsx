'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle, Edit, Trash2, Package, MapPin, Calendar, User } from 'lucide-react'

interface InventoryCorrection {
  id: number
  systemCount: number
  physicalCount: number
  difference: number
  reason: string
  remarks: string | null
  status: string
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
    sku: string
  }
  location: {
    id: number
    name: string
  }
  createdByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  }
  approvedByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
  stockTransaction: {
    id: number
    referenceNo: string
    transactionDate: string
    beforeQty: number
    afterQty: number
  } | null
}

export default function InventoryCorrectionDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const { can } = usePermissions()
  const [correction, setCorrection] = useState<InventoryCorrection | null>(null)
  const [loading, setLoading] = useState(true)

  const correctionId = params.id as string

  // Check if current user created this correction (self-approval restriction)
  const currentUserId = session?.user?.id ? Number(session.user.id) : null
  const isOwnCorrection = correction && currentUserId === correction.createdByUser?.id

  useEffect(() => {
    if (correctionId) {
      fetchCorrection()
    }
  }, [correctionId])

  const fetchCorrection = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/inventory-corrections/${correctionId}`)

      if (res.ok) {
        const data = await res.json()
        setCorrection(data.correction)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to fetch inventory correction')
        router.push('/dashboard/inventory-corrections')
      }
    } catch (error) {
      console.error('Error fetching correction:', error)
      toast.error('Failed to fetch inventory correction')
      router.push('/dashboard/inventory-corrections')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!correction) return

    if (!confirm('Are you sure you want to approve this inventory correction? This will update the stock levels and cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory-corrections/${correction.id}/approve`, {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Inventory correction approved successfully')
        fetchCorrection() // Refresh
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to approve inventory correction')
      }
    } catch (error) {
      console.error('Error approving correction:', error)
      toast.error('Failed to approve inventory correction')
    }
  }

  const handleDelete = async () => {
    if (!correction) return

    if (!confirm('Are you sure you want to delete this inventory correction? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory-corrections/${correction.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Inventory correction deleted successfully')
        router.push('/dashboard/inventory-corrections')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete inventory correction')
      }
    } catch (error) {
      console.error('Error deleting correction:', error)
      toast.error('Failed to delete inventory correction')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-lg px-4 py-1">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-lg px-4 py-1">Approved</Badge>
      default:
        return <Badge variant="outline" className="text-lg px-4 py-1">{status}</Badge>
    }
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

  const getDifferenceDisplay = (difference: number) => {
    if (difference > 0) {
      return <span className="text-green-600 font-bold text-2xl">+{difference}</span>
    } else if (difference < 0) {
      return <span className="text-red-600 font-bold text-2xl">{difference}</span>
    }
    return <span className="text-gray-600 text-2xl">0</span>
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading correction details...</p>
        </div>
      </div>
    )
  }

  if (!correction) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Inventory Correction Not Found</h1>
          <Button onClick={() => router.push('/dashboard/inventory-corrections')} className="mt-4">
            Back to List
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/inventory-corrections')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory Corrections
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Correction Details</h1>
            <p className="text-gray-600 mt-1">Correction #{correction.id}</p>
          </div>
          <div>
            {getStatusBadge(correction.status)}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {correction.status === 'pending' && (
        <div className="mb-6 flex gap-3">
          {/* Approve Button - Hidden for own corrections (self-approval restriction) */}
          {can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE) && !isOwnCorrection && (
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Correction
            </Button>
          )}
          {can(PERMISSIONS.INVENTORY_CORRECTION_UPDATE) && (
            <Button
              onClick={() => router.push(`/dashboard/inventory-corrections/${correction.id}/edit`)}
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {can(PERMISSIONS.INVENTORY_CORRECTION_DELETE) && (
            <Button onClick={handleDelete} variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Product Name</label>
              <p className="text-lg font-semibold text-gray-900">{correction.product.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Product SKU</label>
              <p className="text-gray-900">{correction.product.sku}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Variation</label>
              <p className="text-gray-900">
                {(correction.productVariation.name === 'DUMMY' || correction.productVariation.name === 'Default') ? 'N/A (Single Product)' : correction.productVariation.name}
              </p>
            </div>
            {(correction.productVariation.name !== 'DUMMY' && correction.productVariation.name !== 'Default') && (
              <div>
                <label className="text-sm font-medium text-gray-500">Variation SKU</label>
                <p className="text-gray-900">{correction.productVariation.sku}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location & Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Business Location</label>
              <p className="text-lg font-semibold text-gray-900">{correction.location.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Created On</label>
              <p className="text-gray-900">{new Date(correction.createdAt).toLocaleString()}</p>
            </div>
            {correction.approvedAt && (
              <div>
                <label className="text-sm font-medium text-gray-500">Approved On</label>
                <p className="text-gray-900">{new Date(correction.approvedAt).toLocaleString()}</p>
              </div>
            )}
            {correction.updatedAt !== correction.createdAt && (
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-gray-900">{new Date(correction.updatedAt).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Counts */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Stock Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
                <label className="text-sm font-medium text-gray-500">System Count</label>
                <p className="text-3xl font-bold text-gray-900 mt-2">{correction.systemCount}</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                <label className="text-sm font-medium text-gray-500">Physical Count</label>
                <p className="text-3xl font-bold text-blue-900 mt-2">{correction.physicalCount}</p>
              </div>
              <div className={`p-6 rounded-lg border-2 ${correction.difference > 0 ? 'bg-green-50 border-green-200' : correction.difference < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <label className="text-sm font-medium text-gray-500">Difference</label>
                <div className="mt-2">{getDifferenceDisplay(correction.difference)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reason & Remarks */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reason & Remarks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Reason</label>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {getReasonLabel(correction.reason)}
              </p>
            </div>
            {correction.remarks && (
              <div>
                <label className="text-sm font-medium text-gray-500">Remarks</label>
                <p className="text-gray-900 mt-1">{correction.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Created By
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">
              {correction.createdByUser.firstName && correction.createdByUser.lastName
                ? `${correction.createdByUser.firstName} ${correction.createdByUser.lastName}`
                : correction.createdByUser.username}
            </p>
            <p className="text-sm text-gray-500">@{correction.createdByUser.username}</p>
          </CardContent>
        </Card>

        {correction.approvedByUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approved By
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-gray-900">
                {correction.approvedByUser.firstName && correction.approvedByUser.lastName
                  ? `${correction.approvedByUser.firstName} ${correction.approvedByUser.lastName}`
                  : correction.approvedByUser.username}
              </p>
              <p className="text-sm text-gray-500">@{correction.approvedByUser.username}</p>
            </CardContent>
          </Card>
        )}

        {/* Stock Transaction Reference */}
        {correction.stockTransaction && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Stock Transaction</CardTitle>
              <CardDescription>This correction has been applied to inventory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Transaction Reference</label>
                  <p className="text-gray-900 font-mono">{correction.stockTransaction.referenceNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Transaction Date</label>
                  <p className="text-gray-900">{new Date(correction.stockTransaction.transactionDate).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Stock Before</label>
                  <p className="text-gray-900 font-semibold">{correction.stockTransaction.beforeQty}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Stock After</label>
                  <p className="text-gray-900 font-semibold">{correction.stockTransaction.afterQty}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
