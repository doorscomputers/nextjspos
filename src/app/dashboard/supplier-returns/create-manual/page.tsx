'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Supplier {
  id: number
  name: string
  mobile: string | null
  email: string | null
}

interface Product {
  id: number
  name: string
  sku: string
}

interface Variation {
  id: number
  name: string
  sku: string | null
}

interface Location {
  id: number
  name: string
}

// Currency formatter with commas
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('PHP', '₱')
}

export default function CreateManualSupplierReturnPage() {
  const router = useRouter()
  const { can, user } = usePermissions()

  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variations, setVariations] = useState<Variation[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [variationId, setVariationId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [condition, setCondition] = useState('defective')
  const [returnReason, setReturnReason] = useState('defective')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(true)

  useEffect(() => {
    fetchSuppliers()
    fetchProducts()
    fetchLocations()
  }, [])

  useEffect(() => {
    if (productId) {
      fetchVariations(productId)
      fetchLastPurchaseCost(productId)
    } else {
      setVariations([])
      setVariationId('')
      setUnitCost(0)
    }
  }, [productId])

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      const response = await fetch('/api/suppliers?limit=1000')
      const data = await response.json()
      if (response.ok) {
        setSuppliers(data.suppliers || [])
      } else {
        toast.error('Failed to fetch suppliers')
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to fetch suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch('/api/products?limit=1000')
      const data = await response.json()
      if (response.ok) {
        setProducts(data.products || [])
      } else {
        toast.error('Failed to fetch products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to fetch products')
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true)
      const response = await fetch('/api/business-locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
        // Auto-select Main Warehouse if found
        const mainWarehouse = data.locations?.find((loc: Location) =>
          loc.name.toLowerCase().includes('warehouse') || loc.name.toLowerCase().includes('main warehouse')
        )
        if (mainWarehouse) {
          setLocationId(mainWarehouse.id.toString())
        }
      } else {
        toast.error('Failed to fetch locations')
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast.error('Failed to fetch locations')
    } finally {
      setLoadingLocations(false)
    }
  }

  const fetchVariations = async (prodId: string) => {
    try {
      const response = await fetch(`/api/products/${prodId}/variations`)
      const data = await response.json()
      if (response.ok) {
        setVariations(data.variations || [])
        // Auto-select first variation if only one exists
        if (data.variations?.length === 1) {
          setVariationId(data.variations[0].id.toString())
        }
      } else {
        toast.error('Failed to fetch product variations')
      }
    } catch (error) {
      console.error('Error fetching variations:', error)
      toast.error('Failed to fetch product variations')
    }
  }

  const fetchLastPurchaseCost = async (prodId: string) => {
    try {
      const response = await fetch(`/api/products/${prodId}/last-purchase-cost`)
      const data = await response.json()
      if (response.ok && data.lastCost) {
        setUnitCost(parseFloat(data.lastCost))
      }
    } catch (error) {
      console.error('Error fetching last purchase cost:', error)
      // Don't show error toast, just leave unit cost at 0
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supplierId || !productId || !variationId || !locationId) {
      toast.error('Please fill in all required fields')
      return
    }

    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    if (unitCost <= 0) {
      toast.error('Unit cost must be greater than 0')
      return
    }

    const totalAmount = unitCost * quantity

    try {
      setLoading(true)

      const payload = {
        supplierId: parseInt(supplierId),
        locationId: parseInt(locationId),
        returnDate,
        returnReason,
        items: [
          {
            productId: parseInt(productId),
            productVariationId: parseInt(variationId),
            quantity,
            unitCost,
            condition,
            notes: `Manual return - ${condition}`,
          },
        ],
        notes,
      }

      const response = await fetch('/api/supplier-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Supplier return created: ${data.return.returnNumber}`)
        router.push('/dashboard/supplier-returns')
      } else {
        toast.error(data.error || 'Failed to create supplier return')
      }
    } catch (error) {
      console.error('Error creating supplier return:', error)
      toast.error('Failed to create supplier return')
    } finally {
      setLoading(false)
    }
  }

  if (!can(PERMISSIONS.PURCHASE_RETURN_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create supplier returns.
        </div>
      </div>
    )
  }

  const totalAmount = unitCost * quantity

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/dashboard/supplier-returns">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Returns
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create Supplier Return (Manual)
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            For items without serial numbers (bulk items, accessories, consumables)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Return Information */}
        <Card>
          <CardHeader>
            <CardTitle>Return Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <Select value={supplierId} onValueChange={setSupplierId} disabled={loadingSuppliers}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSuppliers ? "Loading..." : "Select supplier"} />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <Select value={locationId} onValueChange={setLocationId} disabled={loadingLocations}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingLocations ? "Loading..." : "Select location"} />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <Select value={returnReason} onValueChange={setReturnReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty">Warranty Claim</SelectItem>
                    <SelectItem value="defective">Defective</SelectItem>
                    <SelectItem value="damaged">Damaged in Transit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product <span className="text-red-500">*</span>
                </label>
                <Select value={productId} onValueChange={setProductId} disabled={loadingProducts}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProducts ? "Loading..." : "Select product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Variation <span className="text-red-500">*</span>
                </label>
                <Select
                  value={variationId}
                  onValueChange={setVariationId}
                  disabled={!productId || variations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!productId ? "Select product first" : "Select variation"} />
                  </SelectTrigger>
                  <SelectContent>
                    {variations.map((variation) => (
                      <SelectItem key={variation.id} value={variation.id.toString()}>
                        {variation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unit Cost <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  required
                  placeholder="0.00"
                />
                {productId && unitCost > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-filled from last purchase
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Condition <span className="text-red-500">*</span>
                </label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty_claim">Warranty Claim</SelectItem>
                    <SelectItem value="defective">Defective</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                placeholder="Describe the issue, reason for return, or additional details..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {productId && variationId && quantity > 0 && unitCost > 0 && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Return Summary</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Quantity:</span>
                  <span className="font-semibold">{quantity} units</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Unit Cost:</span>
                  <span className="font-semibold">{formatCurrency(unitCost)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-3 border-t border-blue-200">
                  <span>Total Amount:</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/supplier-returns">
            <Button type="button" variant="outline" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading || !supplierId || !productId || !variationId || !locationId}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white"
          >
            {loading ? 'Creating...' : 'Create Return'}
          </Button>
        </div>
      </form>
    </div>
  )
}
