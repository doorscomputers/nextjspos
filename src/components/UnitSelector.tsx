'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UnitOption {
  unitId: number
  unitName: string
  unitShortName: string
  isBaseUnit: boolean
  multiplier: string // Serialized from API as string
}

interface UnitSelectorProps {
  productId: number
  businessId: number
  value?: number | null
  onChange: (unitId: number | null) => void
  disabled?: boolean
  className?: string
  size?: 'sm' | 'default'
  showLabel?: boolean
  required?: boolean
}

export default function UnitSelector({
  productId,
  businessId,
  value,
  onChange,
  disabled = false,
  className = '',
  size = 'default',
  showLabel = true,
  required = false,
}: UnitSelectorProps) {
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch available units for the product
  useEffect(() => {
    if (!productId || !businessId) {
      setLoading(false)
      return
    }

    const fetchUnits = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/products/${productId}/units?businessId=${businessId}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch units')
        }

        const data = await response.json()
        setUnits(data.units || [])

        // Auto-select base unit if no value is set
        if (!value && data.units && data.units.length > 0) {
          const baseUnit = data.units.find((u: UnitOption) => u.isBaseUnit)
          if (baseUnit) {
            onChange(baseUnit.unitId)
          }
        }
      } catch (err) {
        console.error('Error fetching units:', err)
        setError('Failed to load units')
      } finally {
        setLoading(false)
      }
    }

    fetchUnits()
  }, [productId, businessId])

  // Don't render if product has no units or only one unit (unless required)
  if (!loading && units.length <= 1 && !required) {
    return null
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-2">
        {showLabel && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit
          </label>
        )}
        <div className="h-9 w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-2">
        {showLabel && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit
          </label>
        )}
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      </div>
    )
  }

  // No units available
  if (units.length === 0) {
    return null
  }

  const selectedUnit = units.find((u) => u.unitId === value)

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Unit {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <Select
        value={value?.toString() || ''}
        onValueChange={(val) => onChange(val ? parseInt(val) : null)}
        disabled={disabled || units.length === 0}
      >
        <SelectTrigger size={size} className="w-full">
          <SelectValue placeholder="Select unit">
            {selectedUnit ? (
              <span className="flex items-center gap-2">
                <span className="font-medium">{selectedUnit.unitShortName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedUnit.unitName}
                </span>
                {!selectedUnit.isBaseUnit && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    (×{selectedUnit.multiplier})
                  </span>
                )}
              </span>
            ) : (
              'Select unit'
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {units.map((unit) => (
            <SelectItem key={unit.unitId} value={unit.unitId.toString()}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{unit.unitShortName}</span>
                <span className="text-xs text-gray-500">
                  {unit.unitName}
                </span>
                {unit.isBaseUnit ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Base
                  </span>
                ) : (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    ×{unit.multiplier}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show hint about conversions if multiple units */}
      {units.length > 1 && selectedUnit && !selectedUnit.isBaseUnit && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💡 1 {selectedUnit.unitShortName} = {selectedUnit.multiplier}{' '}
          {units.find((u) => u.isBaseUnit)?.unitShortName}
        </p>
      )}
    </div>
  )
}
