import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate, locationIds = [] } = body

    const businessId = parseInt(session.user.businessId)

    // Date range setup
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Previous period for comparison (same duration)
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - periodDays)
    const prevEnd = new Date(start)

    // Base where clause
    const baseWhere: any = {
      businessId,
      saleDate: {
        gte: start,
        lte: end
      }
    }

    if (locationIds.length > 0) {
      baseWhere.locationId = { in: locationIds }
    }

    const prevWhere: any = {
      businessId,
      saleDate: {
        gte: prevStart,
        lte: prevEnd
      }
    }

    if (locationIds.length > 0) {
      prevWhere.locationId = { in: locationIds }
    }

    // ========== EXECUTIVE SUMMARY ==========
    const [
      currentSales,
      previousSales,
      totalCustomers,
      locations,
      currentInventoryValue,
      lowStockCount,
      outOfStockCount
    ] = await Promise.all([
      // Current period sales
      prisma.sale.findMany({
        where: baseWhere,
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          }
        }
      }),
      // Previous period sales
      prisma.sale.findMany({
        where: prevWhere,
        select: {
          totalAmount: true
        }
      }),
      // Total customers
      prisma.customer.count({
        where: { businessId }
      }),
      // Locations
      prisma.businessLocation.findMany({
        where: { businessId },
        select: { id: true, name: true }
      }),
      // Current inventory value
      prisma.variationLocationDetails.findMany({
        where: {
          product: { businessId },
          ...(locationIds.length > 0 ? { locationId: { in: locationIds } } : {})
        },
        include: {
          productVariation: {
            include: {
              product: true
            }
          }
        }
      }),
      // Low stock count
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT v.id) as count
        FROM "product_variations" v
        INNER JOIN "products" p ON v."product_id" = p.id
        LEFT JOIN "variation_location_details" vld ON v.id = vld."product_variation_id"
        WHERE p."business_id" = ${businessId}
        AND vld."qty_available" <= p."alert_quantity"
        AND vld."qty_available" > 0
      `,
      // Out of stock count
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT v.id) as count
        FROM "product_variations" v
        INNER JOIN "products" p ON v."product_id" = p.id
        LEFT JOIN "variation_location_details" vld ON v.id = vld."product_variation_id"
        WHERE p."business_id" = ${businessId}
        AND vld."qty_available" = 0
      `
    ])

    // Calculate current metrics
    const currentRevenue = currentSales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const currentCost = currentSales.reduce((sum, s) =>
      sum + s.items.reduce((itemSum, item) =>
        itemSum + (Number(item.quantity) * Number(item.unitCost || 0)), 0
      ), 0
    )
    const currentProfit = currentRevenue - currentCost
    const currentTransactions = currentSales.length
    const currentItemsSold = currentSales.reduce((sum, s) =>
      sum + s.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0
    )

    // Calculate previous metrics
    const prevRevenue = previousSales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const prevTransactions = previousSales.length

    // Growth rates
    const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const transactionGrowth = prevTransactions > 0 ? ((currentTransactions - prevTransactions) / prevTransactions) * 100 : 0
    const avgTransactionValue = currentTransactions > 0 ? currentRevenue / currentTransactions : 0
    const profitMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0

    // Inventory value - use productVariation purchasePrice (most accurate)
    const inventoryValue = currentInventoryValue.reduce((sum, stock) => {
      const purchasePrice = Number(stock.productVariation?.purchasePrice || stock.productVariation?.product?.purchasePrice || 0)
      return sum + (Number(stock.qtyAvailable) * purchasePrice)
    }, 0)

    // ========== REVENUE TRENDS (DAILY) ==========
    const revenueTrends: Array<{
      date: string
      revenue: number
      transactions: number
      avgTransaction: number
    }> = []

    const dateMap = new Map<string, { revenue: number; transactions: number }>()

    currentSales.forEach(sale => {
      const dateKey = new Date(sale.saleDate).toISOString().split('T')[0]
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { revenue: 0, transactions: 0 })
      }
      const data = dateMap.get(dateKey)!
      data.revenue += Number(sale.totalAmount)
      data.transactions += 1
    })

    dateMap.forEach((data, date) => {
      revenueTrends.push({
        date,
        revenue: data.revenue,
        transactions: data.transactions,
        avgTransaction: data.transactions > 0 ? data.revenue / data.transactions : 0
      })
    })

    revenueTrends.sort((a, b) => a.date.localeCompare(b.date))

    // ========== TOP PRODUCTS BY REVENUE ==========
    const productRevenue = new Map<number, {
      productId: number
      name: string
      sku: string
      category: string
      revenue: number
      quantity: number
      profit: number
      transactions: number
    }>()

    currentSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = item.product
        if (!product) return

        const productId = product.id
        const revenue = Number(item.quantity) * Number(item.unitPrice)
        const cost = Number(item.quantity) * Number(item.unitCost || 0)
        const profit = revenue - cost

        if (!productRevenue.has(productId)) {
          productRevenue.set(productId, {
            productId,
            name: product.name,
            sku: product.sku || 'N/A',
            category: product.category?.name || 'Uncategorized',
            revenue: 0,
            quantity: 0,
            profit: 0,
            transactions: 0
          })
        }

        const data = productRevenue.get(productId)!
        data.revenue += revenue
        data.quantity += Number(item.quantity)
        data.profit += profit
        data.transactions += 1
      })
    })

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)

    // ========== CATEGORY PERFORMANCE ==========
    const categoryPerformance = new Map<string, {
      category: string
      revenue: number
      profit: number
      quantity: number
      transactions: number
    }>()

    currentSales.forEach(sale => {
      sale.items.forEach(item => {
        const category = item.product?.category?.name || 'Uncategorized'
        const revenue = Number(item.quantity) * Number(item.unitPrice)
        const cost = Number(item.quantity) * Number(item.unitCost || 0)
        const profit = revenue - cost

        if (!categoryPerformance.has(category)) {
          categoryPerformance.set(category, {
            category,
            revenue: 0,
            profit: 0,
            quantity: 0,
            transactions: 0
          })
        }

        const data = categoryPerformance.get(category)!
        data.revenue += revenue
        data.profit += profit
        data.quantity += Number(item.quantity)
        data.transactions += 1
      })
    })

    const categoryData = Array.from(categoryPerformance.values())
      .sort((a, b) => b.revenue - a.revenue)

    // ========== HOURLY SALES PATTERN ==========
    const hourlyPattern = new Array(24).fill(0).map((_, hour) => ({
      hour,
      transactions: 0,
      revenue: 0
    }))

    currentSales.forEach(sale => {
      const hour = new Date(sale.saleDate).getHours()
      hourlyPattern[hour].transactions += 1
      hourlyPattern[hour].revenue += Number(sale.totalAmount)
    })

    // ========== TOP CUSTOMERS ==========
    const customerRevenue = new Map<number, {
      customerId: number
      name: string
      email: string
      phone: string
      revenue: number
      transactions: number
      lastPurchase: Date
    }>()

    currentSales.forEach(sale => {
      if (!sale.customerId) return

      if (!customerRevenue.has(sale.customerId)) {
        customerRevenue.set(sale.customerId, {
          customerId: sale.customerId,
          name: 'Customer', // Will be populated from DB
          email: '',
          phone: '',
          revenue: 0,
          transactions: 0,
          lastPurchase: sale.saleDate
        })
      }

      const data = customerRevenue.get(sale.customerId)!
      data.revenue += Number(sale.totalAmount)
      data.transactions += 1
      if (sale.saleDate > data.lastPurchase) {
        data.lastPurchase = sale.saleDate
      }
    })

    // Fetch customer details
    const customerIds = Array.from(customerRevenue.keys())
    if (customerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, email: true, mobile: true }
      })

      customers.forEach(customer => {
        const data = customerRevenue.get(customer.id)
        if (data) {
          data.name = customer.name
          data.email = customer.email || ''
          data.phone = customer.mobile || ''
        }
      })
    }

    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // ========== INVENTORY INSIGHTS ==========
    // Fast movers (high turnover)
    const productSalesVelocity = new Map<number, {
      productId: number
      name: string
      sku: string
      quantitySold: number
      currentStock: number
      daysToStockOut: number
      reorderRecommended: boolean
    }>()

    currentSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = item.product
        if (!product) return

        if (!productSalesVelocity.has(product.id)) {
          productSalesVelocity.set(product.id, {
            productId: product.id,
            name: product.name,
            sku: product.sku || 'N/A',
            quantitySold: 0,
            currentStock: 0,
            daysToStockOut: 0,
            reorderRecommended: false
          })
        }

        const data = productSalesVelocity.get(product.id)!
        data.quantitySold += Number(item.quantity)
      })
    })

    // Add current stock levels
    currentInventoryValue.forEach(stock => {
      const productId = stock.productVariation?.product?.id
      if (!productId) return

      const data = productSalesVelocity.get(productId)
      if (data) {
        data.currentStock += Number(stock.qtyAvailable)
      }
    })

    // Calculate days to stock out and recommendations
    productSalesVelocity.forEach(data => {
      if (data.quantitySold > 0) {
        const dailyVelocity = data.quantitySold / periodDays
        data.daysToStockOut = dailyVelocity > 0 ? Math.floor(data.currentStock / dailyVelocity) : 999
        data.reorderRecommended = data.daysToStockOut < 14 && data.daysToStockOut > 0
      }
    })

    const fastMovers = Array.from(productSalesVelocity.values())
      .filter(p => p.quantitySold > 0)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20)

    const reorderRecommendations = Array.from(productSalesVelocity.values())
      .filter(p => p.reorderRecommended)
      .sort((a, b) => a.daysToStockOut - b.daysToStockOut)
      .slice(0, 20)

    // ========== SALES BY LOCATION ==========
    const locationPerformance = new Map<number, {
      locationId: number
      locationName: string
      revenue: number
      transactions: number
      profit: number
    }>()

    currentSales.forEach(sale => {
      if (!sale.locationId) return

      if (!locationPerformance.has(sale.locationId)) {
        const location = locations.find(l => l.id === sale.locationId)
        locationPerformance.set(sale.locationId, {
          locationId: sale.locationId,
          locationName: location?.name || 'Unknown',
          revenue: 0,
          transactions: 0,
          profit: 0
        })
      }

      const data = locationPerformance.get(sale.locationId)!
      data.revenue += Number(sale.totalAmount)
      data.transactions += 1

      const saleCost = sale.items.reduce((sum, item) =>
        sum + (Number(item.quantity) * Number(item.unitCost || 0)), 0
      )
      data.profit += Number(sale.totalAmount) - saleCost
    })

    const locationData = Array.from(locationPerformance.values())
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      success: true,
      data: {
        // Executive Summary
        executive: {
          revenue: currentRevenue,
          revenueGrowth,
          transactions: currentTransactions,
          transactionGrowth,
          profit: currentProfit,
          profitMargin,
          avgTransactionValue,
          itemsSold: currentItemsSold,
          totalCustomers,
          inventoryValue,
          lowStockCount: Number(lowStockCount[0]?.count || 0),
          outOfStockCount: Number(outOfStockCount[0]?.count || 0)
        },
        // Revenue Analysis
        revenueTrends,
        // Product Performance
        topProducts,
        // Category Performance
        categoryData,
        // Time Analysis
        hourlyPattern,
        // Customer Insights
        topCustomers,
        // Inventory Intelligence
        fastMovers,
        reorderRecommendations,
        // Location Performance
        locationData,
        // Metadata
        locations
      }
    })
  } catch (error) {
    console.error('Error generating intelligence dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to generate dashboard intelligence' },
      { status: 500 }
    )
  }
}
