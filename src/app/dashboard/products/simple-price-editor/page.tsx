'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import notify from 'devextreme/ui/notify'
import ProductSearch from '@/components/ProductSearch'
import ProductReview from '@/components/ProductReview'
import LocationSelector from '@/components/LocationSelector'
import PriceUpdateForm from '@/components/PriceUpdateForm'
import UnitPriceUpdateForm from '@/components/UnitPriceUpdateForm'

interface Product {
  id: number
  name: string
  sku: string
  variationName?: string
  currentPrice: number
  costPrice: number
  productVariationId: number
}

interface Location {
  id: number
  name: string
}

export default function SimplePriceEditorPage() {
  const { can, hasAnyRole, user } = usePermissions()

  // Check permissions
  const canEditAll = can(PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
  const canEdit = can(PERMISSIONS.PRODUCT_PRICE_EDIT)
  const hasAccess = canEditAll || canEdit

  // State management
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])
  const [updating, setUpdating] = useState(false)

  // Role-based location access
  const canManageAllLocations = hasAnyRole(['Super Admin', 'Admin', 'Warehouse Manager', 'Bulk Pricer'])
  const userLocationId = user?.locationIds?.[0] // User's assigned location

  useEffect(() => {
    if (hasAccess) {
      fetchLocations()
    } else {
      setLoading(false)
    }
  }, [hasAccess])

  const fetchLocations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/locations')
      const result = await response.json()

      if (response.ok && result.success) {
        // Filter locations based on user role
        // Exclude Main Warehouse (doesn't sell products)
        let filteredLocations = result.data.filter((loc: Location) =>
          !loc.name.toLowerCase().includes('main warehouse')
        )

        // If user can't manage all locations, show only their assigned location
        if (!canManageAllLocations && userLocationId) {
          filteredLocations = filteredLocations.filter((loc: Location) =>
            loc.id === userLocationId
          )
        }

        setLocations(filteredLocations)
      } else {
        notify('Failed to load locations', 'error', 3000)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      notify('Error loading locations', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setSelectedLocations([]) // Reset location selection when product changes
  }

  const handleLocationChange = async (locationIds: number[]) => {
    setSelectedLocations(locationIds)

    // Only fetch location-specific price if EXACTLY 1 location is selected
    // - 0 locations: Show default price (no query needed)
    // - 1 location: Show that location's price (query needed)
    // - 2+ locations: Show default price (can't show multiple prices)
    if (locationIds.length === 1 && selectedProduct) {
      await fetchLocationSpecificPrice(selectedProduct.productVariationId, locationIds[0])
    } else if (selectedProduct) {
      // Reset to default price when 0 or 2+ locations selected
      console.log('🔵 Resetting to default price (0 or 2+ locations selected)')
      // Re-fetch the product to get its default price
      // This avoids stale location-specific prices
    }
  }

  // Fetch location-specific price for the selected location
  const fetchLocationSpecificPrice = async (productVariationId: number, locationId: number) => {
    try {
      // Add cache buster to prevent stale data
      const url = `/api/products/variation-price?productVariationId=${productVariationId}&locationId=${locationId}&_t=${Date.now()}`

      // DEBUG: Log what we're fetching
      console.log('🔵 Fetching variation price for single-unit product:', {
        productVariationId,
        locationId,
        url,
      })

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      const result = await response.json()

      // DEBUG: Log what we received
      console.log('🔵 Received variation price:', result)

      if (response.ok && result.success) {
        const newPrice = result.data.sellingPrice

        // DEBUG: Log price update
        console.log('🔵 Updating product currentPrice:', {
          oldPrice: selectedProduct?.currentPrice,
          newPrice,
          isLocationSpecific: result.data.isLocationSpecific,
        })

        // Update the selected product with location-specific price
        setSelectedProduct(prev =>
          prev
            ? {
                ...prev,
                currentPrice: newPrice || prev.currentPrice,
              }
            : null
        )

        // Force re-render by updating a dummy state or notify user
        console.log('✅ Product price updated to ₱' + newPrice)
      } else {
        console.error('🔴 Failed to fetch variation price:', result)
      }
    } catch (error) {
      console.error('🔴 Error fetching location-specific price:', error)
    }
  }

  const handlePriceUpdate = async (newPrice: number) => {
    if (!selectedProduct || selectedLocations.length === 0) {
      notify('Please select product and locations', 'warning', 3000)
      return
    }

    try {
      setUpdating(true)

      // Build updates for the API
      const updates = selectedLocations.map(locationId => ({
        productVariationId: selectedProduct.productVariationId,
        locationId: locationId,
        sellingPrice: newPrice,
        pricePercentage: null, // Not using percentage in this simplified version
      }))

      // DEBUG: Log Step 4 price update
      console.log('🔵 Step 4 - Sending price update to /api/products/bulk-price-update:', {
        productVariationId: selectedProduct.productVariationId,
        selectedLocations,
        newPrice,
        updates,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
      })

      const response = await fetch('/api/products/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      const result = await response.json()

      // DEBUG: Log API response
      console.log('🔵 Step 4 - API response from /api/products/bulk-price-update:', result)

      if (response.ok && result.success) {
        const locationNames = locations
          .filter(loc => selectedLocations.includes(loc.id))
          .map(loc => loc.name)
          .join(', ')

        notify(
          `✅ Successfully updated price for ${selectedProduct.name} across ${selectedLocations.length} location(s): ${locationNames}`,
          'success',
          5000
        )

        // Update the selected product's current price
        setSelectedProduct({
          ...selectedProduct,
          currentPrice: newPrice
        })

      } else {
        console.error('Update failed:', result)
        notify(result.error || 'Failed to update price', 'error', 5000)
      }
    } catch (error) {
      console.error('Error updating price:', error)
      notify('Error updating price', 'error', 3000)
    } finally {
      setUpdating(false)
    }
  }

  // If no access, show access denied
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to edit product prices.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading price editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Simple Price Editor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Update product prices quickly and easily
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Step 1: Search Product */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Step 1: Search Product
            </h2>
            <ProductSearch onProductSelect={handleProductSelect} />
          </div>

          {/* Step 2: Product Review (shown only when product is selected) */}
          {selectedProduct && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <span className="text-2xl">📦</span>
                Step 2: Product Details
              </h2>
              {/* Force re-render when price changes by using key */}
              <ProductReview
                key={`${selectedProduct.id}-${selectedProduct.currentPrice}-${selectedLocations.join(',')}`}
                product={selectedProduct}
              />
            </div>
          )}

          {/* Step 3: Location Selection (shown only when product is selected) */}
          {selectedProduct && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <span className="text-2xl">📍</span>
                Step 3: Select Locations
              </h2>
              <LocationSelector
                locations={locations}
                selectedLocations={selectedLocations}
                onLocationChange={handleLocationChange}
                canManageAllLocations={canManageAllLocations}
              />
            </div>
          )}

          {/* Step 4: Price Update (shown only when product and locations are selected) */}
          {selectedProduct && selectedLocations.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <span className="text-2xl">💰</span>
                Step 4: Update Location Price
              </h2>
              <PriceUpdateForm
                product={selectedProduct}
                selectedLocationCount={selectedLocations.length}
                onPriceUpdate={handlePriceUpdate}
                updating={updating}
              />
            </div>
          )}

          {/* Step 5: Unit Prices (shown only when product is selected) */}
          {selectedProduct && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <span className="text-2xl">📏</span>
                Step 5: Update Unit Prices (All Units)
              </h2>
              {selectedLocations.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Set purchase and selling prices for <strong>ALL units</strong> (including primary unit) at the selected location(s).
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>💡 For Multi-Unit Products:</strong> Use this step to set prices for ALL units (Roll, Meter, etc.).
                      You can skip Step 4 if you're setting all unit prices here.
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
                      <strong>Location-Specific Pricing:</strong> Prices will be applied to {selectedLocations.length} selected location(s).
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Set purchase and selling prices for each unit of measure (e.g., Box, Piece, Meter, Roll, Kg, etc.)
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 mb-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>⚠️ No locations selected:</strong> These prices will be set as <strong>global defaults</strong> for all locations.
                    </p>
                  </div>
                </>
              )}
              <UnitPriceUpdateForm product={selectedProduct} selectedLocations={selectedLocations} />
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              💡 How to Use
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200 list-decimal list-inside">
              <li><strong>Step 1-2:</strong> Search for a product and review current details</li>
              <li><strong>Step 3:</strong> Select location(s) to update (leave unchecked for global pricing)</li>
              <li>
                <strong>Step 4:</strong> (Optional) Update primary unit price
                <ul className="ml-6 mt-1 space-y-1 list-disc">
                  <li>For single-unit products (e.g., only "Piece")</li>
                  <li>Or to set the base price before Step 5</li>
                </ul>
              </li>
              <li>
                <strong>Step 5:</strong> Update ALL unit prices (Roll, Meter, etc.)
                <ul className="ml-6 mt-1 space-y-1 list-disc">
                  <li><strong>For multi-unit products:</strong> Set prices for ALL units here</li>
                  <li>This includes the primary unit (e.g., Roll) AND sub-units (e.g., Meter)</li>
                  <li><strong>You can skip Step 4</strong> if you're setting all prices here</li>
                </ul>
              </li>
            </ol>
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                📌 Quick Guide for Multi-Unit Products:
              </p>
              <ul className="text-xs text-green-800 dark:text-green-200 mt-2 space-y-1 list-disc list-inside">
                <li>Check location(s) in <strong>Step 3</strong></li>
                <li>Skip <strong>Step 4</strong> (or use it for primary unit only)</li>
                <li>Set ALL unit prices in <strong>Step 5</strong> (Roll, Meter, etc.)</li>
                <li>Click "Save All Prices"</li>
              </ul>
            </div>
            {canManageAllLocations ? (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                As an admin, you can update prices across all locations.
              </p>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                You can only update prices for your assigned location.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}