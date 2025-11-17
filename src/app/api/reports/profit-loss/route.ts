import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// In-memory cache for report results (60 second TTL)
const reportCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

function getCacheKey(businessId: number, startDate: string, endDate: string, locationId: string): string {
  return `pl_${businessId}_${startDate}_${endDate}_${locationId}`
}

function getFromCache(key: string): any | null {
  const cached = reportCache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > CACHE_TTL) {
    reportCache.delete(key)
    return null
  }

  return cached.data
}

function setCache(key: string, data: any): void {
  reportCache.set(key, { data, timestamp: Date.now() })

  // Clean old cache entries (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
  for (const [k, v] of reportCache.entries()) {
    if (v.timestamp < fiveMinutesAgo) {
      reportCache.delete(k)
    }
  }
}

/**
 * GET /api/reports/profit-loss
 * Comprehensive Profit & Loss Report
 *
 * Query Params:
 * - startDate: Start date for report
 * - endDate: End date for report
 * - locationId: Optional - Filter by specific location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)

    // Check cache first
    const cacheKey = getCacheKey(businessId, start.toISOString(), end.toISOString(), locationId?.toString() || 'all')
    const cachedResult = getFromCache(cacheKey)
    if (cachedResult) {
      console.log('[Profit/Loss] Returning cached result')
      return NextResponse.json(cachedResult)
    }

    // Build base where clause
    const baseWhere: any = {
      businessId: parseInt(businessId),
    }

    if (locationId && locationId !== 'all') {
      baseWhere.locationId = parseInt(locationId)
    }

    // ============================================
    // OPENING STOCK (at start date)
    // Uses Historical Stock Reconstruction from stockTransaction table
    // Same technique as Historical Inventory report
    // ============================================

    // Set opening date to start of day (beginning of period)
    const openingDate = new Date(start)
    openingDate.setHours(0, 0, 0, 0)

    // Get all variation-location combinations for this business
    const openingStockWhere: any = {
      product: {
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    }

    if (locationId && locationId !== 'all') {
      openingStockWhere.locationId = parseInt(locationId)
    }

    // OPTIMIZED: Get latest stock transactions in a single query using raw SQL
    const openingStockQuery = `
      WITH LatestTransactions AS (
        SELECT DISTINCT ON (st.product_id, st.product_variation_id, st.location_id)
          st.product_id,
          st.product_variation_id,
          st.location_id,
          st.balance_qty,
          st.unit_cost,
          pv.purchase_price,
          pv.selling_price
        FROM stock_transaction st
        INNER JOIN product_variation pv ON st.product_variation_id = pv.id
        INNER JOIN product p ON st.product_id = p.id
        WHERE st.business_id = $1
          AND p.deleted_at IS NULL
          AND st.created_at <= $2
          ${locationId && locationId !== 'all' ? 'AND st.location_id = $3' : ''}
        ORDER BY st.product_id, st.product_variation_id, st.location_id, st.created_at DESC, st.id DESC
      )
      SELECT
        COALESCE(SUM(balance_qty * COALESCE(unit_cost, purchase_price, 0)), 0) as opening_stock_purchase,
        COALESCE(SUM(balance_qty * COALESCE(selling_price, 0)), 0) as opening_stock_sale
      FROM LatestTransactions
      WHERE balance_qty > 0
    `

    const openingStockParams = locationId && locationId !== 'all'
      ? [businessId, openingDate, locationId]
      : [businessId, openingDate]

    const openingStockResult: any = await prisma.$queryRawUnsafe(openingStockQuery, ...openingStockParams)

    const openingStockPurchase = parseFloat(openingStockResult[0]?.opening_stock_purchase || '0')
    const openingStockSale = parseFloat(openingStockResult[0]?.opening_stock_sale || '0')

    // ============================================
    // CLOSING STOCK (at end date)
    // Uses Historical Stock Reconstruction from stockTransaction table
    // Same technique as Historical Inventory report
    // ============================================

    // Set closing date to end of day (end of period)
    const closingDate = new Date(end)
    closingDate.setHours(23, 59, 59, 999)

    // OPTIMIZED: Get latest stock transactions in a single query using raw SQL
    const closingStockQuery = `
      WITH LatestTransactions AS (
        SELECT DISTINCT ON (st.product_id, st.product_variation_id, st.location_id)
          st.product_id,
          st.product_variation_id,
          st.location_id,
          st.balance_qty,
          st.unit_cost,
          pv.purchase_price,
          pv.selling_price
        FROM stock_transaction st
        INNER JOIN product_variation pv ON st.product_variation_id = pv.id
        INNER JOIN product p ON st.product_id = p.id
        WHERE st.business_id = $1
          AND p.deleted_at IS NULL
          AND st.created_at <= $2
          ${locationId && locationId !== 'all' ? 'AND st.location_id = $3' : ''}
        ORDER BY st.product_id, st.product_variation_id, st.location_id, st.created_at DESC, st.id DESC
      )
      SELECT
        COALESCE(SUM(balance_qty * COALESCE(unit_cost, purchase_price, 0)), 0) as closing_stock_purchase,
        COALESCE(SUM(balance_qty * COALESCE(selling_price, 0)), 0) as closing_stock_sale
      FROM LatestTransactions
      WHERE balance_qty > 0
    `

    const closingStockParams = locationId && locationId !== 'all'
      ? [businessId, closingDate, locationId]
      : [businessId, closingDate]

    const closingStockResult: any = await prisma.$queryRawUnsafe(closingStockQuery, ...closingStockParams)

    const closingStockPurchase = parseFloat(closingStockResult[0]?.closing_stock_purchase || '0')
    const closingStockSale = parseFloat(closingStockResult[0]?.closing_stock_sale || '0')

    // ============================================
    // PURCHASES
    // ============================================
    const purchasesWhere = {
      ...baseWhere,
      purchaseDate: { gte: start, lte: end },
      status: { not: 'cancelled' },
    }

    const purchases = await prisma.purchase.findMany({
      where: purchasesWhere,
    })

    let totalPurchase = 0
    let totalPurchaseShipping = 0
    let purchaseAdditionalExpenses = 0
    let totalPurchaseDiscount = 0

    purchases.forEach((purchase) => {
      totalPurchase += purchase.totalAmount ? parseFloat(purchase.totalAmount.toString()) : 0
      totalPurchaseShipping += purchase.shippingCost ? parseFloat(purchase.shippingCost.toString()) : 0
      // purchaseAdditionalExpenses += purchase.additionalExpense ? parseFloat(purchase.additionalExpense.toString()) : 0 // Field doesn't exist in schema
      totalPurchaseDiscount += purchase.discountAmount ? parseFloat(purchase.discountAmount.toString()) : 0
    })

    // ============================================
    // PURCHASE RETURNS
    // ============================================
    const purchaseReturnsWhere = {
      ...baseWhere,
      returnDate: { gte: start, lte: end },
      status: { not: 'cancelled' },
    }

    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: purchaseReturnsWhere,
    })

    let totalPurchaseReturn = 0
    purchaseReturns.forEach((ret) => {
      totalPurchaseReturn += ret.totalAmount ? parseFloat(ret.totalAmount.toString()) : 0
    })

    // ============================================
    // SALES (with items for COGS calculation)
    // ============================================
    const salesWhere = {
      ...baseWhere,
      saleDate: { gte: start, lte: end },
      status: { notIn: ['cancelled', 'voided'] },
    }

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        saleItems: true, // Include sale items to calculate COGS
      },
    })

    let totalSales = 0
    let totalSellShipping = 0
    let sellAdditionalExpenses = 0
    let totalSellDiscount = 0
    let totalSellRoundOff = 0
    let actualCOGS = 0 // Calculate COGS from actual items sold

    sales.forEach((sale) => {
      totalSales += sale.totalAmount ? parseFloat(sale.totalAmount.toString()) : 0
      totalSellShipping += sale.shippingCost ? parseFloat(sale.shippingCost.toString()) : 0
      // sellAdditionalExpenses += sale.additionalExpense ? parseFloat(sale.additionalExpense.toString()) : 0 // Field doesn't exist in schema
      totalSellDiscount += sale.discountAmount ? parseFloat(sale.discountAmount.toString()) : 0
      // totalSellRoundOff += sale.roundOffAmount ? parseFloat(sale.roundOffAmount.toString()) : 0 // Field doesn't exist in schema

      // Calculate COGS from sale items
      if (sale.saleItems && Array.isArray(sale.saleItems)) {
        sale.saleItems.forEach((item: any) => {
          const quantity = item.quantity ? parseFloat(item.quantity.toString()) : 0
          const unitCost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
          actualCOGS += quantity * unitCost
        })
      }
    })

    // ============================================
    // SALE RETURNS
    // ============================================
    const saleReturnsWhere = {
      businessId: parseInt(businessId),
      // Note: Add locationId filter if you have a location field on sale returns
      createdAt: { gte: start, lte: end },
    }

    // Assuming you have a SaleReturn model (adjust if different)
    // If not, you can calculate from voided/cancelled sales
    let totalSellReturn = 0
    const voidedSales = await prisma.sale.findMany({
      where: {
        ...baseWhere,
        saleDate: { gte: start, lte: end },
        status: { in: ['voided', 'cancelled'] },
      },
    })

    voidedSales.forEach((sale) => {
      totalSellReturn += sale.totalAmount ? parseFloat(sale.totalAmount.toString()) : 0
    })

    // ============================================
    // EXPENSES (Cash Out)
    // ============================================
    const expensesWhere = {
      ...baseWhere,
      type: 'cash_out',
      createdAt: { gte: start, lte: end },
    }

    const expenses = await prisma.cashInOut.findMany({
      where: expensesWhere,
    })

    let totalExpense = 0
    expenses.forEach((expense) => {
      totalExpense += expense.amount ? parseFloat(expense.amount.toString()) : 0
    })

    // ============================================
    // STOCK ADJUSTMENTS
    // ============================================
    const stockAdjustmentsWhere = {
      businessId: parseInt(businessId),
      createdAt: { gte: start, lte: end },
      type: { in: ['normal', 'abnormal', 'damage'] },
    }

    const stockAdjustments = await prisma.stockTransaction.findMany({
      where: stockAdjustmentsWhere,
    })

    let totalStockAdjustment = 0
    stockAdjustments.forEach((adj) => {
      const qty = adj.quantity ? parseFloat(adj.quantity.toString()) : 0
      const unitCost = adj.unitCost ? parseFloat(adj.unitCost.toString()) : 0
      totalStockAdjustment += qty * unitCost
    })

    // ============================================
    // STOCK RECOVERED
    // ============================================
    const stockRecoveredWhere = {
      businessId: parseInt(businessId),
      createdAt: { gte: start, lte: end },
      type: 'recovered',
    }

    const stockRecovered = await prisma.stockTransaction.findMany({
      where: stockRecoveredWhere,
    })

    let totalStockRecovered = 0
    stockRecovered.forEach((rec) => {
      const qty = rec.quantity ? parseFloat(rec.quantity.toString()) : 0
      const unitCost = rec.unitCost ? parseFloat(rec.unitCost.toString()) : 0
      totalStockRecovered += qty * unitCost
    })

    // ============================================
    // TRANSFER SHIPPING
    // ============================================
    // Note: StockTransfer model doesn't have shippingCharge field in current schema
    let totalTransferShipping = 0

    // Uncomment if shippingCharge field is added to StockTransfer schema
    // const transfersWhere = {
    //   businessId: parseInt(businessId),
    //   createdAt: { gte: start, lte: end },
    // }
    // const transfers = await prisma.stockTransfer.findMany({
    //   where: transfersWhere,
    // })
    // transfers.forEach((transfer) => {
    //   totalTransferShipping += transfer.shippingCharge ? parseFloat(transfer.shippingCharge.toString()) : 0
    // })

    // ============================================
    // CUSTOMER REWARDS (if you track them separately)
    // ============================================
    // This would depend on your loyalty program implementation
    const totalCustomerReward = 0 // Placeholder

    // ============================================
    // CALCULATIONS
    // ============================================

    // PRIMARY COGS: Actual cost of goods sold (from sale items)
    // This is the most accurate method - directly from sale transactions
    const cogs = actualCOGS

    // TRADITIONAL COGS FORMULA (for validation and cross-check)
    // COGS = Opening Stock + Purchases + Adjustments - Closing Stock - Purchase Returns
    const traditionalCOGS = openingStockPurchase + totalPurchase + totalStockAdjustment - closingStockPurchase - totalPurchaseReturn

    // Calculate variance between methods (helps identify discrepancies)
    const cogsVariance = Math.abs(cogs - traditionalCOGS)
    const cogsVariancePercent = traditionalCOGS > 0 ? (cogsVariance / traditionalCOGS) * 100 : 0

    // Gross Profit = Total Sales - COGS
    const grossProfit = totalSales - cogs

    // Net Profit = Gross Profit - Expenses + Additional Income - Discounts - Returns + Shipping Revenue - Shipping Costs
    const netProfit =
      grossProfit -
      totalExpense +
      totalStockRecovered -
      totalSellDiscount -
      totalSellReturn +
      totalSellShipping -
      totalPurchaseShipping -
      totalTransferShipping +
      totalPurchaseDiscount -
      purchaseAdditionalExpenses -
      sellAdditionalExpenses -
      totalCustomerReward

    const response = {
      // Left Column - Costs
      openingStockPurchase,
      openingStockSale,
      totalPurchase,
      totalStockAdjustment,
      totalExpense,
      totalPurchaseShipping,
      purchaseAdditionalExpenses,
      totalTransferShipping,
      totalSellDiscount,
      totalCustomerReward,
      totalSellReturn,

      // Right Column - Revenue
      closingStockPurchase,
      closingStockSale,
      totalSales,
      totalSellShipping,
      sellAdditionalExpenses,
      totalStockRecovered,
      totalPurchaseReturn,
      totalPurchaseDiscount,
      totalSellRoundOff,

      // Calculated Fields
      cogs,
      grossProfit,
      netProfit,

      // COGS Validation (for transparency and debugging)
      traditionalCOGS,
      cogsVariance,
      cogsVariancePercent,

      // Metadata
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    }

    // Cache the result for 60 seconds
    setCache(cacheKey, response)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating profit/loss report:', error)
    return NextResponse.json(
      { error: 'Failed to generate profit/loss report', details: error.message },
      { status: 500 }
    )
  }
}
