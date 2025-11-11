'use client'

import { useState, useEffect } from 'react'
import notify from 'devextreme/ui/notify'

interface Unit {
  id: number
  name: string
  shortName: string | null
}

interface UnitPrice {
  id?: number
  unitId: number
  unit?: Unit
  purchasePrice: number
  sellingPrice: number
}

interface Product {
  id: number
  name: string
  sku: string
  unitId: number
  unit?: Unit
  subUnitIds?: string | number[]
}

interface UnitPriceUpdateFormProps {
  product: Product
  selectedLocations?: number[] // NEW: Optional location IDs for location-specific pricing
  onPriceUpdate?: () => void
}

export default function UnitPriceUpdateForm({
  product,
  selectedLocations,
  onPriceUpdate,
}: UnitPriceUpdateFormProps) {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitPrices, setUnitPrices] = useState<Record<number, UnitPrice>>({})
  const [changes, setChanges] = useState<Record<number, { purchasePrice: string; sellingPrice: string }>>({})

  // Determine if we're in location-specific mode
  const isLocationSpecific = selectedLocations && selectedLocations.length > 0

  useEffect(() => {
    fetchUnitPrices()
  }, [product.id, selectedLocations])

  const fetchUnitPrices = async () => {
    try {
      setLoading(true)

      // Build URL with location IDs if in location-specific mode
      let url = `/api/products/unit-prices?productId=${product.id}`
      if (isLocationSpecific) {
        url += `&locationIds=${selectedLocations!.join(',')}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (response.ok && result.success) {
        setUnits(result.data.units || [])

        // Convert array to record
        const pricesRecord: Record<number, UnitPrice> = {}
        for (const price of result.data.unitPrices || []) {
          pricesRecord[price.unitId] = price
        }
        setUnitPrices(pricesRecord)
      } else {
        notify(result.error || 'Failed to load unit prices', 'error', 3000)
      }
    } catch (error) {
      console.error('Error fetching unit prices:', error)
      notify('Error loading unit prices', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handlePriceChange = (unitId: number, field: 'purchasePrice' | 'sellingPrice', value: string) => {
    // Validate numeric input
    if (value && !/^\d*\.?\d{0,2}$/.test(value)) {
      return // Invalid format
    }

    setChanges(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [field]: value,
      },
    }))
  }

  const getCurrentPrice = (unitId: number, field: 'purchasePrice' | 'sellingPrice'): string => {
    if (changes[unitId]?.[field] !== undefined) {
      return changes[unitId][field]
    }

    const existingPrice = unitPrices[unitId]?.[field]
    return existingPrice !== undefined ? String(existingPrice) : ''
  }

  const hasChanges = (): boolean => {
    return Object.keys(changes).length > 0 && Object.values(changes).some(c => c.purchasePrice || c.sellingPrice)
  }

  const handleSave = async () => {
    if (!hasChanges()) {
      notify('No changes to save', 'warning', 2000)
      return
    }

    // Validate all changes
    const updates: Array<{ unitId: number; purchasePrice: number; sellingPrice: number }> = []

    for (const [unitIdStr, change] of Object.entries(changes)) {
      const unitId = parseInt(unitIdStr)
      const purchasePrice = change.purchasePrice ? parseFloat(change.purchasePrice) : (unitPrices[unitId]?.purchasePrice || 0)
      const sellingPrice = change.sellingPrice ? parseFloat(change.sellingPrice) : (unitPrices[unitId]?.sellingPrice || 0)

      if (sellingPrice <= 0) {
        notify(`Selling price for ${units.find(u => u.id === unitId)?.name || 'unit'} must be greater than 0`, 'error', 3000)
        return
      }

      if (purchasePrice < 0) {
        notify(`Purchase price for ${units.find(u => u.id === unitId)?.name || 'unit'} cannot be negative`, 'error', 3000)
        return
      }

      updates.push({ unitId, purchasePrice, sellingPrice })
    }

    try {
      setUpdating(true)

      // If location-specific mode, send location-specific prices
      if (isLocationSpecific) {
        const response = await fetch('/api/products/unit-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            unitPrices: updates,
            locationIds: selectedLocations, // NEW: Include location IDs
          }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          notify(`✅ Successfully updated prices for ${updates.length} unit(s) across ${selectedLocations!.length} location(s)`, 'success', 4000)
          setChanges({})
          fetchUnitPrices() // Reload prices
          if (onPriceUpdate) {
            onPriceUpdate()
          }
        } else {
          notify(result.error || 'Failed to update prices', 'error', 4000)
        }
      } else {
        // Global unit prices (no location context)
        const response = await fetch('/api/products/unit-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            unitPrices: updates,
          }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          notify(`✅ Successfully updated prices for ${updates.length} unit(s)`, 'success', 4000)
          setChanges({})
          fetchUnitPrices() // Reload prices
          if (onPriceUpdate) {
            onPriceUpdate()
          }
        } else {
          notify(result.error || 'Failed to update prices', 'error', 4000)
        }
      }
    } catch (error) {
      console.error('Error updating prices:', error)
      notify('Error updating prices', 'error', 3000)
    } finally {
      setUpdating(false)
    }
  }

  const handleReset = () => {
    setChanges({})
  }

  const getMarginPercentage = (unitId: number): number => {
    const purchasePrice = getCurrentPrice(unitId, 'purchasePrice')
    const sellingPrice = getCurrentPrice(unitId, 'sellingPrice')

    const purchase = parseFloat(purchasePrice) || 0
    const selling = parseFloat(sellingPrice) || 0

    if (selling === 0) return 0
    return ((selling - purchase) / selling) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading unit prices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Product Info Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
          {product.name}
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          SKU: {product.sku}
        </p>
      </div>

      {/* Unit Prices Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Purchase Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Selling Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {units.map((unit) => {
                const isPrimary = unit.id === product.unitId
                const margin = getMarginPercentage(unit.id)

                return (
                  <tr key={unit.id} className={isPrimary ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {unit.name}
                        </span>
                        {unit.shortName && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({unit.shortName})
                          </span>
                        )}
                        {isPrimary && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-medium">
                            PRIMARY
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500 dark:text-gray-400">₱</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getCurrentPrice(unit.id, 'purchasePrice')}
                          onChange={(e) => handlePriceChange(unit.id, 'purchasePrice', e.target.value)}
                          className="w-32 px-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                          disabled={updating}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500 dark:text-gray-400">₱</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getCurrentPrice(unit.id, 'sellingPrice')}
                          onChange={(e) => handlePriceChange(unit.id, 'sellingPrice', e.target.value)}
                          className="w-32 px-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                          disabled={updating}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        margin > 30 ? 'text-green-600 dark:text-green-400' :
                        margin > 15 ? 'text-green-500' :
                        margin > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {margin.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges() || updating}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
            !hasChanges() || updating
              ? 'bg-gray-400 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:scale-105'
          }`}
        >
          {updating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving Prices...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Save All Prices
            </span>
          )}
        </button>

        {hasChanges() && (
          <button
            onClick={handleReset}
            disabled={updating}
            className="px-6 py-3 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Reset Changes
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h5 className="font-medium text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
          <span>💡</span>
          Unit Pricing Guide
        </h5>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
          <li>The <strong>PRIMARY</strong> unit is the main unit of measure for this product</li>
          <li>Sub-units allow selling the same product in different quantities (e.g., Box, Piece, Meter)</li>
          <li>Set different prices for each unit to accommodate different customer preferences</li>
          <li>Margin % shows the profit margin for each unit (Green = Good, Yellow = Fair, Red = Low)</li>
        </ul>
      </div>
    </div>
  )
}
