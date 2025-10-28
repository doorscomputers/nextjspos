'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeftIcon, CheckCircleIcon, LockClosedIcon, XCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import CreateReturnModal from '@/components/purchases/CreateReturnModal'
import { type SerialNumberData } from '@/components/purchases/SerialNumberInputInline'

interface PurchaseReceiptDetail {
  id: number
  receiptNumber: string
  receiptDate: string
  status: string
  notes: string | null
  purchaseId: number | null
  purchase: {
    id: number
    purchaseOrderNumber: string
    subtotal: string
    taxAmount: string
    discountAmount: string
    shippingCost: string
    totalAmount: string
    supplier: {
      id: number
      name: string
      contactPerson: string | null
      email: string | null
      mobile: string | null
    }
  } | null
  supplier: {
    id: number
    name: string
    contactPerson: string | null
    email: string | null
    mobile: string | null
  }
  location: {
    id: number
    name: string
  }
  receivedBy: number
  receivedAt: string
  approvedBy: number | null
  approvedAt: string | null
  receivedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  }
  approvedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  } | null
  items: Array<{
    id: number
    quantityReceived: string
    serialNumbers: any
    notes: string | null
    purchaseItem: {
      id: number
      quantity: string
      unitCost: string
      product: {
        id: number
        name: string
      }
      productVariation: {
        id: number
        name: string
        sku: string
        enableSerialNumber: boolean
      }
    } | null
    product: {
      id: number
      name: string
    }
    productVariation: {
      id: number
      name: string
      sku: string
      enableSerialNumber: boolean
    }
    unitCost: string | null
  }>
}

