/**
 * Universal Unit of Measure (UOM) Conversion Library
 *
 * Provides conversion utilities for multi-unit inventory tracking.
 * Supports scenarios like:
 * - Buying in bulk (rolls, boxes, sacks) and selling in smaller units (meters, pieces, kg)
 * - Accurate inventory tracking with conversions
 * - Price management per unit with markup flexibility
 *
 * Example: Network Cable
 * - Base Unit: Roll (500 meters)
 * - Sub Unit: Meter (multiplier: 0.002)
 * - 1 meter = 0.002 rolls
 * - 500 meters = 1 roll
 */

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UnitWithConversion {
  id: number
  name: string
  shortName: string
  allowDecimal: boolean
  baseUnitId: number | null
  baseUnitMultiplier: Decimal | null
  baseUnit?: {
    id: number
    name: string
    shortName: string
  } | null
}

export interface ConversionResult {
  success: boolean
  quantity: Decimal
  fromUnit: UnitWithConversion
  toUnit: UnitWithConversion
  error?: string
}

export interface UnitOption {
  unitId: number
  unitName: string
  unitShortName: string
  isBaseUnit: boolean
  multiplier: Decimal
}

// ============================================================================
// CORE CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert quantity from one unit to another using multipliers
 *
 * @example
 * // Convert 10 meters to rolls (meter multiplier = 0.002)
 * convertQuantity(10, meterUnit, rollUnit) // Returns 0.02 rolls
 *
 * @example
 * // Convert 2 rolls to meters
 * convertQuantity(2, rollUnit, meterUnit) // Returns 1000 meters
 */
export async function convertQuantity(
  quantity: number | Decimal,
  fromUnit: UnitWithConversion,
  toUnit: UnitWithConversion
): Promise<ConversionResult> {
  try {
    const qty = new Decimal(quantity)

    // Same unit - no conversion needed
    if (fromUnit.id === toUnit.id) {
      return {
        success: true,
        quantity: qty,
        fromUnit,
        toUnit,
      }
    }

    // Determine if units are in the same hierarchy
    const fromBaseId = fromUnit.baseUnitId || fromUnit.id
    const toBaseId = toUnit.baseUnitId || toUnit.id

    if (fromBaseId !== toBaseId) {
      return {
        success: false,
        quantity: new Decimal(0),
        fromUnit,
        toUnit,
        error: `Cannot convert between ${fromUnit.name} and ${toUnit.name} - different unit hierarchies`,
      }
    }

    // Get multipliers (null means this IS the base unit, so multiplier = 1)
    const fromMultiplier = fromUnit.baseUnitMultiplier || new Decimal(1)
    const toMultiplier = toUnit.baseUnitMultiplier || new Decimal(1)

    // Convert to base unit first, then to target unit
    // Formula: baseQty = qty * fromMultiplier
    //         targetQty = baseQty / toMultiplier
    const baseQuantity = qty.mul(fromMultiplier)
    const convertedQuantity = baseQuantity.div(toMultiplier)

    return {
      success: true,
      quantity: convertedQuantity,
      fromUnit,
      toUnit,
    }
  } catch (error) {
    return {
      success: false,
      quantity: new Decimal(0),
      fromUnit,
      toUnit,
      error: error instanceof Error ? error.message : 'Unknown conversion error',
    }
  }
}

/**
 * Convert quantity to base unit (for storage/calculation)
 *
 * @example
 * // Convert 50 meters to base unit (rolls)
 * convertToBaseUnit(50, meterUnit) // Returns 0.1 rolls
 */
export function convertToBaseUnit(
  quantity: number | Decimal,
  unit: UnitWithConversion
): Decimal {
  const qty = new Decimal(quantity)
  const multiplier = unit.baseUnitMultiplier || new Decimal(1)
  return qty.mul(multiplier)
}

/**
 * Convert quantity from base unit to target unit (for display)
 *
 * @example
 * // Convert 2 rolls (base) to meters
 * convertFromBaseUnit(2, meterUnit) // Returns 1000 meters
 */
export function convertFromBaseUnit(
  baseQuantity: number | Decimal,
  targetUnit: UnitWithConversion
): Decimal {
  const qty = new Decimal(baseQuantity)
  const multiplier = targetUnit.baseUnitMultiplier || new Decimal(1)
  return qty.div(multiplier)
}

// ============================================================================
// UNIT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get all available units for a product (base unit + configured sub-units)
 *
 * @param productId - Product ID
 * @param businessId - Business ID for multi-tenancy
 * @returns Array of available unit options with conversion info
 */
export async function getProductUnits(
  productId: number,
  businessId: number
): Promise<UnitOption[]> {
  // Get product with unit info
  const product = await prisma.product.findUnique({
    where: { id: productId, businessId },
    include: {
      unit: {
        include: {
          baseUnit: true,
        },
      },
    },
  })

  if (!product) {
    return []
  }

  const units: UnitOption[] = []

  // Add base unit
  const baseUnit = product.unit
  units.push({
    unitId: baseUnit.id,
    unitName: baseUnit.name,
    unitShortName: baseUnit.shortName,
    isBaseUnit: true,
    multiplier: new Decimal(1),
  })

  // Add sub-units if configured
  if (product.subUnitIds) {
    try {
      const subUnitIds = JSON.parse(product.subUnitIds) as number[]

      if (Array.isArray(subUnitIds) && subUnitIds.length > 0) {
        const subUnits = await prisma.unit.findMany({
          where: {
            id: { in: subUnitIds },
            businessId,
          },
        })

        for (const subUnit of subUnits) {
          units.push({
            unitId: subUnit.id,
            unitName: subUnit.name,
            unitShortName: subUnit.shortName,
            isBaseUnit: false,
            multiplier: subUnit.baseUnitMultiplier || new Decimal(1),
          })
        }
      }
    } catch (error) {
      console.error('Error parsing subUnitIds:', error)
    }
  }

  return units
}

