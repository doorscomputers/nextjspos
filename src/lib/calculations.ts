/**
 * Pure Calculation Functions for POS System
 * These functions have NO database dependencies and are easily unit-testable
 */

/**
 * Calculate subtotal from line items
 */
export function calculateSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
}

/**
 * Calculate discount amount
 * @param amount - Original amount
 * @param discountPercent - Discount percentage (0-100)
 * @returns Discount amount
 */
export function calculateDiscountAmount(amount: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount percent must be between 0 and 100')
  }
  return (amount * discountPercent) / 100
}

/**
 * Apply discount to amount
 */
export function applyDiscount(amount: number, discountPercent: number): number {
  const discountAmount = calculateDiscountAmount(amount, discountPercent)
  return amount - discountAmount
}

/**
 * Calculate tax amount
 * @param amount - Amount to tax
 * @param taxPercent - Tax percentage (e.g., 12 for 12% VAT)
 * @returns Tax amount
 */
export function calculateTax(amount: number, taxPercent: number): number {
  if (taxPercent < 0) {
    throw new Error('Tax percent cannot be negative')
  }
  return (amount * taxPercent) / 100
}

/**
 * Calculate total with tax
 */
export function calculateTotalWithTax(subtotal: number, taxPercent: number): number {
  const tax = calculateTax(subtotal, taxPercent)
  return subtotal + tax
}

/**
 * Calculate change to return to customer
 */
export function calculateChange(totalDue: number, amountPaid: number): number {
  const change = amountPaid - totalDue
  if (change < 0) {
    throw new Error('Insufficient payment')
  }
  return change
}

/**
 * Calculate markup percentage
 * @param cost - Cost price
 * @param sellingPrice - Selling price
 * @returns Markup percentage
 */
export function calculateMarkupPercent(cost: number, sellingPrice: number): number {
  if (cost <= 0) {
    throw new Error('Cost must be greater than zero')
  }
  return ((sellingPrice - cost) / cost) * 100
}

/**
 * Calculate profit margin percentage
 * @param cost - Cost price
 * @param sellingPrice - Selling price
 * @returns Profit margin percentage
 */
export function calculateProfitMargin(cost: number, sellingPrice: number): number {
  if (sellingPrice <= 0) {
    throw new Error('Selling price must be greater than zero')
  }
  return ((sellingPrice - cost) / sellingPrice) * 100
}

/**
 * Calculate profit amount
 */
export function calculateProfit(cost: number, sellingPrice: number, quantity: number = 1): number {
  return (sellingPrice - cost) * quantity
}

/**
 * Calculate FIFO cost layers
 * Used for inventory valuation
 */
export interface CostLayer {
  date: Date
  quantity: number
  unitCost: number
}

export interface FIFOResult {
  remainingLayers: CostLayer[]
  totalCost: number
  totalQuantity: number
  averageCost: number
}

export function calculateFIFOCost(
  purchases: CostLayer[],
  soldQuantity: number
): FIFOResult {
  if (soldQuantity < 0) {
    throw new Error('Sold quantity cannot be negative')
  }

  const layers = purchases
    .sort((a, b) => a.date.getTime() - b.date.getTime()) // Sort by date ascending (oldest first)
    .map(layer => ({ ...layer })) // Clone to avoid mutation

  let remainingToSell = soldQuantity

  for (const layer of layers) {
    if (remainingToSell === 0) break

    const toConsume = Math.min(layer.quantity, remainingToSell)
    layer.quantity -= toConsume
    remainingToSell -= toConsume
  }

  const remainingLayers = layers.filter(l => l.quantity > 0)
  const totalQuantity = remainingLayers.reduce((sum, l) => sum + l.quantity, 0)
  const totalCost = remainingLayers.reduce((sum, l) => sum + (l.quantity * l.unitCost), 0)
  const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0

  return {
    remainingLayers,
    totalCost,
    totalQuantity,
    averageCost
  }
}

/**
 * Calculate Weighted Average Cost
 */
export function calculateWeightedAverageCost(purchases: CostLayer[]): number {
  const totalCost = purchases.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0)
  const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0)

  return totalQuantity > 0 ? totalCost / totalQuantity : 0
}

/**
 * Calculate cash drawer expected balance
 */
export interface CashMovement {
  beginningCash: number
  cashSales: number
  cashIn: number
  cashOut: number
}

export function calculateExpectedCashBalance(movements: CashMovement): number {
  return movements.beginningCash + movements.cashSales + movements.cashIn - movements.cashOut
}

/**
 * Calculate cash variance (overage/shortage)
 */
export function calculateCashVariance(expectedCash: number, actualCash: number): number {
  return actualCash - expectedCash
}

/**
 * Calculate cash count from denominations (Philippine Peso)
 */
export interface CashDenominations {
  bills1000: number
  bills500: number
  bills200: number
  bills100: number
  bills50: number
  bills20: number
  coins10: number
  coins5: number
  coins1: number
  coins025: number // 25 centavos
}

export function calculateCashTotal(denominations: CashDenominations): number {
  return (
    denominations.bills1000 * 1000 +
    denominations.bills500 * 500 +
    denominations.bills200 * 200 +
    denominations.bills100 * 100 +
    denominations.bills50 * 50 +
    denominations.bills20 * 20 +
    denominations.coins10 * 10 +
    denominations.coins5 * 5 +
    denominations.coins1 * 1 +
    denominations.coins025 * 0.25
  )
}

/**
 * Round to 2 decimal places (for money)
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Calculate inventory turnover ratio
 * Formula: Cost of Goods Sold / Average Inventory Value
 */
export function calculateInventoryTurnover(
  costOfGoodsSold: number,
  averageInventoryValue: number
): number {
  if (averageInventoryValue <= 0) {
    throw new Error('Average inventory value must be greater than zero')
  }
  return costOfGoodsSold / averageInventoryValue
}

/**
 * Calculate days inventory outstanding (DIO)
 * Formula: (Average Inventory / COGS) * 365
 */
export function calculateDaysInventoryOutstanding(
  averageInventory: number,
  costOfGoodsSold: number
): number {
  if (costOfGoodsSold <= 0) {
    throw new Error('Cost of goods sold must be greater than zero')
  }
  return (averageInventory / costOfGoodsSold) * 365
}

/**
 * Calculate gross profit
 */
export function calculateGrossProfit(revenue: number, costOfGoodsSold: number): number {
  return revenue - costOfGoodsSold
}

/**
 * Calculate gross profit margin percentage
 */
export function calculateGrossProfitMargin(revenue: number, costOfGoodsSold: number): number {
  if (revenue <= 0) {
    throw new Error('Revenue must be greater than zero')
  }
  const grossProfit = calculateGrossProfit(revenue, costOfGoodsSold)
  return (grossProfit / revenue) * 100
}
