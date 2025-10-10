'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Supplier {
  id: number
  name: string
}

interface Location {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  variationName: string
  currentStock: number
}

interface PurchaseOrder {
  id: number
  purchaseOrderNumber: string
  supplier: {
    id: number
    name: string
  }
  items: PurchaseOrderItem[]
}

interface PurchaseOrderItem {
  id: number
  productId: number
  productVariationId: number
  quantity: number
  quantityReceived: number
  unitCost: string
  product: {
    name: string
    sku: string
  }
  variation: {
    variationName: string
  }
}

interface GRNItem {
  id: string  // Temporary ID for UI
  productId: number | null
  productVariationId: number | null
  productName: string
  productSku: string
  variationName: string
  quantityOrdered?: number
  quantityReceived: number
  unitCost: number
  purchaseItemId?: number | null
  serialNumbers?: any
  notes?: string
}

export default function NewPurchaseReceiptPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Workflow toggle
  const [entryMode, setEntryMode] = useState<'purchase_order' | 'direct'>('purchase_order')

  // Form fields
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(null)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<GRNItem[]>([])

  // Data sources
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Check permission
  if (!can(PERMISSIONS.PURCHASE_RECEIPT_CREATE)) {
    return (
      <div className="p-8">
        <p className="text-red-600">You don't have permission to create purchase receipts.</p>
      </div>
    )
  }

  // Load suppliers
  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Load locations
  useEffect(() => {
    fetchLocations()
  }, [])

  // Load purchase orders when in PO mode
  useEffect(() => {
    if (entryMode === 'purchase_order') {
      fetchPurchaseOrders()
    }
  }, [entryMode])

  // Load products when in direct mode
  useEffect(() => {
    if (entryMode === 'direct') {
      fetchProducts()
    }
  }, [entryMode])

  // When PO is selected, pre-fill items
  useEffect(() => {
    if (purchaseOrderId) {
      prefillFromPurchaseOrder()
    }
  }, [purchaseOrderId])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/purchases?status=approved')
      if (res.ok) {
        const data = await res.json()
        setPurchaseOrders(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/products?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setProducts(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const prefillFromPurchaseOrder = async () => {
    if (!purchaseOrderId) return

    try {
      setLoading(true)
      const res = await fetch(`/api/purchases/${purchaseOrderId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch purchase order details')
      }

      const data = await res.json()
      const po = data.data

      // Set supplier from PO
      setSupplierId(po.supplier.id)

      // Pre-fill items from PO
      const grnItems: GRNItem[] = po.items.map((item: PurchaseOrderItem) => ({
        id: `po-${item.id}`,
        productId: item.productId,
        productVariationId: item.productVariationId,
        productName: item.product.name,
        productSku: item.product.sku,
        variationName: item.variation.variationName,
        quantityOrdered: parseFloat(item.quantity.toString()),
        quantityReceived: parseFloat(item.quantity.toString()) - parseFloat(item.quantityReceived.toString()),
        unitCost: parseFloat(item.unitCost),
        purchaseItemId: item.id,
        notes: '',
      }))

      setItems(grnItems)
      toast.success('Purchase order loaded successfully')
    } catch (error: any) {
      console.error('Error loading purchase order:', error)
      toast.error(error.message || 'Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  const addDirectItem = () => {
    const newItem: GRNItem = {
      id: `direct-${Date.now()}`,
      productId: null,
      productVariationId: null,
      productName: '',
      productSku: '',
      variationName: '',
      quantityReceived: 0,
      unitCost: 0,
      notes: '',
    }
    setItems([...items, newItem])
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId))
  }

  const updateItem = (itemId: string, field: keyof GRNItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        // If product is changed, update related fields
        if (field === 'productId') {
          const product = products.find(p => p.id === parseInt(value))
          if (product && product.variations.length > 0) {
            return {
              ...item,
              productId: parseInt(value),
              productName: product.name,
              productSku: product.sku,
              productVariationId: product.variations[0].id,
              variationName: product.variations[0].variationName,
            }
          }
        }

        if (field === 'productVariationId') {
          const product = products.find(p => p.id === item.productId)
          const variation = product?.variations.find(v => v.id === parseInt(value))
          if (variation) {
            return {
              ...item,
              productVariationId: parseInt(value),
              variationName: variation.variationName,
            }
          }
        }

        return {
          ...item,
          [field]: value,
        }
      }
      return item
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!locationId) {
      toast.error('Please select a location')
      return
    }

    if (!receiptDate) {
      toast.error('Please select a receipt date')
      return
    }

    if (entryMode === 'direct' && !supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (entryMode === 'purchase_order' && !purchaseOrderId) {
      toast.error('Please select a purchase order')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate all items have required fields
    for (const item of items) {
      if (!item.productId || !item.productVariationId) {
        toast.error('All items must have a product and variation selected')
        return
      }

      if (item.quantityReceived <= 0) {
        toast.error('All items must have a quantity greater than 0')
        return
      }

      if (entryMode === 'direct' && (item.unitCost === undefined || item.unitCost === null || item.unitCost < 0)) {
        toast.error('All items must have a valid unit cost')
        return
      }
    }

    try {
      setSaving(true)

      const payload = {
        purchaseId: entryMode === 'purchase_order' ? purchaseOrderId : null,
        supplierId: entryMode === 'direct' ? supplierId : undefined,
        locationId,
        receiptDate,
        notes,
        items: items.map(item => ({
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantityReceived: item.quantityReceived,
          unitCost: item.unitCost,
          purchaseItemId: item.purchaseItemId || null,
          serialNumbers: item.serialNumbers || null,
          notes: item.notes || null,
        })),
      }

      const res = await fetch('/api/purchases/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to create purchase receipt')
      }

      toast.success('Purchase receipt created successfully!')
      router.push('/dashboard/purchases/receipts')
    } catch (error: any) {
      console.error('Error creating purchase receipt:', error)
      toast.error(error.message || 'Failed to create purchase receipt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/purchases/receipts">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Receipts
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Goods Received Note (GRN)</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Record goods received from supplier
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Workflow Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={entryMode === 'purchase_order' ? 'default' : 'outline'}
                onClick={() => {
                  setEntryMode('purchase_order')
                  setItems([])
                  setPurchaseOrderId(null)
                  setSupplierId(null)
                }}
                className="flex-1"
              >
                <DocumentCheckIcon className="w-5 h-5 mr-2" />
                From Purchase Order
              </Button>
              <Button
                type="button"
                variant={entryMode === 'direct' ? 'default' : 'outline'}
                onClick={() => {
                  setEntryMode('direct')
                  setItems([])
                  setPurchaseOrderId(null)
                  setSupplierId(null)
                }}
                className="flex-1"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Direct Entry (No PO)
              </Button>
            </div>
            {entryMode === 'direct' && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  💡 <strong>Direct Entry:</strong> Use this for walk-in purchases, emergency stock, or when you didn't create a purchase order beforehand.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Details */}
        <Card>
          <CardHeader>
            <CardTitle>Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purchase Order (if PO mode) */}
              {entryMode === 'purchase_order' && (
                <div>
                  <Label htmlFor="purchaseOrder">
                    Purchase Order <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={purchaseOrderId?.toString() || ''}
                    onValueChange={(value) => setPurchaseOrderId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Purchase Order" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((po) => (
                        <SelectItem key={po.id} value={po.id.toString()}>
                          {po.purchaseOrderNumber} - {po.supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Supplier (if direct mode) */}
              {entryMode === 'direct' && (
                <div>
                  <Label htmlFor="supplier">
                    Supplier <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={supplierId?.toString() || ''}
                    onValueChange={(value) => setSupplierId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Supplier" />
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
              )}

              {/* Location */}
              <div>
                <Label htmlFor="location">
                  Location <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={locationId?.toString() || ''}
                  onValueChange={(value) => setLocationId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Location" />
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

              {/* Receipt Date */}
              <div>
                <Label htmlFor="receiptDate">
                  Receipt Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="receiptDate"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              {entryMode === 'direct' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={addDirectItem}
                  disabled={!supplierId}
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {entryMode === 'purchase_order'
                  ? 'Select a purchase order to load items'
                  : 'Click "Add Item" to add products'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Variation</th>
                      {entryMode === 'purchase_order' && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Ordered</th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Qty Received *</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Unit Cost{entryMode === 'direct' ? ' *' : ''}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          {entryMode === 'direct' ? (
                            <Select
                              value={item.productId?.toString() || ''}
                              onValueChange={(value) => updateItem(item.id, 'productId', value)}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Select Product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id.toString()}>
                                    {product.name} ({product.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                              <p className="text-sm text-gray-500">{item.productSku}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entryMode === 'direct' && item.productId ? (
                            <Select
                              value={item.productVariationId?.toString() || ''}
                              onValueChange={(value) => updateItem(item.id, 'productVariationId', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Variation" />
                              </SelectTrigger>
                              <SelectContent>
                                {products
                                  .find(p => p.id === item.productId)
                                  ?.variations.map((variation) => (
                                    <SelectItem key={variation.id} value={variation.id.toString()}>
                                      {variation.variationName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">{item.variationName}</span>
                          )}
                        </td>
                        {entryMode === 'purchase_order' && (
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {item.quantityOrdered}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantityReceived}
                            onChange={(e) => updateItem(item.id, 'quantityReceived', parseFloat(e.target.value) || 0)}
                            className="w-24 text-right"
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          {entryMode === 'direct' ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="w-24 text-right"
                              required
                            />
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              ₱{item.unitCost.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ₱{(item.quantityReceived * item.unitCost).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {entryMode === 'direct' && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td colSpan={entryMode === 'purchase_order' ? 5 : 4} className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                        Grand Total:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                        ₱{items.reduce((sum, item) => sum + (item.quantityReceived * item.unitCost), 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || items.length === 0}
          >
            {saving ? 'Creating...' : 'Create Purchase Receipt'}
          </Button>
        </div>
      </form>
    </div>
  )
}
