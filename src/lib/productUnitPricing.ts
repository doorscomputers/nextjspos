/**
 * Product Unit Pricing Library
 *
 * Manages unit-specific pricing for products with multi-unit support.
 * Allows different purchase/selling prices per unit (e.g., piece vs box vs roll)
 */

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UnitPrice {
  unitId: number
  unitName: string
  unitShortName: string
  purchasePrice: Decimal
  sellingPrice: Decimal
  multiplier: Decimal // Conversion multiplier to base unit
  isBaseUnit: boolean
}

export interface UnitPriceInput {
  unitId: number
  purchasePrice: number
  sellingPrice: number
}

// ============================================================================
// FETCH UNIT PRICES
// ============================================================================

/**
 * Get all unit prices for a product
 * Includes auto-calculated prices for units without explicit pricing
 */
export async function getProductUnitPrices(
  productId: number,
  businessId: number
): Promise<UnitPrice[]> {
  // Get product with unit configuration
  const product = await prisma.product.findUnique({
    where: { id: productId, businessId },
    include: {
      unit: {
        include: {
          baseUnit: true,
        },
      },
      unitPrices: {
        include: {
          unit: true,
        },
      },
    },
  })

  if (!product || !product.unit) {
    return []
  }

  let prices: UnitPrice[] = [] // Changed from const to let
  const primaryUnit = product.unit
  const trueBaseUnit = primaryUnit.baseUnit || primaryUnit

  // Get all available units for this product
  const availableUnitIds: number[] = [trueBaseUnit.id]

  // Add primary unit if different from base
  if (primaryUnit.id !== trueBaseUnit.id) {
    availableUnitIds.push(primaryUnit.id)
  }

  // Add sub-units from configuration (with validation)
  if (product.subUnitIds) {
    try {
      const subUnitIds = JSON.parse(product.subUnitIds) as number[]
      availableUnitIds.push(...subUnitIds)
    } catch (error) {
      console.error('Error parsing subUnitIds:', error)
    }
  }

  // Fetch all units
  const units = await prisma.unit.findMany({
    where: {
      id: { in: [...new Set(availableUnitIds)] },
      businessId,
      deletedAt: null,
    },
  })

  // FILTER: Only keep units that are explicitly configured for this product
  // Valid units are:
  // 1. Primary unit (selected in Unit dropdown, e.g., Box300pc or Roll)
  // 2. Any units explicitly checked in Additional Sub-Units (from subUnitIds)
  // Note: Base unit is ONLY included if it's checked in Additional Sub-Units OR is the primary unit
  const configuredSubUnitIds = product.subUnitIds
    ? (JSON.parse(product.subUnitIds) as number[])
    : []

  const validUnits = units.filter(unit => {
    // Always include primary unit (the one selected in Unit dropdown)
    if (unit.id === primaryUnit.id) return true

    // Include any unit that is explicitly checked in Additional Sub-Units
    // This includes the base unit IF it was checked by the user
    if (configuredSubUnitIds.includes(unit.id)) {
      return true
    }

    return false
  })

  // First pass: Add all units with explicit prices
  const unitsWithPrices: UnitPrice[] = []
  let referencePrice: { purchase: Decimal; selling: Decimal; refMultiplier: Decimal } | null = null

  for (const unit of validUnits) {
    const explicitPrice = product.unitPrices.find(up => up.unitId === unit.id)
    const isBase = unit.id === trueBaseUnit.id
    const multiplier = unit.baseUnitMultiplier || new Decimal(1)

    if (explicitPrice) {
      // Store unit with explicit price
      const unitPrice: UnitPrice = {
        unitId: unit.id,
        unitName: unit.name,
        unitShortName: unit.shortName,
        purchasePrice: explicitPrice.purchasePrice,
        sellingPrice: explicitPrice.sellingPrice,
        multiplier,
        isBaseUnit: isBase,
      }
      unitsWithPrices.push(unitPrice)

      // Use first explicit price as reference for calculations
      if (!referencePrice) {
        referencePrice = {
          purchase: explicitPrice.purchasePrice,
          selling: explicitPrice.sellingPrice,
          refMultiplier: multiplier
        }
      }
    }
  }

  // Second pass: Calculate prices for units without explicit prices
  for (const unit of validUnits) {
    const explicitPrice = product.unitPrices.find(up => up.unitId === unit.id)

    if (explicitPrice) {
      // Already added in first pass
      continue
    }

    const isBase = unit.id === trueBaseUnit.id
    const multiplier = unit.baseUnitMultiplier || new Decimal(1)

    if (referencePrice) {
      // Calculate based on reference unit price
      // Formula: target_price = reference_price × (target_multiplier / reference_multiplier)
      // Example: If Box200=2000 (ref, mult=200), then Piece price = 2000 × (1/200) = 10
      const ratio = multiplier.div(referencePrice.refMultiplier)

      unitsWithPrices.push({
        unitId: unit.id,
        unitName: unit.name,
        unitShortName: unit.shortName,
        purchasePrice: referencePrice.purchase.mul(ratio),
        sellingPrice: referencePrice.selling.mul(ratio),
        multiplier,
        isBaseUnit: isBase,
      })
    } else {
      // No explicit prices set, use product default
      // product.purchasePrice is for the PRIMARY UNIT (product.unit)
      const defaultPurchase = product.purchasePrice || new Decimal(0)
      const defaultSelling = product.sellingPrice || new Decimal(0)

      // Get the PRIMARY unit's multiplier
      const primaryMultiplier = primaryUnit.baseUnitMultiplier || new Decimal(1)

      // Calculate price ratio relative to primary unit
      // Formula: unit_price = primary_price × (unit_multiplier / primary_multiplier)
      // Example: Primary=Roll (×300, price=1500), Target=Meter (×1)
      //          Meter price = 1500 × (1 / 300) = 5
      const ratio = multiplier.div(primaryMultiplier)

      unitsWithPrices.push({
        unitId: unit.id,
        unitName: unit.name,
        unitShortName: unit.shortName,
        purchasePrice: defaultPurchase.mul(ratio),
        sellingPrice: defaultSelling.mul(ratio),
        multiplier,
        isBaseUnit: isBase,
      })
    }
  }

  prices = unitsWithPrices

  console.log(`[getProductUnitPrices] Product ${product.name}: Found ${prices.length} unit prices`)
  return prices
}

