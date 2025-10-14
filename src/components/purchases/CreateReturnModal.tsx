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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ReceiptItem {
  id: number
  productId: number
  productVariationId: number
  productName?: string
  variationName?: string
  quantityReceived: number
  unitCost?: number
}

interface Receipt {
  id: number
  receiptNumber: string
  supplierId: number
  supplierName: string
  items: ReceiptItem[]
}

interface ReturnItem {
  purchaseReceiptItemId: number
  productId: number
  productVariationId: number
  quantityReturned: number
  unitCost: number
  condition: string
  notes: string
}

interface CreateReturnModalProps {
  open: boolean
  onClose: () => void
  receipt: Receipt
  onSuccess: () => void
}

export default function CreateReturnModal({
  open,
  onClose,
  receipt,
  onSuccess,
}: CreateReturnModalProps) {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnReason, setReturnReason] = useState('')
  const [expectedAction, setExpectedAction] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({})
  const [itemConditions, setItemConditions] = useState<Record<number, string>>({})
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({})
  const [creating, setCreating] = useState(false)

  const handleItemToggle = (itemId: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
      // Clear related data
      const newQuantities = { ...returnQuantities }
      const newConditions = { ...itemConditions }
      const newNotes = { ...itemNotes }
      delete newQuantities[itemId]
      delete newConditions[itemId]
      delete newNotes[itemId]
      setReturnQuantities(newQuantities)
      setItemConditions(newConditions)
      setItemNotes(newNotes)
    } else {
      newSelected.add(itemId)
      // Set default values
      const item = receipt.items.find((i) => i.id === itemId)
      if (item) {
        setReturnQuantities({ ...returnQuantities, [itemId]: 1 })
        setItemConditions({ ...itemConditions, [itemId]: 'damaged' })
      }
    }
    setSelectedItems(newSelected)
  }

  const handleCreate = async () => {
    // Validation
    if (!returnReason) {
      toast.error('Please select a return reason')
      return
    }

    if (!expectedAction) {
      toast.error('Please select expected action from supplier')
      return
    }

    if (selectedItems.size === 0) {
      toast.error('Please select at least one item to return')
      return
    }

    // Validate all selected items have required data
    for (const itemId of Array.from(selectedItems)) {
      const item = receipt.items.find((i) => i.id === itemId)
      if (!item) continue

      const quantity = returnQuantities[itemId]
      const condition = itemConditions[itemId]

      if (!quantity || quantity <= 0) {
        toast.error(`Invalid quantity for item`)
        return
      }

      if (quantity > item.quantityReceived) {
        toast.error(`Quantity cannot exceed received quantity (${item.quantityReceived})`)
        return
      }

      if (!condition) {
        toast.error(`Please select condition for all items`)
        return
      }
    }

    // Build items array
    const items: ReturnItem[] = Array.from(selectedItems).map((itemId) => {
      const item = receipt.items.find((i) => i.id === itemId)!
      return {
        purchaseReceiptItemId: itemId,
        productId: item.productId,
        productVariationId: item.productVariationId,
        quantityReturned: returnQuantities[itemId],
        unitCost: item.unitCost || 0,
        condition: itemConditions[itemId],
        notes: itemNotes[itemId] || '',
      }
    })

    setCreating(true)
    try {
      const res = await fetch('/api/purchases/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseReceiptId: receipt.id,
          returnDate,
          returnReason,
          expectedAction,
          notes,
          items,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create return')
      }

      const data = await res.json()
      toast.success('Purchase return created successfully')
      onSuccess()
      onClose()

      // Reset form
      setSelectedItems(new Set())
      setReturnQuantities({})
      setItemConditions({})
      setItemNotes({})
      setReturnReason('')
      setExpectedAction('')
      setNotes('')
    } catch (error: any) {
      console.error('Error creating return:', error)
      toast.error(error.message || 'Failed to create purchase return')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <ArrowUturnLeftIcon className="w-6 h-6" />
            Create Purchase Return
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Return items from GRN {receipt.receiptNumber} to {receipt.supplierName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Return Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returnDate" className="text-gray-900 dark:text-white">
                Return Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <Label htmlFor="returnReason" className="text-gray-900 dark:text-white">
                Return Reason <span className="text-red-500">*</span>
              </Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="damaged" className="text-gray-900 dark:text-white">
                    Damaged
                  </SelectItem>
                  <SelectItem value="wrong_item" className="text-gray-900 dark:text-white">
                    Wrong Item
                  </SelectItem>
                  <SelectItem value="quality_issue" className="text-gray-900 dark:text-white">
                    Quality Issue
                  </SelectItem>
                  <SelectItem value="overcharge" className="text-gray-900 dark:text-white">
                    Overcharge
                  </SelectItem>
                  <SelectItem value="expired" className="text-gray-900 dark:text-white">
                    Expired
                  </SelectItem>
                  <SelectItem value="defective" className="text-gray-900 dark:text-white">
                    Defective
                  </SelectItem>
                  <SelectItem value="not_as_ordered" className="text-gray-900 dark:text-white">
                    Not as Ordered
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="expectedAction" className="text-gray-900 dark:text-white">
              Expected Action from Supplier <span className="text-red-500">*</span>
            </Label>
            <Select value={expectedAction} onValueChange={setExpectedAction}>
              <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select expected action" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectItem value="refund" className="text-gray-900 dark:text-white">
                  Refund
                </SelectItem>
                <SelectItem value="replacement" className="text-gray-900 dark:text-white">
                  Replacement
                </SelectItem>
                <SelectItem value="credit_note" className="text-gray-900 dark:text-white">
                  Credit Note
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes" className="text-gray-900 dark:text-white">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this return..."
              rows={3}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* Items Selection */}
          <div>
            <Label className="text-gray-900 dark:text-white mb-3 block">
              Select Items to Return <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-4 border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-96 overflow-y-auto">
              {receipt.items.map((item) => {
                const isSelected = selectedItems.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleItemToggle(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.productName || `Product #${item.productId}`}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.variationName || `Variation #${item.productVariationId}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Received: {item.quantityReceived} units
                          </p>
                        </div>

                        {isSelected && (
                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                            <div>
                              <Label className="text-xs text-gray-700 dark:text-gray-300">
                                Quantity <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max={item.quantityReceived}
                                value={returnQuantities[item.id] || 1}
                                onChange={(e) =>
                                  setReturnQuantities({
                                    ...returnQuantities,
                                    [item.id]: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-gray-700 dark:text-gray-300">
                                Condition <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={itemConditions[item.id] || 'damaged'}
                                onValueChange={(value) =>
                                  setItemConditions({ ...itemConditions, [item.id]: value })
                                }
                              >
                                <SelectTrigger className="bg-white dark:bg-gray-600 text-gray-900 dark:text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-800">
                                  <SelectItem value="good_condition">Good Condition</SelectItem>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                  <SelectItem value="defective">Defective</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Label className="text-xs text-gray-700 dark:text-gray-300">
                                Item Notes
                              </Label>
                              <Textarea
                                value={itemNotes[item.id] || ''}
                                onChange={(e) =>
                                  setItemNotes({ ...itemNotes, [item.id]: e.target.value })
                                }
                                placeholder="Notes for this item..."
                                rows={2}
                                className="bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {selectedItems.size} item(s) selected
            </p>
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
            <ArrowUturnLeftIcon className="w-4 h-4 mr-2" />
            {creating ? 'Creating...' : 'Create Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
