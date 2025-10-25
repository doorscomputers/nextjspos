/**
 * Cost Basis Tracker
 * Calculates COGS (Cost of Goods Sold) and profitability metrics
 * Essential for accurate profit/loss statements and pricing decisions
 */

import { prisma } from './prisma'
import {
  getInventoryValuation,
  ValuationMethod
} from './inventoryValuation'

/**
 * Sale Item for COGS Calculation
 */
export interface SaleItemInput {
  variationId: number
  locationId: number
  quantity: number
  sellingPrice: number
}

/**
 * COGS Calculation Result for Single Item
 */
export interface ItemCOGSResult {
  variationId: number
  quantity: number
  revenue: number
  cogs: number
  profit: number
  margin: number
  unitCost: number
}

/**
 * Complete COGS Calculation Result
 */
export interface COGSResult {
  totalCOGS: number
  totalRevenue: number
  grossProfit: number
  grossMargin: number
  items: ItemCOGSResult[]
}

/**
 * Calculate COGS for a Sale
 *
 * Uses the business's configured valuation method (FIFO/LIFO/Weighted Average)
 * to determine the cost of goods sold for each item in the sale.
 *
 * @param businessId - Business ID
 * @param saleItems - Array of sale items with variation, location, quantity, and selling price
 * @param method - Optional valuation method override (defaults to business setting)
 * @returns COGS calculation with totals and per-item breakdown
 */
export async function calculateSaleCOGS(
  businessId: number,
  saleItems: SaleItemInput[],
  method?: ValuationMethod
): Promise<COGSResult> {

  // Get business valuation method if not specified
  if (!method) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { accountingMethod: true }
    })
    method = (business?.accountingMethod as ValuationMethod) || ValuationMethod.WEIGHTED_AVG
  }

  const itemResults: ItemCOGSResult[] = []
  let totalCOGS = 0
  let totalRevenue = 0

  for (const item of saleItems) {
    try {
      // Get current cost using the valuation method
      const valuation = await getInventoryValuation(
        item.variationId,
        item.locationId,
        businessId,
        method
      )

      const unitCost = valuation.unitCost
      const itemCOGS = Number(item.quantity) * unitCost
      const itemRevenue = Number(item.quantity) * Number(item.sellingPrice)
      const itemProfit = itemRevenue - itemCOGS
      const itemMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0

      itemResults.push({
        variationId: item.variationId,
        quantity: Number(item.quantity),
        revenue: itemRevenue,
        cogs: itemCOGS,
        profit: itemProfit,
        margin: itemMargin,
        unitCost
      })

      totalCOGS += itemCOGS
      totalRevenue += itemRevenue
    } catch (error) {
      console.error(`Failed to calculate COGS for variation ${item.variationId}:`, error)

      // Fallback: Use zero cost if valuation fails
      const itemRevenue = Number(item.quantity) * Number(item.sellingPrice)
      itemResults.push({
        variationId: item.variationId,
        quantity: Number(item.quantity),
        revenue: itemRevenue,
        cogs: 0,
        profit: itemRevenue,
        margin: 100,
        unitCost: 0
      })
      totalRevenue += itemRevenue
    }
  }

  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  return {
    totalCOGS,
    totalRevenue,
    grossProfit,
    grossMargin,
    items: itemResults
  }
}

/**
 * Get Product Profitability Report
 *
 * Aggregates sales data to calculate profitability metrics per product
 *
 * @param businessId - Business ID
 * @param startDate - Start date for report period
 * @param endDate - End date for report period
 * @param locationId - Optional location filter
 * @returns Profitability report by product
 */
