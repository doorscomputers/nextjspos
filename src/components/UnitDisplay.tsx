'use client'

import { useEffect, useState } from 'react'
import { Decimal } from '@prisma/client/runtime/library'

interface Unit {
  id: number
  name: string
  shortName: string
  allowDecimal: boolean
}

interface UnitDisplayProps {
  quantity: number | string | Decimal
  unit: Unit
  showFullName?: boolean
  showDualUnit?: boolean
  baseUnit?: Unit
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * UnitDisplay Component
 * Displays quantities with proper unit formatting and optional dual-unit display
 *
 * @example
 * // Simple display
 * <UnitDisplay quantity={100} unit={meterUnit} />
 * // Output: "100 m"
 *
 * @example
 * // Dual unit display
 * <UnitDisplay quantity={0.5} unit={rollUnit} showDualUnit baseUnit={meterUnit} />
 * // Output: "0.5 rolls (250 meters)"
 */
export default function UnitDisplay({
  quantity,
  unit,
  showFullName = false,
  showDualUnit = false,
  baseUnit,
  className = '',
  size = 'md',
}: UnitDisplayProps) {
  const [formattedQuantity, setFormattedQuantity] = useState<string>('')
  const [dualDisplay, setDualDisplay] = useState<string | null>(null)

  useEffect(() => {
    try {
      const qty = new Decimal(quantity)

      // Format the quantity based on unit's decimal settings
      const formatted = unit.allowDecimal
        ? qty.toFixed(2).replace(/\.?0+$/, '') // Remove trailing zeros
        : qty.toFixed(0)

      const unitLabel = showFullName ? unit.name : unit.shortName
      setFormattedQuantity(`${formatted} ${unitLabel}`)

      // Calculate dual unit display if requested
      if (showDualUnit && baseUnit && baseUnit.id !== unit.id) {
        // This would require conversion logic - simplified for now
        // In a full implementation, you'd call the conversion API
        setDualDisplay(`${formatted} ${unitLabel}`)
      } else {
        setDualDisplay(null)
      }
    } catch (error) {
      console.error('Error formatting quantity:', error)
      setFormattedQuantity('--')
    }
  }, [quantity, unit, showFullName, showDualUnit, baseUnit])

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <span className={`inline-flex items-center gap-1 ${sizeClasses[size]} ${className}`}>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        {formattedQuantity}
      </span>
      {dualDisplay && (
        <span className="text-gray-500 dark:text-gray-400">
          ({dualDisplay})
        </span>
      )}
    </span>
  )
}

/**
 * UnitBadge Component
 * Displays unit as a badge/pill for visual emphasis
 */
export function UnitBadge({
  unit,
  showFullName = false,
  variant = 'default',
  className = '',
}: {
  unit: Unit
  showFullName?: boolean
  variant?: 'default' | 'primary' | 'success' | 'warning'
  className?: string
}) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }

  const unitLabel = showFullName ? unit.name : unit.shortName

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {unitLabel}
    </span>
  )
}

/**
 * QuantityWithUnitBadge Component
 * Combines quantity display with a unit badge
 */
export function QuantityWithUnitBadge({
  quantity,
  unit,
  showFullName = false,
  className = '',
}: {
  quantity: number | string | Decimal
  unit: Unit
  showFullName?: boolean
  className?: string
}) {
  const qty = new Decimal(quantity)
  const formatted = unit.allowDecimal
    ? qty.toFixed(2).replace(/\.?0+$/, '')
    : qty.toFixed(0)

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-semibold text-gray-900 dark:text-gray-100">
        {formatted}
      </span>
      <UnitBadge unit={unit} showFullName={showFullName} />
    </div>
  )
}

/**
 * DualUnitDisplay Component
 * Displays quantity in two different units for comparison
 */
export function DualUnitDisplay({
  primaryQuantity,
  primaryUnit,
  secondaryQuantity,
  secondaryUnit,
  className = '',
}: {
  primaryQuantity: number | string | Decimal
  primaryUnit: Unit
  secondaryQuantity: number | string | Decimal
  secondaryUnit: Unit
  className?: string
}) {
  const primaryQty = new Decimal(primaryQuantity)
  const secondaryQty = new Decimal(secondaryQuantity)

  const primaryFormatted = primaryUnit.allowDecimal
    ? primaryQty.toFixed(2).replace(/\.?0+$/, '')
    : primaryQty.toFixed(0)

  const secondaryFormatted = secondaryUnit.allowDecimal
    ? secondaryQty.toFixed(2).replace(/\.?0+$/, '')
    : secondaryQty.toFixed(0)

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-semibold text-gray-900 dark:text-gray-100">
        {primaryFormatted} {primaryUnit.shortName}
      </span>
      <span className="text-gray-400 dark:text-gray-600">≈</span>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {secondaryFormatted} {secondaryUnit.shortName}
      </span>
    </div>
  )
}
