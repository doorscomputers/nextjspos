'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Search } from 'lucide-react'

interface Location {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  productId: number
}

interface InventoryDetails {
  qtyAvailable: number
  productId: number
  productVariationId: number
}

export default function NewInventoryCorrectionPage() {
  const router = useRouter()
  const { can, user } = usePermissions()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [systemCount, setSystemCount] = useState<number | null>(null)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [userLocation, setUserLocation] = useState<Location | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const [formData, setFormData] = useState({
    locationId: '',
    productId: '',
    productVariationId: '',
    physicalCount: '',
    reason: '',
    remarks: ''
  })

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_CREATE)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to create inventory corrections.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchLocations()
    fetchProducts()
  }, [])

  // Auto-select location based on user's assigned location
  useEffect(() => {
    console.log('🔍 Location auto-lock effect triggered')
    console.log('  - locations.length:', locations.length)
    console.log('  - session?.user:', session?.user)

    if (locations.length > 0 && session?.user) {
      const userLocationIds = (session.user as any).locationIds || []
      console.log('  - userLocationIds:', userLocationIds)

      // If user has exactly one location, auto-select it and lock the field
      if (userLocationIds.length === 1) {
        console.log('  ✓ User has exactly 1 location - auto-locking')
        const userLoc = locations.find(loc => userLocationIds.includes(loc.id))
        console.log('  - Found location:', userLoc)
        if (userLoc) {
          setUserLocation(userLoc)
          setFormData(prev => ({ ...prev, locationId: userLoc.id.toString() }))
          console.log('  ✓ Location set to:', userLoc.name)
        }
      }
      // If user has multiple locations, they can choose from their assigned locations
      else if (userLocationIds.length > 1) {
        console.log('  - User has multiple locations')
        const accessibleLocs = locations.filter(loc => userLocationIds.includes(loc.id))
        setLocations(accessibleLocs)
      } else {
        console.log('  ⚠️ No locationIds found in session')
      }
    }
  }, [locations.length, session?.user])

  // Filter products based on search term (partial match on name, SKU, or barcode)
  useEffect(() => {
    if (!productSearchTerm.trim()) {
      setFilteredProducts(products)
      return
    }

    const searchLower = productSearchTerm.toLowerCase().trim()
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchLower))
    )
    setFilteredProducts(filtered)
  }, [productSearchTerm, products])

  useEffect(() => {
    if (formData.productId) {
      fetchVariations(parseInt(formData.productId))
    } else {
      setVariations([])
      setFormData((prev) => ({ ...prev, productVariationId: '' }))
    }
  }, [formData.productId])

  // Auto-select variation if product has only one variation
  useEffect(() => {
    if (variations.length === 1 && !formData.productVariationId) {
      setFormData((prev) => ({ ...prev, productVariationId: variations[0].id.toString() }))
    }
  }, [variations, formData.productVariationId])

  // Auto-fetch system count when product variation is selected
  useEffect(() => {
    if (formData.locationId && formData.productVariationId) {
      fetchSystemCount(parseInt(formData.locationId), parseInt(formData.productVariationId))
    } else {
      setSystemCount(null)
    }
  }, [formData.locationId, formData.productVariationId])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchVariations = async (productId: number) => {
    try {
      const res = await fetch(`/api/products/${productId}/variations`)
      if (res.ok) {
        const data = await res.json()
        setVariations(data.variations || [])
      }
    } catch (error) {
      console.error('Error fetching variations:', error)
    }
  }

  const fetchSystemCount = async (locationId: number, variationId: number) => {
    try {
      const res = await fetch(`/api/products/variations/${variationId}/inventory?locationId=${locationId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.inventory) {
          setSystemCount(parseFloat(data.inventory.qtyAvailable))
        } else {
          // Product exists but not at this location - show 0
          setSystemCount(0)
          toast.info('Product not yet added to this location. System count is 0.')
        }
      }
    } catch (error) {
      console.error('Error fetching system count:', error)
      setSystemCount(0)
    }
  }

  // Handle barcode scanning - auto-select product and variation by SKU
  const handleBarcodeSearch = async (searchValue: string) => {
    console.log('🔍 handleBarcodeSearch called with:', searchValue)

    if (!searchValue.trim()) {
      console.log('  ⚠️ Empty search value')
      toast.error('Please enter a SKU or barcode')
      return
    }

    console.log('  ✓ Setting isScanning to true')
    setIsScanning(true)
    const searchTerm = searchValue.trim()

    try {
      console.log('  🌐 Fetching from API:', `/api/products/variations/search?sku=${searchTerm}`)

      // Search for product variation by SKU (most specific match)
      const variationRes = await fetch(`/api/products/variations/search?sku=${encodeURIComponent(searchTerm)}`)

      console.log('Response status:', variationRes.status)

      if (variationRes.ok) {
        const variationData = await variationRes.json()
        console.log('Variation data:', variationData)

        if (variationData.variation) {
          // Found exact SKU match - auto-select product and variation
          const variation = variationData.variation

          // Set product first
          setFormData((prev) => ({
            ...prev,
            productId: variation.productId.toString(),
            productVariationId: variation.id.toString()
          }))

          // Fetch variations for this product
          await fetchVariations(variation.productId)

          // Fetch system count if location is already selected
          if (formData.locationId) {
            await fetchSystemCount(parseInt(formData.locationId), variation.id)
          }

          // Clear search
          setProductSearchTerm('')

          toast.success(`Product found: ${variation.productName} (${variation.name})`)
          setIsScanning(false)
          return
        } else {
          // No product found with this SKU
          toast.error(`No product found with SKU: ${searchTerm}`)
          setIsScanning(false)
          return
        }
      } else {
        const errorData = await variationRes.json()
        console.error('API error:', errorData)
        toast.error(errorData.error || 'Failed to search for product')
      }

      setIsScanning(false)
    } catch (error) {
      console.error('Error searching by barcode:', error)
      toast.error('Failed to search for product. Check console for details.')
      setIsScanning(false)
    }
  }

  const calculateDifference = () => {
    if (systemCount !== null && formData.physicalCount) {
      const physCount = parseFloat(formData.physicalCount)
      return physCount - systemCount
    }
    return 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.locationId || !formData.productId || !formData.productVariationId || !formData.physicalCount || !formData.reason) {
      toast.error('Please fill in all required fields')
      return
    }

    if (systemCount === null) {
      toast.error('Unable to determine system count. Please ensure the product exists at this location.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/inventory-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: parseInt(formData.locationId),
          productId: parseInt(formData.productId),
          productVariationId: parseInt(formData.productVariationId),
          physicalCount: parseFloat(formData.physicalCount),
          reason: formData.reason,
          remarks: formData.remarks || null
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Inventory correction created successfully')
        router.push('/dashboard/inventory-corrections')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create inventory correction')
      }
    } catch (error) {
      console.error('Error creating correction:', error)
      toast.error('Failed to create inventory correction')
    } finally {
      setLoading(false)
    }
  }

  const difference = calculateDifference()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">New Inventory Correction</h1>
        <p className="text-gray-600 mt-2">Create a new stock adjustment for expired, damaged, or missing items</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-3xl">
        <div className="space-y-6">
          {/* Location - Locked to user's assigned location */}
          <div>
            <Label htmlFor="locationId" className="required">Location</Label>
            {userLocation ? (
              <div className="mt-1">
                <Input
                  id="locationId"
                  type="text"
                  value={userLocation.name}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Location is locked to your assigned branch</p>
              </div>
            ) : (
              <Select
                value={formData.locationId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, locationId: value }))}
              >
                <SelectTrigger id="locationId" className="mt-1">
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
            )}
          </div>

          {/* Product - With barcode scanning and search */}
          <div>
            <Label htmlFor="productSearch" className="required">
              Product {formData.productId && formData.productVariationId && (
                <span className="text-green-600 font-normal ml-2">✓ Selected</span>
              )}
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="productSearch"
                type="text"
                placeholder="Scan barcode or type SKU/product name..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  console.log('⌨️ Key pressed:', e.key, 'Value:', productSearchTerm)
                  if (e.key === 'Enter') {
                    console.log('  ✓ Enter key detected, calling handleBarcodeSearch')
                    e.preventDefault()
                    handleBarcodeSearch(productSearchTerm)
                  }
                }}
                className="pl-10"
                disabled={isScanning}
              />
              {isScanning && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Scan barcode or search manually. Press Enter after scanning.
            </p>

            {/* Only show manual selection if not auto-selected by barcode */}
            {!formData.productVariationId && (
              <Select
                value={formData.productId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, productId: value, productVariationId: '' }))
                  setProductSearchTerm('')
                }}
              >
                <SelectTrigger id="productId" className="mt-2">
                  <SelectValue placeholder="Or select product manually" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id.toString()}>
                        {prod.name} ({prod.sku})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_no_results" disabled>
                      {productSearchTerm ? 'No products found' : 'Start typing to search'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Show selected product info */}
            {formData.productId && formData.productVariationId && variations.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900">
                  {products.find(p => p.id.toString() === formData.productId)?.name}
                </p>
                <p className="text-xs text-blue-700">
                  SKU: {variations.find(v => v.id.toString() === formData.productVariationId)?.sku}
                  {variations.find(v => v.id.toString() === formData.productVariationId)?.name !== 'Default' &&
                    ` | Variation: ${variations.find(v => v.id.toString() === formData.productVariationId)?.name}`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Product Variation - Only show if multiple variations exist */}
          {variations.length > 1 && (
            <div>
              <Label htmlFor="productVariationId" className="required">Product Variation</Label>
              <Select
                value={formData.productVariationId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, productVariationId: value }))}
                disabled={!formData.productId}
              >
                <SelectTrigger id="productVariationId" className="mt-1">
                  <SelectValue placeholder={formData.productId ? "Select variation" : "Select product first"} />
                </SelectTrigger>
                <SelectContent>
                  {variations.map((variation) => (
                    <SelectItem key={variation.id} value={variation.id.toString()}>
                      {variation.name} ({variation.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* System Count (Read-only) */}
          <div>
            <Label htmlFor="systemCount">Current System Count</Label>
            <Input
              id="systemCount"
              type="text"
              value={systemCount !== null ? systemCount.toFixed(2) : '—'}
              readOnly
              className="mt-1 bg-gray-50 font-medium"
            />
            {systemCount !== null && (
              <p className="text-xs text-gray-500 mt-1">
                System inventory at selected location
              </p>
            )}
          </div>

          {/* Physical Count */}
          <div>
            <Label htmlFor="physicalCount" className="required">Physical Count</Label>
            <Input
              id="physicalCount"
              type="number"
              step="0.01"
              min="0"
              value={formData.physicalCount}
              onChange={(e) => {
                const value = e.target.value
                // Only allow numbers and decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setFormData((prev) => ({ ...prev, physicalCount: value }))
                }
              }}
              onKeyPress={(e) => {
                // Prevent non-numeric characters (except decimal point)
                if (!/[\d.]/.test(e.key)) {
                  e.preventDefault()
                }
              }}
              placeholder="Enter actual physical count"
              className="mt-1"
              required
            />
          </div>

          {/* Difference (Calculated) */}
          <div>
            <Label htmlFor="difference">Difference</Label>
            <Input
              id="difference"
              type="text"
              value={difference !== 0 ? (difference > 0 ? `+${difference}` : difference.toString()) : '0'}
              readOnly
              className={`mt-1 font-medium ${
                difference > 0 ? 'bg-green-50 text-green-700' :
                difference < 0 ? 'bg-red-50 text-red-700' :
                'bg-gray-50'
              }`}
            />
            {difference !== 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {difference > 0 ? 'Stock will increase' : 'Stock will decrease'}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason" className="required">Reason</Label>
            <Select
              value={formData.reason}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
            >
              <SelectTrigger id="reason" className="mt-1">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="found">Found</SelectItem>
                <SelectItem value="count_error">Count Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
              placeholder="Add any additional notes or comments"
              className="mt-1"
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t">
            <Button
              type="submit"
              disabled={loading || systemCount === null}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Create Correction'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
