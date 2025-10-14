import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')
    const sortBy = searchParams.get('sortBy') || 'totalSales'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {
      businessId: session.user.businessId,
      status: { not: 'VOID' },
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

    // Get sales grouped by cashier
    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: true,
      },
    })

    // Group by cashier
    const cashierMap = new Map()

    sales.forEach((sale) => {
      const cashierId = sale.userId
      if (!cashierMap.has(cashierId)) {
        const cashierName = sale.user
          ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() ||
            sale.user.username
          : 'Unknown'

        cashierMap.set(cashierId, {
          cashierId,
          cashierName,
          username: sale.user?.username || 'N/A',
          transactionCount: 0,
          totalSales: 0,
          totalItems: 0,
          totalDiscount: 0,
          totalTax: 0,
          netSales: 0,
          averageTransactionValue: 0,
          locations: new Map(),
          paymentMethods: new Map(),
          dailySales: new Map(),
        })
      }

      const cashierData = cashierMap.get(cashierId)
      cashierData.transactionCount++
      cashierData.totalSales += sale.totalAmount
      cashierData.totalDiscount += sale.discountAmount
      cashierData.totalTax += sale.taxAmount
      cashierData.totalItems += sale.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      )

      // Track by location
      const locName = sale.location?.name || 'N/A'
      if (!cashierData.locations.has(locName)) {
        cashierData.locations.set(locName, {
          count: 0,
          amount: 0,
        })
      }
      const locData = cashierData.locations.get(locName)
      locData.count++
      locData.amount += sale.totalAmount

      // Track by payment method
      const payMethod = sale.paymentMethod
      if (!cashierData.paymentMethods.has(payMethod)) {
        cashierData.paymentMethods.set(payMethod, {
          count: 0,
          amount: 0,
        })
      }
      const pmData = cashierData.paymentMethods.get(payMethod)
      pmData.count++
      pmData.amount += sale.totalAmount

      // Track daily sales
      const dateKey = sale.createdAt.toISOString().split('T')[0]
      if (!cashierData.dailySales.has(dateKey)) {
        cashierData.dailySales.set(dateKey, {
          count: 0,
          amount: 0,
        })
      }
      const dailyData = cashierData.dailySales.get(dateKey)
      dailyData.count++
      dailyData.amount += sale.totalAmount
    })

    // Convert to array and calculate derived metrics
    let cashierSummary = Array.from(cashierMap.values()).map((cashier) => {
      const netSales = cashier.totalSales - cashier.totalTax
      const avgTransactionValue =
        cashier.transactionCount > 0 ? cashier.totalSales / cashier.transactionCount : 0
      const avgItemsPerTransaction =
        cashier.transactionCount > 0 ? cashier.totalItems / cashier.transactionCount : 0

      return {
        ...cashier,
        netSales,
        averageTransactionValue: avgTransactionValue,
        averageItemsPerTransaction: avgItemsPerTransaction,
        locationBreakdown: Array.from(cashier.locations.entries()).map(([name, data]) => ({
          location: name,
          transactionCount: data.count,
          totalAmount: data.amount,
        })),
        paymentMethodBreakdown: Array.from(cashier.paymentMethods.entries()).map(
          ([method, data]) => ({
            method,
            transactionCount: data.count,
            totalAmount: data.amount,
          })
        ),
        dailyPerformance: Array.from(cashier.dailySales.entries())
          .map(([date, data]) => ({
            date,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }
    })

    // Remove temporary Map objects
    cashierSummary = cashierSummary.map(
      ({ locations, paymentMethods, dailySales, ...rest }) => rest
    )

    // Sort results
    if (sortBy === 'cashierName') {
      cashierSummary.sort((a, b) => {
        const aVal = a.cashierName.toLowerCase()
        const bVal = b.cashierName.toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    } else {
      cashierSummary.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number
        const bVal = b[sortBy as keyof typeof b] as number
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Calculate overall summary
    const summary = {
      totalCashiers: cashierSummary.length,
      totalTransactions: cashierSummary.reduce((sum, c) => sum + c.transactionCount, 0),
      totalSales: cashierSummary.reduce((sum, c) => sum + c.totalSales, 0),
      totalItems: cashierSummary.reduce((sum, c) => sum + c.totalItems, 0),
      totalDiscount: cashierSummary.reduce((sum, c) => sum + c.totalDiscount, 0),
      averageSalesPerCashier:
        cashierSummary.length > 0
          ? cashierSummary.reduce((sum, c) => sum + c.totalSales, 0) / cashierSummary.length
          : 0,
      averageTransactionsPerCashier:
        cashierSummary.length > 0
          ? cashierSummary.reduce((sum, c) => sum + c.transactionCount, 0) /
            cashierSummary.length
          : 0,
    }

    return NextResponse.json({
      cashiers: cashierSummary,
      summary,
    })
  } catch (error) {
    console.error('Sales Per Cashier Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales per cashier report' },
      { status: 500 }
    )
  }
}
