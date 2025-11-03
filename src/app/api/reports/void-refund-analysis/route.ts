import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/void-refund-analysis
 * Comprehensive analysis of voided and refunded transactions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user
    const businessId = parseInt(user.businessId)

    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const locationIdParam = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const typeParam = searchParams.get('type') // 'void', 'refund', or 'all'
    const cashierIdParam = searchParams.get('cashierId')

    // Default date range: last 30 days
    const today = new Date()
    const defaultStartDate = new Date(today)
    defaultStartDate.setDate(today.getDate() - 30)
    defaultStartDate.setHours(0, 0, 0, 0)

    const startDate = startDateParam ? new Date(startDateParam) : defaultStartDate
    startDate.setHours(0, 0, 0, 0)

    const endDate = endDateParam ? new Date(endDateParam) : new Date(today)
    endDate.setHours(23, 59, 59, 999)

    // Build where clause for voided sales
    const voidedWhere: any = {
      businessId,
      status: 'voided',
      saleDate: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Location access control
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (locationIdParam && locationIdParam !== 'all') {
      const requestedLocationId = parseInt(locationIdParam)
      if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
      voidedWhere.locationId = requestedLocationId
    } else if (accessibleLocationIds !== null) {
      voidedWhere.locationId = { in: accessibleLocationIds }
    }

    // Cashier filter
    if (cashierIdParam && cashierIdParam !== 'all') {
      voidedWhere.createdBy = parseInt(cashierIdParam)
    }

    // Fetch voided sales
    const voidedSales = await prisma.sale.findMany({
      where: voidedWhere,
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        saleDate: 'desc',
      },
    })

    // TODO: Implement refund tracking when refund table is created
    // For now, we'll focus on voids

    // Calculate summary metrics
    const totalVoids = voidedSales.length
    const totalVoidedAmount = voidedSales.reduce(
      (sum, sale) => sum + parseFloat(sale.totalAmount.toString()),
      0
    )

    // Breakdown by location
    const locationBreakdown: Record<string, any> = {}
    const cashierBreakdown: Record<string, any> = {}
    const reasonBreakdown: Record<string, any> = {}
    const dailyBreakdown: Record<string, any> = {}
    const hourlyBreakdown: Record<number, any> = {}

    // Initialize hourly buckets
    for (let hour = 0; hour < 24; hour++) {
      hourlyBreakdown[hour] = {
        hour,
        voidCount: 0,
        voidAmount: 0,
      }
    }

    voidedSales.forEach((sale) => {
      const amount = parseFloat(sale.totalAmount.toString())
      const saleDate = new Date(sale.saleDate)
      const hour = saleDate.getHours()
      const dateKey = saleDate.toISOString().split('T')[0]

      // Location breakdown
      const locationKey = sale.location.name
      if (!locationBreakdown[locationKey]) {
        locationBreakdown[locationKey] = {
          locationId: sale.location.id,
          locationName: locationKey,
          voidCount: 0,
          voidAmount: 0,
        }
      }
      locationBreakdown[locationKey].voidCount++
      locationBreakdown[locationKey].voidAmount += amount

      // Cashier breakdown
      const cashierName = sale.creator
        ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() || sale.creator.username
        : 'Unknown'
      const cashierKey = `${sale.createdBy}-${cashierName}`
      if (!cashierBreakdown[cashierKey]) {
        cashierBreakdown[cashierKey] = {
          cashierId: sale.createdBy,
          cashierName,
          voidCount: 0,
          voidAmount: 0,
        }
      }
      cashierBreakdown[cashierKey].voidCount++
      cashierBreakdown[cashierKey].voidAmount += amount

      // Reason breakdown (from voidReason field if available)
      const reason = (sale as any).voidReason || 'No reason provided'
      if (!reasonBreakdown[reason]) {
        reasonBreakdown[reason] = {
          reason,
          count: 0,
          amount: 0,
        }
      }
      reasonBreakdown[reason].count++
      reasonBreakdown[reason].amount += amount

      // Daily breakdown
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = {
          date: dateKey,
          voidCount: 0,
          voidAmount: 0,
        }
      }
      dailyBreakdown[dateKey].voidCount++
      dailyBreakdown[dateKey].voidAmount += amount

      // Hourly breakdown
      hourlyBreakdown[hour].voidCount++
      hourlyBreakdown[hour].voidAmount += amount
    })

    // Sort breakdowns
    const topLocations = Object.values(locationBreakdown).sort(
      (a: any, b: any) => b.voidCount - a.voidCount
    )

    const topCashiers = Object.values(cashierBreakdown).sort(
      (a: any, b: any) => b.voidCount - a.voidCount
    )

    const topReasons = Object.values(reasonBreakdown)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)

    const dailyTrend = Object.values(dailyBreakdown).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    )

    // Format voided transactions for response
    const formattedVoids = voidedSales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString(),
      totalAmount: parseFloat(sale.totalAmount.toString()),
      voidReason: (sale as any).voidReason || 'No reason provided',
      location: {
        id: sale.location.id,
        name: sale.location.name,
      },
      cashier: {
        id: sale.user?.id,
        name: sale.user
          ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username
          : 'Unknown',
      },
      customer: sale.customer
        ? {
            id: sale.customer.id,
            name: sale.customer.name,
          }
        : null,
    }))

    // Calculate average void amount
    const averageVoidAmount = totalVoids > 0 ? totalVoidedAmount / totalVoids : 0

    // Calculate total sales for comparison (to get void rate)
    const totalSalesWhere = {
      businessId,
      saleDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(locationIdParam && locationIdParam !== 'all'
        ? { locationId: parseInt(locationIdParam) }
        : accessibleLocationIds !== null
        ? { locationId: { in: accessibleLocationIds } }
        : {}),
    }

    const totalSalesCount = await prisma.sale.count({
      where: totalSalesWhere,
    })

    const voidRate = totalSalesCount > 0 ? (totalVoids / totalSalesCount) * 100 : 0

    const summary = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalVoids,
      totalVoidedAmount,
      averageVoidAmount,
      totalSalesInPeriod: totalSalesCount,
      voidRate,
      topLocations,
      topCashiers,
      topReasons,
      dailyTrend,
      hourlyPattern: Object.values(hourlyBreakdown).filter((h: any) => h.voidCount > 0),
    }

    return NextResponse.json({
      summary,
      voidedTransactions: formattedVoids,
    })
  } catch (error: any) {
    console.error('Error generating void/refund analysis report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}
