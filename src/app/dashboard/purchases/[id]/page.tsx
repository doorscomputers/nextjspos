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
  quantity: number
  quantityReceived: number
  unitCost: number
  requiresSerial: boolean
  product: {
    id: number
    name: string
    sku: string
  } | null
  productVariation: {
    id: number
    name: string
  } | null
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
  business?: {
    name: string
    taxNumberPrimary?: string | null
    taxLabelPrimary?: string | null
    taxNumberSecondary?: string | null
    taxLabelSecondary?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
  } | null
  location?: {
    id: number
    name: string
    landmark?: string | null
    country?: string | null
    state?: string | null
    city?: string | null
    zipCode?: string | null
    mobile?: string | null
    alternateNumber?: string | null
    email?: string | null
  } | null
}

export default function PurchaseDetailPage() {
  const { can, user } = usePermissions()
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

  // For cancelling PO
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // For emailing to supplier
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSubject, setEmailSubject] = useState(`Purchase Order ${purchase?.purchaseOrderNumber}`)
  const [emailMessage, setEmailMessage] = useState(`Dear Supplier,\n\nPlease find attached our purchase order ${purchase?.purchaseOrderNumber}.\n\nKindly confirm receipt and expected delivery date.\n\nThank you for your continued partnership.`)

  const toNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }
    const parsed = Number.parseFloat(String(value))
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const normalizePurchase = (raw: any): Purchase => {
    const items: PurchaseItem[] = (raw.items ?? []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productVariationId: item.productVariationId,
      quantity: toNumber(item.quantity),
      quantityReceived: toNumber(item.quantityReceived),
      unitCost: toNumber(item.unitCost),
      requiresSerial: Boolean(item.requiresSerial),
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name ?? 'Unnamed Product',
            sku: item.product.sku ?? '',
          }
        : null,
      productVariation: item.productVariation
        ? {
            id: item.productVariation.id,
            name: item.productVariation.name ?? 'Standard',
          }
        : null,
    }))

    const locationMeta = raw.location
      ? {
          id: raw.location.id,
          name: raw.location.name ?? '',
          landmark: raw.location.landmark ?? null,
          country: raw.location.country ?? null,
          state: raw.location.state ?? null,
          city: raw.location.city ?? null,
          zipCode: raw.location.zipCode ?? null,
          mobile: raw.location.mobile ?? null,
          alternateNumber: raw.location.alternateNumber ?? null,
          email: raw.location.email ?? null,
        }
      : null

    const businessMeta = raw.business
      ? {
          name: raw.business.name ?? 'Company Name',
          taxNumberPrimary: raw.business.taxNumberPrimary ?? null,
          taxLabelPrimary: raw.business.taxLabelPrimary ?? null,
          taxNumberSecondary: raw.business.taxNumberSecondary ?? null,
          taxLabelSecondary: raw.business.taxLabelSecondary ?? null,
          phone: raw.business.phone ?? null,
          email: raw.business.email ?? null,
          address: raw.business.address ?? null,
        }
      : null

    if (businessMeta && !businessMeta.address && locationMeta) {
      const addressParts = [
        locationMeta.landmark,
        [locationMeta.city, locationMeta.state].filter(Boolean).join(', '),
        locationMeta.country,
        locationMeta.zipCode,
      ]
        .filter((part) => part && String(part).trim().length > 0)
        .map((part) => String(part).trim())

      businessMeta.address = addressParts.join(' | ') || null

      if (!businessMeta.phone) {
        businessMeta.phone = locationMeta.mobile || locationMeta.alternateNumber || null
      }

      if (!businessMeta.email) {
        businessMeta.email = locationMeta.email || null
      }
    }

    return {
      id: raw.id,
      purchaseOrderNumber: raw.purchaseOrderNumber,
      purchaseDate: raw.purchaseDate,
      expectedDeliveryDate: raw.expectedDeliveryDate,
      status: raw.status,
      subtotal: toNumber(raw.subtotal),
      taxAmount: toNumber(raw.taxAmount),
      discountAmount: toNumber(raw.discountAmount),
      shippingCost: toNumber(raw.shippingCost),
      totalAmount: toNumber(raw.totalAmount),
      notes: raw.notes ?? null,
      createdAt: raw.createdAt,
      supplier: {
        id: raw.supplier?.id ?? 0,
        name: raw.supplier?.name ?? 'Unknown Supplier',
        mobile: raw.supplier?.mobile ?? null,
        email: raw.supplier?.email ?? null,
      },
      items,
      business: businessMeta,
      location: locationMeta,
    }
  }

  const extractErrorMessage = async (response: Response) => {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json()
        return data?.error || data?.message || null
      } catch (_error) {
        return null
      }
    }

    try {
      const text = await response.text()
      return text
    } catch (_error) {
      return null
    }
  }

  useEffect(() => {
    fetchPurchase()
  }, [purchaseId])

  const fetchPurchase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchases/${purchaseId}`)
      const data = await response.json()

      if (!response.ok) {
        toast.error(data?.error || 'Failed to fetch purchase')
        router.push('/dashboard/purchases')
        return
      }

      const normalizedPurchase = normalizePurchase(data.data)
      setPurchase(normalizedPurchase)

      const quantities: { [key: number]: number } = {}
      normalizedPurchase.items.forEach((item: PurchaseItem) => {
        const remaining = Math.max(item.quantity - item.quantityReceived, 0)
        quantities[item.id] = remaining
      })
      setReceiveQuantities(quantities)
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
            const productName = purchaseItem.product?.name ?? 'Unknown product'
            throw new Error(`Product "${productName}" requires ${qty} serial number(s), but ${itemSerialNumbers.length} provided`)
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

  const hasIncompleteSerials = purchase
    ? purchase.items.some((item) => {
        if (!item.requiresSerial) return false
        const qty = receiveQuantities[item.id] || 0
        if (qty <= 0) return false
        const serials = serialNumbers[item.id] || []
        return serials.length !== qty
      })
    : false

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

  const handleCancelPurchaseOrder = async () => {
    if (!purchase) return

    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancelling the purchase order')
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/purchases/${purchaseId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Purchase order cancelled successfully!')
        setShowCancelDialog(false)
        setCancelReason('')
        fetchPurchase()
      } else {
        toast.error(data.error || 'Failed to cancel purchase order')
      }
    } catch (error) {
      console.error('Error cancelling purchase order:', error)
      toast.error('Failed to cancel purchase order')
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
      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response)
        throw new Error(errorMessage || 'Failed to export to Excel')
      }
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
      const message = error instanceof Error ? error.message : 'Failed to export to Excel'
      toast.error(message)
    }
  }

  const handleExportPDF = async () => {
    if (!purchase) return

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/export?format=pdf`)
      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response)
        throw new Error(errorMessage || 'Failed to export to PDF')
      }
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
      const message = error instanceof Error ? error.message : 'Failed to export to PDF'
      toast.error(message)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const parsed = new Date(dateString)
    if (Number.isNaN(parsed.getTime())) {
      return dateString
    }
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    const numericAmount = toNumber(amount)
    return `PHP ${numericAmount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string, className?: string } } = {
      'pending': { variant: 'outline', label: 'Pending', className: 'border-yellow-600 text-yellow-700 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
      'approved': { variant: 'default', label: 'Approved' },
      'partially_received': { variant: 'secondary', label: 'Partially Received' },
      'received': { variant: 'default', label: 'Received' },
      'cancelled': { variant: 'destructive', label: 'Cancelled' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return (
      <Badge
        variant={statusConfig.variant}
        className={`text-lg px-4 py-1.5 font-semibold ${statusConfig.className || ''}`}
      >
        {statusConfig.label}
      </Badge>
    )
  }

  const getItemReceivedStatus = (item: PurchaseItem) => {
    const ordered = item.quantity
    const received = item.quantityReceived
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
  const canCancel = purchase.status === 'pending' && (can(PERMISSIONS.PURCHASE_DELETE) || can(PERMISSIONS.PURCHASE_UPDATE))

  const businessName = purchase.business?.name || user?.businessName || 'Company Name'
  const businessAddress =
    purchase.business?.address ||
    purchase.location?.landmark ||
    user?.businessAddress ||
    '123 Business Street'
  const cityStateCountry = (() => {
    const cityState = [purchase.location?.city, purchase.location?.state].filter(Boolean).join(', ')
    const countryZip = [purchase.location?.country, purchase.location?.zipCode].filter(Boolean).join(' ')
    const segments = [cityState, countryZip].filter((segment) => segment && segment.trim().length > 0)
    if (segments.length > 0) {
      return segments.join(', ')
    }
    return `${user?.businessCity || 'City'}, ${user?.businessState || 'State'} ${user?.businessZip || '12345'}`
  })()
  const businessPhone =
    purchase.business?.phone ||
    purchase.location?.mobile ||
    purchase.location?.alternateNumber ||
    user?.businessPhone ||
    '(123) 456-7890'
  const businessEmail =
    purchase.business?.email || purchase.location?.email || user?.businessEmail || 'info@company.com'

  return (
    <div className="p-6 space-y-6">
      {/* Print-Only Header - Professional PO Template */}
      <div className="hidden print:block print-header">
        <div className="border-b-4 border-blue-600 pb-6 mb-6">
          {/* Company Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">{businessName}</h1>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{businessAddress}</p>
                <p>{cityStateCountry}</p>
                <p>Phone: {businessPhone}</p>
                <p>Email: {businessEmail}</p>
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
            <Button variant="outline" size="sm" className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
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
      <div className="bg-white p-4 rounded-lg shadow space-y-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && canReceive && (
            <Link href={`/dashboard/purchases/${purchaseId}/receive`}>
              <Button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold">
                <TruckIcon className="w-5 h-5 mr-2" />
                Receive Goods (GRN)
              </Button>
            </Link>
          )}

          {canClose && (
            <Button variant="outline" onClick={() => setShowCloseDialog(true)} className="border-orange-500 text-orange-600 hover:bg-orange-50 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <LockClosedIcon className="w-4 h-4 mr-2" />
              Close PO (Partial Delivery)
            </Button>
          )}

          {canCancel && (
            <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <XMarkIcon className="w-4 h-4 mr-2" />
              Cancel PO
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
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white no-print shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportPDF} className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white no-print shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={handleExportExcel} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white no-print shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
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
                    const ordered = item.quantity
                    const received = item.quantityReceived
                    const pending = ordered - received
                    const productName = item.product?.name ?? 'Unnamed Product'
                    const variationName = item.productVariation?.name ?? 'Standard'
                    return (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-gray-600">{productName} - {variationName}:</span>
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

      {/* Cancel PO Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Cancel Purchase Order</h3>
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">⚠️ Warning</h4>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                    <li>• This will permanently cancel the purchase order</li>
                    <li>• The PO cannot be received after cancellation</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-sm">
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>PO Number:</strong> {purchase.purchaseOrderNumber}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>Supplier:</strong> {purchase.supplier.name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>Total Amount:</strong> {formatCurrency(purchase.totalAmount)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason for cancellation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Supplier unable to fulfill order, Found better price, Order placed in error..."
                    required
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t dark:border-gray-600">
                  <Button
                    onClick={handleCancelPurchaseOrder}
                    disabled={actionLoading}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XMarkIcon className="w-4 h-4 mr-2" />
                    {actionLoading ? 'Cancelling...' : 'Cancel Purchase Order'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                    Keep PO
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
                      const ordered = item.quantity
                      const received = item.quantityReceived
                      const remaining = ordered - received
                      const productName = item.product?.name ?? 'Unnamed Product'
                      const variationName = item.productVariation?.name ?? 'Standard'
                      const sku = item.product?.sku ?? 'N/A'

                      return (
                        <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">
                                {productName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {variationName} • SKU: {sku}
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
                                productName={`${productName} - ${variationName}`}
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
              const quantity = item.quantity
              const unitCost = item.unitCost
              const lineTotal = quantity * unitCost
              const productName = item.product?.name ?? 'Unnamed Product'
              const variationName = item.productVariation?.name ?? 'Standard'
              const sku = item.product?.sku ?? 'N/A'

              return (
                <tr key={item.id}>
                  <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div className="font-medium">{productName}</div>
                    <div className="text-xs text-gray-600">{variationName}</div>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">{sku}</td>
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
        </table>

        {/* Print Summary - Outside table so it only appears at the end */}
        {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
          <div className="mt-6 border border-gray-300 rounded">
            <div className="flex justify-end">
              <div className="w-1/2 min-w-[300px]">
                <div className="flex justify-between border-b border-gray-300 px-4 py-2">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(purchase.subtotal)}</span>
                </div>
                {purchase.taxAmount > 0 && (
                  <div className="flex justify-between border-b border-gray-300 px-4 py-2">
                    <span>Tax:</span>
                    <span>{formatCurrency(purchase.taxAmount)}</span>
                  </div>
                )}
                {purchase.discountAmount > 0 && (
                  <div className="flex justify-between border-b border-gray-300 px-4 py-2">
                    <span>Discount:</span>
                    <span className="text-green-600">-{formatCurrency(purchase.discountAmount)}</span>
                  </div>
                )}
                {purchase.shippingCost > 0 && (
                  <div className="flex justify-between border-b border-gray-300 px-4 py-2">
                    <span>Shipping:</span>
                    <span>{formatCurrency(purchase.shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between bg-gray-100 px-4 py-3">
                  <span className="text-lg font-bold">TOTAL:</span>
                  <span className="text-lg font-bold">{formatCurrency(purchase.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
                const ordered = item.quantity
                const received = item.quantityReceived
                const remaining = ordered - received
                const productName = item.product?.name ?? 'Unnamed Product'
                const variationName = item.productVariation?.name ?? 'Standard'
                const sku = item.product?.sku ?? 'N/A'

                return (
                  <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{productName}</div>
                        <div className="text-sm text-gray-500">{variationName} • SKU: {sku}</div>
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
              totalAmount: purchase.totalAmount,
              subtotal: purchase.subtotal,
              taxAmount: purchase.taxAmount,
              discountAmount: purchase.discountAmount,
              shippingCharges: purchase.shippingCost,
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
