/**
 * UOM (Unit of Measure) Converter
 * Handles conversion between different units with 100% accuracy for inventory management
 */

export interface Unit {
  id: number
  name: string
  shortName: string | null
  allowDecimal: boolean
  baseUnitId: number | null
  baseUnitMultiplier: number | null
}

export interface UnitPrice {
  unitId: number
  unit: Unit
  purchasePrice: number
  sellingPrice: number
}

export interface ConversionResult {
  baseUnitQuantity: number  // Quantity in base unit (for inventory)
  displayQuantity: number    // Quantity in selected unit (for display)
  unitMultiplier: number     // Conversion factor
  selectedUnit: Unit
  baseUnit: Unit | null
}

/**
 * Convert quantity from a sub-unit to base unit
 * Example: 5 Meters → 0.05 Rolls (if 1 Roll = 100 Meters)
 *
 * @param quantity - Quantity in the selected unit
 * @param selectedUnit - The unit being sold in
 * @param allUnits - Array of all units for lookup
 * @returns Conversion result with base unit quantity
 */
export function convertToBaseUnit(
  quantity: number,
  selectedUnit: Unit,
  allUnits: Unit[]
): ConversionResult {
  // If selected unit IS the base unit, no conversion needed
  if (!selectedUnit.baseUnitId || !selectedUnit.baseUnitMultiplier) {
    return {
      baseUnitQuantity: quantity,
      displayQuantity: quantity,
      unitMultiplier: 1,
      selectedUnit,
      baseUnit: null,
    }
  }

  // Find the base unit
  const baseUnit = allUnits.find(u => u.id === selectedUnit.baseUnitId)

  if (!baseUnit) {
    throw new Error(`Base unit not found for ${selectedUnit.name}`)
  }

  // Convert to base unit
  // If 1 Roll = 100 Meters, then baseUnitMultiplier = 100
  // To convert 5 Meters to Rolls: 5 / 100 = 0.05 Rolls
  const multiplier = parseFloat(String(selectedUnit.baseUnitMultiplier))
  const baseUnitQuantity = quantity / multiplier

  return {
    baseUnitQuantity,
    displayQuantity: quantity,
    unitMultiplier: multiplier,
    selectedUnit,
    baseUnit,
  }
}

/**
 * Convert quantity from base unit to a sub-unit
 * Example: 0.05 Rolls → 5 Meters (if 1 Roll = 100 Meters)
 *
 * @param baseQuantity - Quantity in base unit
 * @param targetUnit - The unit to convert to
 * @param allUnits - Array of all units for lookup
 * @returns Quantity in target unit
 */
export function convertFromBaseUnit(
  baseQuantity: number,
  targetUnit: Unit,
  allUnits: Unit[]
): number {
  // If target unit IS the base unit, no conversion needed
  if (!targetUnit.baseUnitId || !targetUnit.baseUnitMultiplier) {
    return baseQuantity
  }

  // Convert from base unit to target unit
  // If 1 Roll = 100 Meters, then baseUnitMultiplier = 100
  // To convert 0.05 Rolls to Meters: 0.05 * 100 = 5 Meters
  const multiplier = parseFloat(String(targetUnit.baseUnitMultiplier))
  return baseQuantity * multiplier
}

/**
 * Get the selling price for a specific unit
 * If unit price exists in ProductUnitPrice table, use it
 * Otherwise, convert the base unit price proportionally
 *
 * @param baseUnitPrice - Price in base unit
 * @param selectedUnit - The unit being sold in
 * @param unitPrices - Array of unit-specific prices
 * @returns Price for the selected unit
 */
export function getUnitPrice(
  baseUnitPrice: number,
  selectedUnit: Unit,
  unitPrices: UnitPrice[]
): number {
  // Check if we have a specific price for this unit
  const unitPrice = unitPrices.find(up => up.unitId === selectedUnit.id)

  if (unitPrice) {
    return parseFloat(String(unitPrice.sellingPrice))
  }

  // No specific price found
  // If this is a sub-unit, calculate proportional price
  if (selectedUnit.baseUnitId && selectedUnit.baseUnitMultiplier) {
    // If 1 Roll costs ₱100 and 1 Roll = 100 Meters
    // Then 1 Meter should cost ₱100 / 100 = ₱1
    const multiplier = parseFloat(String(selectedUnit.baseUnitMultiplier))
    return baseUnitPrice / multiplier
  }

  // This is the base unit, return base price
  return baseUnitPrice
}

/**
 * Validate if quantity is acceptable for a unit
 * Some units don't allow decimals (e.g., whole boxes only)
 *
 * @param quantity - Quantity to validate
 * @param unit - The unit
 * @returns true if valid, false otherwise
 */
export function isValidQuantity(quantity: number, unit: Unit): boolean {
  if (!unit.allowDecimal && quantity % 1 !== 0) {
    return false
  }
  return quantity > 0
}

/**
 * Format quantity with appropriate decimal places
 *
 * @param quantity - Quantity to format
 * @param unit - The unit
 * @returns Formatted string
 */
export function formatQuantity(quantity: number, unit: Unit): string {
  if (unit.allowDecimal) {
    return quantity.toFixed(4).replace(/\.?0+$/, '') // Remove trailing zeros
  }
  return Math.floor(quantity).toString()
}

/**
 * Calculate available stock in a specific unit
 *
 * @param baseUnitStock - Stock quantity in base unit
 * @param targetUnit - The unit to show stock in
 * @param allUnits - Array of all units
 * @returns Available quantity in target unit
 */
export function getAvailableStockInUnit(
  baseUnitStock: number,
  targetUnit: Unit,
  allUnits: Unit[]
): number {
  return convertFromBaseUnit(baseUnitStock, targetUnit, allUnits)
}
