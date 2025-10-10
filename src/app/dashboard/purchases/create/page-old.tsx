"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

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
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  enableSerialNumber: boolean
}

interface POItem {
  productId: number
  productVariationId: number
  productName: string
  variationName: string
  quantity: number
  unitCost: number
  requiresSerial: boolean
}

export default function CreatePurchaseOrderPage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [items, setItems] = useState<POItem[]>([])
  const [taxAmount, setTaxAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)
  const [notes, setNotes] = useState('')

  // Product selection state
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariationId, setSelectedVariationId] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [suppliersRes, locationsRes, productsRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/locations'),
        fetch('/api/products?includeVariations=true'),
      ])

      const [suppliersData, locationsData, productsData] = await Promise.all([
        suppliersRes.json(),
        locationsRes.json(),
        productsRes.json(),
      ])

      if (suppliersRes.ok) {
        setSuppliers(suppliersData.suppliers || suppliersData || [])
      }
      if (locationsRes.ok) {
        setLocations(locationsData.locations || locationsData || [])
      }
      if (productsRes.ok) {
        setProducts(productsData.products || productsData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  const getSelectedProduct = () => {
    return products.find(p => p.id === parseInt(selectedProductId))
  }

  const getSelectedVariation = () => {
    const product = getSelectedProduct()
    if (!product) return null
    return product.variations.find(v => v.id === parseInt(selectedVariationId))
  }

  const handleAddItem = () => {
    const product = getSelectedProduct()
    const variation = getSelectedVariation()

    if (!product || !variation) {
      toast.error('Please select a product and variation')
      return
    }

    // Check if item already exists
    const existingItem = items.find(item => item.productVariationId === variation.id)
    if (existingItem) {
      toast.error('This product variation is already in the list')
      return
    }

    const newItem: POItem = {
      productId: product.id,
      productVariationId: variation.id,
      productName: product.name,
      variationName: variation.name,
      quantity: 1,
      unitCost: 0,
      requiresSerial: variation.enableSerialNumber || false,
    }

    setItems([...items, newItem])
    setSelectedProductId('')
    setSelectedVariationId('')
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

    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (!locationId) {
      toast.error('Please select a receiving location')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate all items have quantities and costs
    const invalidItems = items.filter(item => item.quantity <= 0 || item.unitCost <= 0)
    if (invalidItems.length > 0) {
      toast.error('All items must have valid quantity and unit cost')
      return
    }

    try {
      setSubmitting(true)

      const poData = {
        supplierId: parseInt(supplierId),
        locationId: parseInt(locationId),
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
        router.push(`/dashboard/purchases/${data.purchase.id}`)
      } else {
        toast.error(data.error || 'Failed to create purchase order')
        if (data.details) {
          toast.error(`Details: ${data.details}`)
        }
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
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create purchase orders.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Loading form data...</div>
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
          <h1 className="text-3xl font-bold">Create Purchase Order</h1>
          <p className="text-gray-500 mt-1">Create a new purchase order from supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Information */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Receiving Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date *</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Add Items Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Add Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={selectedProductId}
                onValueChange={(value) => {
                  setSelectedProductId(value)
                  setSelectedVariationId('')
                }}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="variation">Variation</Label>
              <Select
                value={selectedVariationId}
                onValueChange={setSelectedVariationId}
                disabled={!selectedProductId}
              >
                <SelectTrigger id="variation">
                  <SelectValue placeholder="Select variation" />
                </SelectTrigger>
                <SelectContent>
                  {getSelectedProduct()?.variations.map((variation) => (
                    <SelectItem key={variation.id} value={variation.id.toString()}>
                      {variation.name} {variation.sku ? `(${variation.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedVariationId}
                className="w-full"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.productVariationId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.productName}</h3>
                      <p className="text-sm text-gray-600">{item.variationName}</p>
                      {item.requiresSerial && (
                        <p className="text-xs text-blue-600 mt-1">⚠️ Requires serial numbers on receipt</p>
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
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.productVariationId, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit Cost ($) *</Label>
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
                      <Label>Subtotal</Label>
                      <div className="px-3 py-2 bg-gray-50 rounded-md font-semibold">
                        ${(item.quantity * item.unitCost).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Costs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Additional Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxAmount">Tax Amount ($)</Label>
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
              <Label htmlFor="discountAmount">Discount Amount ($)</Label>
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
              <Label htmlFor="shippingCost">Shipping Cost ($)</Label>
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
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Items Subtotal:</span>
              <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-medium">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-medium">${shippingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t-2 text-lg">
              <span className="font-bold">Total Amount:</span>
              <span className="font-bold">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Notes (Optional)</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about this purchase order..."
            rows={4}
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/purchases">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting || items.length === 0}>
            {submitting ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}
