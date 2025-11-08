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
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Search, X } from 'lucide-react'

interface Location {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string
  variations?: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  productId: number
  variationLocationDetails?: Array<{
    locationId: number
    qtyAvailable: number
  }>
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)

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
    if (locations.length > 0 && session?.user) {
      const userPermissions = (session.user as any).permissions || []
      const hasAccessAllLocations = userPermissions.includes('location.access_all')
      const userLocationIds = (session.user as any).locationIds || []

      // If user has access to all locations, show all locations
      if (hasAccessAllLocations) {
        // Don't lock location, let them choose
        return
      }

      // If user has exactly one location, auto-lock it
      if (userLocationIds.length === 1) {
        const userLoc = locations.find(loc => userLocationIds.includes(loc.id))
        if (userLoc) {
          setUserLocation(userLoc)
          setFormData(prev => ({ ...prev, locationId: userLoc.id.toString() }))
        }
      } else if (userLocationIds.length > 1) {
        // Filter to show only accessible locations
        const accessibleLocs = locations.filter(loc => userLocationIds.includes(loc.id))
        setLocations(accessibleLocs)
      }
      // If userLocationIds is empty and no ACCESS_ALL_LOCATIONS,
      // they'll see empty dropdown (which is correct - they need location assignment)
    }
  }, [locations.length, session?.user])

  // Filter products - SKU first, then phrase search
  useEffect(() => {
    console.log('🔍 Search term changed:', productSearchTerm)
    console.log('🔍 Total products available:', products.length)

    if (!productSearchTerm.trim()) {
      setFilteredProducts(products)
      console.log('🔍 No search term, showing all products:', products.length)
      return
    }

    const searchLower = productSearchTerm.toLowerCase().trim()
    console.log('🔍 Searching for:', searchLower)

    // STEP 1: Check for exact SKU match first (priority)
    const exactSkuMatches = products.filter(product => {
      const productSku = product.sku.toLowerCase()
      const isExactMatch = productSku === searchLower

      if (isExactMatch) {
        console.log('🎯 EXACT SKU MATCH:', product.name, 'SKU:', product.sku)
      }

      return isExactMatch
    })

    // If we found exact SKU match, return only that
    if (exactSkuMatches.length > 0) {
      console.log('✅ Found', exactSkuMatches.length, 'exact SKU match(es)')
      setFilteredProducts(exactSkuMatches)
      setCurrentPage(1)
      return
    }

    // STEP 2: If no exact SKU match, search by phrase (contains)
    console.log('🔍 No exact SKU match, searching by phrase...')

    const phraseMatches = products.filter(product => {
      const productName = product.name.toLowerCase()
      const productSku = product.sku.toLowerCase()
      const productBarcode = product.barcode?.toLowerCase() || ''

      // Check if the FULL search phrase is contained in name, SKU, or barcode
      const nameContains = productName.includes(searchLower)
      const skuContains = productSku.includes(searchLower)
      const barcodeContains = productBarcode.includes(searchLower)

      const hasMatch = nameContains || skuContains || barcodeContains

      if (hasMatch) {
        console.log('✅ Phrase match:', product.name, 'SKU:', product.sku, {
          nameMatch: nameContains,
          skuMatch: skuContains,
          barcodeMatch: barcodeContains
        })
      }

      return hasMatch
    })

    console.log('🔍 Found', phraseMatches.length, 'phrase match(es)')

    if (phraseMatches.length === 0) {
      console.log('⚠️ No products found. Sample of available products:')
      products.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (SKU: ${p.sku})`)
      })
    }

    setFilteredProducts(phraseMatches)
    setCurrentPage(1)
  }, [productSearchTerm, products])

  useEffect(() => {
    if (formData.productId) {
      const productId = parseInt(formData.productId)

      // If the product was selected via the UI, variations are already populated
      if (selectedProduct && selectedProduct.id === productId) {
        return
      }

      fetchVariations(productId).then((vars) => {
        setVariations(vars)
      })
    } else {
      setVariations([])
      setFormData((prev) => ({ ...prev, productVariationId: '' }))
    }
  }, [formData.productId, selectedProduct])

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
        // API returns { success: true, data: [...] }
        setLocations(data.data || [])
        console.log('📍 Locations loaded:', data.data?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=10000')
      if (res.ok) {
        const data = await res.json()
        const productsWithVariations = data.products || []
        console.log('📦 Products loaded:', productsWithVariations.length)
        console.log('📦 Sample products:')
        productsWithVariations.slice(0, 10).forEach((p: any, i: number) => {
          console.log(`   ${i + 1}. ${p.name} | SKU: ${p.sku} | Barcode: ${p.barcode || 'N/A'}`)
        })

        // Check for products with "512" in name or SKU
        const with512 = productsWithVariations.filter((p: any) =>
          p.name.toLowerCase().includes('512') ||
          p.sku.toLowerCase().includes('512')
        )
        console.log('📦 Products containing "512":', with512.length)
        if (with512.length > 0) {
          with512.forEach((p: any) => {
            console.log(`   - ${p.name} | SKU: ${p.sku}`)
          })
        }

        // Check for products with "adata" in name
        const withAdata = productsWithVariations.filter((p: any) =>
          p.name.toLowerCase().includes('adata')
        )
        console.log('📦 Products containing "adata":', withAdata.length)
        if (withAdata.length > 0 && withAdata.length <= 10) {
          withAdata.forEach((p: any) => {
            console.log(`   - ${p.name} | SKU: ${p.sku}`)
          })
        }

        setProducts(productsWithVariations)
        setFilteredProducts(productsWithVariations)
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
        const vars = data.variations || []
        console.log('[fetchVariations] Found', vars.length, 'variations for product', productId)
        return vars
      } else {
        console.warn('[fetchVariations] Failed with status', res.status, 'for product', productId)
      }
    } catch (error) {
      console.error('Error fetching variations:', error)
    }
    return []
  }

  const fetchSystemCount = async (locationId: number, variationId: number) => {
    console.log('[fetchSystemCount] Called with locationId:', locationId, 'variationId:', variationId)
    try {
      const url = `/api/products/variations/${variationId}/inventory?locationId=${locationId}`
      console.log('[fetchSystemCount] Fetching:', url)
      const res = await fetch(url)
      console.log('[fetchSystemCount] Response status:', res.status, res.ok ? 'OK' : 'ERROR')

      if (res.ok) {
        const data = await res.json()
        console.log('[fetchSystemCount] Response data:', data)

        if (data.inventory) {
          const count = parseFloat(data.inventory.qtyAvailable)
          console.log('[fetchSystemCount] Setting systemCount to:', count)
          setSystemCount(count)
        } else {
          // Product doesn't exist at this location - set to 0 for beginning inventory
          console.log('[fetchSystemCount] No inventory found, setting to 0')
          setSystemCount(0)
          toast.info('Product not yet added to this location. System count is 0.')
        }
      } else {
        // API error (404, 500, etc.) - still allow correction with 0 count
        const errorText = await res.text()
        console.warn('[fetchSystemCount] API error, defaulting to 0. Status:', res.status, 'Error:', errorText)
        setSystemCount(0)
        toast.info('Product not yet added to this location. System count is 0.')
      }
    } catch (error) {
      console.error('[fetchSystemCount] Exception:', error)
      setSystemCount(0)
      toast.warning('Could not verify current inventory. System count set to 0.')
    }
  }

  const handleProductSelect = async (product: Product) => {
    console.log('[Product Selected]', product.name, 'ID:', product.id)
    setSelectedProduct(product)
    setFormData((prev) => ({
      ...prev,
      productId: product.id.toString(),
      productVariationId: ''
    }))

    // Prefer variations already included in the product payload to avoid extra API round-trips
    const cachedVariations = Array.isArray(product.variations) ? product.variations : []
    const vars =
      cachedVariations.length > 0
        ? cachedVariations
        : await fetchVariations(product.id)

    setVariations(vars)

    // If single variation, auto-select it
    if (vars && vars.length === 1) {
      console.log('[Auto-selecting single variation]', vars[0].id)
      const variationId = vars[0].id
      setFormData((prev) => ({
        ...prev,
        productVariationId: variationId.toString()
      }))

      // IMMEDIATELY fetch system count after auto-selecting variation
      if (formData.locationId) {
        console.log('[Fetching system count immediately] location:', formData.locationId, 'variation:', variationId)
        await fetchSystemCount(parseInt(formData.locationId), variationId)
      }
    } else if (vars && vars.length > 1) {
      console.log('[Multiple variations] User must manually select')
    } else {
      console.warn('[No variations found for product]', product.id)
      toast.error('No variations found for this product. Please create a variation before recording corrections.')
      setVariations([])
      setSystemCount(null)
    }

    // Clear search
    setProductSearchTerm('')
  }

  const clearProductSelection = () => {
    setSelectedProduct(null)
    setFormData((prev) => ({
      ...prev,
      productId: '',
      productVariationId: ''
    }))
    setVariations([])
    setSystemCount(null)
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

    // Prevent double submission - disable button immediately
    if (loading) return
    setLoading(true)

    // Validate required fields
    if (!formData.locationId || !formData.productId || !formData.productVariationId || !formData.physicalCount || !formData.reason || !formData.remarks) {
      toast.error('Please fill in all required fields (Location, Physical Count, Reason, and Remarks)')
      setLoading(false)
      return
    }

    // Validate physical count is a valid number >= 0
    const physCount = parseFloat(formData.physicalCount)
    if (isNaN(physCount) || physCount < 0) {
      toast.error('Physical Count must be a number greater than or equal to 0')
      setLoading(false)
      return
    }

    if (systemCount === null) {
      toast.error('Unable to determine system count. Please ensure the product exists at this location.')
      setLoading(false)
      return
    }

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
        toast.success(data.message || 'Inventory correction created successfully', {
          duration: 2000 // Show for only 2 seconds
        })
        // Redirect immediately without waiting for toast
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

  // Pagination calculations
  const indexOfLastProduct = currentPage * itemsPerPage
  const indexOfFirstProduct = indexOfLastProduct - itemsPerPage
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Product Selection (takes 2/3 of space) */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Select Product</h2>
                <span className="text-sm text-gray-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                  {productSearchTerm && ` found`}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product name, SKU, or barcode..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-10"
                />
                {productSearchTerm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setProductSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {productSearchTerm && filteredProducts.length > 0 && (
                <p className="text-xs text-green-600 mb-2">
                  ✓ Found {filteredProducts.length} matching product{filteredProducts.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Product Grid */}
              {!selectedProduct ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {currentProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-gray-200"
                        onClick={() => handleProductSelect(product)}
                      >
                        <CardContent className="p-3">
                          <h3 className="font-bold text-xs mb-1 line-clamp-2 h-8">
                            {product.name}
                          </h3>
                          <p className="text-[10px] text-gray-500 mb-1">
                            SKU: {product.sku}
                          </p>
                          <Button
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-7 mt-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleProductSelect(product)
                            }}
                          >
                            Select
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                      >
                        Next
                      </Button>
                    </div>
                  )}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p>No products found</p>
                      <p className="text-sm mt-1">Try adjusting your search</p>
                    </div>
                  )}
                </>
              ) : (
                /* Selected Product Display */
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-blue-900">{selectedProduct.name}</p>
                      <p className="text-xs text-blue-700">SKU: {selectedProduct.sku}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearProductSelection}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Variation Selection if multiple */}
                  {variations.length > 1 && (
                    <div className="mt-3">
                      <Label htmlFor="productVariationId" className="text-sm">Select Variation</Label>
                      <Select
                        value={formData.productVariationId}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, productVariationId: value }))}
                      >
                        <SelectTrigger id="productVariationId" className="mt-1">
                          <SelectValue placeholder="Select variation" />
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Correction Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit}>
            <Card className="border-gray-200 shadow-sm sticky top-4">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Correction Details</h2>

                {/* Location */}
                <div>
                  <Label htmlFor="locationId" className="text-sm">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  {userLocation ? (
                    <div className="mt-1">
                      <Input
                        id="locationId"
                        type="text"
                        value={userLocation.name}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Locked to your branch</p>
                    </div>
                  ) : (
                    <Select
                      value={formData.locationId}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, locationId: value }))}
                      required
                    >
                      <SelectTrigger id="locationId" className="mt-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">No active locations available</div>
                        ) : (
                          locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              {loc.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* System Count */}
                <div>
                  <Label htmlFor="systemCount" className="text-sm">System Count</Label>
                  <Input
                    id="systemCount"
                    type="text"
                    value={systemCount !== null ? systemCount.toFixed(2) : '—'}
                    readOnly
                    className="mt-1 bg-gray-50 font-medium text-sm"
                  />
                  {systemCount === 0 && formData.productVariationId && (
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ New product - no inventory at this location yet
                    </p>
                  )}
                  {systemCount === null && formData.productVariationId && (
                    <p className="text-xs text-gray-500 mt-1">
                      ⏳ Loading system count...
                    </p>
                  )}
                </div>

                {/* Physical Count */}
                <div>
                  <Label htmlFor="physicalCount" className="text-sm">
                    Physical Count <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="physicalCount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.physicalCount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, physicalCount: e.target.value }))}
                    placeholder="Enter actual count"
                    className="mt-1"
                    required
                  />
                </div>

                {/* Difference */}
                <div>
                  <Label htmlFor="difference" className="text-sm">Difference</Label>
                  <Input
                    id="difference"
                    type="text"
                    value={difference !== 0 ? (difference > 0 ? `+${difference}` : difference.toString()) : '0'}
                    readOnly
                    className={`mt-1 font-medium text-sm ${
                      difference > 0 ? 'bg-green-50 text-green-700' :
                      difference < 0 ? 'bg-red-50 text-red-700' :
                      'bg-gray-50'
                    }`}
                  />
                </div>

                {/* Reason */}
                <div>
                  <Label htmlFor="reason" className="text-sm">
                    Reason <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
                    required
                  >
                    <SelectTrigger id="reason" className="mt-1">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginning_inventory">Beginning Inventory</SelectItem>
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
                  <Label htmlFor="remarks" className="text-sm">
                    Remarks <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Additional notes..."
                    className="mt-1"
                    rows={3}
                    required
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-4 border-t">
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      systemCount === null ||
                      !formData.locationId ||
                      !formData.productId ||
                      !formData.productVariationId ||
                      !formData.physicalCount ||
                      !formData.reason ||
                      !formData.remarks ||
                      parseFloat(formData.physicalCount) < 0
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Creating...' : 'Create Correction'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={loading}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  )
}
