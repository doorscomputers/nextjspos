"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, CheckIcon, XMarkIcon, TruckIcon, CheckCircleIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  status: string
  stockDeducted: boolean
  notes: string | null
  createdAt: string
  items: TransferItem[]
}

interface TransferItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  receivedQuantity: string | null
  isVerified: boolean
}

export default function TransferDetailPage() {
  const { can } = usePermissions()
  const params = useParams()
  const router = useRouter()
  const transferId = params.id as string

  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // For verification
  const [verifying, setVerifying] = useState(false)
  const [verificationQuantities, setVerificationQuantities] = useState<{ [key: number]: number }>({})

  // For rejection
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    fetchLocations()
    fetchTransfer()
  }, [transferId])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchTransfer = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/transfers/${transferId}`)
      const data = await response.json()

      if (response.ok) {
        setTransfer(data)

        // Initialize verification quantities
        const quantities: { [key: number]: number } = {}
        data.items?.forEach((item: TransferItem) => {
          quantities[item.id] = parseFloat(item.quantity)
        })
        setVerificationQuantities(quantities)
      } else {
        toast.error(data.error || 'Failed to fetch transfer')
      }
    } catch (error) {
      console.error('Error fetching transfer:', error)
      toast.error('Failed to fetch transfer')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (endpoint: string, successMessage: string, data?: any) => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/transfers/${transferId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {})
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(successMessage)
        fetchTransfer()
      } else {
        toast.error(result.error || `Failed to ${successMessage.toLowerCase()}`)
      }
    } catch (error) {
      console.error(`Error with ${endpoint}:`, error)
      toast.error(`Failed to ${successMessage.toLowerCase()}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitForCheck = () => {
    handleAction('submit-for-check', 'Transfer submitted for checking')
  }

  const handleApprove = () => {
    handleAction('check-approve', 'Transfer approved')
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    await handleAction('check-reject', 'Transfer rejected', { reason: rejectionReason })
    setShowRejectDialog(false)
    setRejectionReason('')
  }

  const handleSend = () => {
    if (!confirm('Are you sure? Stock will be deducted from origin location.')) return
    handleAction('send', 'Transfer sent - stock deducted')
  }

  const handleMarkArrived = () => {
    handleAction('mark-arrived', 'Transfer marked as arrived')
  }

  const handleStartVerification = () => {
    handleAction('start-verification', 'Verification started')
  }

  const handleVerifyItem = async (itemId: number) => {
    const quantity = verificationQuantities[itemId]
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid received quantity')
      return
    }

    await handleAction('verify-item', 'Item verified', {
      itemId,
      receivedQuantity: quantity
    })
  }

  const handleComplete = () => {
    if (!confirm('Complete this transfer? Stock will be added to destination location.')) return
    handleAction('complete', 'Transfer completed - stock added to destination')
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this transfer? This action cannot be undone.')) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/transfers/${transferId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Transfer cancelled')
        router.push('/dashboard/transfers')
      } else {
        toast.error(data.error || 'Failed to cancel transfer')
      }
    } catch (error) {
      console.error('Error cancelling transfer:', error)
      toast.error('Failed to cancel transfer')
    } finally {
      setActionLoading(false)
    }
  }

  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId)
    return location?.name || `Location ${locationId}`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'draft': { variant: 'secondary', label: 'Draft' },
      'pending_check': { variant: 'secondary', label: 'Pending Check' },
      'checked': { variant: 'default', label: 'Checked' },
      'in_transit': { variant: 'default', label: 'In Transit' },
      'arrived': { variant: 'default', label: 'Arrived' },
      'verifying': { variant: 'secondary', label: 'Verifying' },
      'verified': { variant: 'default', label: 'Verified' },
      'completed': { variant: 'default', label: 'Completed' },
      'cancelled': { variant: 'destructive', label: 'Cancelled' },
    }
    const config = statusConfig[status] || { variant: 'outline', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getAvailableActions = () => {
    if (!transfer) return []

    const actions = []
    const status = transfer.status

    // Draft → Submit for Check
    if (status === 'draft' && can(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
      actions.push({
        label: 'Submit for Checking',
        icon: ClipboardDocumentCheckIcon,
        onClick: handleSubmitForCheck,
        variant: 'default' as const
      })
    }

    // Pending Check → Approve or Reject
    if (status === 'pending_check' && can(PERMISSIONS.STOCK_TRANSFER_CHECK)) {
      actions.push({
        label: 'Approve',
        icon: CheckIcon,
        onClick: handleApprove,
        variant: 'default' as const
      })
      actions.push({
        label: 'Reject',
        icon: XMarkIcon,
        onClick: () => setShowRejectDialog(true),
        variant: 'destructive' as const
      })
    }

    // Checked → Send
    if (status === 'checked' && can(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      actions.push({
        label: 'Send Transfer',
        icon: TruckIcon,
        onClick: handleSend,
        variant: 'default' as const
      })
    }

    // In Transit → Mark Arrived
    if (status === 'in_transit' && can(PERMISSIONS.STOCK_TRANSFER_RECEIVE)) {
      actions.push({
        label: 'Mark as Arrived',
        icon: CheckCircleIcon,
        onClick: handleMarkArrived,
        variant: 'default' as const
      })
    }

    // Arrived → Start Verification
    if (status === 'arrived' && can(PERMISSIONS.STOCK_TRANSFER_VERIFY)) {
      actions.push({
        label: 'Start Verification',
        icon: ClipboardDocumentCheckIcon,
        onClick: handleStartVerification,
        variant: 'default' as const
      })
    }

    // Verified → Complete
    if (status === 'verified' && can(PERMISSIONS.STOCK_TRANSFER_COMPLETE)) {
      actions.push({
        label: 'Complete Transfer',
        icon: CheckCircleIcon,
        onClick: handleComplete,
        variant: 'default' as const
      })
    }

    // Cancel - available for draft, pending_check, checked, in_transit
    if (['draft', 'pending_check', 'checked', 'in_transit'].includes(status) &&
        can(PERMISSIONS.STOCK_TRANSFER_DELETE)) {
      actions.push({
        label: 'Cancel Transfer',
        icon: XMarkIcon,
        onClick: handleCancel,
        variant: 'destructive' as const
      })
    }

    return actions
  }

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view stock transfers.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="text-gray-500">Loading transfer details...</div>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Transfer not found
        </div>
      </div>
    )
  }

  const availableActions = getAvailableActions()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/transfers">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-gray-500 mt-1">Transfer Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(transfer.status)}
          {transfer.stockDeducted && (
            <Badge variant="default">Stock Deducted</Badge>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {availableActions.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-2">
            {availableActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  disabled={actionLoading}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {action.label}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Transfer</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                Reject Transfer
              </Button>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Transfer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">From Location</label>
                <div className="font-medium">{getLocationName(transfer.fromLocationId)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">To Location</label>
                <div className="font-medium">{getLocationName(transfer.toLocationId)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Transfer Date</label>
                <div className="font-medium">
                  {new Date(transfer.transferDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created At</label>
                <div className="font-medium">
                  {new Date(transfer.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            {transfer.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <div className="font-medium">{transfer.notes}</div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Transfer Items ({transfer.items.length})</h2>
            <div className="space-y-3">
              {transfer.items.map((item) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">Product #{item.productId}</div>
                      <div className="text-sm text-gray-500">Variation #{item.productVariationId}</div>
                    </div>
                    {item.isVerified && (
                      <Badge variant="default">
                        <CheckIcon className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{item.quantity}</span>
                    </div>
                    {item.receivedQuantity !== null && (
                      <div>
                        <span className="text-gray-500">Received:</span>
                        <span className="ml-2 font-medium">{item.receivedQuantity}</span>
                      </div>
                    )}
                  </div>

                  {/* Verification Input */}
                  {transfer.status === 'verifying' && !item.isVerified && can(PERMISSIONS.STOCK_TRANSFER_VERIFY) && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={verificationQuantities[item.id] || ''}
                        onChange={(e) => setVerificationQuantities({
                          ...verificationQuantities,
                          [item.id]: parseFloat(e.target.value) || 0
                        })}
                        placeholder="Received quantity"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <Button onClick={() => handleVerifyItem(item.id)} disabled={actionLoading}>
                        <CheckIcon className="w-4 h-4 mr-1" />
                        Verify
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Status</h2>
            <div className="space-y-2">
              {getStatusBadge(transfer.status)}
              <div className="text-sm text-gray-500">
                {transfer.stockDeducted
                  ? 'Stock has been deducted from origin'
                  : 'Stock not yet deducted'}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Workflow Status</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <div className={transfer.status === 'draft' ? 'font-bold' : ''}>
                1. Draft
              </div>
              <div className={transfer.status === 'pending_check' ? 'font-bold' : ''}>
                2. Pending Check
              </div>
              <div className={transfer.status === 'checked' ? 'font-bold' : ''}>
                3. Checked
              </div>
              <div className={transfer.status === 'in_transit' ? 'font-bold' : ''}>
                4. In Transit (Stock Deducted)
              </div>
              <div className={transfer.status === 'arrived' ? 'font-bold' : ''}>
                5. Arrived
              </div>
              <div className={transfer.status === 'verifying' ? 'font-bold' : ''}>
                6. Verifying
              </div>
              <div className={transfer.status === 'verified' ? 'font-bold' : ''}>
                7. Verified
              </div>
              <div className={transfer.status === 'completed' ? 'font-bold' : ''}>
                8. Completed (Stock Added)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
