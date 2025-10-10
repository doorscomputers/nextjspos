"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Product {
  id: number
  name: string
  sku: string
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string
}

interface TransferItem {
  productId: number
  productVariationId: number
  productName: string
  variationName: string
  quantity: number
  availableStock: number
}

export default function CreateTransferPage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [locations, setLocations] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<TransferItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedVariation, setSelectedVariation] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchLocations()
    fetchProducts()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch('/api/products?limit=1000')
      const data = await response.json()
      if (response.ok) {
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const getAvailableStock = async (variationId: number, locationId: number): Promise<number> => {
    try {
      const response = await fetch(`/api/stock/query?locationId=${locationId}&variationId=${variationId}`)
      const data = await response.json()
      if (response.ok && data.stock) {
        return parseFloat(data.stock.qtyAvailable) || 0
      }
      return 0
    } catch (error) {
      console.error('Error fetching stock:', error)
      return 0
    }
  }

  const handleAddItem = async () => {
    if (!selectedProduct || !selectedVariation || !fromLocationId) {
      toast.error('Please select product, variation, and from location')
      return
    }

    const product = products.find(p => p.id === parseInt(selectedProduct))
    const variation = product?.variations.find(v => v.id === parseInt(selectedVariation))

    if (!product || !variation) return

    // Check if already added
    if (items.some(item => item.productVariationId === variation.id)) {
      toast.error('This product variation is already added')
      return
    }

    // Get available stock
    const availableStock = await getAvailableStock(variation.id, parseInt(fromLocationId))

    const newItem: TransferItem = {
      productId: product.id,
      productVariationId: variation.id,
      productName: product.name,
      variationName: variation.name,
      quantity: 1,
      availableStock
    }

    setItems([...items, newItem])
    setSelectedProduct('')
    setSelectedVariation('')
    toast.success('Item added')
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleQuantityChange = (index: number, value: string) => {
    const quantity = parseFloat(value) || 0
    const newItems = [...items]
    newItems[index].quantity = quantity
    setItems(newItems)
  }

  const handleSubmit = async () => {
    // Validation
    if (!fromLocationId || !toLocationId) {
      toast.error('Please select both from and to locations')
      return
    }

    if (fromLocationId === toLocationId) {
      toast.error('From and to locations cannot be the same')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate quantities
    for (const item of items) {
      if (item.quantity <= 0) {
        toast.error(`Invalid quantity for ${item.productName}`)
        return
      }
      if (item.quantity > item.availableStock) {
        toast.error(`Insufficient stock for ${item.productName}. Available: ${item.availableStock}`)
        return
      }
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromLocationId: parseInt(fromLocationId),
          toLocationId: parseInt(toLocationId),
          transferDate,
          items: items.map(item => ({
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity
          })),
          notes
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Transfer created successfully')
        router.push(`/dashboard/transfers/${data.transfer.id}`)
      } else {
        toast.error(data.error || 'Failed to create transfer')
      }
    } catch (error) {
      console.error('Error creating transfer:', error)
      toast.error('Failed to create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedProductData = products.find(p => p.id === parseInt(selectedProduct))

  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower)
    )
  })

  if (!can(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create stock transfers.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/transfers">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Stock Transfer</h1>
          <p className="text-gray-500 mt-1">Transfer stock between locations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Locations and Date */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Transfer Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Location <span className="text-red-500">*</span>
                </label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Location <span className="text-red-500">*</span>
                </label>
                <Select value={toLocationId} onValueChange={setToLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes about this transfer..."
              />
            </div>
          </div>

          {/* Add Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Add Items</h2>

            {!fromLocationId && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                Please select "From Location" first to see available stock
              </div>
            )}

            {fromLocationId && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Product
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by product name or SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product
                    </label>
                    <Select value={selectedProduct} onValueChange={(value) => {
                      setSelectedProduct(value)
                      setSelectedVariation('')
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProducts.map(product => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} {product.sku && `(${product.sku})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variation
                    </label>
                    <Select
                      value={selectedVariation}
                      onValueChange={setSelectedVariation}
                      disabled={!selectedProduct}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select variation" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProductData?.variations.map(variation => (
                          <SelectItem key={variation.id} value={variation.id.toString()}>
                            {variation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleAddItem} disabled={!selectedProduct || !selectedVariation}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            )}
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold">Transfer Items ({items.length})</h2>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-gray-500">{item.variationName}</div>
                      <div className="text-sm text-gray-500">Available: {item.availableStock}</div>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow space-y-4 sticky top-6">
            <h2 className="text-lg font-semibold">Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity:</span>
                <span className="font-medium">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
              >
                {submitting ? 'Creating...' : 'Create Transfer'}
              </Button>
              <Link href="/dashboard/transfers">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
