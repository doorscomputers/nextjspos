"use client"

import { useState, useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import ProductAutocomplete from '@/components/ProductAutocomplete'

interface Supplier {
  id: number
  name: string
  mobile: string | null
  email: string | null
}

interface Location {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  categoryName?: string | null
  variations: ProductVariation[]
  matchType?: 'exact' | 'fuzzy'
}

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  barcode?: string | null
  enableSerialNumber: boolean
  defaultPurchasePrice?: number | null
  defaultSellingPrice?: number | null
}

interface POItem {
  productId: number
  productVariationId: number
  productName: string
  variationName: string
  sku: string | null
  quantity: number
  unitCost: number
  requiresSerial: boolean
}

export default function CreatePurchaseOrderPage() {
  const { can, user } = usePermissions()
  const { data: session } = useSession()
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Supplier search and quick add
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierMobile, setNewSupplierMobile] = useState('')
  const [newSupplierEmail, setNewSupplierEmail] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [warehouseLocationId, setWarehouseLocationId] = useState('')
  const [warehouseLocationName, setWarehouseLocationName] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [items, setItems] = useState<POItem[]>([])
  const [taxAmount, setTaxAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [suppliersRes, locationsRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/locations'),
      ])

      const [suppliersData, locationsData] = await Promise.all([
        suppliersRes.json(),
        locationsRes.json(),
      ])

      if (suppliersRes.ok) {
        setSuppliers(suppliersData.suppliers || suppliersData || [])
      }

      if (locationsRes.ok) {
        const allLocations = locationsData.locations || locationsData || []
        setLocations(allLocations)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  // Filter suppliers by search term (CONTAINS operator)
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm.trim()) return suppliers
    const searchLower = supplierSearchTerm.toLowerCase()
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchLower) ||
      supplier.mobile?.toLowerCase().includes(searchLower) ||
      supplier.email?.toLowerCase().includes(searchLower)
    )
  }, [suppliers, supplierSearchTerm])

  const handleQuickAddSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error('Supplier name is required')
      return
    }

    try {
      setAddingSupplier(true)
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          mobile: newSupplierMobile || null,
          email: newSupplierEmail || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Supplier "${newSupplierName}" added successfully`)
        setSuppliers([...suppliers, data])
        setSupplierId(data.id.toString())
        setShowSupplierDialog(false)
        setNewSupplierName('')
        setNewSupplierMobile('')
        setNewSupplierEmail('')
      } else {
        toast.error(data.error || 'Failed to add supplier')
      }
    } catch (error) {
      console.error('Error adding supplier:', error)
      toast.error('Failed to add supplier')
    } finally {
      setAddingSupplier(false)
    }
  }

  // Handle product selection from autocomplete
  const handleProductSelect = (product: Product, variation: ProductVariation) => {
    // Check if item already exists
    const existingItem = items.find(item => item.productVariationId === variation.id)
    if (existingItem) {
      toast.warning('Product already in list. Increase quantity if needed.')
      return
    }

    const newItem: POItem = {
      productId: product.id,
      productVariationId: variation.id,
      productName: product.name,
      variationName: variation.name,
      sku: variation.sku,
      quantity: 1,
      unitCost: variation.defaultPurchasePrice || 0, // Auto-fill with default price
      requiresSerial: variation.enableSerialNumber || false,
    }

    setItems([...items, newItem])
    // Note: toast is already shown in ProductAutocomplete component
  }

  const handleRemoveItem = (variationId: number) => {
    setItems(items.filter(item => item.productVariationId !== variationId))
  }

  const handleItemChange = (variationId: number, field: 'quantity' | 'unitCost', value: number) => {
    setItems(items.map(item =>
      item.productVariationId === variationId
        ? { ...item, [field]: Math.max(0, value) }
        : item
    ))
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    return subtotal + taxAmount + shippingCost - discountAmount
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Comprehensive validation with friendly messages
    if (!supplierId) {
      toast.error('Please select a supplier before creating the purchase order')
      return
    }

    if (!warehouseLocationId) {
      toast.error('Please select a receiving location before creating the purchase order')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one product to the purchase order')
      return
    }

    // Validate all items have quantities and costs
    const invalidQuantityItems = items.filter(item => item.quantity <= 0)
    if (invalidQuantityItems.length > 0) {
      toast.error(`Invalid quantity for ${invalidQuantityItems[0].productName}. Quantity must be greater than 0.`)
      return
    }

    const invalidCostItems = items.filter(item => item.unitCost < 0)
    if (invalidCostItems.length > 0) {
      toast.error(`Invalid unit cost for ${invalidCostItems[0].productName}. Cost cannot be negative.`)
      return
    }

    try {
      setSubmitting(true)

      const poData = {
        supplierId: parseInt(supplierId),
        locationId: parseInt(warehouseLocationId),
        purchaseDate: new Date(purchaseDate).toISOString(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : null,
        items: items.map(item => ({
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          requiresSerial: item.requiresSerial,
        })),
        taxAmount,
        discountAmount,
        shippingCost,
        notes: notes || null,
      }

      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(poData),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Purchase order created successfully')
        router.push(`/dashboard/purchases/${data.id}`)
      } else {
        // Show user-friendly error message
        const errorMessage = data.error || 'Failed to create purchase order'
        toast.error(errorMessage)
        console.error('Purchase creation error:', data)
      }
    } catch (error) {
      console.error('Error creating purchase order:', error)
      toast.error('Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  if (!can(PERMISSIONS.PURCHASE_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to create purchase orders.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading form data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/purchases">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new purchase order from supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Information */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier with Quick Add */}
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-gray-900 dark:text-gray-200">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search supplier by name, mobile, or email..."
                    value={supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {supplierSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setSupplierSearchTerm('')}
                      className="absolute right-3 top-3"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSupplierDialog(true)}
                  className="shrink-0"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Quick Add
                </Button>
              </div>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name} {supplier.mobile ? `(${supplier.mobile})` : ''}
                    </SelectItem>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-gray-500">
                      No suppliers found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Receiving Location (Manual Selection) */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-gray-900 dark:text-gray-200">
                Receiving Location <span className="text-red-500">*</span>
              </Label>
              <Select value={warehouseLocationId} onValueChange={setWarehouseLocationId}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select receiving location" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((loc) => session?.user?.locationIds?.includes(loc.id))
                    .map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  {locations.filter((loc) => session?.user?.locationIds?.includes(loc.id)).length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-gray-500">
                      No locations assigned to you
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select the branch/location where this purchase will be received
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate" className="text-gray-900 dark:text-gray-200">
                Purchase Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate" className="text-gray-900 dark:text-gray-200">
                Expected Delivery Date
              </Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Add Products Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Add Products</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <strong>Quick search:</strong> Scan barcode or type exact SKU for instant match.
              Or search by product name to browse all matching products.
            </p>
            <ProductAutocomplete
              onProductSelect={handleProductSelect}
              placeholder="Scan barcode, enter SKU, or search product name..."
              autoFocus={false}
            />
          </div>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Order Items ({items.length})</h2>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productVariationId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.productName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.variationName} {item.sku && `• SKU: ${item.sku}`}
                      </p>
                      {item.requiresSerial && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">⚠️ Requires serial numbers on receipt</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.productVariationId)}
                    >
                      <TrashIcon className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-gray-200">Quantity <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.productVariationId, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-gray-200">Unit Cost (₱) <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(item.productVariationId, 'unitCost', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-gray-200">Subtotal</Label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md font-semibold text-gray-900 dark:text-white">
                        ₱{(item.quantity * item.unitCost).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Costs */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Additional Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxAmount" className="text-gray-900 dark:text-gray-200">Tax Amount (₱)</Label>
              <Input
                id="taxAmount"
                type="number"
                min="0"
                step="0.01"
                value={taxAmount}
                onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountAmount" className="text-gray-900 dark:text-gray-200">Discount Amount (₱)</Label>
              <Input
                id="discountAmount"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCost" className="text-gray-900 dark:text-gray-200">Shipping Cost (₱)</Label>
              <Input
                id="shippingCost"
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>Items Subtotal:</span>
              <span className="font-medium">₱{calculateSubtotal().toFixed(2)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Tax:</span>
                <span className="font-medium">₱{taxAmount.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Discount:</span>
                <span className="font-medium">-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Shipping:</span>
                <span className="font-medium">₱{shippingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t-2 border-gray-300 dark:border-gray-600 text-lg">
              <span className="font-bold text-gray-900 dark:text-white">Total Amount:</span>
              <span className="font-bold text-gray-900 dark:text-white">₱{calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Notes (Optional)</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about this purchase order..."
            rows={4}
            className="text-gray-900 dark:text-white"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/purchases">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting || items.length === 0 || !warehouseLocationId}>
            {submitting ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </form>

      {/* Quick Add Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white text-xl">Quick Add Supplier</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Add a new supplier quickly. You can edit full details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newSupplierName" className="text-gray-900 dark:text-gray-200 font-medium">
                Supplier Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newSupplierName"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newSupplierMobile" className="text-gray-900 dark:text-gray-200 font-medium">
                Mobile Number
              </Label>
              <Input
                id="newSupplierMobile"
                value={newSupplierMobile}
                onChange={(e) => setNewSupplierMobile(e.target.value)}
                placeholder="Enter mobile number"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newSupplierEmail" className="text-gray-900 dark:text-gray-200 font-medium">
                Email
              </Label>
              <Input
                id="newSupplierEmail"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                placeholder="Enter email address"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSupplierDialog(false)}
              disabled={addingSupplier}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleQuickAddSupplier}
              disabled={addingSupplier}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addingSupplier ? 'Adding...' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
