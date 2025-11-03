import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const compareWith = searchParams.get('compareWith') // 'previous-period', 'previous-year'

    // Build where clause
    const where: any = {
      businessId: parseInt(session.user.businessId),
      status: { not: 'VOID' },
    }

    const start = startDate ? new Date(startDate + 'T00:00:00') : new Date()
    const end = endDate ? new Date(endDate + 'T23:59:59.999') : new Date()

    if (!startDate) {
      start.setDate(start.getDate() - 30) // Last 30 days by default
    }

    where.createdAt = {
      gte: start,
      lte: end,
    }

    // Location filtering
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Get sales for current period
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        location: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Calculate daily sales trend
    const dailySales = new Map()
    const hourlySales = new Map()
    const categorySales = new Map()
    const topProducts = new Map()

    sales.forEach((sale) => {
      // Daily trend
      const dateKey = sale.createdAt.toISOString().split('T')[0]
      if (!dailySales.has(dateKey)) {
        dailySales.set(dateKey, {
          date: dateKey,
          sales: 0,
          transactions: 0,
          items: 0,
        })
      }
      const dailyData = dailySales.get(dateKey)
      dailyData.sales += sale.totalAmount
      dailyData.transactions++
      dailyData.items += sale.items.reduce((sum, item) => sum + item.quantity, 0)

      // Hourly trend
      const hour = sale.createdAt.getHours()
      if (!hourlySales.has(hour)) {
        hourlySales.set(hour, {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          sales: 0,
          transactions: 0,
        })
      }
      const hourlyData = hourlySales.get(hour)
      hourlyData.sales += sale.totalAmount
      hourlyData.transactions++

      // Category sales
      sale.items.forEach((item) => {
        const category = item.product?.category?.name || 'Uncategorized'
        if (!categorySales.has(category)) {
          categorySales.set(category, {
            category,
            sales: 0,
            quantity: 0,
          })
        }
        const categoryData = categorySales.get(category)
        categoryData.sales += item.subtotal
        categoryData.quantity += item.quantity

        // Top products
        const productId = item.productId
        if (!topProducts.has(productId)) {
          topProducts.set(productId, {
            productId,
            productName: item.product?.name || 'N/A',
            quantity: 0,
            revenue: 0,
          })
        }
        const productData = topProducts.get(productId)
        productData.quantity += item.quantity
        productData.revenue += item.subtotal
      })
    })

    // Convert to sorted arrays
    const dailyTrend = Array.from(dailySales.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    const hourlyTrend = Array.from(hourlySales.values()).sort(
      (a, b) => parseInt(a.hour) - parseInt(b.hour)
    )

    const categoryBreakdown = Array.from(categorySales.values()).sort(
      (a, b) => b.sales - a.sales
    )

    const topSellingProducts = Array.from(topProducts.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Calculate KPIs
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
    const totalTransactions = sales.length
    const totalItems = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((s, item) => s + item.quantity, 0),
      0
    )
    const totalDiscount = sales.reduce((sum, sale) => sum + sale.discountAmount, 0)
    const totalTax = sales.reduce((sum, sale) => sum + sale.taxAmount, 0)
    const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0
    const avgItemsPerTransaction = totalTransactions > 0 ? totalItems / totalTransactions : 0

    // Payment method breakdown
    const paymentMethods = new Map()
    sales.forEach((sale) => {
      if (!paymentMethods.has(sale.paymentMethod)) {
        paymentMethods.set(sale.paymentMethod, {
          method: sale.paymentMethod,
          count: 0,
          amount: 0,
        })
      }
      const pmData = paymentMethods.get(sale.paymentMethod)
      pmData.count++
      pmData.amount += sale.totalAmount
    })

    const paymentMethodBreakdown = Array.from(paymentMethods.values()).map((pm) => ({
      ...pm,
      percentage: (pm.amount / totalSales) * 100,
    }))

    // Get comparison data if requested
    let comparison = null
    if (compareWith && (compareWith === 'previous-period' || compareWith === 'previous-year')) {
      const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

      let compareStart: Date
      let compareEnd: Date

      if (compareWith === 'previous-period') {
        compareEnd = new Date(start)
        compareEnd.setDate(compareEnd.getDate() - 1)
        compareStart = new Date(compareEnd)
        compareStart.setDate(compareStart.getDate() - periodDays)
      } else {
        // previous-year
        compareStart = new Date(start)
        compareStart.setFullYear(compareStart.getFullYear() - 1)
        compareEnd = new Date(end)
        compareEnd.setFullYear(compareEnd.getFullYear() - 1)
      }

      const compareWhere = {
        ...where,
        createdAt: {
          gte: compareStart,
          lte: compareEnd,
        },
      }

      const compareSales = await prisma.sale.aggregate({
        where: compareWhere,
        _sum: {
          totalAmount: true,
        },
        _count: true,
      })

      const previousSales = compareSales._sum.totalAmount || 0
      const previousTransactions = compareSales._count

      comparison = {
        period: compareWith === 'previous-period' ? 'Previous Period' : 'Previous Year',
        previousSales,
        previousTransactions,
        salesGrowth:
          previousSales > 0 ? ((totalSales - previousSales) / previousSales) * 100 : 0,
        transactionGrowth:
          previousTransactions > 0
            ? ((totalTransactions - previousTransactions) / previousTransactions) * 100
            : 0,
      }
    }

    return NextResponse.json({
      kpis: {
        totalSales,
        totalTransactions,
        totalItems,
        totalDiscount,
        totalTax,
        netSales: totalSales - totalTax,
        averageTransactionValue: avgTransactionValue,
        averageItemsPerTransaction: avgItemsPerTransaction,
      },
      trends: {
        daily: dailyTrend,
        hourly: hourlyTrend,
      },
      breakdown: {
        categories: categoryBreakdown,
        paymentMethods: paymentMethodBreakdown,
      },
      topProducts: topSellingProducts,
      comparison,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      },
    })
  } catch (error) {
    console.error('Sales Analytics Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales analytics report' },
      { status: 500 }
    )
  }
}
