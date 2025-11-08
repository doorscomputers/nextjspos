"use client"

import { useState, useEffect } from 'react'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface UnitPrice {
  unitId: number
  unitName: string
  unitShortName: string
  purchasePrice: string
  sellingPrice: string
  multiplier: string
  isBaseUnit: boolean
}

interface UnitPricingManagerProps {
  productId: number | null
  onPricesChange?: (prices: UnitPrice[]) => void
  readOnly?: boolean
  defaultPurchasePrice?: string // From product form
  defaultSellingPrice?: string  // From product form
}

export default function UnitPricingManager({
  productId,
  onPricesChange,
  readOnly = false,
  defaultPurchasePrice,
  defaultSellingPrice
}: UnitPricingManagerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prices, setPrices] = useState<UnitPrice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (productId) {
      fetchUnitPrices()
    }
  }, [productId])

  // Auto-recalculate when default prices change
  useEffect(() => {
    if (defaultPurchasePrice && defaultSellingPrice && prices.length > 0) {
      recalculateFromDefaults()
    }
  }, [defaultPurchasePrice, defaultSellingPrice])

  const fetchUnitPrices = async () => {
    if (!productId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}/unit-prices`)
      const data = await response.json()

      if (response.ok) {
        setPrices(data.prices || [])
      } else {
        setError(data.error || 'Failed to load unit prices')
      }
    } catch (err) {
      console.error('Error fetching unit prices:', err)
      setError('Failed to load unit prices')
    } finally {
      setLoading(false)
    }
  }

  const handlePriceChange = (
    unitId: number,
    field: 'purchasePrice' | 'sellingPrice',
    value: string
  ) => {
    const updatedPrices = prices.map(price =>
      price.unitId === unitId
        ? { ...price, [field]: value }
        : price
    )

    setPrices(updatedPrices)

    // Notify parent component
    if (onPricesChange) {
      onPricesChange(updatedPrices)
    }
  }

  const validatePrice = (price: UnitPrice): string | null => {
    const purchase = parseFloat(price.purchasePrice)
    const selling = parseFloat(price.sellingPrice)

    if (isNaN(purchase) || purchase <= 0) {
      return 'Purchase price must be greater than 0'
    }

    if (isNaN(selling) || selling <= 0) {
      return 'Selling price must be greater than 0'
    }

    if (selling < purchase) {
      return 'Selling price cannot be less than purchase price'
    }

    return null
  }

  const calculateEffectivePricePerBase = (price: UnitPrice) => {
    const multiplier = parseFloat(price.multiplier)
    const purchasePrice = parseFloat(price.purchasePrice)
    const sellingPrice = parseFloat(price.sellingPrice)

    if (isNaN(multiplier) || multiplier === 0) return { purchase: 0, selling: 0 }

    return {
      purchase: purchasePrice / multiplier,
      selling: sellingPrice / multiplier
    }
  }

  const calculateMargin = (price: UnitPrice): number => {
    const purchase = parseFloat(price.purchasePrice)
    const selling = parseFloat(price.sellingPrice)

    if (isNaN(purchase) || isNaN(selling) || purchase === 0) return 0

    return ((selling - purchase) / purchase) * 100
  }

  const recalculateFromDefaults = () => {
    if (!defaultPurchasePrice || !defaultSellingPrice) return

    const basePurchase = parseFloat(defaultPurchasePrice)
    const baseSelling = parseFloat(defaultSellingPrice)

    if (isNaN(basePurchase) || isNaN(baseSelling)) return

    // Find the base unit (multiplier = 1)
    const baseUnit = prices.find(p => p.isBaseUnit)
    if (!baseUnit) return

    // Recalculate all unit prices based on default
    const updatedPrices = prices.map(price => {
      const multiplier = parseFloat(price.multiplier)
      return {
        ...price,
        purchasePrice: (basePurchase * multiplier).toFixed(2),
        sellingPrice: (baseSelling * multiplier).toFixed(2)
      }
    })

    setPrices(updatedPrices)

    if (onPricesChange) {
      onPricesChange(updatedPrices)
    }
  }

  const handleSavePrices = async () => {
    if (!productId) return

    // Validate all prices before saving
    const validationErrors = prices.map(p => validatePrice(p)).filter(e => e !== null)
    if (validationErrors.length > 0) {
      setError('Please fix validation errors before saving')
      return
    }

    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const payload = prices.map(price => ({
        unitId: price.unitId,
        purchasePrice: parseFloat(price.purchasePrice),
        sellingPrice: parseFloat(price.sellingPrice)
      }))

      const response = await fetch(`/api/products/${productId}/unit-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: payload })
      })

      const data = await response.json()

      if (response.ok) {
        setSaveSuccess(true)
        // Refresh prices to show saved data
        await fetchUnitPrices()

        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setError(data.error || 'Failed to save unit prices')
      }
    } catch (err) {
      console.error('Error saving unit prices:', err)
      setError('Failed to save unit prices')
    } finally {
      setSaving(false)
    }
  }

  if (!productId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
          <p className="text-sm text-yellow-800">
            Save the product first to configure unit-specific pricing
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading unit prices...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={fetchUnitPrices}
          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (prices.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          No units configured for this product. Please set up units first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-6 w-6 text-yellow-700 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-yellow-900">
            <p className="font-bold mb-2 text-base">⚠️ IMPORTANT: Save Product First!</p>
            <p className="mb-2">If you just changed the <strong>Unit</strong> or <strong>Additional Sub-Units</strong>, you MUST click <strong className="text-red-600">"Save Changes"</strong> button at the bottom of the page FIRST before Unit-Specific Pricing will update.</p>
            <p className="text-xs">Reason: Unit-Specific Pricing reads from the database. Your unsaved changes are only in the form and haven't been saved yet.</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Unit-Specific Pricing - Auto-Calculated</p>
            <p>Prices below are automatically calculated from the <strong>Product Pricing</strong> section above. When you change the base price, all unit prices update automatically based on their multipliers.</p>
            <p className="mt-1">You can override any price by typing a new value, then click <strong>Save Unit Prices</strong>.</p>
          </div>
        </div>
      </div>

      {/* Unit Prices Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Multiplier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Purchase Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Selling Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margin %
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effective Price/Base
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {prices.map((price) => {
              const validationError = validatePrice(price)
              const effectivePrice = calculateEffectivePricePerBase(price)
              const margin = calculateMargin(price)

              return (
                <tr key={price.unitId} className={price.isBaseUnit ? 'bg-green-50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {price.unitName}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({price.unitShortName})
                      </span>
                      {price.isBaseUnit && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                          BASE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    ×{price.multiplier}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.purchasePrice}
                      onChange={(e) => handlePriceChange(price.unitId, 'purchasePrice', e.target.value)}
                      disabled={readOnly}
                      className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm
                        ${validationError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
                        ${readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
                      `}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.sellingPrice}
                      onChange={(e) => handlePriceChange(price.unitId, 'sellingPrice', e.target.value)}
                      disabled={readOnly}
                      className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm
                        ${validationError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
                        ${readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
                      `}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margin.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex flex-col space-y-1">
                      <span>₱{effectivePrice.purchase.toFixed(4)}</span>
                      <span className="text-gray-400">/</span>
                      <span>₱{effectivePrice.selling.toFixed(4)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Validation Errors */}
      {prices.some(p => validatePrice(p)) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {prices.map(price => {
              const error = validatePrice(price)
              if (error) {
                return (
                  <li key={price.unitId}>
                    <span className="font-medium">{price.unitName}:</span> {error}
                  </li>
                )
              }
              return null
            })}
          </ul>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800">
            ✓ Unit prices saved successfully!
          </p>
        </div>
      )}

      {/* Save Button */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSavePrices}
            disabled={saving || prices.some(p => validatePrice(p) !== null)}
            className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {saving ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Unit Prices'
            )}
          </button>
        </div>
      )}

      {/* Helpful Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-700 mb-2">💡 Tips:</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>Effective Price/Base</strong> shows the cost per smallest unit (e.g., price per piece when buying by box)</li>
          <li>• Lower effective prices indicate bulk discounts</li>
          <li>• Base unit (highlighted in green) is used for inventory tracking</li>
          <li>• All prices must be greater than 0, and selling price ≥ purchase price</li>
        </ul>
      </div>
    </div>
  )
}
