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
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentCheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { SerialNumberInput, SerialNumberData } from '@/components/purchases/SerialNumberInput'

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
  enableProductInfo: boolean  // Does product require serial tracking?
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
    enableProductInfo: boolean  // Does product require serial tracking?
  }
  variation: {
    name: string  // API returns 'name' not 'variationName'
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
  serialNumbers?: SerialNumberData[]
  notes?: string
  enableProductInfo?: boolean  // NEW: Does product require serial tracking?
}

// Helper function to format currency with thousand separators
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<GRNItem[]>([])

  // Data sources
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)

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
    console.log('🔄 Entry mode changed to:', entryMode)
    if (entryMode === 'direct') {
      console.log('📦 Fetching products for Direct Entry mode...')
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
        // API returns array directly, not { data: [] }
        const suppliersList = Array.isArray(data) ? data : (data.data || data.suppliers || [])
        console.log('✅ Suppliers loaded:', suppliersList.length, 'suppliers')
        console.log('First 3 suppliers:', suppliersList.slice(0, 3))
        setSuppliers(suppliersList)
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
        // API returns { locations: [] }
        const locationsList = data.locations || data.data || []
        console.log('✅ Locations loaded:', locationsList.length, 'locations')
        console.log('First 3 locations:', locationsList.slice(0, 3))
        setLocations(locationsList)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/purchases?status=pending')
      if (res.ok) {
        const data = await res.json()
        console.log('✅ Purchase Orders loaded:', data)
        // API returns { purchases: [], pagination: {} }
        const poList = data.purchases || data.data || []
        console.log('📦 PO List:', poList.length, 'orders')
        setPurchaseOrders(poList)
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
      console.log('📡 Fetching from /api/products?limit=1000...')
      const res = await fetch('/api/products?limit=1000')
      console.log('📡 Response status:', res.status, res.statusText)

      if (res.ok) {
        const data = await res.json()
        console.log('📡 Raw API response:', data)
        const productsList = data.data || data.products || (Array.isArray(data) ? data : [])
        console.log('✅ Products loaded:', productsList.length, 'products')
        console.log('First 3 products:', productsList.slice(0, 3).map(p => ({ sku: p.sku, name: p.name })))
        setProducts(productsList)
      } else {
        const errorData = await res.json()
        console.error('❌ API error:', errorData)
        toast.error('Failed to load products: ' + (errorData.error || res.statusText))
      }
    } catch (error) {
      console.error('❌ Exception fetching products:', error)
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
        variationName: item.variation.name,  // API returns 'name' not 'variationName'
        quantityOrdered: parseFloat(item.quantity.toString()),
        quantityReceived: parseFloat(item.quantity.toString()) - parseFloat(item.quantityReceived.toString()),
        unitCost: parseFloat(item.unitCost),
        purchaseItemId: item.id,
        enableProductInfo: item.product.enableProductInfo,  // Set serial tracking requirement
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

  // Filter products based on search (SKU exact match or name contains)
  useEffect(() => {
    console.log('🔍 Search effect triggered. Search term:', productSearch, '| Total products:', products.length)

    if (!productSearch.trim()) {
      setFilteredProducts([])
      setSelectedProductIndex(0)
      return
    }

    const search = productSearch.trim().toLowerCase()
    const filtered = products.filter(product => {
      const productSku = (product.sku || '').toLowerCase()
      const productName = (product.name || '').toLowerCase()

      // Exact match on SKU (for barcode scanning)
      if (productSku === search) {
        return true
      }
      // Partial SKU match (contains)
      if (productSku.includes(search)) {
        return true
      }
      // Contains search on product name
      if (productName.includes(search)) {
        return true
      }
      return false
    })

    console.log('🔍 Search:', search)
    console.log('📦 Total products available:', products.length)
    console.log('📦 Filtered products:', filtered.length, filtered.slice(0, 3).map(p => ({ sku: p.sku, name: p.name })))

    setFilteredProducts(filtered)
    setSelectedProductIndex(0) // Reset selection when results change
  }, [productSearch, products])

  const addProductToItems = (product: Product, variationId?: number) => {
    // For variable products (multiple variations), NEVER auto-increment quantity
    // Always add as a new line item so user can select the variation manually
    const isVariableProduct = product.variations.length > 1

    if (isVariableProduct) {
      // Variable product: Find the first variation that's NOT already used
      // Get all variation IDs currently used for this product
      const usedVariationIds = items
        .filter(item => item.productId === product.id)
        .map(item => item.productVariationId)

      // Find first available variation
      const availableVariation = product.variations.find(
        v => !usedVariationIds.includes(v.id)
      )

      // If all variations are used, show warning and don't add
      if (!availableVariation) {
        toast.error(`All variations of ${product.name} have already been added. Please adjust quantities in existing rows instead.`)
        return
      }

      const newItem: GRNItem = {
        id: `direct-${Date.now()}`,
        productId: product.id,
        productVariationId: availableVariation.id,
        productName: product.name,
        productSku: product.sku,
        variationName: availableVariation.variationName,
        quantityReceived: 1,
        unitCost: 0,
        enableProductInfo: product.enableProductInfo,
        notes: '',
      }
      setItems([...items, newItem])
      toast.success(`Added ${product.name} - ${availableVariation.variationName}`)
    } else {
      // Single variation product: Check if already exists and increment quantity
      const existingItemIndex = items.findIndex(item =>
        item.productId === product.id &&
        (variationId ? item.productVariationId === variationId : item.productVariationId === product.variations[0]?.id)
      )

      if (existingItemIndex >= 0) {
        // Increment quantity if already exists
        const updatedItems = [...items]
        updatedItems[existingItemIndex].quantityReceived += 1
        setItems(updatedItems)
        toast.success(`Increased quantity for ${product.name}`)
      } else {
        // Add new item
        const variation = variationId
          ? product.variations.find(v => v.id === variationId)
          : product.variations[0]

        if (!variation) {
          toast.error('Product has no variations')
          return
        }

        const newItem: GRNItem = {
          id: `direct-${Date.now()}`,
          productId: product.id,
          productVariationId: variation.id,
          productName: product.name,
          productSku: product.sku,
          variationName: variation.variationName,
          quantityReceived: 1,
          unitCost: 0,
          enableProductInfo: product.enableProductInfo,
          notes: '',
        }
        setItems([...items, newItem])
        toast.success(`Added ${product.name}`)
      }
    }

    // Clear search
    setProductSearch('')
    setFilteredProducts([])
  }

  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredProducts.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedProductIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        )
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedProductIndex(prev => prev > 0 ? prev - 1 : prev)
        break

      case 'Enter':
        e.preventDefault()
        // Add the selected product
        const selectedProduct = filteredProducts[selectedProductIndex]
        if (selectedProduct) {
          addProductToItems(selectedProduct)
        }
        break

      case 'Escape':
        e.preventDefault()
        setProductSearch('')
        setFilteredProducts([])
        setSelectedProductIndex(0)
        break
    }
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId))
  }

  const updateItem = (itemId: string, field: keyof GRNItem, value: any) => {
    // Special handling for variation changes - check for duplicates
    if (field === 'productVariationId') {
      const currentItem = items.find(i => i.id === itemId)
      if (!currentItem) return

      const newVariationId = parseInt(value)

      // Check if this product-variation combination already exists in another row
      const duplicateExists = items.some(item =>
        item.id !== itemId &&
        item.productId === currentItem.productId &&
        item.productVariationId === newVariationId
      )

      if (duplicateExists) {
        const product = products.find(p => p.id === currentItem.productId)
        const variation = product?.variations.find(v => v.id === newVariationId)
        toast.error(`${product?.name} - ${variation?.variationName} already exists in the list. Please adjust quantity on that row instead.`)
        return
      }
    }

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
              enableProductInfo: product.enableProductInfo,  // Set serial tracking requirement
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

    // receiptDate validation removed - server will use real-time timestamp

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

    // Check for duplicate product-variation combinations
    const productVariationCombos = new Map<string, number>()
    for (const item of items) {
      const comboKey = `${item.productId}-${item.productVariationId}`
      const existingCount = productVariationCombos.get(comboKey) || 0

      if (existingCount > 0) {
        const product = products.find(p => p.id === item.productId)
        const variation = product?.variations.find(v => v.id === item.productVariationId)
        toast.error(`Duplicate detected: ${item.productName} - ${variation?.variationName} appears multiple times. Please merge quantities or remove duplicate rows.`)
        return
      }

      productVariationCombos.set(comboKey, existingCount + 1)
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

      if (entryMode === 'direct' && (item.unitCost === undefined || item.unitCost === null || item.unitCost <= 0)) {
        toast.error('All items must have a unit cost greater than zero')
        return
      }
    }

    try {
      setSaving(true)

      const payload = {
        purchaseId: entryMode === 'purchase_order' ? purchaseOrderId : null,
        supplierId: entryMode === 'direct' ? supplierId : undefined,
        locationId,
        // receiptDate removed - server will use real-time timestamp
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
          <Button size="sm" className="mb-4 bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-sm">
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
                className={`flex-1 ${entryMode === 'purchase_order' ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
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
                className={`flex-1 ${entryMode === 'direct' ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
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

              {/* Receipt Date Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>📅 Receipt Date:</strong> Automatically recorded as current date/time when you submit.
                  <br />
                  <span className="text-xs">This prevents backdating and ensures accurate audit trails.</span>
                </p>
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
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Product Search (Direct Entry Mode) */}
            {entryMode === 'direct' && (
              <div className="mb-6">
                <Label htmlFor="productSearch" className="mb-2 block">
                  Add Product (Scan Barcode or Search)
                </Label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="productSearch"
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleProductSearchKeyDown}
                    placeholder="Scan barcode or type product name..."
                    className="pl-10 pr-10 text-lg"
                    autoComplete="off"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('')
                        setFilteredProducts([])
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {filteredProducts.length > 0 && (
                  <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg bg-white dark:bg-gray-800 max-h-64 overflow-y-auto">
                    {filteredProducts.map((product, index) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProductToItems(product)}
                        className={`w-full px-4 py-3 text-left border-b last:border-b-0 border-gray-200 dark:border-gray-700 transition-colors ${
                          index === selectedProductIndex
                            ? 'bg-blue-100 dark:bg-blue-900/50'
                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</p>
                          </div>
                          <Badge variant="outline" className="ml-2">
                            {product.variations.length} variation{product.variations.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {productSearch && filteredProducts.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No products found matching "{productSearch}"
                  </p>
                )}
              </div>
            )}

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {entryMode === 'purchase_order'
                  ? 'Select a purchase order to load items'
                  : 'Scan barcode or search for products to add items'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-64">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-32">Variation</th>
                      {entryMode === 'purchase_order' && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-24">Ordered</th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-28">Qty Received *</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-28">Unit Cost{entryMode === 'direct' ? ' *' : ''}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-32">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-28">Serial #</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.productSku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 relative">
                          {entryMode === 'direct' && item.productId && products.find(p => p.id === item.productId)?.variations.length! > 1 ? (
                            <Select
                              value={item.productVariationId?.toString() || ''}
                              onValueChange={(value) => updateItem(item.id, 'productVariationId', value)}
                            >
                              <SelectTrigger className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 z-[9999]">
                                {products
                                  .find(p => p.id === item.productId)
                                  ?.variations
                                  .filter(variation => {
                                    // Show the current variation
                                    if (variation.id === item.productVariationId) return true

                                    // Filter out variations already used in OTHER rows for the SAME product
                                    const isUsedInOtherRow = items.some(otherItem =>
                                      otherItem.id !== item.id &&
                                      otherItem.productId === item.productId &&
                                      otherItem.productVariationId === variation.id
                                    )
                                    return !isUsedInOtherRow
                                  })
                                  .map((variation) => (
                                    <SelectItem
                                      key={variation.id}
                                      value={variation.id.toString()}
                                      className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
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
                        <td className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantityReceived}
                            onChange={(e) => updateItem(item.id, 'quantityReceived', parseFloat(e.target.value) || 0)}
                            className="w-full text-right"
                            required
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {entryMode === 'direct' ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="w-full text-right"
                              required
                            />
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              ₱{formatCurrency(item.unitCost)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ₱{formatCurrency(item.quantityReceived * item.unitCost)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.enableProductInfo && item.quantityReceived > 0 && (
                            <SerialNumberInput
                              requiredCount={Math.floor(item.quantityReceived)}
                              productName={item.productName}
                              supplierName={suppliers.find(s => s.id === supplierId)?.name || ''}
                              dateReceived={new Date().toISOString().split('T')[0]}
                              userName={can ? 'Current User' : ''}
                              onSerialNumbersChange={(serialNumbers) => {
                                updateItem(item.id, 'serialNumbers', serialNumbers)
                              }}
                              initialSerialNumbers={item.serialNumbers || []}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
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
                        ₱{formatCurrency(items.reduce((sum, item) => sum + (item.quantityReceived * item.unitCost), 0))}
                      </td>
                      <td colSpan={2}></td>
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
            onClick={() => router.back()}
            disabled={saving}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md disabled:opacity-50"
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
