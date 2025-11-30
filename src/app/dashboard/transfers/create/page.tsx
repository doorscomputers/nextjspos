"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserPrimaryLocation } from '@/hooks/useUserPrimaryLocation'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeftIcon, TrashIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import UnifiedProductSearch from '@/components/UnifiedProductSearch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Product {
  id: number
  name: string
  sku: string
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
  stockAtLocation?: number  // NEW: Stock quantity at user's location (pre-loaded, no API call!)
  variationLocationDetails?: any[] // Include full stock details if needed
}

interface TransferItem {
  productId: number
  productVariationId: number
  productName: string
  variationName: string
  sku: string | null
  quantity: number
  availableStock: number
}

interface Location {
  id: number
  name: string
  isAssigned?: boolean
}

export default function CreateTransferPage() {
  const { can, user } = usePermissions()
  const router = useRouter()

  // BULLETPROOF location detection from session (instant, no API delay)
  const { locationId, location, loading: locationLoading, noLocationAssigned } = useUserPrimaryLocation()

  const [allLocations, setAllLocations] = useState<Location[]>([]) // All business locations for To dropdown
  const [loadingLocations, setLoadingLocations] = useState(true)

  // From location is auto-set from session (user's primary location)
  const fromLocationId = locationId?.toString() || ''
  const [toLocationId, setToLocationId] = useState('')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<TransferItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)

  // INSTANT SEARCH: Load all products once (POS pattern - client-side filtering)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Product search method state
  useEffect(() => {
    fetchInitialData()
  }, [])

  // Load ALL products ONCE on mount (same endpoint as POS)
  useEffect(() => {
    if (locationId) {
      fetchAllProducts()
    }
  }, [locationId])

  // Auto-set destination to Main Warehouse for branch locations (Hub-and-Spoke model)
  // This effect runs after BOTH location and allLocations are loaded (fixes race condition)
  useEffect(() => {
    // Wait for both location and locations to load
    if (!location || !allLocations.length || locationLoading || loadingLocations) {
      return
    }

    // If user is at a branch (not Main Warehouse), auto-set to Main Warehouse
    if (location.name !== 'Main Warehouse') {
      const mainWarehouse = allLocations.find(loc => loc.name === 'Main Warehouse')

      if (mainWarehouse && toLocationId !== mainWarehouse.id.toString()) {
        setToLocationId(mainWarehouse.id.toString())
        console.log('🏭 Auto-set destination to Main Warehouse (Hub-and-Spoke model)')
        toast.info('Destination auto-set to Main Warehouse (centralized transfer policy)')
      }
    }
  }, [location, allLocations, locationLoading, loadingLocations, toLocationId])

  const fetchInitialData = async () => {
    try {
      setLoadingLocations(true)

      // Fetch ALL business locations for the To Location dropdown
      const allLocationsRes = await fetch('/api/locations/all')
      const allLocationsData = await allLocationsRes.json()

      console.log('🏢 All business locations:', allLocationsData.locations?.length || 0)

      if (allLocationsRes.ok) {
        const locations = allLocationsData.locations || []
        setAllLocations(locations)
      }
    } catch (error) {
      console.error('❌ Error fetching initial data:', error)
      toast.error('Failed to load locations')
    } finally {
      setLoadingLocations(false)
    }
  }

  // INSTANT SEARCH: Load ALL products once (EXACT POS PATTERN for instant search)
  const fetchAllProducts = async () => {
    if (!locationId) return

    try {
      setLoadingProducts(true)
      console.log('🚀 [INSTANT SEARCH] Loading ALL products... (like POS)')

      // Use SAME endpoint as POS: /api/products?limit=10000&status=active
      const response = await fetch('/api/products?limit=10000&status=active')
      const data = await response.json()

      console.log(`📦 Fetched ${data.products?.length || 0} total products`)

      if (data.products) {
        // Filter for products with stock > 0 at THIS location (EXACT POS PATTERN)
        const productsWithStock = data.products
          .map((p: any) => {
            // Add stock quantity to each variation for INSTANT access (no API call!)
            const variationsWithStock = p.variations?.map((v: any) => {
              const locationStock = v.variationLocationDetails?.find(
                (vl: any) => vl.locationId === locationId
              )
              const stockQty = locationStock ? parseFloat(locationStock.qtyAvailable) : 0

              return {
                ...v,
                stockAtLocation: stockQty,  // PRE-CALCULATE stock for instant add-to-cart
                variationLocationDetails: v.variationLocationDetails  // Keep full details if needed
              }
            }).filter((v: any) => v.stockAtLocation > 0)  // Only variations with stock

            return {
              ...p,
              variations: variationsWithStock
            }
          })
          .filter((p: any) => p.variations && p.variations.length > 0)  // Only products with stock

        console.log(`✅ [INSTANT SEARCH] ${productsWithStock.length} products have stock at location ${locationId}`)

        // Sort by name (like POS)
        const sortedProducts = productsWithStock.sort((a: any, b: any) =>
          a.name.localeCompare(b.name)
        )

        setAllProducts(sortedProducts)
      } else {
        setAllProducts([])
      }
    } catch (error) {
      console.error('❌ Error loading products:', error)
      toast.error('Failed to load products for search')
      setAllProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleAutoPopulate = () => {
    if (items.length > 0) {
      toast.warning('Please clear current items before auto-populating')
      return
    }

    if (allProducts.length === 0) {
      toast.error('No products with stock available at this location')
      return
    }

    // Flatten all variations with stock (already filtered by location!)
    const availableVariations = allProducts.flatMap(product =>
      product.variations.map(variation => ({
        product,
        variation,
        stockQty: variation.stockAtLocation || 0
      }))
    ).filter(item => item.stockQty > 0)

    if (availableVariations.length === 0) {
      toast.error('No variations with stock available')
      return
    }

    // Shuffle array randomly (Fisher-Yates algorithm)
    const shuffled = [...availableVariations]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Take first 70 (or less if not enough products)
    const selected = shuffled.slice(0, Math.min(70, shuffled.length))

    // Convert to TransferItem format with random quantities
    const newItems: TransferItem[] = selected.map(({ product, variation, stockQty }) => {
      // Random quantity between 1 and min(5, available stock)
      const maxQty = Math.min(5, Math.floor(stockQty))
      const randomQty = Math.floor(Math.random() * maxQty) + 1

      return {
        productId: product.id,
        productVariationId: variation.id,
        productName: product.name,
        variationName: variation.name,
        sku: variation.sku,
        quantity: randomQty,
        availableStock: stockQty
      }
    })

    setItems(newItems)
    toast.success(`✨ Auto-populated ${newItems.length} items with random quantities!`)
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

  const handleProductSelect = async (product: Product, variation: ProductVariation) => {
    if (!fromLocationId) {
      toast.error('Please select "From Location" first')
      return
    }

    // Check if already added
    if (items.some(item => item.productVariationId === variation.id)) {
      toast.warning('Product already in list. Increase quantity if needed.')
      return
    }

    // INSTANT: Use pre-loaded stock (no API call!)
    const availableStock = variation.stockAtLocation || 0

    console.log(`⚡ INSTANT ADD: ${product.name} - Stock: ${availableStock} (no API call!)`)

    if (availableStock <= 0) {
      toast.error(`No stock available for ${product.name} - ${variation.name} at this location`)
      return
    }

    const newItem: TransferItem = {
      productId: product.id,
      productVariationId: variation.id,
      productName: product.name,
      variationName: variation.name,
      sku: variation.sku,
      quantity: 1,
      availableStock
    }

    setItems([...items, newItem])
    toast.success(`Added: ${product.name} - ${variation.name}`)
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

  const handleCreateTransferClick = () => {
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

    // Show confirmation dialog
    setShowConfirmDialog(true)
  }

  const handleSubmit = async () => {
    setShowConfirmDialog(false)

    try {
      setSubmitting(true)

      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromLocationId: parseInt(fromLocationId),
          toLocationId: parseInt(toLocationId),
          // transferDate removed - server will use real-time timestamp
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
          <Button variant="secondary" size="sm" className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
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
          {/* Locations */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Transfer Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Location <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {locationLoading ? (
                    <input
                      type="text"
                      value="Loading your location..."
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                    />
                  ) : noLocationAssigned ? (
                    <input
                      type="text"
                      value="No location assigned"
                      disabled
                      className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-700 cursor-not-allowed dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                    />
                  ) : (
                    <input
                      type="text"
                      value={location?.name || 'Unknown'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 font-medium"
                    />
                  )}
                  {!locationLoading && !noLocationAssigned && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded dark:bg-green-900 dark:text-green-300">
                      Auto-Assigned
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <strong>🎯 Auto-assigned from session:</strong> Instantly set to your primary location (no API delay)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Location <span className="text-red-500">*</span>
                </label>
                {(() => {
                  // HUB-AND-SPOKE MODEL LOGIC
                  const isFromMainWarehouse = location?.name === 'Main Warehouse'
                  const mainWarehouse = allLocations.find(loc => loc.name === 'Main Warehouse')

                  // If transferring FROM a branch (not Main Warehouse), TO location is locked to Main Warehouse
                  if (!isFromMainWarehouse && mainWarehouse && !locationLoading) {
                    return (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            value={toLocationId ? "Main Warehouse" : "Setting destination..."}
                            disabled
                            className={`w-full px-3 py-2 border rounded-lg cursor-not-allowed
                              ${toLocationId
                                ? 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                                : 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800'
                              }`}
                          />
                          {toLocationId && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-300">
                              Auto-Set
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <strong>🏭 Centralized Transfer Policy:</strong> All branch transfers must go to Main Warehouse
                        </p>
                      </>
                    )
                  }

                  // If transferring FROM Main Warehouse, allow selecting any other location
                  return (
                    <>
                      <Select value={toLocationId} onValueChange={setToLocationId} disabled={locationLoading || noLocationAssigned}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination location" />
                        </SelectTrigger>
                        <SelectContent>
                          {allLocations
                            .filter(loc => {
                              // Exclude from location itself (can't transfer to itself)
                              if (fromLocationId && loc.id === parseInt(fromLocationId)) return false
                              return true
                            })
                            .map(loc => (
                              <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        <strong>✅ Main Warehouse:</strong> Can transfer to any branch location
                      </p>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Add Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Add Items</h2>

            {loadingLocations || locationLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading locations...
              </div>
            ) : noLocationAssigned ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
                <p className="font-semibold">No Location Assigned</p>
                <p className="text-sm mt-1">You need to have a location assigned to your account before creating transfers.</p>
                <p className="text-sm mt-1">Please contact your administrator to assign you to a location.</p>
              </div>
            ) : (
              <div>
                {/* Clear All button when items exist */}
                {items.length > 0 && (
                  <div className="mb-4 flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearAllDialog(true)}
                      className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Clear All
                    </Button>
                  </div>
                )}

                {/* INSTANT SEARCH: Pass pre-loaded products for client-side filtering (POS pattern) */}
                {loadingProducts ? (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-800 dark:text-blue-200">Loading products for instant search...</span>
                  </div>
                ) : (
                  <UnifiedProductSearch
                    onProductSelect={handleProductSelect}
                    placeholder="🔍 Scan barcode or search product (SKU, Name)..."
                    autoFocus={true}
                    products={allProducts}  // CLIENT-SIDE SEARCH (INSTANT like POS!)
                  />
                )}
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
                      <div className="text-sm text-gray-500">
                        {item.variationName}
                        {item.sku && ` • SKU: ${item.sku}`}
                      </div>
                      <div className="text-sm text-green-600 font-medium">Available: {item.availableStock}</div>
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2 font-medium"
                      title="Remove this item"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transfer Date and Notes */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>📅 Transfer Date:</strong> Automatically recorded as current date/time when you submit.
                <br />
                <span className="text-xs">This prevents backdating and ensures accurate audit trails.</span>
              </p>
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
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                onClick={handleCreateTransferClick}
                disabled={
                  submitting ||
                  items.length === 0 ||
                  locationLoading ||
                  loadingLocations ||
                  !toLocationId
                }
              >
                {submitting ? 'Creating...' : 'Create Transfer'}
              </Button>
              <Link href="/dashboard/transfers">
                <Button variant="secondary" className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-center sm:text-center">
            <AlertDialogTitle className="text-xl font-semibold">
              Clear All Items?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400 pt-2">
              This will remove all <span className="font-semibold text-red-600">{items.length} item(s)</span> from this transfer.
              <br />
              <span className="text-sm">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3 sm:justify-center">
            <AlertDialogCancel className="min-w-[100px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setItems([])
                setShowClearAllDialog(false)
                toast.info('All items cleared')
              }}
              className="min-w-[100px] bg-red-600 hover:bg-red-700 text-white"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-center sm:text-center">
            <AlertDialogTitle className="text-xl font-semibold">
              Confirm Transfer?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400 pt-4 space-y-3">
              <div>
                Transfer <span className="font-semibold text-gray-900 dark:text-white">{items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span>
              </div>
              <div className="flex items-center justify-center gap-4 py-2">
                <span className="font-medium text-gray-800 dark:text-gray-200">{location?.name}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{allLocations.find(loc => loc.id === parseInt(toLocationId))?.name}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3 sm:justify-center">
            <AlertDialogCancel className="min-w-[100px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              className="min-w-[100px] bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
