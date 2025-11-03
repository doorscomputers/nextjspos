import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
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
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Build where clause
    const where: any = {
      businessId: parseInt(session.user.businessId),
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

    // Get sales grouped by payment method
    const sales = await prisma.sale.findMany({
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
      },
    })

    // Group by payment method
    const paymentMap = new Map()

    sales.forEach((sale) => {
      const method = sale.paymentMethod
      if (!paymentMap.has(method)) {
        paymentMap.set(method, {
          method,
          transactionCount: 0,
          totalAmount: 0,
          locations: new Map(),
          cashiers: new Map(),
          dailyTrend: new Map(),
        })
      }

      const paymentData = paymentMap.get(method)
      paymentData.transactionCount++
      paymentData.totalAmount += sale.totalAmount

      // Track by location
      const locName = sale.location?.name || 'N/A'
      if (!paymentData.locations.has(locName)) {
        paymentData.locations.set(locName, {
          count: 0,
          amount: 0,
        })
      }
      const locData = paymentData.locations.get(locName)
      locData.count++
      locData.amount += sale.totalAmount

      // Track by cashier
      const cashierId = sale.userId
      const cashierName = sale.user
        ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username
        : 'Unknown'
      if (!paymentData.cashiers.has(cashierId)) {
        paymentData.cashiers.set(cashierId, {
          name: cashierName,
          count: 0,
          amount: 0,
        })
      }
      const cashierData = paymentData.cashiers.get(cashierId)
      cashierData.count++
      cashierData.amount += sale.totalAmount

      // Track daily trend
      const dateKey = sale.createdAt.toISOString().split('T')[0]
      if (!paymentData.dailyTrend.has(dateKey)) {
        paymentData.dailyTrend.set(dateKey, {
          date: dateKey,
          count: 0,
          amount: 0,
        })
      }
      const dailyData = paymentData.dailyTrend.get(dateKey)
      dailyData.count++
      dailyData.amount += sale.totalAmount
    })

    // Calculate total for percentages
    const totalSales = Array.from(paymentMap.values()).reduce(
      (sum, pm) => sum + pm.totalAmount,
      0
    )
    const totalTransactions = Array.from(paymentMap.values()).reduce(
      (sum, pm) => sum + pm.transactionCount,
      0
    )

    // Convert to array and calculate derived metrics
    let paymentSummary = Array.from(paymentMap.values()).map((payment) => {
      const avgTransactionValue =
        payment.transactionCount > 0 ? payment.totalAmount / payment.transactionCount : 0

      return {
        ...payment,
        percentage: totalSales > 0 ? (payment.totalAmount / totalSales) * 100 : 0,
        transactionPercentage:
          totalTransactions > 0 ? (payment.transactionCount / totalTransactions) * 100 : 0,
        averageTransactionValue: avgTransactionValue,
        locationBreakdown: Array.from(payment.locations.entries())
          .map(([name, data]) => ({
            location: name,
            transactionCount: data.count,
            totalAmount: data.amount,
            percentage: (data.amount / payment.totalAmount) * 100,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount),
        cashierBreakdown: Array.from(payment.cashiers.entries())
          .map(([id, data]) => ({
            cashierId: id,
            cashierName: data.name,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 10), // Top 10 cashiers
        dailyTrend: Array.from(payment.dailyTrend.entries())
          .map(([date, data]) => ({
            date: data.date,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }
    })

    // Remove temporary Map objects
    paymentSummary = paymentSummary.map(
      ({ locations, cashiers, dailyTrend, ...rest }) => ({
        ...rest,
        locationBreakdown: paymentSummary.find((p) => p.method === rest.method)
          ?.locationBreakdown,
        cashierBreakdown: paymentSummary.find((p) => p.method === rest.method)?.cashierBreakdown,
        dailyTrend: paymentSummary.find((p) => p.method === rest.method)?.dailyTrend,
      })
    )

    // Sort by total amount
    paymentSummary.sort((a, b) => b.totalAmount - a.totalAmount)

    // Calculate summary
    const summary = {
      totalSales,
      totalTransactions,
      paymentMethodCount: paymentSummary.length,
      mostUsedMethod:
        paymentSummary.length > 0
          ? {
              method: paymentSummary[0].method,
              transactionCount: paymentSummary[0].transactionCount,
              percentage: paymentSummary[0].transactionPercentage,
            }
          : null,
      highestRevenueMethod:
        paymentSummary.length > 0
          ? {
              method: paymentSummary[0].method,
              amount: paymentSummary[0].totalAmount,
              percentage: paymentSummary[0].percentage,
            }
          : null,
    }

    return NextResponse.json({
      paymentMethods: paymentSummary,
      summary,
    })
  } catch (error) {
    console.error('Payment Method Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate payment method report' },
      { status: 500 }
    )
  }
}
