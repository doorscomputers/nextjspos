"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, CheckIcon, XMarkIcon, TruckIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, PrinterIcon, ArrowDownTrayIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  fromLocationName?: string
  toLocationName?: string
  status: string
  stockDeducted: boolean
  notes: string | null
  createdAt: string
  items: TransferItem[]
  createdBy: number | null
  checkedBy: number | null
  sentBy: number | null
  arrivedBy: number | null
  verifiedBy: number | null
  completedBy: number | null
  checkedAt: string | null
  sentAt: string | null
  arrivedAt: string | null
  verifiedAt: string | null
  completedAt: string | null
  creator?: { id: number; username: string } | null
  checker?: { id: number; username: string } | null
  sender?: { id: number; username: string } | null
  arrivalMarker?: { id: number; username: string } | null
  verifier?: { id: number; username: string } | null
  completer?: { id: number; username: string } | null
}

interface TransferItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  receivedQuantity: string | null
  verified: boolean
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
    sku: string | null
  }
}

export default function TransferDetailPage() {
  const { can, user } = usePermissions()
  const params = useParams()
  const router = useRouter()
  const transferId = params.id as string
  const currentUserId = parseInt(user?.id || '0')

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

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF...')
      // Use browser's print to PDF functionality
      window.print()
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Failed to export to PDF')
    }
  }

  const handleExportExcel = () => {
    try {
      if (!transfer) return

      // Create CSV content (Excel compatible)
      let csv = 'Stock Transfer Report\n\n'
      csv += `Transfer Number:,${transfer.transferNumber}\n`
      csv += `From Location:,${getLocationName(transfer.fromLocationId)}\n`
      csv += `To Location:,${getLocationName(transfer.toLocationId)}\n`
      csv += `Transfer Date:,${new Date(transfer.transferDate).toLocaleDateString()}\n`
      csv += `Status:,${transfer.status}\n`
      csv += `Created At:,${new Date(transfer.createdAt).toLocaleString()}\n`
      if (transfer.notes) {
        csv += `Notes:,${transfer.notes}\n`
      }
      csv += '\n'
      csv += 'Product Name,Variation,SKU,Quantity,Received,Verified\n'

      transfer.items.forEach(item => {
        csv += `"${item.product.name}","${item.productVariation.name}","${item.productVariation.sku || ''}",${item.quantity},${item.receivedQuantity || 'N/A'},${item.verified ? 'Yes' : 'No'}\n`
      })

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `transfer_${transfer.transferNumber}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Excel file downloaded successfully')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Failed to export to Excel')
    }
  }

  const getLocationName = (locationId: number) => {
    // Prefer location name from transfer API response
    if (transfer) {
      if (locationId === transfer.fromLocationId && transfer.fromLocationName) {
        return transfer.fromLocationName
      }
      if (locationId === transfer.toLocationId && transfer.toLocationName) {
        return transfer.toLocationName
      }
    }
    // Fallback to user's location list
    const location = locations.find(loc => loc.id === locationId)
    return location?.name || `Location ${locationId}`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bgColor: string, textColor: string, label: string } } = {
      'draft': {
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        label: 'Draft'
      },
      'pending_check': {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        label: 'Pending Check'
      },
      'checked': {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        label: 'Checked'
      },
      'in_transit': {
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        label: 'In Transit'
      },
      'arrived': {
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-800',
        label: 'Arrived'
      },
      'verifying': {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        label: 'Verifying'
      },
      'verified': {
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-800',
        label: 'Verified'
      },
      'completed': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        label: 'Completed'
      },
      'cancelled': {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        label: 'Cancelled'
      },
    }

    const config = statusConfig[status] || {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      label: status
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
        {config.label}
      </span>
    )
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
    // CRITICAL: Don't show approve button if current user is the creator (separation of duties)
    if (status === 'pending_check' && can(PERMISSIONS.STOCK_TRANSFER_CHECK)) {
      const isCreator = transfer.createdBy === currentUserId
      if (!isCreator) {
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
    }

    // Checked → Send
    // CRITICAL: Only show to users at ORIGIN location (not destination)
    if (status === 'checked' && can(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      // Check if user has access to the FROM location
      const hasAccessToOrigin = user?.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS) ||
        locations.some(loc => loc.id === transfer.fromLocationId)

      if (hasAccessToOrigin) {
        actions.push({
          label: 'Send Transfer',
          icon: TruckIcon,
          onClick: handleSend,
          variant: 'default' as const
        })
      }
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
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10px;
            font-size: 11px;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
          }
          .print-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 15px;
            font-size: 10px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 10px;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            text-align: left;
          }
          .print-table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .print-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #000;
            font-size: 9px;
          }
          .print-signature {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 40px;
            font-size: 10px;
          }
          .print-signature-box {
            text-align: center;
            padding-top: 30px;
            border-top: 1px solid #000;
          }
        }
      `}</style>

      {/* Hidden Print Content */}
      <div className="print-content" style={{ display: 'none' }}>
        <div className="print-header">
          <h1 style={{ margin: 0, fontSize: '16px' }}>STOCK TRANSFER DOCUMENT</h1>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>{transfer.transferNumber}</div>
        </div>

        <div className="print-info-grid">
          <div>
            <strong>From Location:</strong> {getLocationName(transfer.fromLocationId)}
          </div>
          <div>
            <strong>To Location:</strong> {getLocationName(transfer.toLocationId)}
          </div>
          <div>
            <strong>Transfer Date:</strong> {new Date(transfer.transferDate).toLocaleDateString()}
          </div>
          <div>
            <strong>Status:</strong> {transfer.status.toUpperCase()}
          </div>
          <div>
            <strong>Created By:</strong> {transfer.creator?.username || `User ${transfer.createdBy}`}
          </div>
          <div>
            <strong>Created At:</strong> {new Date(transfer.createdAt).toLocaleString()}
          </div>
        </div>

        {transfer.notes && (
          <div style={{ marginBottom: '10px', fontSize: '10px' }}>
            <strong>Notes:</strong> {transfer.notes}
          </div>
        )}

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>#</th>
              <th style={{ width: '35%' }}>Product Name</th>
              <th style={{ width: '25%' }}>Variation</th>
              <th style={{ width: '15%' }}>SKU</th>
              <th style={{ width: '10%' }}>Qty</th>
              <th style={{ width: '10%' }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.product.name}</td>
                <td>{item.productVariation.name}</td>
                <td>{item.productVariation.sku || '-'}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'center' }}>
                  {item.receivedQuantity || '_____'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                Total Items:
              </td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                {transfer.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div className="print-signature">
          <div className="print-signature-box">
            <div><strong>Prepared By:</strong></div>
            <div>{transfer.creator?.username || `User ${transfer.createdBy}`}</div>
          </div>
          <div className="print-signature-box">
            <div><strong>Checked By:</strong></div>
            <div>_________________</div>
          </div>
          <div className="print-signature-box">
            <div><strong>Received By:</strong></div>
            <div>_________________</div>
          </div>
        </div>

        <div className="print-footer">
          <div>Printed: {new Date().toLocaleString()}</div>
          <div style={{ marginTop: '5px', fontSize: '8px' }}>
            <strong>Instructions:</strong> This document must accompany the physical transfer of goods.
            The receiver must verify all items and quantities before signing.
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6 print-area">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/transfers" className="no-print">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        {/* Workflow Actions */}
        {availableActions.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Workflow Actions</h3>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <Button
                    key={index}
                    variant={action.variant}
                    onClick={action.onClick}
                    disabled={actionLoading}
                    className={action.variant === 'default' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Export & Print Actions */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Export & Print</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              <PrinterIcon className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            >
              <TableCellsIcon className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

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
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-500">
                        {item.productVariation.name}
                        {item.productVariation.sku && ` • SKU: ${item.productVariation.sku}`}
                      </div>
                    </div>
                    {item.verified && (
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
                  {transfer.status === 'verifying' && !item.verified && can(PERMISSIONS.STOCK_TRANSFER_VERIFY) && (
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

          {/* Workflow Participants */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Workflow Audit Trail</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500 block mb-1">Created By</label>
                <div className="font-medium">
                  {transfer.creator?.username || `User ID: ${transfer.createdBy || 'N/A'}`}
                </div>
                <div className="text-gray-500 text-xs">{new Date(transfer.createdAt).toLocaleString()}</div>
              </div>

              {transfer.checkedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Checked/Approved By</label>
                  <div className="font-medium">
                    {transfer.checker?.username || `User ID: ${transfer.checkedBy}`}
                  </div>
                  {transfer.checkedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.checkedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Different user verified transfer</div>
                </div>
              )}

              {transfer.sentBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Sent By</label>
                  <div className="font-medium">
                    {transfer.sender?.username || `User ID: ${transfer.sentBy}`}
                  </div>
                  {transfer.sentAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.sentAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Stock deducted from source</div>
                </div>
              )}

              {transfer.arrivedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Marked Arrived By</label>
                  <div className="font-medium">
                    {transfer.arrivalMarker?.username || `User ID: ${transfer.arrivedBy}`}
                  </div>
                  {transfer.arrivedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.arrivedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Destination confirmed receipt</div>
                </div>
              )}

              {transfer.verifiedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Verified By</label>
                  <div className="font-medium">
                    {transfer.verifier?.username || `User ID: ${transfer.verifiedBy}`}
                  </div>
                  {transfer.verifiedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.verifiedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Items physically verified</div>
                </div>
              )}

              {transfer.completedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Completed By</label>
                  <div className="font-medium">
                    {transfer.completer?.username || `User ID: ${transfer.completedBy}`}
                  </div>
                  {transfer.completedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.completedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-green-600 mt-1">✓ Transfer complete - stock added to destination</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <strong>Separation of Duties:</strong> Each workflow stage must be performed by a different user to ensure proper control and prevent fraud. This audit trail tracks all participants.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
