import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

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

    const openingStockItems = await prisma.variationLocationDetails.findMany({
      where: openingStockWhere,
      include: {
        productVariation: {
          select: {
            purchasePrice: true,
            sellingPrice: true,
          },
        },
      },
    })

    // Calculate historical stock value for each item at opening date
    let openingStockPurchase = 0
    let openingStockSale = 0

    await Promise.all(
      openingStockItems.map(async (item) => {
        // Find last transaction on or before opening date
        const lastTx = await prisma.stockTransaction.findFirst({
          where: {
            businessId: parseInt(businessId),
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: item.locationId,
            createdAt: { lte: openingDate },
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          select: {
            balanceQty: true,
            unitCost: true,
          },
        })

        if (lastTx && lastTx.balanceQty) {
          const historicalQty = parseFloat(lastTx.balanceQty.toString())
          const historicalCost = lastTx.unitCost
            ? parseFloat(lastTx.unitCost.toString())
            : parseFloat(item.productVariation.purchasePrice?.toString() || '0')

          const salePrice = parseFloat(item.productVariation.sellingPrice?.toString() || '0')

          openingStockPurchase += historicalQty * historicalCost
          openingStockSale += historicalQty * salePrice
        }
      })
    )

    // ============================================
    // CLOSING STOCK (at end date)
    // Uses Historical Stock Reconstruction from stockTransaction table
    // Same technique as Historical Inventory report
    // ============================================

    // Set closing date to end of day (end of period)
    const closingDate = new Date(end)
    closingDate.setHours(23, 59, 59, 999)

    // Get all variation-location combinations for this business
    const closingStockWhere: any = {
      product: {
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    }

    if (locationId && locationId !== 'all') {
      closingStockWhere.locationId = parseInt(locationId)
    }

    const closingStockItems = await prisma.variationLocationDetails.findMany({
      where: closingStockWhere,
      include: {
        productVariation: {
          select: {
            purchasePrice: true,
            sellingPrice: true,
          },
        },
      },
    })

    // Calculate historical stock value for each item at closing date
    let closingStockPurchase = 0
    let closingStockSale = 0

    await Promise.all(
      closingStockItems.map(async (item) => {
        // Find last transaction on or before closing date
        const lastTx = await prisma.stockTransaction.findFirst({
          where: {
            businessId: parseInt(businessId),
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: item.locationId,
            createdAt: { lte: closingDate },
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          select: {
            balanceQty: true,
            unitCost: true,
          },
        })

        if (lastTx && lastTx.balanceQty) {
          const historicalQty = parseFloat(lastTx.balanceQty.toString())
          const historicalCost = lastTx.unitCost
            ? parseFloat(lastTx.unitCost.toString())
            : parseFloat(item.productVariation.purchasePrice?.toString() || '0')

          const salePrice = parseFloat(item.productVariation.sellingPrice?.toString() || '0')

          closingStockPurchase += historicalQty * historicalCost
          closingStockSale += historicalQty * salePrice
        }
      })
    )

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

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating profit/loss report:', error)
    return NextResponse.json(
      { error: 'Failed to generate profit/loss report', details: error.message },
      { status: 500 }
    )
  }
}
