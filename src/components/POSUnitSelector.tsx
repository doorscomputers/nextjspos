'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  convertToBaseUnit,
  getUnitPrice,
  isValidQuantity,
  formatQuantity,
  getAvailableStockInUnit,
  type Unit,
  type UnitPrice,
} from '@/lib/uomConverter'

interface POSUnitSelectorProps {
  productId: number
  productName: string
  baseUnitPrice: number
  availableStock: number // Stock in base unit
  currentQuantity: number // Current quantity in base unit
  locationId: number // Location ID for location-specific pricing
  // ⚡ PERFORMANCE: Pre-loaded data to avoid API calls
  preloadedUnits?: Unit[]
  preloadedUnitPrices?: UnitPrice[]
  preloadedPrimaryUnitId?: number
  onUnitChange: (data: {
    selectedUnitId: number
    displayQuantity: number
    baseQuantity: number
    unitPrice: number
    unitName: string
  }) => void
}

export default function POSUnitSelector({
  productId,
  productName,
  baseUnitPrice,
  availableStock,
  currentQuantity,
  locationId,
  preloadedUnits,
  preloadedUnitPrices,
  preloadedPrimaryUnitId,
  onUnitChange,
}: POSUnitSelectorProps) {
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitPrices, setUnitPrices] = useState<UnitPrice[]>([])
  const [primaryUnitId, setPrimaryUnitId] = useState<number | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
  const [displayQuantity, setDisplayQuantity] = useState('1')
  const [error, setError] = useState('')

  useEffect(() => {
    // ⚡ PERFORMANCE: Use pre-loaded data if available (INSTANT!)
    if (preloadedUnits && preloadedUnitPrices && preloadedPrimaryUnitId) {
      console.log('⚡ POSUnitSelector: Using CACHED unit data (NO API CALL!)')
      setUnits(preloadedUnits)
      setUnitPrices(preloadedUnitPrices)
      setPrimaryUnitId(preloadedPrimaryUnitId)
      setSelectedUnitId(preloadedPrimaryUnitId)
      setLoading(false)
    } else {
      console.log('⚠️ POSUnitSelector: Falling back to API call (data not pre-loaded)')
      fetchUnitData()
    }
  }, [productId, locationId, preloadedUnits, preloadedUnitPrices, preloadedPrimaryUnitId])

  const fetchUnitData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/pos/product-units?productId=${productId}&locationId=${locationId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        const unitsData: Unit[] = result.data.units
        setUnits(unitsData)
        setPrimaryUnitId(result.data.primaryUnitId)

        // Set default to primary unit
        setSelectedUnitId(result.data.primaryUnitId)

        // Map unit prices
        const prices: UnitPrice[] = result.data.unitPrices.map((up: any) => {
          const unit = unitsData.find(u => u.id === up.unitId)!
          return {
            unitId: up.unitId,
            unit,
            purchasePrice: up.purchasePrice,
            sellingPrice: up.sellingPrice,
          }
        })
        setUnitPrices(prices)
      }
    } catch (error) {
      console.error('Error fetching units:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnitChange = (unitId: string) => {
    const newUnitId = parseInt(unitId)
    setSelectedUnitId(newUnitId)
    setDisplayQuantity('1') // Reset quantity when unit changes
    setError('')
  }

  const handleQuantityChange = (value: string) => {
    setDisplayQuantity(value)
    setError('')
  }

  const handleApply = () => {
    if (!selectedUnitId) {
      setError('Please select a unit')
      return
    }

    const qty = parseFloat(displayQuantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    const selectedUnit = units.find(u => u.id === selectedUnitId)
    if (!selectedUnit) {
      setError('Invalid unit selected')
      return
    }

    // Validate quantity format for unit
    if (!isValidQuantity(qty, selectedUnit)) {
      setError(`${selectedUnit.name} does not allow decimal quantities`)
      return
    }

    // Convert to base unit
    const conversion = convertToBaseUnit(qty, selectedUnit, units)

    // Check stock availability
    // Note: availableStock is total stock at location (not reduced by cart items)
    // This is OK because we're REPLACING the current cart item quantity
    if (conversion.baseUnitQuantity > availableStock) {
      const availableInUnit = getAvailableStockInUnit(availableStock, selectedUnit, units)
      setError(`Insufficient stock! Only ${formatQuantity(availableInUnit, selectedUnit)} ${selectedUnit.name} available`)
      return
    }

    // Get unit price
    const unitPrice = getUnitPrice(baseUnitPrice, selectedUnit, unitPrices)

    // Call parent callback
    onUnitChange({
      selectedUnitId: selectedUnit.id,
      displayQuantity: qty,
      baseQuantity: conversion.baseUnitQuantity,
      unitPrice,
      unitName: selectedUnit.name,
    })

    setError('')
  }

  if (loading) {
    return <div className="text-xs text-gray-500 p-3">Loading units...</div>
  }

  if (units.length === 0) {
    return <div className="text-xs text-red-500 p-3">No units found for this product</div>
  }

  const selectedUnit = units.find(u => u.id === selectedUnitId)

  // If only primary unit exists, show simplified quantity-only selector
  if (units.length === 1) {
    const primaryUnit = units[0]

    return (
      <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
        <Label className="text-xs font-semibold text-blue-900 dark:text-blue-200">
          📦 Enter Quantity
        </Label>

        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            Quantity ({primaryUnit.name})
          </Label>
          <Input
            type="number"
            value={displayQuantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            step={primaryUnit.allowDecimal ? '0.01' : '1'}
            min="0"
            className="h-10 text-base font-semibold"
            placeholder="1"
            autoFocus
          />
        </div>

        <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border">
          <div className="flex justify-between">
            <span>Unit Price:</span>
            <span className="font-semibold">
              ₱{baseUnitPrice.toFixed(2)} / {primaryUnit.name}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Available Stock:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatQuantity(availableStock, primaryUnit)} {primaryUnit.name}
            </span>
          </div>
          {displayQuantity && (
            <div className="flex justify-between mt-1 pt-1 border-t">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                ₱{(parseFloat(displayQuantity || '0') * baseUnitPrice).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-300 dark:border-red-700">
            {error}
          </div>
        )}

        <Button
          size="sm"
          onClick={() => {
            const qty = parseFloat(displayQuantity)
            if (isNaN(qty) || qty <= 0) {
              setError('Please enter a valid quantity')
              return
            }

            if (!isValidQuantity(qty, primaryUnit)) {
              setError(`${primaryUnit.name} does not allow decimal quantities`)
              return
            }

            if (qty > availableStock) {
              setError(`Insufficient stock! Only ${formatQuantity(availableStock, primaryUnit)} ${primaryUnit.name} available`)
              return
            }

            onUnitChange({
              selectedUnitId: primaryUnit.id,
              displayQuantity: qty,
              baseQuantity: qty,
              unitPrice: baseUnitPrice,
              unitName: primaryUnit.name,
            })

            setError('')
          }}
          className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold"
        >
          ✓ Apply Quantity
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
      <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
        📏 Select Unit of Measure
      </Label>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">Unit</Label>
          <Select value={selectedUnitId?.toString()} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => {
                const isPrimary = unit.id === primaryUnitId
                return (
                  <SelectItem key={unit.id} value={unit.id.toString()}>
                    {unit.name} {unit.shortName && `(${unit.shortName})`}
                    {isPrimary && ' ⭐'}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">Quantity</Label>
          <Input
            type="number"
            value={displayQuantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            step={selectedUnit?.allowDecimal ? '0.01' : '1'}
            min="0"
            className="h-9 text-sm"
            placeholder="1"
          />
        </div>
      </div>

      {selectedUnit && (
        <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border">
          <div className="flex justify-between">
            <span>Unit Price:</span>
            <span className="font-semibold">
              ₱{getUnitPrice(baseUnitPrice, selectedUnit, unitPrices).toFixed(2)} / {selectedUnit.name}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Available:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatQuantity(getAvailableStockInUnit(availableStock, selectedUnit, units), selectedUnit)} {selectedUnit.name}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-300 dark:border-red-700">
          {error}
        </div>
      )}

      <Button
        size="sm"
        onClick={handleApply}
        className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
      >
        ✓ Apply Unit & Quantity
      </Button>
    </div>
  )
}