/**
 * Get price for a specific unit
 */
export async function getUnitPrice(
  productId: number,
  unitId: number,
  businessId: number
): Promise<UnitPrice | null> {
  const prices = await getProductUnitPrices(productId, businessId)
  return prices.find(p => p.unitId === unitId) || null
}

// ============================================================================
// SAVE UNIT PRICES
// ============================================================================

/**
 * Save or update unit prices for a product
 */
export async function saveProductUnitPrices(
  productId: number,
  businessId: number,
  prices: UnitPriceInput[]
): Promise<void> {
  console.log(`[saveProductUnitPrices] Saving ${prices.length} unit prices for product ${productId}`)

  // Validate prices
  for (const price of prices) {
    if (price.purchasePrice <= 0) {
      throw new Error(`Purchase price for unit ${price.unitId} must be greater than 0`)
    }
    if (price.sellingPrice <= 0) {
      throw new Error(`Selling price for unit ${price.unitId} must be greater than 0`)
    }
    if (price.sellingPrice < price.purchasePrice) {
      throw new Error(`Selling price cannot be less than purchase price for unit ${price.unitId}`)
    }
  }

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Delete existing prices
    await tx.productUnitPrice.deleteMany({
      where: { productId, businessId },
    })

    // Insert new prices
    for (const price of prices) {
      await tx.productUnitPrice.create({
        data: {
          businessId,
          productId,
          unitId: price.unitId,
          purchasePrice: new Decimal(price.purchasePrice),
          sellingPrice: new Decimal(price.sellingPrice),
        },
      })
    }
  })

  console.log(`[saveProductUnitPrices] ✅ Saved ${prices.length} unit prices for product ${productId}`)
}

/**
 * Delete all unit prices for a product
 */
export async function deleteProductUnitPrices(
  productId: number,
  businessId: number
): Promise<void> {
  await prisma.productUnitPrice.deleteMany({
    where: { productId, businessId },
  })
  console.log(`[deleteProductUnitPrices] ✅ Deleted all unit prices for product ${productId}`)
}

// ============================================================================
// PRICE CALCULATIONS
// ============================================================================

/**
 * Calculate total cost for quantity in specific unit
 */
export function calculateTotalCost(
  quantity: number,
  unitPrice: UnitPrice
): Decimal {
  return new Decimal(quantity).mul(unitPrice.purchasePrice)
}

/**
 * Calculate total selling price for quantity in specific unit
 */
export function calculateTotalSelling(
  quantity: number,
  unitPrice: UnitPrice
): Decimal {
  return new Decimal(quantity).mul(unitPrice.sellingPrice)
}

/**
 * Convert quantity from one unit to another
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnit: UnitPrice,
  toUnit: UnitPrice
): Decimal {
  // Convert to base unit first
  const baseQuantity = new Decimal(quantity).mul(fromUnit.multiplier)

  // Convert from base to target unit
  const targetQuantity = baseQuantity.div(toUnit.multiplier)

  return targetQuantity
}

/**
 * Get effective price per base unit
 * (Useful for comparing prices across different unit types)
 */
export function getEffectivePricePerBaseUnit(unitPrice: UnitPrice): {
  purchasePricePerBase: Decimal
  sellingPricePerBase: Decimal
} {
  return {
    purchasePricePerBase: unitPrice.purchasePrice.div(unitPrice.multiplier),
    sellingPricePerBase: unitPrice.sellingPrice.div(unitPrice.multiplier),
  }
}
