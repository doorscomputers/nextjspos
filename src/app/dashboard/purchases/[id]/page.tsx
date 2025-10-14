"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, TruckIcon, CheckCircleIcon, XMarkIcon, DocumentTextIcon, ClockIcon, LockClosedIcon, PrinterIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import AmendmentHistoryModal from '@/components/purchases/AmendmentHistoryModal'
import CreateAmendmentModal from '@/components/purchases/CreateAmendmentModal'
import { SerialNumberInputInline, type SerialNumberData } from '@/components/purchases/SerialNumberInputInline'

interface PurchaseItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  quantityReceived: string
  unitCost: string
  requiresSerial: boolean
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
  }
}

interface Purchase {
  id: number
  purchaseOrderNumber: string
  purchaseDate: string
  expectedDeliveryDate: string | null
  status: string
  subtotal: number | string
  taxAmount: number | string
  discountAmount: number | string
  shippingCost: number | string
  totalAmount: number | string
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
  const [serialNumbers, setSerialNumbers] = useState<{ [key: number]: SerialNumberData[] }>({})

  // For amendments
  const [showAmendmentHistory, setShowAmendmentHistory] = useState(false)
  const [showCreateAmendment, setShowCreateAmendment] = useState(false)

  // For closing PO
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closeReason, setCloseReason] = useState('')

  // For emailing to supplier
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSubject, setEmailSubject] = useState(`Purchase Order ${purchase?.purchaseOrderNumber}`)
  const [emailMessage, setEmailMessage] = useState(`Dear Supplier,\n\nPlease find attached our purchase order ${purchase?.purchaseOrderNumber}.\n\nKindly confirm receipt and expected delivery date.\n\nThank you for your continued partnership.`)

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

    try {
      // Build items array for receiving
      const itemsToReceive = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const purchaseItem = purchase.items.find(i => i.id === parseInt(itemId))
          const itemSerialNumbers = serialNumbers[parseInt(itemId)] || []

          // Validate serial numbers if required
          if (purchaseItem?.requiresSerial && itemSerialNumbers.length !== qty) {
            throw new Error(`Product "${purchaseItem.product.name}" requires ${qty} serial number(s), but ${itemSerialNumbers.length} provided`)
          }

          return {
            purchaseItemId: parseInt(itemId),
            quantityReceived: qty,
            serialNumbers: itemSerialNumbers.length > 0 ? itemSerialNumbers : undefined,
            notes: '',
          }
        })

      if (itemsToReceive.length === 0) {
        toast.error('Please specify quantities to receive')
        return
      }

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
        toast.success(`GRN created successfully (${data.receiptNumber})! Awaiting approval to add stock.`)
        setShowReceiveDialog(false)
        // Force a fresh fetch from the server
        await fetchPurchase()
        // Reload the page to ensure all data is up-to-date
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to receive goods')
      }
    } catch (error) {
      console.error('Error receiving goods:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to receive goods')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleClosePurchaseOrder = async () => {
    if (!purchase) return

    if (!closeReason.trim()) {
      toast.error('Please provide a reason for closing the purchase order')
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/purchases/${purchaseId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: closeReason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Purchase order closed successfully! Accounts Payable entry ${data.data.accountsPayableCreated ? 'created' : 'updated'}.`)
        setShowCloseDialog(false)
        setCloseReason('')
        fetchPurchase()
      } else {
        toast.error(data.error || 'Failed to close purchase order')
      }
    } catch (error) {
      console.error('Error closing purchase order:', error)
      toast.error('Failed to close purchase order')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    if (!purchase) return

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/export?format=excel`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${purchase.purchaseOrderNumber}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Purchase Order exported to Excel')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Failed to export to Excel')
    }
  }

  const handleExportPDF = async () => {
    if (!purchase) return

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/export?format=pdf`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${purchase.purchaseOrderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Purchase Order exported to PDF')
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Failed to export to PDF')
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
      'approved': { variant: 'default', label: 'Approved' },
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
  const canClose = purchase.status === 'partially_received' && can(PERMISSIONS.PURCHASE_UPDATE)

  return (
    <div className="p-6 space-y-6">
      {/* Print-Only Header - Professional PO Template */}
      <div className="hidden print:block print-header">
        <div className="border-b-4 border-blue-600 pb-6 mb-6">
          {/* Company Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">{user?.businessName || 'Company Name'}</h1>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{user?.businessAddress || '123 Business Street'}</p>
                <p>{user?.businessCity || 'City'}, {user?.businessState || 'State'} {user?.businessZip || '12345'}</p>
                <p>Phone: {user?.businessPhone || '(123) 456-7890'}</p>
                <p>Email: {user?.businessEmail || 'info@company.com'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-800 mb-2">PURCHASE ORDER</div>
              <div className="text-sm text-gray-600">
                <p><strong>PO #:</strong> {purchase.purchaseOrderNumber}</p>
                <p><strong>Date:</strong> {formatDate(purchase.purchaseDate)}</p>
                {purchase.expectedDeliveryDate && (
                  <p><strong>Expected Delivery:</strong> {formatDate(purchase.expectedDeliveryDate)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Supplier Information */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-2">SUPPLIER INFORMATION</h3>
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{purchase.supplier.name}</p>
              {purchase.supplier.mobile && <p>Phone: {purchase.supplier.mobile}</p>}
              {purchase.supplier.email && <p>Email: {purchase.supplier.email}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Screen-Only Header */}
      <div className="print:hidden flex items-center justify-between">
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
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && canReceive && (
            <Link href={`/dashboard/purchases/${purchaseId}/receive`}>
              <Button>
                <TruckIcon className="w-4 h-4 mr-2" />
                Receive Goods (GRN)
              </Button>
            </Link>
          )}

          {canClose && (
            <Button variant="outline" onClick={() => setShowCloseDialog(true)} className="border-orange-500 text-orange-600 hover:bg-orange-50">
              <LockClosedIcon className="w-4 h-4 mr-2" />
              Close PO (Partial Delivery)
            </Button>
          )}

          {/* TEMPORARILY HIDDEN - Amendment History Feature */}
          {/* {can(PERMISSIONS.PURCHASE_AMENDMENT_VIEW) && (
            <Button variant="outline" onClick={() => setShowAmendmentHistory(true)}>
              <ClockIcon className="w-4 h-4 mr-2" />
              Amendment History
            </Button>
          )} */}

          {/* {can(PERMISSIONS.PURCHASE_AMENDMENT_CREATE) && purchase.status === 'approved' && (
            <Button variant="outline" onClick={() => setShowCreateAmendment(true)}>
              <DocumentTextIcon className="w-4 h-4 mr-2" />
              Request Amendment
            </Button>
          )} */}
        </div>

        {/* Print & Export Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="no-print">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="no-print">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Close PO Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-orange-600">Close Purchase Order</h3>
                <button
                  onClick={() => setShowCloseDialog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-800 mb-2">⚠️ What does closing a PO mean?</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• The PO will be marked as "Received" (completed)</li>
                    <li>• An Accounts Payable entry will be created for the ACTUAL received amount</li>
                    <li>• You can proceed with payment for what was delivered</li>
                    <li>• This is useful when the supplier cannot deliver remaining items</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <h4 className="font-semibold text-gray-700">Current Status Summary:</h4>
                  {purchase.items.map((item) => {
                    const ordered = parseFloat(item.quantity)
                    const received = parseFloat(item.quantityReceived)
                    const pending = ordered - received
                    return (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-gray-600">{item.product.name} - {item.productVariation.name}:</span>
                        <span className={pending > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                          {received}/{ordered} received {pending > 0 && `(${pending} pending)`}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for closing <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., Supplier confirmed remaining items out of stock, Accepted partial delivery due to urgency..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be recorded in the audit log and added to the PO notes
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleClosePurchaseOrder}
                    disabled={actionLoading}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <LockClosedIcon className="w-4 h-4 mr-2" />
                    Close Purchase Order
                  </Button>
                  <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Dialog */}
      {showReceiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
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
                                {item.product.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.productVariation.name} • SKU: {item.product.sku}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
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
                            <div className="mt-4 border-t pt-4">
                              <SerialNumberInputInline
                                requiredCount={receiveQuantities[item.id]}
                                productName={`${item.product.name} - ${item.productVariation.name}`}
                                onSerialNumbersChange={(serials) => {
                                  setSerialNumbers({
                                    ...serialNumbers,
                                    [item.id]: serials
                                  })
                                }}
                                initialSerialNumbers={serialNumbers[item.id] || []}
                              />
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

      {/* Print-Only Items Table */}
      <div className="hidden print:block">
        <table className="w-full border-collapse border border-gray-300 mt-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">#</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
              <th className="border border-gray-300 px-4 py-2 text-left">SKU</th>
              <th className="border border-gray-300 px-4 py-2 text-right">Quantity</th>
              {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                <>
                  <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item, index) => {
              const quantity = parseFloat(item.quantity)
              const unitCost = parseFloat(item.unitCost)
              const lineTotal = quantity * unitCost

              return (
                <tr key={item.id}>
                  <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-xs text-gray-600">{item.productVariation.name}</div>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">{item.product.sku}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{quantity}</td>
                  {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                    <>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(unitCost)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
            <tfoot>
              <tr>
                <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right font-semibold">Subtotal:</td>
                <td colSpan={2} className="border border-gray-300 px-4 py-2 text-right font-semibold">{formatCurrency(purchase.subtotal)}</td>
              </tr>
              {purchase.taxAmount > 0 && (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">Tax:</td>
                  <td colSpan={2} className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(purchase.taxAmount)}</td>
                </tr>
              )}
              {purchase.discountAmount > 0 && (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">Discount:</td>
                  <td colSpan={2} className="border border-gray-300 px-4 py-2 text-right text-green-600">-{formatCurrency(purchase.discountAmount)}</td>
                </tr>
              )}
              {purchase.shippingCost > 0 && (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">Shipping:</td>
                  <td colSpan={2} className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(purchase.shippingCost)}</td>
                </tr>
              )}
              <tr className="bg-gray-100">
                <td colSpan={4} className="border border-gray-300 px-4 py-3 text-right text-lg font-bold">TOTAL:</td>
                <td colSpan={2} className="border border-gray-300 px-4 py-3 text-right text-lg font-bold">{formatCurrency(purchase.totalAmount)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Print Notes */}
        {purchase.notes && (
          <div className="mt-6 border border-gray-300 p-4 rounded">
            <h3 className="font-semibold mb-2">Notes:</h3>
            <p className="text-sm">{purchase.notes}</p>
          </div>
        )}

        {/* Print Footer */}
        <div className="mt-12 border-t border-gray-300 pt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold mb-4">Prepared By:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-600">Signature & Date</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-4">Approved By:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-600">Signature & Date</p>
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>This is a computer-generated purchase order and is valid without signature.</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
      </div>

      {/* Screen-Only Content */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-sm text-gray-500">{item.productVariation.name} • SKU: {item.product.sku}</div>
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

      {/* Amendment Modals */}
      {purchase && (
        <>
          <AmendmentHistoryModal
            open={showAmendmentHistory}
            onClose={() => setShowAmendmentHistory(false)}
            purchaseId={purchase.id}
            referenceNo={purchase.purchaseOrderNumber}
          />

          <CreateAmendmentModal
            open={showCreateAmendment}
            onClose={() => setShowCreateAmendment(false)}
            purchase={{
              id: purchase.id,
              referenceNo: purchase.purchaseOrderNumber,
              totalAmount: typeof purchase.totalAmount === 'string' ? parseFloat(purchase.totalAmount) : purchase.totalAmount,
              subtotal: typeof purchase.subtotal === 'string' ? parseFloat(purchase.subtotal) : purchase.subtotal,
              taxAmount: typeof purchase.taxAmount === 'string' ? parseFloat(purchase.taxAmount) : purchase.taxAmount,
              discountAmount: typeof purchase.discountAmount === 'string' ? parseFloat(purchase.discountAmount) : purchase.discountAmount,
              shippingCharges: typeof purchase.shippingCost === 'string' ? parseFloat(purchase.shippingCost) : purchase.shippingCost,
              deliveryDate: purchase.expectedDeliveryDate || undefined,
              paymentTerms: undefined,
              notes: purchase.notes || undefined,
            }}
            onSuccess={() => {
              fetchPurchase()
              setShowAmendmentHistory(true)
            }}
          />
        </>
      )}
    </div>
  )
}