/**
 * Check if a product has multiple units configured
 */
export async function hasMultipleUnits(
  productId: number,
  businessId: number
): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId, businessId },
    select: { subUnitIds: true },
  })

  if (!product || !product.subUnitIds) {
    return false
  }

  try {
    const subUnitIds = JSON.parse(product.subUnitIds) as number[]
    return Array.isArray(subUnitIds) && subUnitIds.length > 0
  } catch {
    return false
  }
}

/**
 * Validate if a unit is allowed for a product
 */
export async function isUnitAllowedForProduct(
  productId: number,
  unitId: number,
  businessId: number
): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId, businessId },
    select: { unitId: true, subUnitIds: true },
  })

  if (!product) {
    return false
  }

  // Base unit is always allowed
  if (product.unitId === unitId) {
    return true
  }

  // Check if unit is in sub-units
  if (product.subUnitIds) {
    try {
      const subUnitIds = JSON.parse(product.subUnitIds) as number[]
      return Array.isArray(subUnitIds) && subUnitIds.includes(unitId)
    } catch {
      return false
    }
  }

  return false
}

// ============================================================================
// DISPLAY & FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format quantity with unit for display
 *
 * @example
 * formatQuantityWithUnit(1000, meterUnit) // "1,000 m"
 * formatQuantityWithUnit(2.5, rollUnit) // "2.5 rolls"
 */
export function formatQuantityWithUnit(
  quantity: number | Decimal,
  unit: UnitWithConversion,
  showFullName = false
): string {
  const qty = new Decimal(quantity)
  const formatted = unit.allowDecimal
    ? qty.toFixed(2).replace(/\.?0+$/, '') // Remove trailing zeros
    : qty.toFixed(0)

  const unitLabel = showFullName ? unit.name : unit.shortName
  return `${formatted} ${unitLabel}`
}

/**
 * Format quantity showing both base and sub-unit
 *
 * @example
 * // Display: "9.58 boxes (115 pieces)"
 * formatDualUnit(115, pieceUnit, boxUnit)
 */
export async function formatDualUnit(
  quantity: number | Decimal,
  currentUnit: UnitWithConversion,
  displayUnit?: UnitWithConversion
): Promise<string> {
  const currentFormatted = formatQuantityWithUnit(quantity, currentUnit)

  if (!displayUnit) {
    return currentFormatted
  }

  const conversion = await convertQuantity(quantity, currentUnit, displayUnit)

  if (!conversion.success) {
    return currentFormatted
  }

  const displayFormatted = formatQuantityWithUnit(conversion.quantity, displayUnit)
  return `${displayFormatted} (${currentFormatted})`
}

// ============================================================================
// INVENTORY CALCULATION HELPERS
// ============================================================================

/**
 * Calculate inventory balance in base units for accurate tracking
 *
 * This ensures all inventory calculations use the base unit to avoid
 * rounding errors when mixing different units in transactions
 */
export function calculateInventoryBalance(
  transactions: Array<{
    quantity: Decimal
    unit: UnitWithConversion
    type: 'add' | 'subtract'
  }>
): Decimal {
  let balance = new Decimal(0)

  for (const transaction of transactions) {
    const baseQty = convertToBaseUnit(transaction.quantity, transaction.unit)

    if (transaction.type === 'add') {
      balance = balance.add(baseQty)
    } else {
      balance = balance.sub(baseQty)
    }
  }

  return balance
}

/**
 * Check if sufficient stock exists for a transaction
 *
 * @param currentStock - Current stock in base unit
 * @param requestedQty - Requested quantity
 * @param requestedUnit - Unit of the requested quantity
 * @returns Boolean indicating if stock is sufficient
 */
export function hasSufficientStock(
  currentStock: number | Decimal,
  requestedQty: number | Decimal,
  requestedUnit: UnitWithConversion
): boolean {
  const stock = new Decimal(currentStock)
  const baseQtyNeeded = convertToBaseUnit(requestedQty, requestedUnit)
  return stock.gte(baseQtyNeeded)
}

// ============================================================================
// PRICE CONVERSION HELPERS
// ============================================================================

/**
 * Convert price from one unit to another
 *
 * @example
 * // If selling price per roll = 5000, what's the price per meter?
 * // Roll = 500 meters, so price per meter = 5000 / 500 = 10
 * convertPrice(5000, rollUnit, meterUnit)
 */
export async function convertPrice(
  price: number | Decimal,
  fromUnit: UnitWithConversion,
  toUnit: UnitWithConversion
): Promise<Decimal> {
  const priceDecimal = new Decimal(price)

  // Same unit - no conversion
  if (fromUnit.id === toUnit.id) {
    return priceDecimal
  }

  // Convert 1 unit from -> to
  const conversion = await convertQuantity(1, fromUnit, toUnit)

  if (!conversion.success) {
    throw new Error(`Cannot convert price: ${conversion.error}`)
  }

  // Price per toUnit = price per fromUnit / conversion factor
  // Example: Price per meter = 5000 per roll / 500 = 10
  return priceDecimal.div(conversion.quantity)
}

/**
 * Calculate unit price from total and quantity
 */
export function calculateUnitPrice(
  totalPrice: number | Decimal,
  quantity: number | Decimal
): Decimal {
  const total = new Decimal(totalPrice)
  const qty = new Decimal(quantity)

  if (qty.isZero()) {
    return new Decimal(0)
  }

  return total.div(qty)
}
