'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface Purchase {
  id: number
  referenceNo: string
  totalAmount: number
  subtotal: number
  taxAmount: number
  discountAmount?: number
  shippingCharges?: number
  deliveryDate?: string
  paymentTerms?: string
  notes?: string
}

interface CreateAmendmentModalProps {
  open: boolean
  onClose: () => void
  purchase: Purchase
  onSuccess: () => void
}

export default function CreateAmendmentModal({
  open,
  onClose,
  purchase,
  onSuccess,
}: CreateAmendmentModalProps) {
  const [amendmentReason, setAmendmentReason] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Financial fields
  const [newSubtotal, setNewSubtotal] = useState(purchase.subtotal.toString())
  const [newTaxAmount, setNewTaxAmount] = useState(purchase.taxAmount.toString())
  const [newShippingCharges, setNewShippingCharges] = useState((purchase.shippingCharges || 0).toString())
  const [newDiscountAmount, setNewDiscountAmount] = useState((purchase.discountAmount || 0).toString())

  // Other fields
  const [newDeliveryDate, setNewDeliveryDate] = useState(
    purchase.deliveryDate ? new Date(purchase.deliveryDate).toISOString().split('T')[0] : ''
  )
  const [newPaymentTerms, setNewPaymentTerms] = useState(purchase.paymentTerms || '')
  const [newNotes, setNewNotes] = useState(purchase.notes || '')

  const calculateNewTotal = () => {
    const subtotal = parseFloat(newSubtotal) || 0
    const tax = parseFloat(newTaxAmount) || 0
    const shipping = parseFloat(newShippingCharges) || 0
    const discount = parseFloat(newDiscountAmount) || 0
    return subtotal + tax + shipping - discount
  }

  const detectChanges = () => {
    const changes: any = {}

    // Financial changes
    if (parseFloat(newSubtotal) !== purchase.subtotal) {
      changes.subtotal = parseFloat(newSubtotal)
    }
    if (parseFloat(newTaxAmount) !== purchase.taxAmount) {
      changes.taxAmount = parseFloat(newTaxAmount)
    }
    if (parseFloat(newShippingCharges) !== (purchase.shippingCharges || 0)) {
      changes.shippingCharges = parseFloat(newShippingCharges)
    }
    if (parseFloat(newDiscountAmount) !== (purchase.discountAmount || 0)) {
      changes.discountAmount = parseFloat(newDiscountAmount)
    }

    // Delivery date change
    const oldDeliveryDate = purchase.deliveryDate ? new Date(purchase.deliveryDate).toISOString().split('T')[0] : ''
    if (newDeliveryDate !== oldDeliveryDate) {
      changes.deliveryDate = newDeliveryDate
    }

    // Payment terms change
    if (newPaymentTerms !== (purchase.paymentTerms || '')) {
      changes.paymentTerms = newPaymentTerms
    }

    // Notes change
    if (newNotes !== (purchase.notes || '')) {
      changes.notes = newNotes
    }

    return changes
  }

  const handleCreate = async () => {
    // Validation
    if (!amendmentReason) {
      toast.error('Please select an amendment reason')
      return
    }

    if (!description) {
      toast.error('Please provide a description for this amendment')
      return
    }

    const changedFields = detectChanges()

    if (Object.keys(changedFields).length === 0) {
      toast.error('No changes detected. Please modify at least one field.')
      return
    }

    setCreating(true)
    try {
      const newTotal = calculateNewTotal()

      const res = await fetch(`/api/purchases/${purchase.id}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amendmentReason,
          description,
          notes,
          changedFields,
          newSubtotal: parseFloat(newSubtotal),
          newTaxAmount: parseFloat(newTaxAmount),
          newTotalAmount: newTotal,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create amendment')
      }

      const data = await res.json()
      toast.success('Amendment request created successfully and is pending approval')
      onSuccess()
      onClose()

      // Reset form
      setAmendmentReason('')
      setDescription('')
      setNotes('')
      setNewSubtotal(purchase.subtotal.toString())
      setNewTaxAmount(purchase.taxAmount.toString())
      setNewShippingCharges((purchase.shippingCharges || 0).toString())
      setNewDiscountAmount((purchase.discountAmount || 0).toString())
    } catch (error: any) {
      console.error('Error creating amendment:', error)
      toast.error(error.message || 'Failed to create amendment')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <DocumentTextIcon className="w-6 h-6" />
            Create Amendment - PO {purchase.referenceNo}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Request changes to this approved purchase order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amendment Reason */}
          <div>
            <Label htmlFor="amendmentReason" className="text-gray-900 dark:text-white">
              Amendment Reason <span className="text-red-500">*</span>
            </Label>
            <Select value={amendmentReason} onValueChange={setAmendmentReason}>
              <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectItem value="price_change" className="text-gray-900 dark:text-white">
                  Price Change
                </SelectItem>
                <SelectItem value="quantity_change" className="text-gray-900 dark:text-white">
                  Quantity Change
                </SelectItem>
                <SelectItem value="delivery_date_change" className="text-gray-900 dark:text-white">
                  Delivery Date Change
                </SelectItem>
                <SelectItem value="payment_terms_change" className="text-gray-900 dark:text-white">
                  Payment Terms Change
                </SelectItem>
                <SelectItem value="shipping_change" className="text-gray-900 dark:text-white">
                  Shipping Change
                </SelectItem>
                <SelectItem value="supplier_request" className="text-gray-900 dark:text-white">
                  Supplier Request
                </SelectItem>
                <SelectItem value="discount_adjustment" className="text-gray-900 dark:text-white">
                  Discount Adjustment
                </SelectItem>
                <SelectItem value="tax_adjustment" className="text-gray-900 dark:text-white">
                  Tax Adjustment
                </SelectItem>
                <SelectItem value="other" className="text-gray-900 dark:text-white">
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-gray-900 dark:text-white">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the changes and reason for this amendment..."
              rows={3}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* Financial Fields */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Financial Changes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900 dark:text-white">Subtotal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newSubtotal}
                  onChange={(e) => setNewSubtotal(e.target.value)}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-white">Tax Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTaxAmount}
                  onChange={(e) => setNewTaxAmount(e.target.value)}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-white">Shipping Charges</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newShippingCharges}
                  onChange={(e) => setNewShippingCharges(e.target.value)}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-white">Discount Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newDiscountAmount}
                  onChange={(e) => setNewDiscountAmount(e.target.value)}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>New Total:</strong> ${calculateNewTotal().toFixed(2)}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Previous Total: ${purchase.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Other Fields */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Other Changes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900 dark:text-white">Delivery Date</Label>
                <Input
                  type="date"
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-white">Payment Terms</Label>
                <Input
                  type="text"
                  value={newPaymentTerms}
                  onChange={(e) => setNewPaymentTerms(e.target.value)}
                  placeholder="e.g., Net 30"
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="newNotes" className="text-gray-900 dark:text-white">
              Purchase Order Notes
            </Label>
            <Textarea
              id="newNotes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Update purchase order notes..."
              rows={3}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* Amendment Notes */}
          <div>
            <Label htmlFor="notes" className="text-gray-900 dark:text-white">
              Amendment Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this amendment request..."
              rows={2}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            {creating ? 'Creating...' : 'Create Amendment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