export default function PurchaseReceiptDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [receipt, setReceipt] = useState<PurchaseReceiptDetail | null>(null)
  const [verificationChecked, setVerificationChecked] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showCreateReturnModal, setShowCreateReturnModal] = useState(false)

  const [showEditSerialsModal, setShowEditSerialsModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [editingSerialNumbers, setEditingSerialNumbers] = useState<SerialNumberData[]>([])
  const [serialInput, setSerialInput] = useState('')
  const [savingSerials, setSavingSerials] = useState(false)
  const [isCheckingSerial, setIsCheckingSerial] = useState(false)

  const getRequiredSerialCount = (item: any | null) => {
    if (!item) return 0
    const candidate =
      item.quantityReceived ??
      item.purchaseItem?.quantityReceived ??
      item.purchaseItem?.quantity ??
      0
    const numeric =
      typeof candidate === 'number'
        ? candidate
        : parseFloat(candidate || '0')

    return Number.isFinite(numeric) ? numeric : 0
  }

  const itemRequiresSerialTracking = (item: any | null) => {
    if (!item) return false

    const hasSerialFlag =
      item.purchaseItem?.requiresSerial ||
      item.purchaseItem?.productVariation?.enableSerialNumber ||
      item.productVariation?.enableSerialNumber ||
      item.product?.enableProductInfo

    if (hasSerialFlag) {
      return true
    }

    const serialValue = item.serialNumbers
    if (Array.isArray(serialValue)) {
      return serialValue.length > 0
    }

    if (typeof serialValue === 'string') {
      return serialValue.trim().length > 0
    }

    if (serialValue && typeof serialValue === 'object') {
      try {
        return Array.isArray(serialValue) ? serialValue.length > 0 : Object.keys(serialValue).length > 0
      } catch (_error) {
        return false
      }
    }

    return false
  }

  const fetchReceipt = async () => {
    setLoading(true)
    try {
      console.log('Fetching receipt ID:', params.id)
      const res = await fetch(`/api/purchases/receipts/${params.id}`)
      console.log('Response status:', res.status)

      if (!res.ok) {
        const error = await res.json()
        console.error('API Error:', error)
        throw new Error(error.error || 'Failed to fetch receipt')
      }

      const data = await res.json()
      console.log('Receipt data received:', data)
      setReceipt(data)
    } catch (error: any) {
      console.error('Error fetching receipt:', error)
      toast.error(error.message || 'Failed to load receipt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
      fetchReceipt()
    }
  }, [params.id])

  const openSerialEditor = (item: any) => {
    setEditingItem(item)
    // Handle both array and JSON serial numbers
    let serialNumbers = []
    if (Array.isArray(item.serialNumbers)) {
      serialNumbers = item.serialNumbers
    } else if (item.serialNumbers) {
      try {
        if (typeof item.serialNumbers === 'string') {
          serialNumbers = JSON.parse(item.serialNumbers)
        } else {
          serialNumbers = item.serialNumbers
        }
      } catch (error) {
        console.error('Error parsing serialNumbers in openSerialEditor:', error)
        serialNumbers = []
      }
    }
    setEditingSerialNumbers(serialNumbers)
    setSerialInput('')
    setShowEditSerialsModal(true)
  }

  const addSerialNumber = async () => {
    if (isCheckingSerial) {
      return
    }

    if (!editingItem) {
      toast.error('No item selected')
      return
    }

    const trimmed = serialInput.trim()
    if (!trimmed) {
      toast.error('Serial number is required')
      return
    }

    if (editingSerialNumbers.some((sn) => sn.serialNumber === trimmed)) {
      toast.error('This serial number is already in the list')
      return
    }

    try {
      setIsCheckingSerial(true)
      const response = await fetch(`/api/serial-numbers/check?serial=${encodeURIComponent(trimmed)}`)
      if (!response.ok) {
        throw new Error('Unable to validate serial number')
      }
      const result = await response.json()
      if (result.exists) {
        toast.error(`Serial number already exists (Receipt: ${result.serial.receiptNumber})`)
        return
      }
    } catch (error) {
      console.error('Serial validation failed:', error)
      toast.error('Failed to validate serial number. Please try again.')
      return
    } finally {
      setIsCheckingSerial(false)
    }

    const updated = [...editingSerialNumbers, { serialNumber: trimmed, condition: 'new' as const }]
    setEditingSerialNumbers(updated)
    setSerialInput('')

    const remaining = getRequiredSerialCount(editingItem) - updated.length
    if (remaining > 0) {
      toast.success(`Serial added! ${remaining} remaining.`)
    } else {
      toast.success('Serial number added!')
    }
  }

  const removeSerialNumber = (index: number) => {
    const updated = editingSerialNumbers.filter((_, i) => i !== index)
    setEditingSerialNumbers(updated)
  }

  const isSaveSerialDisabled = () => {
    if (!editingItem) return true

    const variation = editingItem.productVariation || editingItem.purchaseItem?.productVariation
    const isRequired = variation?.enableSerialNumber
    const requiredCount = getRequiredSerialCount(editingItem)

    if (!isRequired) {
      return false
    }

    return requiredCount > 0 && editingSerialNumbers.length !== requiredCount
  }

  const getSaveSerialDisabledMessage = () => {
    if (!editingItem) return ''

    const variation = editingItem.productVariation || editingItem.purchaseItem?.productVariation
    const isRequired = variation?.enableSerialNumber
    const requiredCount = getRequiredSerialCount(editingItem)
    const diff = requiredCount - editingSerialNumbers.length

    if (!isRequired || requiredCount === 0 || diff === 0) {
      return ''
    }

    return diff > 0
      ? `Add ${diff} more serial number${diff === 1 ? '' : 's'} to enable save`
      : `Remove ${Math.abs(diff)} serial number${Math.abs(diff) === 1 ? '' : 's'} to enable save`
  }

  const saveSerialNumbers = async () => {
    if (!receipt || !editingItem) return

    const requiredCount = getRequiredSerialCount(editingItem)
    const variation = editingItem.productVariation || editingItem.purchaseItem?.productVariation
    const isRequired = variation?.enableSerialNumber

    if (isRequired && requiredCount > 0 && editingSerialNumbers.length !== requiredCount) {
      toast.error(`This item requires exactly ${requiredCount} serial number${requiredCount === 1 ? '' : 's'}.`)
      return
    }

    setSavingSerials(true)
    try {
      const response = await fetch(`/api/purchases/receipts/${receipt.id}/serial-numbers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptItemId: editingItem.id,
          serialNumbers: editingSerialNumbers,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || 'Failed to save serial numbers')
      }

      setReceipt((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === editingItem.id ? { ...it, serialNumbers: editingSerialNumbers } : it
          ),
        }
      })

      toast.success('Serial numbers updated successfully')
      setShowEditSerialsModal(false)
      // Refresh the receipt data to show updated serial numbers
      fetchReceipt()
    } catch (error: any) {
      console.error('Error saving serial numbers:', error)
      toast.error(error.message || 'Failed to save serial numbers')
    } finally {
      setSavingSerials(false)
    }
  }
  const handleApprove = async () => {
    if (!receipt) return

    if (!confirm('Are you sure you want to approve this receipt? This will add inventory to stock and cannot be undone.')) {
      return
    }

    setApproving(true)
    try {
      const res = await fetch(`/api/purchases/receipts/${receipt.id}/approve`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve receipt')
      }

      toast.success('Receipt approved successfully! Inventory has been added.')
      fetchReceipt() // Refresh to show updated status
    } catch (error: any) {
      console.error('Error approving receipt:', error)
      toast.error(error.message || 'Failed to approve receipt')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!receipt) return

    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejecting this receipt')
      return
    }

    setRejecting(true)
    try {
      const res = await fetch(`/api/purchases/receipts/${receipt.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectionReason }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject receipt')
      }

      toast.success('Receipt rejected successfully')
      setShowRejectModal(false)
      setRejectionReason('')
      fetchReceipt() // Refresh to show updated status
    } catch (error: any) {
      console.error('Error rejecting receipt:', error)
      toast.error(error.message || 'Failed to reject receipt')
    } finally {
      setRejecting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
  }

  const getFullName = (user: { firstName: string; lastName: string; surname: string } | null) => {
    if (!user) return 'N/A'
    return `${user.firstName} ${user.surname} ${user.lastName}`.trim()
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    }

    return (
      <Badge variant="outline" className={styles[status] || ''}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  if (!can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view purchase receipts.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Receipt not found
        </div>
      </div>
    )
  }

  const totalQuantity = receipt.items.reduce(
    (sum, item) => sum + parseFloat(item.quantityReceived),
    0
  )

  const totalValue = receipt.items.reduce((sum, item) => {
    const unitCost = item.purchaseItem?.unitCost || item.unitCost || '0'
    return sum + parseFloat(item.quantityReceived) * parseFloat(unitCost.toString())
  }, 0)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchases/receipts">
            <Button size="sm" className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Receipts
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{receipt.receiptNumber}</h1>
            <p className="text-gray-600 mt-1">Goods Received Note Details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(receipt.status)}
          {receipt.status === 'approved' && can(PERMISSIONS.PURCHASE_RETURN_CREATE) && (
            <Button
              onClick={() => setShowCreateReturnModal(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              size="sm"
            >
              <ArrowUturnLeftIcon className="w-4 h-4 mr-2" />
              Create Return
            </Button>
          )}
        </div>
      </div>

      {/* Lock Warning for Approved Receipts */}
      {receipt.status === 'approved' && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
          <LockClosedIcon className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">This receipt has been approved and finalized</p>
            <p className="text-sm text-blue-700 mt-1">
              Approved receipts cannot be edited to maintain data integrity. Use Inventory Corrections if adjustments are needed.
            </p>
          </div>
        </div>
      )}

      {/* Rejected Warning */}
      {receipt.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">This receipt has been rejected</p>
            <p className="text-sm text-red-700 mt-1">
              Rejected receipts cannot be approved. If this was done in error, create a new GRN.
            </p>
          </div>
        </div>
      )}

      {/* Pending Approval Warning */}
      {receipt.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Pending Approval</p>
            <p className="text-sm text-yellow-700 mt-1">
              This receipt requires approval before inventory is added to stock. Total quantity: <strong>{totalQuantity} units</strong> worth <strong>{formatCurrency(totalValue)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Verification Checkbox - Only show if pending and user can approve */}
      {receipt.status === 'pending' && can(PERMISSIONS.PURCHASE_RECEIPT_APPROVE) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Verification Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Please verify the following before approval:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>All product details (name, SKU, variation) are correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>Quantities received match the physical count</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>Unit costs and total values are accurate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>Supplier information is correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>Serial numbers (if applicable) are properly recorded</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">âœ“</span>
                  <span>No damaged or defective items are included</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-3 bg-white border-2 border-blue-300 rounded-lg p-4">
              <input
                type="checkbox"
                id="verification"
                checked={verificationChecked}
                onChange={(e) => setVerificationChecked(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              />
              <label htmlFor="verification" className="flex-1 cursor-pointer">
                <p className="font-semibold text-gray-900">I confirm that I have carefully verified all details above</p>
                <p className="text-sm text-gray-600 mt-1">
                  By checking this box, I certify that all information is accurate and complete. This action will update inventory and create accounts payable entries.
                </p>
              </label>
            </div>

            {verificationChecked && (
              <div className="pt-2 space-y-3">
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                  size="lg"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  {approving ? 'Updating Inventory...' : 'Approve & Update Inventory'}
                </Button>
                <Button
                  onClick={() => setShowRejectModal(true)}
                  disabled={approving}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold border-2 border-red-700 hover:border-red-800 shadow-md py-3 disabled:opacity-50"
                  size="lg"
                >
                  <XCircleIcon className="w-5 h-5 mr-2" />
                  Reject Receipt
                </Button>
              </div>
            )}

            {!verificationChecked && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">
                  Please check the verification box above to enable the action buttons
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receipt Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">GRN Number:</span>
              <p className="font-medium">{receipt.receiptNumber}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Receipt Date:</span>
              <p className="font-medium">{formatDate(receipt.receiptDate)}</p>
            </div>
            {receipt.purchase ? (
              <div>
                <span className="text-sm text-gray-600">Purchase Order:</span>
                <p className="font-medium">
                  <Link
                    href={`/dashboard/purchases/${receipt.purchase.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {receipt.purchase.purchaseOrderNumber}
                  </Link>
                </p>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-600">Purchase Order:</span>
                <p className="font-medium">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    Direct Entry (No PO)
                  </Badge>
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Location:</span>
              <p className="font-medium">{receipt.location.name}</p>
            </div>
            {receipt.notes && (
              <div>
                <span className="text-sm text-gray-600">Notes:</span>
                <p className="font-medium">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Supplier Name:</span>
              <p className="font-medium">
                {receipt.purchase ? receipt.purchase.supplier.name : receipt.supplier.name}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Contact Person:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.contactPerson || 'N/A')
                  : (receipt.supplier.contactPerson || 'N/A')
                }
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Email:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.email || 'N/A')
                  : (receipt.supplier.email || 'N/A')
                }
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Mobile:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.mobile || 'N/A')
                  : (receipt.supplier.mobile || 'N/A')
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600 mb-1">Step 1: Received By (Encoder)</p>
              <p className="font-medium text-lg">{getFullName(receipt.receivedByUser)}</p>
              <p className="text-sm text-gray-500">@{receipt.receivedByUser.username}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(receipt.receivedAt)}</p>
            </div>

            <div className={`border-l-4 pl-4 ${receipt.status === 'approved' ? 'border-green-500' : receipt.status === 'rejected' ? 'border-red-500' : 'border-gray-300'}`}>
              <p className="text-sm text-gray-600 mb-1">
                {receipt.status === 'rejected' ? 'Step 2: Rejected By' : 'Step 2: Approved By (Approving Officer)'}
              </p>
              {receipt.approvedByUser ? (
                <>
                  <p className="font-medium text-lg">{getFullName(receipt.approvedByUser)}</p>
                  <p className="text-sm text-gray-500">@{receipt.approvedByUser.username}</p>
                  <p className="text-xs text-gray-400 mt-1">{receipt.approvedAt && formatDate(receipt.approvedAt)}</p>
                  {receipt.status === 'rejected' && (
                    <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-300">
                      REJECTED
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">Awaiting approval</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Received Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-right py-3 px-4">Ordered</th>
                  <th className="text-right py-3 px-4">Received</th>
                  {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                    <>
                      <th className="text-right py-3 px-4">Unit Cost</th>
                      <th className="text-right py-3 px-4">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => {
                  const product = item.purchaseItem?.product || item.product
                  const variation = item.purchaseItem?.productVariation || item.productVariation
                  const orderedQty = item.purchaseItem?.quantity || '-'
                  const unitCost = item.purchaseItem?.unitCost || item.unitCost || '0'

                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">{variation.name}</p>
                          {variation.enableSerialNumber && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Serial Number Required
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {variation.sku}
                      </td>
                      <td className="text-right py-3 px-4">
                        {orderedQty}
                      </td>
                      <td className="text-right py-3 px-4 font-medium">
                        {item.quantityReceived}
                      </td>
                      {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                        <>
                          <td className="text-right py-3 px-4">
                            {formatCurrency(unitCost)}
                          </td>
                          <td className="text-right py-3 px-4 font-medium">
                            {formatCurrency(parseFloat(item.quantityReceived) * parseFloat(unitCost.toString()))}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="py-3 px-4 text-right">
                    TOTAL:
                  </td>
                  <td className="text-right py-3 px-4">
                    {totalQuantity} units
                  </td>
                  {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                    <>
                      <td className="text-right py-3 px-4"></td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(totalValue)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cost Summary - Only show if purchase exists and user can view cost */}
          {receipt.purchase && can(PERMISSIONS.PURCHASE_VIEW_COST) && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-4">Purchase Order Summary</h3>
              <div className="max-w-md ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(receipt.purchase.subtotal)}</span>
                </div>
                {parseFloat(receipt.purchase.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(receipt.purchase.discountAmount)}</span>
                  </div>
                )}
                {parseFloat(receipt.purchase.shippingCost) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping Cost:</span>
                    <span className="font-medium">{formatCurrency(receipt.purchase.shippingCost)}</span>
                  </div>
                )}
                {parseFloat(receipt.purchase.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{formatCurrency(receipt.purchase.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(receipt.purchase.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Serial Numbers */}
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold">Serial Numbers</h3>
            {receipt.items
              .filter(itemRequiresSerialTracking)
              .map((item) => {
                console.log(`=== Serial Numbers Debug for Item ${item.id} ===`)
                console.log('Raw serialNumbers:', item.serialNumbers)
                console.log('Type:', typeof item.serialNumbers)
                console.log('Is Array:', Array.isArray(item.serialNumbers))

                let serialNumbers: any[] = []
                if (Array.isArray(item.serialNumbers)) {
                  serialNumbers = item.serialNumbers
                } else if (item.serialNumbers) {
                  try {
                    if (typeof item.serialNumbers === 'string') {
                      const parsed = JSON.parse(item.serialNumbers)
                      serialNumbers = Array.isArray(parsed) ? parsed : Object.values(parsed || {})
                    } else if (typeof item.serialNumbers === 'object') {
                      serialNumbers = Array.isArray(item.serialNumbers)
                        ? item.serialNumbers
                        : Object.values(item.serialNumbers || {})
                    }
                  } catch (error) {
                    console.error('Error parsing serialNumbers:', error)
                    serialNumbers = []
                  }
                }

                console.log('Processed serialNumbers:', serialNumbers)
                console.log('Length:', serialNumbers.length)
                console.log('First item:', serialNumbers[0])
                console.log('First item type:', typeof serialNumbers[0])
                if (serialNumbers[0]) {
                  console.log('First item keys:', Object.keys(serialNumbers[0]))
                }
                console.log('====================================')
                const product = item.purchaseItem?.product || item.product
                const variation = item.purchaseItem?.productVariation || item.productVariation
                const productName = product?.name || product?.productName || 'Product'
                const variationName = variation?.name || variation?.productVariationName || 'Variation'
                const requiredCount = getRequiredSerialCount(item)

                return (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">
                          {productName} - {variationName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {serialNumbers.length} / {requiredCount} serial numbers entered
                        </p>
                      </div>
                      {can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && receipt.status !== 'approved' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openSerialEditor(item)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-2 border-indigo-700 hover:border-indigo-800 shadow-sm"
                        >
                          {serialNumbers.length > 0 ? 'Edit Serial Numbers' : 'Add Serial Numbers'}
                        </Button>
                      )}
                    </div>
                    {serialNumbers.length > 0 && Array.isArray(serialNumbers) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {serialNumbers.map((sn, index) => {
                          // Handle different possible structures
                          let serialDisplay = ''
                          let imeiDisplay = ''
                          let conditionDisplay = 'new'

                          if (typeof sn === 'string') {
                            serialDisplay = sn
                          } else if (typeof sn === 'object' && sn !== null) {
                            serialDisplay = sn.serialNumber || sn.serial || sn.toString()
                            imeiDisplay = sn.imei || ''
                            conditionDisplay = sn.condition || 'new'
                          } else {
                            serialDisplay = sn.toString()
                          }

                          console.log(`Rendering serial ${index}:`, { sn, serialDisplay, imeiDisplay, conditionDisplay })
                          return (
                            <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                              <p><strong>Serial:</strong> {serialDisplay}</p>
                              {imeiDisplay && <p><strong>IMEI:</strong> {imeiDisplay}</p>}
                              <p><strong>Condition:</strong> {conditionDisplay}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {serialNumbers.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292V21a1 1 0 01-2 0V9.646a4 4 0 110-5.292z" />
                        </svg>
                        <p className="text-sm">No serial numbers entered yet</p>
                        {receipt.status !== 'approved' && can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && (
                          <p className="text-xs text-gray-400 mt-1">Click the "Add Serial Numbers" button to get started</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

            {/* Show message if no items require serial numbers */}
            {!receipt.items.some(itemRequiresSerialTracking) && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No items in this receipt require serial numbers</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircleIcon className="w-6 h-6" />
              Reject Purchase Receipt
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              Please provide a reason for rejecting {receipt.receiptNumber}. This action will prevent the receipt from being approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="rejectionReason" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="rejectionReason"
                placeholder="Explain why this receipt is being rejected (e.g., wrong products, damaged items, pricing issues, etc.)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This reason will be recorded in the receipt notes and audit log
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Once rejected, this receipt cannot be approved. You will need to create a new GRN if this was done in error.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setShowRejectModal(false)
                setRejectionReason('')
              }}
              disabled={rejecting}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircleIcon className="w-4 h-4 mr-2" />
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Serials Modal */}
      <Dialog open={showEditSerialsModal} onOpenChange={setShowEditSerialsModal}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Edit Serial Numbers
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              {editingItem && (
                <>
                  Editing serials for: <strong>{editingItem.product?.name || editingItem.purchaseItem?.product?.name}</strong> - {editingItem.productVariation?.name || editingItem.purchaseItem?.productVariation?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-6 py-4">
              {/* Progress Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292V21a1 1 0 01-2 0V9.646a4 4 0 110-5.292z" />
                    </svg>
                    <h4 className="font-semibold text-gray-900">Serial Numbers Progress</h4>
                  </div>
                  <Badge
                    variant={editingSerialNumbers.length === getRequiredSerialCount(editingItem) ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {editingSerialNumbers.length} / {getRequiredSerialCount(editingItem)}
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      editingSerialNumbers.length === getRequiredSerialCount(editingItem)
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${getRequiredSerialCount(editingItem) > 0
                        ? (editingSerialNumbers.length / getRequiredSerialCount(editingItem)) * 100
                        : 0}%`
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {editingSerialNumbers.length < getRequiredSerialCount(editingItem)
                    ? `${getRequiredSerialCount(editingItem) - editingSerialNumbers.length} serial number${getRequiredSerialCount(editingItem) - editingSerialNumbers.length === 1 ? "" : "s"} remaining`
                    : "All serial numbers entered"}
                </p>
              </div>

              {/* Input Section */}
              {editingSerialNumbers.length < getRequiredSerialCount(editingItem) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Add Serial Number
                  </label>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      addSerialNumber()
                    }}
                  >
                    <Input
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      placeholder="Scan barcode or type serial number..."
                      className="flex-1 font-mono"
                      autoFocus
                      disabled={isCheckingSerial}
                    />
                    <Button
                      type="submit"
                      disabled={!serialInput.trim() || isCheckingSerial}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isCheckingSerial ? 'Checking...' : 'Add'}
                    </Button>
                  </form>
                  <p className="text-xs text-gray-500 mt-2">Press Enter after scanning or typing each serial number</p>
                </div>
              )}

              {/* Serial Numbers List */}
              {editingSerialNumbers.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">Current Serial Numbers:</h5>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {editingSerialNumbers.map((sn, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <span className="text-sm font-mono font-semibold text-gray-900">{sn.serialNumber}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            Condition: <Badge variant="outline" className="text-xs">{sn.condition || 'new'}</Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSerialNumber(index)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning Message */}
              {editingSerialNumbers.length < getRequiredSerialCount(editingItem) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">
                        {getRequiredSerialCount(editingItem) - editingSerialNumbers.length} more serial number{getRequiredSerialCount(editingItem) - editingSerialNumbers.length === 1 ? "" : "s"} needed
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        The "Save Changes" button will be enabled when all serial numbers are entered
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {editingSerialNumbers.length === getRequiredSerialCount(editingItem) && getRequiredSerialCount(editingItem) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-green-800 font-medium">
                        All serial numbers have been entered!
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        You can now save your changes
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setShowEditSerialsModal(false)}
              disabled={savingSerials}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveSerialNumbers}
              disabled={isSaveSerialDisabled() || savingSerials}
              className={editingSerialNumbers.length === getRequiredSerialCount(editingItem) ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}
            >
              {savingSerials ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                  </svg>
                  Save Changes
                </>
              )}
            </Button>
            {getSaveSerialDisabledMessage() && (
              <p className="text-xs text-gray-500 italic">
                {getSaveSerialDisabledMessage()}
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Return Modal */}
      {receipt.status === 'approved' && (
        <CreateReturnModal
          open={showCreateReturnModal}
          onClose={() => setShowCreateReturnModal(false)}
          receipt={{
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            supplierId: receipt.purchase ? receipt.purchase.supplier.id : receipt.supplier.id,
            supplierName: receipt.purchase ? receipt.purchase.supplier.name : receipt.supplier.name,
            items: receipt.items.map((item) => ({
              id: item.id,
              productId: item.product.id,
              productVariationId: item.productVariation.id,
              productName: item.product.name,
              variationName: item.productVariation.name,
              quantityReceived: parseFloat(item.quantityReceived),
              unitCost: item.purchaseItem?.unitCost ? parseFloat(item.purchaseItem.unitCost) : (item.unitCost ? parseFloat(item.unitCost) : 0),
            })),
          }}
          onSuccess={() => {
            toast.success('Purchase return created successfully')
            fetchReceipt()
          }}
        />
      )}
    </div>
  )
}


