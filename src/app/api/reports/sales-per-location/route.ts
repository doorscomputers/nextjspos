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
    const sortBy = searchParams.get('sortBy') || 'totalSales'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

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

    // Get sales grouped by location
    const sales = await prisma.sale.findMany({
      where,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
      },
    })

    // Group by location
    const locationMap = new Map()

    sales.forEach((sale) => {
      const locationId = sale.locationId
      if (!locationMap.has(locationId)) {
        locationMap.set(locationId, {
          locationId,
          locationName: sale.location?.name || 'N/A',
          locationType: sale.location?.type || 'N/A',
          transactionCount: 0,
          totalSales: 0,
          totalItems: 0,
          totalDiscount: 0,
          totalTax: 0,
          netSales: 0,
          cashiers: new Map(),
          paymentMethods: new Map(),
          dailySales: new Map(),
          hourlySales: new Map(),
        })
      }

      const locationData = locationMap.get(locationId)
      locationData.transactionCount++
      locationData.totalSales += sale.totalAmount
      locationData.totalDiscount += sale.discountAmount
      locationData.totalTax += sale.taxAmount
      locationData.totalItems += sale.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      )

      // Track by cashier
      const cashierId = sale.userId
      const cashierName = sale.user
        ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username
        : 'Unknown'
      if (!locationData.cashiers.has(cashierId)) {
        locationData.cashiers.set(cashierId, {
          name: cashierName,
          count: 0,
          amount: 0,
        })
      }
      const cashierData = locationData.cashiers.get(cashierId)
      cashierData.count++
      cashierData.amount += sale.totalAmount

      // Track by payment method
      const payMethod = sale.paymentMethod
      if (!locationData.paymentMethods.has(payMethod)) {
        locationData.paymentMethods.set(payMethod, {
          count: 0,
          amount: 0,
        })
      }
      const pmData = locationData.paymentMethods.get(payMethod)
      pmData.count++
      pmData.amount += sale.totalAmount

      // Track daily sales
      const dateKey = sale.createdAt.toISOString().split('T')[0]
      if (!locationData.dailySales.has(dateKey)) {
        locationData.dailySales.set(dateKey, {
          count: 0,
          amount: 0,
        })
      }
      const dailyData = locationData.dailySales.get(dateKey)
      dailyData.count++
      dailyData.amount += sale.totalAmount

      // Track hourly sales
      const hour = sale.createdAt.getHours()
      if (!locationData.hourlySales.has(hour)) {
        locationData.hourlySales.set(hour, {
          count: 0,
          amount: 0,
        })
      }
      const hourlyData = locationData.hourlySales.get(hour)
      hourlyData.count++
      hourlyData.amount += sale.totalAmount
    })

    // Convert to array and calculate derived metrics
    let locationSummary = Array.from(locationMap.values()).map((location) => {
      const netSales = location.totalSales - location.totalTax
      const avgTransactionValue =
        location.transactionCount > 0 ? location.totalSales / location.transactionCount : 0
      const avgItemsPerTransaction =
        location.transactionCount > 0 ? location.totalItems / location.transactionCount : 0

      return {
        ...location,
        netSales,
        averageTransactionValue: avgTransactionValue,
        averageItemsPerTransaction: avgItemsPerTransaction,
        cashierBreakdown: Array.from(location.cashiers.entries())
          .map(([id, data]) => ({
            cashierId: id,
            cashierName: data.name,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount),
        paymentMethodBreakdown: Array.from(location.paymentMethods.entries()).map(
          ([method, data]) => ({
            method,
            transactionCount: data.count,
            totalAmount: data.amount,
            percentage: (data.amount / location.totalSales) * 100,
          })
        ),
        dailyPerformance: Array.from(location.dailySales.entries())
          .map(([date, data]) => ({
            date,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        hourlyPerformance: Array.from(location.hourlySales.entries())
          .map(([hour, data]) => ({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            transactionCount: data.count,
            totalAmount: data.amount,
          }))
          .sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      }
    })

    // Remove temporary Map objects
    locationSummary = locationSummary.map(
      ({ cashiers, paymentMethods, dailySales, hourlySales, ...rest }) => rest
    )

    // Sort results
    if (sortBy === 'locationName') {
      locationSummary.sort((a, b) => {
        const aVal = a.locationName.toLowerCase()
        const bVal = b.locationName.toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    } else {
      locationSummary.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number
        const bVal = b[sortBy as keyof typeof b] as number
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Calculate overall summary
    const summary = {
      totalLocations: locationSummary.length,
      totalTransactions: locationSummary.reduce((sum, l) => sum + l.transactionCount, 0),
      totalSales: locationSummary.reduce((sum, l) => sum + l.totalSales, 0),
      totalItems: locationSummary.reduce((sum, l) => sum + l.totalItems, 0),
      totalDiscount: locationSummary.reduce((sum, l) => sum + l.totalDiscount, 0),
      averageSalesPerLocation:
        locationSummary.length > 0
          ? locationSummary.reduce((sum, l) => sum + l.totalSales, 0) / locationSummary.length
          : 0,
      topPerformingLocation: locationSummary.length > 0 ? locationSummary[0] : null,
    }

    return NextResponse.json({
      locations: locationSummary,
      summary,
    })
  } catch (error) {
    console.error('Sales Per Location Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales per location report' },
      { status: 500 }
    )
  }
}