export async function getProductProfitability(
  businessId: number,
  startDate?: Date,
  endDate?: Date,
  locationId?: number
) {

  // Build where clause
  const whereClause: any = {
    businessId,
    status: { in: ['completed', 'invoiced'] }
  }

  if (startDate || endDate) {
    whereClause.createdAt = {}
    if (startDate) whereClause.createdAt.gte = startDate
    if (endDate) whereClause.createdAt.lte = endDate
  }

  if (locationId) {
    whereClause.locationId = locationId
  }

  // Get all sales with items
  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      items: {
        include: {
          productVariation: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  categoryId: true,
                  category: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  // Aggregate by product variation
  const productMap = new Map<string, {
    productId: number
    productName: string
    productSku: string
    variationId: number
    variationName: string
    variationSku: string
    categoryId: number | null
    categoryName: string | null
    totalRevenue: number
    totalCOGS: number
    totalProfit: number
    unitsSold: number
    transactionCount: number
  }>()

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = `${item.productId}-${item.productVariationId}`

      const revenue = Number(item.unitPrice) * Number(item.quantity)
      const cogs = Number(item.unitCost) * Number(item.quantity)
      const profit = revenue - cogs

      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: item.productId,
          productName: item.productVariation?.product?.name || 'Unknown',
          productSku: item.productVariation?.product?.sku || '',
          variationId: item.productVariationId,
          variationName: item.productVariation?.name || 'Default',
          variationSku: item.productVariation?.sku || '',
          categoryId: item.productVariation?.product?.categoryId || null,
          categoryName: item.productVariation?.product?.category?.name || null,
          totalRevenue: 0,
          totalCOGS: 0,
          totalProfit: 0,
          unitsSold: 0,
          transactionCount: 0
        })
      }

      const data = productMap.get(key)!
      data.totalRevenue += revenue
      data.totalCOGS += cogs
      data.totalProfit += profit
      data.unitsSold += Number(item.quantity)
      data.transactionCount += 1
    }
  }

  // Calculate averages and margins
  const profitabilityReport = Array.from(productMap.values()).map(item => ({
    ...item,
    avgMargin: item.totalRevenue > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0,
    avgUnitProfit: item.unitsSold > 0 ? item.totalProfit / item.unitsSold : 0,
    avgUnitCost: item.unitsSold > 0 ? item.totalCOGS / item.unitsSold : 0,
    avgSellingPrice: item.unitsSold > 0 ? item.totalRevenue / item.unitsSold : 0
  }))

  // Sort by total profit descending
  profitabilityReport.sort((a, b) => b.totalProfit - a.totalProfit)

  // Calculate summary
  const summary = {
    totalRevenue: profitabilityReport.reduce((sum, item) => sum + item.totalRevenue, 0),
    totalCOGS: profitabilityReport.reduce((sum, item) => sum + item.totalCOGS, 0),
    totalProfit: profitabilityReport.reduce((sum, item) => sum + item.totalProfit, 0),
    totalUnitsSold: profitabilityReport.reduce((sum, item) => sum + item.unitsSold, 0),
    avgMargin: 0,
    productCount: profitabilityReport.length
  }

  summary.avgMargin = summary.totalRevenue > 0
    ? (summary.totalProfit / summary.totalRevenue) * 100
    : 0

  return {
    report: profitabilityReport,
    summary,
    period: {
      startDate,
      endDate
    }
  }
}

/**
 * Get Category Profitability Report
 *
 * Aggregates profitability by product category
 *
 * @param businessId - Business ID
 * @param startDate - Start date for report period
 * @param endDate - End date for report period
 * @param locationId - Optional location filter
 * @returns Profitability report by category
 */
export async function getCategoryProfitability(
  businessId: number,
  startDate?: Date,
  endDate?: Date,
  locationId?: number
) {

  const productReport = await getProductProfitability(
    businessId,
    startDate,
    endDate,
    locationId
  )

  // Aggregate by category
  const categoryMap = new Map<string, {
    categoryId: number | null
    categoryName: string
    totalRevenue: number
    totalCOGS: number
    totalProfit: number
    unitsSold: number
    productCount: number
  }>()

  for (const item of productReport.report) {
    const key = item.categoryId?.toString() || 'uncategorized'
    const categoryName = item.categoryName || 'Uncategorized'

    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        categoryId: item.categoryId,
        categoryName,
        totalRevenue: 0,
        totalCOGS: 0,
        totalProfit: 0,
        unitsSold: 0,
        productCount: 0
      })
    }

    const data = categoryMap.get(key)!
    data.totalRevenue += item.totalRevenue
    data.totalCOGS += item.totalCOGS
    data.totalProfit += item.totalProfit
    data.unitsSold += item.unitsSold
    data.productCount += 1
  }

  // Calculate margins
  const categoryReport = Array.from(categoryMap.values()).map(item => ({
    ...item,
    avgMargin: item.totalRevenue > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0,
    avgUnitProfit: item.unitsSold > 0 ? item.totalProfit / item.unitsSold : 0
  }))

  // Sort by total profit descending
  categoryReport.sort((a, b) => b.totalProfit - a.totalProfit)

  return {
    report: categoryReport,
    summary: productReport.summary,
    period: productReport.period
  }
}

/**
 * Get Low Margin Products
 *
 * Identifies products with margins below a threshold
 *
 * @param businessId - Business ID
 * @param marginThreshold - Minimum acceptable margin percentage (default: 20%)
 * @param startDate - Start date for analysis period
 * @param endDate - End date for analysis period
 * @returns Products with low margins
 */
export async function getLowMarginProducts(
  businessId: number,
  marginThreshold: number = 20,
  startDate?: Date,
  endDate?: Date
) {

  const profitability = await getProductProfitability(
    businessId,
    startDate,
    endDate
  )

  const lowMarginProducts = profitability.report.filter(
    item => item.avgMargin < marginThreshold && item.unitsSold > 0
  )

  return {
    products: lowMarginProducts,
    threshold: marginThreshold,
    count: lowMarginProducts.length
  }
}

/**
 * Get Top Performers
 *
 * Returns top N products by profit
 *
 * @param businessId - Business ID
 * @param limit - Number of top products to return (default: 10)
 * @param startDate - Start date for analysis period
 * @param endDate - End date for analysis period
 * @returns Top performing products
 */
export async function getTopPerformers(
  businessId: number,
  limit: number = 10,
  startDate?: Date,
  endDate?: Date
) {

  const profitability = await getProductProfitability(
    businessId,
    startDate,
    endDate
  )

  return {
    products: profitability.report.slice(0, limit),
    period: profitability.period
  }
}
