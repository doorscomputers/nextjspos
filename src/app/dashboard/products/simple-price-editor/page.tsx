'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import notify from 'devextreme/ui/notify'
import ProductSearch from '@/components/ProductSearch'
import ProductReview from '@/components/ProductReview'
import LocationSelector from '@/components/LocationSelector'
import PriceUpdateForm from '@/components/PriceUpdateForm'

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

  const handleLocationChange = (locationIds: number[]) => {
    setSelectedLocations(locationIds)
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

      console.log('🚀 Sending price update:', updates)

      const response = await fetch('/api/products/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      const result = await response.json()

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
              <ProductReview product={selectedProduct} />
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
                Step 4: Update Price
              </h2>
              <PriceUpdateForm
                product={selectedProduct}
                selectedLocationCount={selectedLocations.length}
                onPriceUpdate={handlePriceUpdate}
                updating={updating}
              />
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              💡 How to Use
            </h3>
            <ol className="space-y-1 text-sm text-blue-800 dark:text-blue-200 list-decimal list-inside">
              <li>Search for a product by SKU (exact match) or name (fuzzy search)</li>
              <li>Review the current product details and pricing</li>
              <li>Select the location(s) where you want to update the price</li>
              <li>Enter the new price and confirm the update</li>
            </ol>
            {canManageAllLocations ? (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                As an admin, you can update prices across all locations.
              </p>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                You can only update prices for your assigned location.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}