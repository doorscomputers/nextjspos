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

    // Build where clause for sales with discounts
    const where: any = {
      businessId: parseInt(session.user.businessId),
      status: { not: 'VOID' },
      discountAmount: { gt: 0 },
    }

    // Date filtering
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Location filtering
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Get all sales (with and without discounts) for comparison
    const allSalesWhere = { ...where }
    delete allSalesWhere.discountAmount

    const [discountedSales, allSales] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
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
          customer: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.sale.aggregate({
        where: allSalesWhere,
        _sum: {
          totalAmount: true,
          discountAmount: true,
        },
        _count: true,
      }),
    ])

    // Group discounts by type (if you have discount type field, otherwise by discount amount ranges)
    const discountTypes = new Map()
    const locationDiscounts = new Map()
    const cashierDiscounts = new Map()
    const customerDiscounts = new Map()
    const dailyDiscounts = new Map()

    discountedSales.forEach((sale) => {
      // Determine discount type based on percentage
      const discountPercent =
        sale.totalAmount > 0
          ? (sale.discountAmount / (sale.totalAmount + sale.discountAmount)) * 100
          : 0

      let discountType = 'Other'
      if (Math.abs(discountPercent - 20) < 1) {
        discountType = 'Senior/PWD (20%)'
      } else if (discountPercent >= 10 && discountPercent < 15) {
        discountType = 'Regular (10-15%)'
      } else if (discountPercent >= 5 && discountPercent < 10) {
        discountType = 'Small (5-10%)'
      } else if (discountPercent < 5) {
        discountType = 'Minimal (<5%)'
      } else if (discountPercent > 20) {
        discountType = 'Large (>20%)'
      }

      // Track by discount type
      if (!discountTypes.has(discountType)) {
        discountTypes.set(discountType, {
          type: discountType,
          count: 0,
          totalDiscount: 0,
          totalSales: 0,
        })
      }
      const typeData = discountTypes.get(discountType)
      typeData.count++
      typeData.totalDiscount += sale.discountAmount
      typeData.totalSales += sale.totalAmount

      // Track by location
      const locName = sale.location?.name || 'N/A'
      if (!locationDiscounts.has(locName)) {
        locationDiscounts.set(locName, {
          location: locName,
          count: 0,
          totalDiscount: 0,
          totalSales: 0,
        })
      }
      const locData = locationDiscounts.get(locName)
      locData.count++
      locData.totalDiscount += sale.discountAmount
      locData.totalSales += sale.totalAmount

      // Track by cashier
      const cashierId = sale.userId
      const cashierName = sale.user
        ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username
        : 'Unknown'
      if (!cashierDiscounts.has(cashierId)) {
        cashierDiscounts.set(cashierId, {
          cashierId,
          cashierName,
          count: 0,
          totalDiscount: 0,
          totalSales: 0,
        })
      }
      const cashierData = cashierDiscounts.get(cashierId)
      cashierData.count++
      cashierData.totalDiscount += sale.discountAmount
      cashierData.totalSales += sale.totalAmount

      // Track by customer (for customers with discounts)
      if (sale.customerId && sale.customer) {
        const customerId = sale.customerId
        if (!customerDiscounts.has(customerId)) {
          customerDiscounts.set(customerId, {
            customerId,
            customerName: sale.customer.name,
            count: 0,
            totalDiscount: 0,
            totalSales: 0,
          })
        }
        const customerData = customerDiscounts.get(customerId)
        customerData.count++
        customerData.totalDiscount += sale.discountAmount
        customerData.totalSales += sale.totalAmount
      }

      // Track daily discounts
      const dateKey = sale.createdAt.toISOString().split('T')[0]
      if (!dailyDiscounts.has(dateKey)) {
        dailyDiscounts.set(dateKey, {
          date: dateKey,
          count: 0,
          totalDiscount: 0,
          totalSales: 0,
        })
      }
      const dailyData = dailyDiscounts.get(dateKey)
      dailyData.count++
      dailyData.totalDiscount += sale.discountAmount
      dailyData.totalSales += sale.totalAmount
    })

    // Calculate percentages
    const calculateWithPercentage = (item: any) => ({
      ...item,
      averageDiscount: item.count > 0 ? item.totalDiscount / item.count : 0,
      discountPercentage:
        item.totalSales > 0
          ? (item.totalDiscount / (item.totalSales + item.totalDiscount)) * 100
          : 0,
    })

    // Convert to arrays
    const discountTypeBreakdown = Array.from(discountTypes.values())
      .map(calculateWithPercentage)
      .sort((a, b) => b.totalDiscount - a.totalDiscount)

    const locationBreakdown = Array.from(locationDiscounts.values())
      .map(calculateWithPercentage)
      .sort((a, b) => b.totalDiscount - a.totalDiscount)

    const cashierBreakdown = Array.from(cashierDiscounts.values())
      .map(calculateWithPercentage)
      .sort((a, b) => b.totalDiscount - a.totalDiscount)

    const customerBreakdown = Array.from(customerDiscounts.values())
      .map(calculateWithPercentage)
      .sort((a, b) => b.totalDiscount - a.totalDiscount)
      .slice(0, 20) // Top 20 customers

    const dailyTrend = Array.from(dailyDiscounts.values())
      .map(calculateWithPercentage)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate summary
    const totalDiscountAmount = allSales._sum.discountAmount || 0
    const totalSalesAmount = allSales._sum.totalAmount || 0
    const totalTransactions = allSales._count
    const discountedTransactions = discountedSales.length

    const summary = {
      totalDiscountAmount,
      totalSalesAmount,
      totalTransactions,
      discountedTransactions,
      discountRate: (discountedTransactions / totalTransactions) * 100,
      averageDiscount:
        discountedTransactions > 0 ? totalDiscountAmount / discountedTransactions : 0,
      discountImpact:
        totalSalesAmount > 0
          ? (totalDiscountAmount / (totalSalesAmount + totalDiscountAmount)) * 100
          : 0,
    }

    return NextResponse.json({
      summary,
      breakdown: {
        byType: discountTypeBreakdown,
        byLocation: locationBreakdown,
        byCashier: cashierBreakdown,
        byCustomer: customerBreakdown,
      },
      trend: dailyTrend,
    })
  } catch (error) {
    console.error('Discount Analysis Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate discount analysis report' },
      { status: 500 }
    )
  }
}
