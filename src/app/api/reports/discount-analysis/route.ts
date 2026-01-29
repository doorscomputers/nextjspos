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

    // Get businessId - handle both string and number types
    const sessionUser = session.user as { businessId?: string | number }
    const businessId = typeof sessionUser.businessId === 'string'
      ? parseInt(sessionUser.businessId)
      : sessionUser.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    console.log('[Discount Analysis] Query params:', { startDate, endDate, locationId, businessId })

    // Build where clause for sales with discounts
    // CRITICAL: Exclude voided sales AND exchange/replacement transactions
    // Exchange discountAmount represents returned item value, NOT an actual discount
    const where: any = {
      businessId,
      status: { not: 'voided' }, // Fixed: status is lowercase in database
      discountAmount: { gt: 0 },
      saleType: 'regular', // Only count discounts from regular sales (exclude exchange/replacement)
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
      where.locationId = locationId
    }

    // Get all sales (with and without discounts) for comparison
    const allSalesWhere = { ...where }
    delete allSalesWhere.discountAmount

    console.log('[Discount Analysis] Where clause:', JSON.stringify(where, null, 2))

    const [discountedSales, allSales] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          location: {
            select: {
              name: true,
            },
          },
          creator: {
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
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              discountAmount: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
              productVariation: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
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

    console.log('[Discount Analysis] Found', discountedSales.length, 'discounted sales, allSales count:', allSales._count)

    // Group discounts by type (if you have discount type field, otherwise by discount amount ranges)
    const discountTypes = new Map()
    const locationDiscounts = new Map()
    const cashierDiscounts = new Map()
    const customerDiscounts = new Map()
    const dailyDiscounts = new Map()

    discountedSales.forEach((sale) => {
      // Convert Decimal to number for arithmetic
      const discountAmt = parseFloat(sale.discountAmount?.toString() || '0')
      const totalAmt = parseFloat(sale.totalAmount?.toString() || '0')

      // Determine discount type based on percentage
      const discountPercent =
        totalAmt > 0
          ? (discountAmt / (totalAmt + discountAmt)) * 100
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
      typeData.totalDiscount += discountAmt
      typeData.totalSales += totalAmt

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
      locData.totalDiscount += discountAmt
      locData.totalSales += totalAmt

      // Track by cashier
      const cashierId = sale.createdBy
      const cashierName = sale.creator
        ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() || sale.creator.username
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
      cashierData.totalDiscount += discountAmt
      cashierData.totalSales += totalAmt

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
        customerData.totalDiscount += discountAmt
        customerData.totalSales += totalAmt
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
      dailyData.totalDiscount += discountAmt
      dailyData.totalSales += totalAmt
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

    // Calculate summary - convert Decimal to number
    const totalDiscountAmount = parseFloat(allSales._sum.discountAmount?.toString() || '0')
    const totalSalesAmount = parseFloat(allSales._sum.totalAmount?.toString() || '0')
    const totalTransactions = allSales._count || 0
    const discountedTransactions = discountedSales.length

    const summary = {
      totalDiscountAmount,
      totalSalesAmount,
      totalTransactions,
      discountedTransactions,
      discountRate: totalTransactions > 0 ? (discountedTransactions / totalTransactions) * 100 : 0,
      averageDiscount:
        discountedTransactions > 0 ? totalDiscountAmount / discountedTransactions : 0,
      discountImpact:
        totalSalesAmount > 0
          ? (totalDiscountAmount / (totalSalesAmount + totalDiscountAmount)) * 100
          : 0,
    }

    // Build detailed transactions list (limit to 500 for performance)
    const detailedTransactions = discountedSales.slice(0, 500).map((sale) => ({
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      createdAt: sale.createdAt,
      location: sale.location?.name || 'N/A',
      cashier: sale.creator
        ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() || sale.creator.username
        : 'Unknown',
      customer: sale.customer?.name || 'Walk-in',
      totalAmount: parseFloat(sale.totalAmount?.toString() || '0'),
      discountAmount: parseFloat(sale.discountAmount?.toString() || '0'),
      discountPercent: parseFloat(sale.totalAmount?.toString() || '0') > 0
        ? (parseFloat(sale.discountAmount?.toString() || '0') / (parseFloat(sale.totalAmount?.toString() || '0') + parseFloat(sale.discountAmount?.toString() || '0'))) * 100
        : 0,
      items: sale.items.map((item) => ({
        id: item.id,
        productName: item.product?.name || 'Unknown Product',
        sku: item.product?.sku || '',
        variationName: item.productVariation?.name || '',
        quantity: parseFloat(item.quantity?.toString() || '0'),
        unitPrice: parseFloat(item.unitPrice?.toString() || '0'),
        totalPrice: parseFloat(item.totalPrice?.toString() || '0'),
        discountAmount: parseFloat(item.discountAmount?.toString() || '0'),
      })),
    }))

    return NextResponse.json({
      summary,
      breakdown: {
        byType: discountTypeBreakdown,
        byLocation: locationBreakdown,
        byCashier: cashierBreakdown,
        byCustomer: customerBreakdown,
      },
      trend: dailyTrend,
      detailedTransactions,
    })
  } catch (error) {
    console.error('Discount Analysis Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate discount analysis report' },
      { status: 500 }
    )
  }
}
