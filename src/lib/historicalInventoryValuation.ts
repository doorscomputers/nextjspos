/**
 * Historical Inventory Valuation Engine
 * Calculates inventory value at specific points in time for trend analysis
 * Extends the base inventoryValuation.ts with date-based filtering
 */

import { prisma } from './prisma'
import { ValuationMethod } from './inventoryValuation'

/**
 * Period types for aggregation
 */
export enum PeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

/**
 * Historical Valuation Result for a single period
 */
export interface PeriodValuation {
  period: string // e.g., "2024-01", "2024-Q1", "2024"
  periodEnd: Date
  totalQuantity: number
  totalValue: number
  valuationMethod: ValuationMethod
  categoryBreakdown: CategoryValuation[]
}

/**
 * Category breakdown for a period
 */
export interface CategoryValuation {
  categoryId: number | null
  categoryName: string
  totalQuantity: number
  totalValue: number
  percentOfTotal: number
}

/**
 * Trend data for charts
 */
export interface ValuationTrend {
  periods: PeriodValuation[]
  summary: {
    startValue: number
    endValue: number
    changeValue: number
    changePercent: number
    method: ValuationMethod
  }
}

/**
 * Calculate Weighted Average Cost Value at a specific date
 * (Fastest method - recommended for historical queries)
 */
async function calculateHistoricalWeightedAverage(
  productVariationId: number,
  locationId: number,
  businessId: number,
  asOfDate: Date
): Promise<{ quantity: number; unitCost: number; totalValue: number }> {

  // Get all inbound transactions up to the date
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { gt: 0 },
      createdAt: { lte: asOfDate }
    },
    select: {
      quantity: true,
      unitCost: true
    }
  })

  // Calculate weighted average cost
  let totalCost = 0
  let totalInboundQty = 0

  for (const txn of inboundTransactions) {
    const qty = Number(txn.quantity)
    const cost = Number(txn.unitCost || 0)
    totalCost += qty * cost
    totalInboundQty += qty
  }

  const weightedAvgCost = totalInboundQty > 0 ? totalCost / totalInboundQty : 0

  // Get total outbound quantity up to the date
  const outboundResult = await prisma.stockTransaction.aggregate({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { lt: 0 },
      createdAt: { lte: asOfDate }
    },
    _sum: { quantity: true }
  })

  const totalOutbound = Math.abs(Number(outboundResult._sum.quantity || 0))
  const currentQty = Math.max(0, totalInboundQty - totalOutbound)
  const totalValue = currentQty * weightedAvgCost

  return {
    quantity: currentQty,
    unitCost: weightedAvgCost,
    totalValue
  }
}

/**
 * Get Historical Inventory Valuation by Category (Optimized)
 * Aggregates by category for performance
 */
export async function getHistoricalValuationByCategory(
  businessId: number,
  asOfDate: Date,
  locationId?: number,
  method: ValuationMethod = ValuationMethod.WEIGHTED_AVG
): Promise<CategoryValuation[]> {

  // Get all variations with transactions up to this date
  const variations = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      ...(locationId ? { locationId } : {}),
      createdAt: { lte: asOfDate }
    },
    select: {
      productVariationId: true,
      locationId: true
    },
    distinct: ['productVariationId', 'locationId']
  })

  // Group by category
  const categoryMap = new Map<number | null, CategoryValuation>()

  for (const { productVariationId, locationId: varLocationId } of variations) {
    try {
      // Get category for this variation
      const variation = await prisma.productVariation.findUnique({
        where: { id: productVariationId },
        select: {
          product: {
            select: {
              categoryId: true,
              category: {
                select: { name: true }
              }
            }
          }
        }
      })

      const categoryId = variation?.product.categoryId || null
      const categoryName = variation?.product.category?.name || 'Uncategorized'

      // Calculate valuation for this variation
      let valuation
      if (method === ValuationMethod.WEIGHTED_AVG) {
        valuation = await calculateHistoricalWeightedAverage(
          productVariationId,
          varLocationId,
          businessId,
          asOfDate
        )
      } else {
        // For FIFO/LIFO, use weighted average for historical queries (performance optimization)
        valuation = await calculateHistoricalWeightedAverage(
          productVariationId,
          varLocationId,
          businessId,
          asOfDate
        )
      }

      // Aggregate by category
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          totalQuantity: 0,
          totalValue: 0,
          percentOfTotal: 0
        })
      }

      const categoryData = categoryMap.get(categoryId)!
      categoryData.totalQuantity += valuation.quantity
      categoryData.totalValue += valuation.totalValue

    } catch (error) {
      console.error(`Error calculating valuation for variation ${productVariationId}:`, error)
      continue
    }
  }

  // Calculate percentages
  const categories = Array.from(categoryMap.values())
  const totalValue = categories.reduce((sum, cat) => sum + cat.totalValue, 0)

  categories.forEach(cat => {
    cat.percentOfTotal = totalValue > 0 ? (cat.totalValue / totalValue) * 100 : 0
  })

  return categories.sort((a, b) => b.totalValue - a.totalValue)
}

