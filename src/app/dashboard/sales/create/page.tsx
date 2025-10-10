"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface Product {
  id: number
  name: string
  sku: string
  enableStock: boolean
  requiresSerial: boolean
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  sellingPrice: number
  purchasePrice: number
  variationLocationDetails: {
    qtyAvailable: number
  }[]
}

interface Customer {
  id: number
  name: string
  mobile: string | null
  email: string | null
}

interface CartItem {
  productId: number
  productName: string
  variationId: number
  variationName: string
  quantity: number
  unitPrice: number
  availableQty: number
  requiresSerial: boolean
  serialNumberIds: number[]
}

interface SerialNumber {
  id: number
  serialNumber: string
  imei: string | null
  status: string
}

export default function CreateSalePage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)

  // Products and search
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [locations, setLocations] = useState<any[]>([])

  // Customer
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Serial numbers
  const [availableSerialNumbers, setAvailableSerialNumbers] = useState<SerialNumber[]>([])
  const [selectedSerials, setSelectedSerials] = useState<{ [key: number]: number[] }>({})
  const [showSerialModal, setShowSerialModal] = useState(false)
  const [currentCartIndex, setCurrentCartIndex] = useState<number | null>(null)

  // Payment
  const [payments, setPayments] = useState<{ method: string; amount: number; reference?: string }[]>([
    { method: 'cash', amount: 0 }
  ])

  // Sale details
  const [notes, setNotes] = useState('')
  const [taxAmount, setTaxAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  useEffect(() => {
    if (selectedLocationId) {
      fetchProducts()
    }
  }, [selectedLocationId])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok && data.locations) {
        setLocations(data.locations)
        if (data.locations.length > 0) {
          setSelectedLocationId(data.locations[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?isActive=true&limit=1000')
      const data = await response.json()
      if (response.ok) {
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers?limit=1000')
      const data = await response.json()
      if (response.ok) {
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchSerialNumbers = async (variationId: number) => {
    if (!selectedLocationId) return

    try {
      const response = await fetch(`/api/serial-numbers?variationId=${variationId}&locationId=${selectedLocationId}&status=in_stock`)
      const data = await response.json()
      if (response.ok) {
        setAvailableSerialNumbers(data.serialNumbers || [])
      }
    } catch (error) {
      console.error('Error fetching serial numbers:', error)
    }
  }

  const addToCart = (product: Product, variation: ProductVariation) => {
    if (!selectedLocationId) {
      toast.error('Please select a location first')
      return
    }

    const availableQty = variation.variationLocationDetails[0]?.qtyAvailable || 0

    if (availableQty <= 0 && !product.requiresSerial) {
      toast.error('Product out of stock')
      return
    }

    // Check if already in cart
    const existingIndex = cart.findIndex(item => item.variationId === variation.id)

    if (existingIndex >= 0) {
      // Update quantity
      const newCart = [...cart]
      newCart[existingIndex].quantity += 1
      setCart(newCart)
    } else {
      // Add new item
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        variationId: variation.id,
        variationName: variation.name,
        quantity: 1,
        unitPrice: variation.sellingPrice,
        availableQty,
        requiresSerial: product.requiresSerial,
        serialNumberIds: []
      }])
    }

    toast.success('Item added to cart')
  }

  const updateCartQuantity = (index: number, quantity: number) => {
    const newCart = [...cart]
    const item = newCart[index]

    if (quantity <= 0) {
      removeFromCart(index)
      return
    }

    if (quantity > item.availableQty && !item.requiresSerial) {
      toast.error('Quantity exceeds available stock')
      return
    }

    newCart[index].quantity = quantity
    setCart(newCart)
  }

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index)
    setCart(newCart)

    // Remove associated serial numbers
    const newSerials = { ...selectedSerials }
    delete newSerials[index]
    setSelectedSerials(newSerials)
  }

  const openSerialModal = async (index: number) => {
    const item = cart[index]
    setCurrentCartIndex(index)
    await fetchSerialNumbers(item.variationId)
    setShowSerialModal(true)
  }

  const saveSerialNumbers = () => {
    if (currentCartIndex === null) return

    const item = cart[currentCartIndex]
    const serials = selectedSerials[currentCartIndex] || []

    if (serials.length !== item.quantity) {
      toast.error(`Please select exactly ${item.quantity} serial numbers`)
      return
    }

    const newCart = [...cart]
    newCart[currentCartIndex].serialNumberIds = serials
    setCart(newCart)

    setShowSerialModal(false)
    setCurrentCartIndex(null)
    toast.success('Serial numbers saved')
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    return subtotal + taxAmount + shippingCost - discountAmount
  }

  const handleSubmit = async () => {
    if (!selectedLocationId) {
      toast.error('Please select a location')
      return
    }

    if (cart.length === 0) {
      toast.error('Please add items to cart')
      return
    }

    // Validate serial numbers
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i]
      if (item.requiresSerial && item.serialNumberIds.length !== item.quantity) {
        toast.error(`Please select serial numbers for ${item.productName}`)
        return
      }
    }

    // Validate payments
    const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0)
    const total = calculateTotal()

    if (totalPayment < total) {
      toast.error('Payment amount is less than total')
      return
    }

    try {
      setLoading(true)

      const saleData = {
        locationId: selectedLocationId,
        customerId: selectedCustomerId,
        saleDate: new Date().toISOString(),
        items: cart.map(item => ({
          productId: item.productId,
          productVariationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          requiresSerial: item.requiresSerial,
          serialNumberIds: item.requiresSerial ? item.serialNumberIds : undefined
        })),
        payments: payments.map(p => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference
        })),
        taxAmount,
        discountAmount,
        shippingCost,
        notes
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Sale created: ${data.invoiceNumber}`)
        router.push(`/dashboard/sales/${data.id}`)
      } else {
        toast.error(data.error || 'Failed to create sale')
      }
    } catch (error) {
      console.error('Error creating sale:', error)
      toast.error('Failed to create sale')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.mobile?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  if (!can(PERMISSIONS.SELL_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create sales.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">New Sale (POS)</h1>
            <p className="text-gray-500 mt-1">Create a new sales transaction</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Location Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium mb-2">Location *</label>
            <Select value={selectedLocationId?.toString()} onValueChange={(val) => setSelectedLocationId(parseInt(val))}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Search */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div key={product.id}>
                  {product.variations.map((variation) => {
                    const availableQty = variation.variationLocationDetails[0]?.qtyAvailable || 0
                    return (
                      <div
                        key={variation.id}
                        className="border rounded-lg p-3 hover:border-blue-500 cursor-pointer transition-colors"
                        onClick={() => addToCart(product, variation)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{product.name}</h4>
                            {variation.name !== 'Default' && (
                              <p className="text-xs text-gray-500">{variation.name}</p>
                            )}
                            <p className="text-xs text-gray-400">SKU: {variation.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-blue-600">${variation.sellingPrice}</p>
                            <p className="text-xs text-gray-500">Stock: {availableQty}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Cart & Checkout */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium mb-2">Customer (Optional)</label>
            <Select value={selectedCustomerId?.toString() || ''} onValueChange={(val) => setSelectedCustomerId(val ? parseInt(val) : null)}>
              <SelectTrigger>
                <SelectValue placeholder="Walk-in Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Walk-in Customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name} {customer.mobile && `(${customer.mobile})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Cart ({cart.length} items)</h3>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Cart is empty</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {cart.map((item, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        {item.variationName !== 'Default' && (
                          <p className="text-xs text-gray-500">{item.variationName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-sm">× ${item.unitPrice}</span>
                      </div>
                      <span className="font-semibold">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>

                    {item.requiresSerial && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSerialModal(index)}
                          className="w-full"
                        >
                          {item.serialNumberIds.length > 0 ? `${item.serialNumberIds.length} S/N Selected` : 'Select Serial Numbers'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Additional Charges */}
            <div className="space-y-2 border-t pt-4 mb-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Tax:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Shipping:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
              </div>
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold mb-4">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>

              {/* Payment */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Payment</label>
                {payments.map((payment, index) => (
                  <div key={index} className="flex gap-2">
                    <Select value={payment.method} onValueChange={(val) => {
                      const newPayments = [...payments]
                      newPayments[index].method = val
                      setPayments(newPayments)
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={payment.amount || ''}
                      onChange={(e) => {
                        const newPayments = [...payments]
                        newPayments[index].amount = parseFloat(e.target.value) || 0
                        setPayments(newPayments)
                      }}
                      className="flex-1 px-3 py-2 border rounded"
                    />
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Add notes..."
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={loading || cart.length === 0}
                className="w-full mt-4"
                size="lg"
              >
                {loading ? 'Processing...' : 'Complete Sale'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Number Modal */}
      {showSerialModal && currentCartIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Select Serial Numbers ({selectedSerials[currentCartIndex]?.length || 0}/{cart[currentCartIndex].quantity})
              </h3>
              <button onClick={() => setShowSerialModal(false)}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2">
              {availableSerialNumbers.map((sn) => {
                const isSelected = selectedSerials[currentCartIndex]?.includes(sn.id)
                return (
                  <div
                    key={sn.id}
                    className={`border rounded p-3 cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => {
                      const current = selectedSerials[currentCartIndex] || []
                      if (isSelected) {
                        setSelectedSerials({
                          ...selectedSerials,
                          [currentCartIndex]: current.filter(id => id !== sn.id)
                        })
                      } else {
                        if (current.length < cart[currentCartIndex].quantity) {
                          setSelectedSerials({
                            ...selectedSerials,
                            [currentCartIndex]: [...current, sn.id]
                          })
                        } else {
                          toast.error('Maximum serial numbers selected')
                        }
                      }
                    }}
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{sn.serialNumber}</p>
                        {sn.imei && <p className="text-sm text-gray-500">IMEI: {sn.imei}</p>}
                      </div>
                      {isSelected && <Badge>Selected</Badge>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={saveSerialNumbers} className="flex-1">
                Save Selection
              </Button>
              <Button variant="outline" onClick={() => setShowSerialModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
