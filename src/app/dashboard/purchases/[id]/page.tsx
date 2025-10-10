"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, TruckIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PurchaseItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  quantityReceived: string
  unitCost: string
  requiresSerial: boolean
}

interface Purchase {
  id: number
  purchaseOrderNumber: string
  purchaseDate: string
  expectedDeliveryDate: string | null
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  items: PurchaseItem[]
}

export default function PurchaseDetailPage() {
  const { can } = usePermissions()
  const params = useParams()
  const router = useRouter()
  const purchaseId = params.id as string

  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // For receiving
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [receiveQuantities, setReceiveQuantities] = useState<{ [key: number]: number }>({})
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [receiveNotes, setReceiveNotes] = useState('')

  useEffect(() => {
    fetchPurchase()
  }, [purchaseId])

  const fetchPurchase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchases?page=1&limit=1000`)
      const data = await response.json()

      if (response.ok) {
        const foundPurchase = data.purchases?.find((p: Purchase) => p.id === parseInt(purchaseId))
        if (foundPurchase) {
          setPurchase(foundPurchase)
          // Initialize receive quantities with remaining amounts
          const quantities: { [key: number]: number } = {}
          foundPurchase.items.forEach((item: PurchaseItem) => {
            const remaining = parseFloat(item.quantity) - parseFloat(item.quantityReceived)
            quantities[item.id] = remaining > 0 ? remaining : 0
          })
          setReceiveQuantities(quantities)
        } else {
          toast.error('Purchase order not found')
          router.push('/dashboard/purchases')
        }
      } else {
        toast.error(data.error || 'Failed to fetch purchase')
      }
    } catch (error) {
      console.error('Error fetching purchase:', error)
      toast.error('Failed to fetch purchase')
    } finally {
      setLoading(false)
    }
  }

  const handleReceiveGoods = async () => {
    if (!purchase) return

    // Build items array for receiving
    const itemsToReceive = Object.entries(receiveQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        purchaseItemId: parseInt(itemId),
        quantityReceived: qty,
        notes: '',
      }))

    if (itemsToReceive.length === 0) {
      toast.error('Please specify quantities to receive')
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/purchases/${purchaseId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDate: receiveDate,
          items: itemsToReceive,
          notes: receiveNotes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Goods received successfully - stock added!')
        setShowReceiveDialog(false)
        fetchPurchase()
      } else {
        toast.error(data.error || 'Failed to receive goods')
      }
    } catch (error) {
      console.error('Error receiving goods:', error)
      toast.error('Failed to receive goods')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return `₱${numAmount.toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'partially_received': { variant: 'secondary', label: 'Partially Received' },
      'received': { variant: 'default', label: 'Received' },
      'cancelled': { variant: 'destructive', label: 'Cancelled' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const getItemReceivedStatus = (item: PurchaseItem) => {
    const ordered = parseFloat(item.quantity)
    const received = parseFloat(item.quantityReceived)
    const percentage = ordered > 0 ? (received / ordered) * 100 : 0

    if (received === 0) {
      return <Badge variant="secondary">Not Received</Badge>
    } else if (received < ordered) {
      return <Badge variant="secondary">{percentage.toFixed(0)}% Received</Badge>
    } else {
      return <Badge variant="default">Fully Received</Badge>
    }
  }

  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view purchases.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="text-gray-500">Loading purchase details...</div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Purchase order not found
        </div>
      </div>
    )
  }

  const canReceive = purchase.status !== 'received' && purchase.status !== 'cancelled'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchases">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{purchase.purchaseOrderNumber}</h1>
            <p className="text-gray-500 mt-1">Purchase Order Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(purchase.status)}
        </div>
      </div>

      {/* Action Buttons */}
      {can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && canReceive && (
        <div className="bg-white p-4 rounded-lg shadow">
          <Button onClick={() => setShowReceiveDialog(true)}>
            <TruckIcon className="w-4 h-4 mr-2" />
            Receive Goods (GRN)
          </Button>
        </div>
      )}

      {/* Receive Dialog */}
      {showReceiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Receive Goods - Create GRN</h3>
                <button
                  onClick={() => setShowReceiveDialog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <h4 className="font-medium mb-2">Items to Receive:</h4>
                  <div className="space-y-3">
                    {purchase.items.map((item) => {
                      const ordered = parseFloat(item.quantity)
                      const received = parseFloat(item.quantityReceived)
                      const remaining = ordered - received

                      return (
                        <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">
                                Product ID: {item.productId} (Variation: {item.productVariationId})
                              </div>
                              <div className="text-sm text-gray-500">
                                Ordered: {ordered} | Already Received: {received} | Remaining: {remaining}
                              </div>
                            </div>
                            {getItemReceivedStatus(item)}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">Receive Qty:</label>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={receiveQuantities[item.id] || 0}
                              onChange={(e) => setReceiveQuantities({
                                ...receiveQuantities,
                                [item.id]: parseFloat(e.target.value) || 0
                              })}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              disabled={remaining <= 0}
                            />
                            <span className="text-sm text-gray-500">
                              (Max: {remaining})
                            </span>
                          </div>
                          {item.requiresSerial && receiveQuantities[item.id] > 0 && (
                            <div className="mt-2 text-xs text-orange-600">
                              ⚠️ Serial numbers required for this item (feature coming soon)
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter any notes about this receipt..."
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleReceiveGoods} disabled={actionLoading}>
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Create GRN & Add Stock
                  </Button>
                  <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PO Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Purchase Order Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">PO Number</label>
                <div className="font-medium">{purchase.purchaseOrderNumber}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">PO Date</label>
                <div className="font-medium">{formatDate(purchase.purchaseDate)}</div>
              </div>
              {purchase.expectedDeliveryDate && (
                <div>
                  <label className="text-sm text-gray-500">Expected Delivery</label>
                  <div className="font-medium">{formatDate(purchase.expectedDeliveryDate)}</div>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">Created At</label>
                <div className="font-medium">{new Date(purchase.createdAt).toLocaleString()}</div>
              </div>
            </div>
            {purchase.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <div className="font-medium">{purchase.notes}</div>
              </div>
            )}
          </div>

          {/* Supplier Info */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Supplier Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <div className="font-medium">{purchase.supplier.name}</div>
              </div>
              {purchase.supplier.mobile && (
                <div>
                  <label className="text-sm text-gray-500">Mobile</label>
                  <div className="font-medium">{purchase.supplier.mobile}</div>
                </div>
              )}
              {purchase.supplier.email && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <div className="font-medium">{purchase.supplier.email}</div>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Purchase Items ({purchase.items.length})</h2>
            <div className="space-y-3">
              {purchase.items.map((item) => {
                const ordered = parseFloat(item.quantity)
                const received = parseFloat(item.quantityReceived)
                const remaining = ordered - received

                return (
                  <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">Product #{item.productId}</div>
                        <div className="text-sm text-gray-500">Variation #{item.productVariationId}</div>
                      </div>
                      {getItemReceivedStatus(item)}
                    </div>
                    <div className={`grid ${can(PERMISSIONS.PURCHASE_VIEW_COST) ? 'grid-cols-4' : 'grid-cols-3'} gap-4 text-sm`}>
                      <div>
                        <span className="text-gray-500">Ordered:</span>
                        <span className="ml-2 font-medium">{ordered}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Received:</span>
                        <span className="ml-2 font-medium text-green-600">{received}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Remaining:</span>
                        <span className="ml-2 font-medium text-orange-600">{remaining}</span>
                      </div>
                      {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                        <div>
                          <span className="text-gray-500">Unit Cost:</span>
                          <span className="ml-2 font-medium">{formatCurrency(parseFloat(item.unitCost))}</span>
                        </div>
                      )}
                    </div>
                    {item.requiresSerial && (
                      <div className="mt-2 text-xs text-blue-600">
                        🔢 Serial numbers required
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(purchase.subtotal)}</span>
                </div>
                {purchase.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax:</span>
                    <span className="font-medium">{formatCurrency(purchase.taxAmount)}</span>
                  </div>
                )}
                {purchase.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount:</span>
                    <span className="font-medium text-green-600">-{formatCurrency(purchase.discountAmount)}</span>
                  </div>
                )}
                {purchase.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping:</span>
                    <span className="font-medium">{formatCurrency(purchase.shippingCost)}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-900 font-semibold">Total:</span>
                    <span className="font-semibold text-lg">{formatCurrency(purchase.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Status Guide</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className={purchase.status === 'pending' ? 'font-bold text-blue-600' : ''}>
                • Pending - Awaiting goods
              </div>
              <div className={purchase.status === 'partially_received' ? 'font-bold text-blue-600' : ''}>
                • Partially Received - Some items received
              </div>
              <div className={purchase.status === 'received' ? 'font-bold text-green-600' : ''}>
                • Received - All goods received
              </div>
              <div className={purchase.status === 'cancelled' ? 'font-bold text-red-600' : ''}>
                • Cancelled
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
