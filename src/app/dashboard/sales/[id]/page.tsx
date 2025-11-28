"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { ArrowLeftIcon, PrinterIcon, XMarkIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import SalesInvoicePrint from '@/components/SalesInvoicePrint'

interface SaleItem {
  id: number
  productId: number
  productVariationId: number
  quantity: number
  unitPrice: number
  unitCost: number
  taxAmount: number
  discountAmount: number
  totalPrice: number
  serialNumbers: any
  product?: {
    id: number
    name: string
    sku?: string | null
  } | null
  productName?: string | null
}

interface SalePayment {
  id: number
  paymentMethod: string
  amount: number
  referenceNumber: string | null
  notes: string | null
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  status: string
  notes: string | null
  createdAt: string
  customer: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  } | null
  items: SaleItem[]
  payments: SalePayment[]
}

export default function SaleDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { can } = usePermissions()
  const [sale, setSale] = useState<Sale | null>(null)
  const [business, setBusiness] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Customer return dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returningItems, setReturningItems] = useState<{ [itemId: number]: { quantity: number, condition: string } }>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [submittingReturn, setSubmittingReturn] = useState(false)

  // Print dialog state
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchSale(params.id as string)
    }
  }, [params.id])

  useEffect(() => {
    fetchBusinessInfo()
  }, [])

  const fetchBusinessInfo = async () => {
    try {
      const response = await fetch('/api/business')
      if (response.ok) {
        const data = await response.json()
        setBusiness(data)
      }
    } catch (error) {
      console.error('Error fetching business info:', error)
    }
  }

  const fetchSale = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sales/${id}`)
      const data = await response.json()

      if (response.ok) {
        setSale(data)

        // Fetch location details if sale has locationId
        if (data.locationId) {
          const locationResponse = await fetch(`/api/locations/${data.locationId}`)
          if (locationResponse.ok) {
            const locationData = await locationResponse.json()
            setLocation(locationData)
          }
        }
      } else {
        toast.error(data.error || 'Failed to fetch sale')
        router.push('/dashboard/sales')
      }
    } catch (error) {
      console.error('Error fetching sale:', error)
      toast.error('Failed to fetch sale')
      router.push('/dashboard/sales')
    } finally {
      setLoading(false)
    }
  }

  const handleVoidSale = async () => {
    if (!sale) return

    if (!confirm(`Are you sure you want to void sale ${sale.invoiceNumber}? Stock will be restored.`)) {
      return
    }

    try {
      const response = await fetch(`/api/sales/${sale.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Sale voided successfully')
        router.push('/dashboard/sales')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to void sale')
      }
    } catch (error) {
      console.error('Error voiding sale:', error)
      toast.error('Failed to void sale')
    }
  }

  const handlePrint = () => {
    setShowPrintDialog(true)
  }

  const handleOpenReturnDialog = () => {
    // Initialize return quantities for all items
    const initialItems: { [itemId: number]: { quantity: number, condition: string } } = {}
    sale?.items.forEach(item => {
      initialItems[item.id] = { quantity: 0, condition: 'resellable' }
    })
    setReturningItems(initialItems)
    setReturnReason('')
    setReturnNotes('')
    setReturnDialogOpen(true)
  }

  const handleReturnQuantityChange = (itemId: number, quantity: number) => {
    setReturningItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: Math.max(0, quantity)
      }
    }))
  }

  const handleReturnConditionChange = (itemId: number, condition: string) => {
    setReturningItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        condition
      }
    }))
  }

  const handleSubmitReturn = async () => {
    if (!sale) return

    // Validate at least one item selected
    const itemsToReturn = Object.entries(returningItems)
      .filter(([_, data]) => data.quantity > 0)
      .map(([itemId, data]) => {
        const saleItem = sale.items.find(i => i.id === parseInt(itemId))
        return {
          productId: saleItem!.productId,
          productVariationId: saleItem!.productVariationId,
          quantity: data.quantity,
          unitPrice: saleItem!.unitPrice,
          condition: data.condition,
          serialNumberIds: saleItem!.serialNumbers && Array.isArray(saleItem!.serialNumbers)
            ? saleItem!.serialNumbers.slice(0, data.quantity).map((sn: any) => sn.id)
            : []
        }
      })

    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return')
      return
    }

    if (!returnReason) {
      toast.error('Please provide a return reason')
      return
    }

    // Validate quantities
    for (const [itemId, data] of Object.entries(returningItems)) {
      if (data.quantity > 0) {
        const saleItem = sale.items.find(i => i.id === parseInt(itemId))
        if (saleItem && data.quantity > saleItem.quantity) {
          toast.error(`Return quantity for item cannot exceed sold quantity (${saleItem.quantity})`)
          return
        }
      }
    }

    try {
      setSubmittingReturn(true)

      const response = await fetch('/api/customer-returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saleId: sale.id,
          returnDate: new Date().toISOString(),
          returnReason,
          items: itemsToReturn,
          notes: returnNotes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Customer return created successfully')
        setReturnDialogOpen(false)
        // Optionally navigate to the return detail page
        router.push(`/dashboard/customer-returns/${data.return.id}`)
      } else {
        toast.error(data.error || 'Failed to create customer return')
        if (data.details) {
          toast.error(`Details: ${data.details}`)
        }
      }
    } catch (error) {
      console.error('Error creating customer return:', error)
      toast.error('Failed to create customer return')
    } finally {
      setSubmittingReturn(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return '0.00'
    }
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const getItemName = (item: SaleItem) => {
    return item.product?.name || item.productName || `Item #${item.productVariationId}`
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'completed': 'default',
      'pending': 'secondary',
      'voided': 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'cash': 'Cash',
      'card': 'Card',
      'bank_transfer': 'Bank Transfer',
      'cheque': 'Cheque',
      'other': 'Other',
    }
    return labels[method] || method
  }

  if (!can(PERMISSIONS.SELL_VIEW) && !can(PERMISSIONS.SELL_VIEW_OWN)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view sales.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">Loading sale details...</div>
      </div>
    )
  }

  if (!sale) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Sale not found
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 print:p-0">
      {/* Header - Hide on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="outline" size="sm" className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{sale.invoiceNumber}</h1>
            <p className="text-gray-500 mt-1">{formatDate(sale.saleDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
          {can(PERMISSIONS.CUSTOMER_RETURN_CREATE) && sale.status === 'completed' && (
            <Button
              variant="outline"
              onClick={handleOpenReturnDialog}
              className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              <ArrowUturnLeftIcon className="w-4 h-4 mr-2" />
              Create Return
            </Button>
          )}
          {can(PERMISSIONS.SELL_DELETE) && sale.status !== 'voided' && (
            <Button variant="destructive" onClick={handleVoidSale} className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <XMarkIcon className="w-4 h-4 mr-2" />
              Void Sale
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Content */}
      <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none">
        {/* Invoice Header */}
        <div className="border-b pb-6 mb-6">
          {/* Company Name at Top Center */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{business?.name || 'Business Name'}</h1>
            {business?.address && <p className="text-gray-600 text-sm">{business.address}</p>}
            {(business?.city || business?.state || business?.zipCode) && (
              <p className="text-gray-600 text-sm">
                {[business?.city, business?.state, business?.zipCode].filter(Boolean).join(', ')}
              </p>
            )}
            {business?.phone && <p className="text-gray-600 text-sm">Tel: {business.phone}</p>}
            {business?.email && <p className="text-gray-600 text-sm">Email: {business.email}</p>}
            {location && (
              <div className="mt-2 pt-2 border-t border-gray-300">
                <p className="text-gray-700 text-sm font-medium">{location.name}</p>
                {location.address && <p className="text-gray-600 text-xs">{location.address}</p>}
                {location.mobile && <p className="text-gray-600 text-xs">Mobile: {location.mobile}</p>}
              </div>
            )}
          </div>

          {/* Invoice Info */}
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">SALES INVOICE</h2>
            <p className="text-gray-600">{sale.invoiceNumber}</p>
            <p className="text-gray-600">Date: {formatDate(sale.saleDate)}</p>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">Bill To:</h3>
          {sale.customer ? (
            <div className="text-gray-700">
              <p className="font-medium">{sale.customer.name}</p>
              {sale.customer.mobile && <p>Phone: {sale.customer.mobile}</p>}
              {sale.customer.email && <p>Email: {sale.customer.email}</p>}
            </div>
          ) : (
            <p className="text-gray-500">Walk-in Customer</p>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2">Item</th>
                <th className="text-center py-2 px-2">Quantity</th>
                <th className="text-right py-2 px-2">Unit Price</th>
                <th className="text-right py-2 px-2">Tax</th>
                <th className="text-right py-2 px-2">Discount</th>
                <th className="text-right py-2 px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3 px-2">
                    <div>
                      <p className="font-medium">{getItemName(item)}</p>
                      {item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 && (
                        <p className="text-xs text-gray-500">
                          S/N: {item.serialNumbers.map((sn: any) => sn.serialNumber).join(', ')}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">{item.quantity}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(item.taxAmount)}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(item.discountAmount)}</td>
                  <td className="text-right py-3 px-2 font-semibold">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2">
            <div className="flex justify-between py-2 border-t">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.taxAmount > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Tax:</span>
                <span className="font-semibold">{formatCurrency(sale.taxAmount)}</span>
              </div>
            )}
            {sale.discountAmount > 0 && (
              <div className="flex justify-between py-2 text-red-600">
                <span>Discount:</span>
                <span className="font-semibold">-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            {sale.shippingCost > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-semibold">{formatCurrency(sale.shippingCost)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-2 border-gray-300 text-lg">
              <span className="font-bold">Total:</span>
              <span className="font-bold">{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        {sale.payments.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">Payment Information</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              {sale.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">{getPaymentMethodLabel(payment.paymentMethod)}</p>
                    {payment.referenceNumber && (
                      <p className="text-sm text-gray-500">Ref: {payment.referenceNumber}</p>
                    )}
                    {payment.notes && (
                      <p className="text-sm text-gray-500">{payment.notes}</p>
                    )}
                  </div>
                  <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {sale.notes && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Notes</h3>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{sale.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-6 text-center text-gray-500 text-sm">
          <p>Created: {formatDate(sale.createdAt)}</p>
        </div>
      </div>

      {/* Customer Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Customer Return</DialogTitle>
            <DialogDescription>
              Select items to return from sale {sale.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Return Reason */}
            <div className="space-y-2">
              <Label htmlFor="returnReason">Return Reason *</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger id="returnReason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defective">Defective Product</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item Shipped</SelectItem>
                  <SelectItem value="not_as_described">Not as Described</SelectItem>
                  <SelectItem value="customer_request">Customer Request</SelectItem>
                  <SelectItem value="warranty">Warranty Claim</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Items to Return */}
            <div className="space-y-4">
              <Label>Items to Return</Label>
              <div className="border rounded-lg divide-y">
                {sale.items.map((item) => (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{getItemName(item)}</p>
                        <p className="text-sm text-gray-500">
                          Sold Quantity: {item.quantity} | Unit Price: {formatCurrency(item.unitPrice)}
                        </p>
                        {item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            S/N: {item.serialNumbers.map((sn: any) => sn.serialNumber).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`qty-${item.id}`}>Return Quantity</Label>
                        <Input
                          id={`qty-${item.id}`}
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returningItems[item.id]?.quantity || 0}
                          onChange={(e) => handleReturnQuantityChange(item.id, parseInt(e.target.value) || 0)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`condition-${item.id}`}>Condition</Label>
                        <Select
                          value={returningItems[item.id]?.condition || 'resellable'}
                          onValueChange={(value) => handleReturnConditionChange(item.id, value)}
                        >
                          <SelectTrigger id={`condition-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="resellable">Resellable (Restore Stock)</SelectItem>
                            <SelectItem value="damaged">Damaged (No Restore)</SelectItem>
                            <SelectItem value="defective">Defective (No Restore)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {returningItems[item.id]?.quantity > 0 && (
                      <div className={`text-sm p-2 rounded ${
                        returningItems[item.id]?.condition === 'resellable'
                          ? 'bg-green-50 text-green-800'
                          : 'bg-orange-50 text-orange-800'
                      }`}>
                        {returningItems[item.id]?.condition === 'resellable'
                          ? `✓ ${returningItems[item.id]?.quantity} unit(s) will be restored to stock`
                          : `✗ ${returningItems[item.id]?.quantity} unit(s) will NOT be restored to stock`
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="returnNotes">Notes (Optional)</Label>
              <Textarea
                id="returnNotes"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Add any additional notes about this return..."
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Return Summary</p>
              <div className="space-y-1 text-sm text-blue-800">
                <p>Total Items Selected: {Object.values(returningItems).filter(item => item.quantity > 0).length}</p>
                <p>
                  Resellable: {Object.values(returningItems).filter(item => item.quantity > 0 && item.condition === 'resellable').reduce((sum, item) => sum + item.quantity, 0)} units
                </p>
                <p>
                  Damaged/Defective: {Object.values(returningItems).filter(item => item.quantity > 0 && item.condition !== 'resellable').reduce((sum, item) => sum + item.quantity, 0)} units
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              disabled={submittingReturn}
              className="shadow-md hover:shadow-lg transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReturn}
              disabled={submittingReturn}
              className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              {submittingReturn ? 'Creating Return...' : 'Create Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog with Paper Size Options */}
      {sale && (
        <SalesInvoicePrint
          sale={sale}
          isOpen={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          business={business}
          location={location}
        />
      )}
    </div>
  )
}
