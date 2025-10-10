import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/profitability
 * Calculate COGS, Revenue, and Gross Profit
 *
 * Query Params:
 * - startDate: Start date for report
 * - endDate: End date for report
 * - locationId: Optional - Filter by specific location
 * - groupBy: Optional - 'product' | 'category' | 'location' | 'date'
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

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
    const locationId = searchParams.get('locationId')
    const groupBy = searchParams.get('groupBy') // 'product' | 'category' | 'location' | 'date'

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Build where clause for sales
    const salesWhere: any = {
      businessId: parseInt(businessId),
      status: 'completed', // Only completed sales
      saleDate: {
        gte: start,
        lte: end,
      },
    }

    if (locationId) {
      salesWhere.locationId = parseInt(locationId)
    }

    // Fetch all completed sales with items in date range
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
              },
            },
            productVariation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Calculate overall metrics
    let totalRevenue = 0
    let totalCOGS = 0
    let totalItemsSold = 0

    // For groupBy functionality
    const productMetrics = new Map<number, any>()
    const locationMetrics = new Map<number, any>()
    const categoryMetrics = new Map<number, any>()
    const dateMetrics = new Map<string, any>()

    sales.forEach(sale => {
      const saleRevenue = parseFloat(sale.totalAmount.toString())
      totalRevenue += saleRevenue

      sale.items.forEach(item => {
        const quantity = parseFloat(item.quantity.toString())
        const unitPrice = parseFloat(item.unitPrice.toString())
        const unitCost = parseFloat(item.unitCost.toString())

        const itemRevenue = quantity * unitPrice
        const itemCOGS = quantity * unitCost
        const itemProfit = itemRevenue - itemCOGS

        totalCOGS += itemCOGS
        totalItemsSold += quantity

        // Group by product
        if (groupBy === 'product' || !groupBy) {
          const productId = item.productVariation.id
          if (!productMetrics.has(productId)) {
            productMetrics.set(productId, {
              productId,
              productName: item.product.name,
              variationName: item.productVariation.name,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              quantitySold: 0,
            })
          }
          const pm = productMetrics.get(productId)
          pm.revenue += itemRevenue
          pm.cogs += itemCOGS
          pm.grossProfit += itemProfit
          pm.quantitySold += quantity
        }

        // Group by location
        if (groupBy === 'location') {
          const locId = sale.location.id
          if (!locationMetrics.has(locId)) {
            locationMetrics.set(locId, {
              locationId: locId,
              locationName: sale.location.name,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              salesCount: 0,
            })
          }
          const lm = locationMetrics.get(locId)
          lm.revenue += itemRevenue
          lm.cogs += itemCOGS
          lm.grossProfit += itemProfit
        }

        // Group by category
        if (groupBy === 'category' && item.product.categoryId) {
          const catId = item.product.categoryId
          if (!categoryMetrics.has(catId)) {
            categoryMetrics.set(catId, {
              categoryId: catId,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              quantitySold: 0,
            })
          }
          const cm = categoryMetrics.get(catId)
          cm.revenue += itemRevenue
          cm.cogs += itemCOGS
          cm.grossProfit += itemProfit
          cm.quantitySold += quantity
        }

        // Group by date
        if (groupBy === 'date') {
          const dateKey = sale.saleDate.toISOString().split('T')[0]
          if (!dateMetrics.has(dateKey)) {
            dateMetrics.set(dateKey, {
              date: dateKey,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              salesCount: 0,
            })
          }
          const dm = dateMetrics.get(dateKey)
          dm.revenue += itemRevenue
          dm.cogs += itemCOGS
          dm.grossProfit += itemProfit
        }
      })

      // Count sales per location
      if (groupBy === 'location') {
        const lm = locationMetrics.get(sale.location.id)
        if (lm) lm.salesCount++
      }

      // Count sales per date
      if (groupBy === 'date') {
        const dateKey = sale.saleDate.toISOString().split('T')[0]
        const dm = dateMetrics.get(dateKey)
        if (dm) dm.salesCount++
      }
    })

    const totalGrossProfit = totalRevenue - totalCOGS
    const grossProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0

    // Build response
    const response: any = {
      summary: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalRevenue,
        totalCOGS,
        totalGrossProfit,
        grossProfitMargin,
        totalSales: sales.length,
        totalItemsSold,
      },
    }

    // Add grouped data if requested
    if (groupBy === 'product' || !groupBy) {
      response.byProduct = Array.from(productMetrics.values())
        .sort((a, b) => b.grossProfit - a.grossProfit)
        .map(p => ({
          ...p,
          grossProfitMargin: p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0,
        }))
    }

    if (groupBy === 'location') {
      response.byLocation = Array.from(locationMetrics.values())
        .sort((a, b) => b.grossProfit - a.grossProfit)
        .map(l => ({
          ...l,
          grossProfitMargin: l.revenue > 0 ? (l.grossProfit / l.revenue) * 100 : 0,
          averageSaleValue: l.salesCount > 0 ? l.revenue / l.salesCount : 0,
        }))
    }

    if (groupBy === 'category') {
      // Fetch category names
      const categoryIds = Array.from(categoryMetrics.keys())
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
        },
        select: {
          id: true,
          name: true,
        },
      })

      const categoryMap = new Map(categories.map(c => [c.id, c.name]))

      response.byCategory = Array.from(categoryMetrics.values())
        .sort((a, b) => b.grossProfit - a.grossProfit)
        .map(c => ({
          ...c,
          categoryName: categoryMap.get(c.categoryId) || 'Unknown',
          grossProfitMargin: c.revenue > 0 ? (c.grossProfit / c.revenue) * 100 : 0,
        }))
    }

    if (groupBy === 'date') {
      response.byDate = Array.from(dateMetrics.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          ...d,
          grossProfitMargin: d.revenue > 0 ? (d.grossProfit / d.revenue) * 100 : 0,
        }))
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating profitability report:', error)
    return NextResponse.json(
      { error: 'Failed to generate profitability report', details: error.message },
      { status: 500 }
    )
  }
}