/**
 * Get Period End Dates for a Year
 */
function getPeriodEndDates(year: number, periodType: PeriodType): Date[] {
  const dates: Date[] = []

  if (periodType === PeriodType.MONTHLY) {
    for (let month = 0; month < 12; month++) {
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
      dates.push(endDate)
    }
  } else if (periodType === PeriodType.QUARTERLY) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const endMonth = (quarter + 1) * 3
      const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999)
      dates.push(endDate)
    }
  } else if (periodType === PeriodType.YEARLY) {
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
    dates.push(endDate)
  }

  return dates
}

/**
 * Format Period Label
 */
function formatPeriodLabel(date: Date, periodType: PeriodType): string {
  const year = date.getFullYear()
  const month = date.getMonth()

  if (periodType === PeriodType.MONTHLY) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[month]} ${year}`
  } else if (periodType === PeriodType.QUARTERLY) {
    const quarter = Math.floor(month / 3) + 1
    return `Q${quarter} ${year}`
  } else {
    return `${year}`
  }
}

/**
 * Get Inventory Valuation Trend
 * Main function for historical valuation report
 */
export async function getInventoryValuationTrend(
  businessId: number,
  year: number,
  periodType: PeriodType,
  locationId?: number,
  method: ValuationMethod = ValuationMethod.WEIGHTED_AVG
): Promise<ValuationTrend> {

  const periodEndDates = getPeriodEndDates(year, periodType)
  const periods: PeriodValuation[] = []

  for (const endDate of periodEndDates) {
    // Only calculate if date is in the past
    if (endDate > new Date()) {
      continue
    }

    const categoryBreakdown = await getHistoricalValuationByCategory(
      businessId,
      endDate,
      locationId,
      method
    )

    const totalQuantity = categoryBreakdown.reduce((sum, cat) => sum + cat.totalQuantity, 0)
    const totalValue = categoryBreakdown.reduce((sum, cat) => sum + cat.totalValue, 0)

    periods.push({
      period: formatPeriodLabel(endDate, periodType),
      periodEnd: endDate,
      totalQuantity,
      totalValue,
      valuationMethod: method,
      categoryBreakdown
    })
  }

  // Calculate summary
  const startValue = periods.length > 0 ? periods[0].totalValue : 0
  const endValue = periods.length > 0 ? periods[periods.length - 1].totalValue : 0
  const changeValue = endValue - startValue
  const changePercent = startValue > 0 ? (changeValue / startValue) * 100 : 0

  return {
    periods,
    summary: {
      startValue,
      endValue,
      changeValue,
      changePercent,
      method
    }
  }
}

/**
 * Get Current Period Valuation (for comparison)
 */
export async function getCurrentPeriodValuation(
  businessId: number,
  locationId?: number,
  method: ValuationMethod = ValuationMethod.WEIGHTED_AVG
): Promise<PeriodValuation> {

  const now = new Date()
  const categoryBreakdown = await getHistoricalValuationByCategory(
    businessId,
    now,
    locationId,
    method
  )

  const totalQuantity = categoryBreakdown.reduce((sum, cat) => sum + cat.totalQuantity, 0)
  const totalValue = categoryBreakdown.reduce((sum, cat) => sum + cat.totalValue, 0)

  return {
    period: 'Current',
    periodEnd: now,
    totalQuantity,
    totalValue,
    valuationMethod: method,
    categoryBreakdown
  }
}
