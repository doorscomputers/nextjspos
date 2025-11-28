import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/sales-by-hour
 * Hourly sales breakdown for peak hours analysis and staffing optimization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const userId = parseInt(String(user.id))

    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const locationIdParam = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const dayOfWeekParam = searchParams.get('dayOfWeek') // 0=Sunday, 6=Saturday

    // Default date range: last 7 days
    const today = new Date()
    const defaultStartDate = new Date(today)
    defaultStartDate.setDate(today.getDate() - 7)
    defaultStartDate.setHours(0, 0, 0, 0)

    // Parse dates as local timezone (not UTC)
    // When parsing "YYYY-MM-DD" format, append time to ensure local timezone interpretation
    let startDate: Date
    if (startDateParam) {
      const [year, month, day] = startDateParam.split('-').map(Number)
      startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    } else {
      startDate = defaultStartDate
    }

    let endDate: Date
    if (endDateParam) {
      const [year, month, day] = endDateParam.split('-').map(Number)
      endDate = new Date(year, month - 1, day, 23, 59, 59, 999)
    } else {
      endDate = new Date(today)
      endDate.setHours(23, 59, 59, 999)
    }

    // Build where clause
    // CRITICAL: Include BOTH completed sales AND pending credit sales
    const salesWhere: any = {
      businessId,
      status: { in: ['completed', 'pending'] }, // Include credit sales (pending payment)
      saleDate: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Location access control
    let accessibleLocationIds = getUserAccessibleLocationIds(user)

    if (accessibleLocationIds !== null && accessibleLocationIds.length === 0) {
      const assignments = await prisma.userLocation.findMany({
        where: { userId },
        select: {
          locationId: true,
          location: {
            select: {
              deletedAt: true,
              isActive: true,
            },
          },
        },
      })

      accessibleLocationIds = assignments
        .filter((assignment) => assignment.location && assignment.location.deletedAt === null && assignment.location.isActive !== false)
        .map((assignment) => assignment.locationId)
    }
    if (locationIdParam && locationIdParam !== 'all') {
      const requestedLocationId = parseInt(locationIdParam)
      if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
      salesWhere.locationId = requestedLocationId
    } else if (accessibleLocationIds !== null) {
      salesWhere.locationId = { in: accessibleLocationIds }
    }

    // Fetch all sales in date range
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      select: {
        id: true,
        saleDate: true,
        totalAmount: true,
        discountAmount: true,
        location: {
          select: {
            id: true,
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

    // Process sales by hour
    const hourlyData: Record<number, any> = {}
    const dayOfWeekData: Record<number, any> = {}
    const locationHourlyData: Record<string, Record<number, any>> = {}

    // Initialize hourly buckets (0-23)
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = {
        hour,
        hourLabel: formatHour(hour),
        salesCount: 0,
        totalRevenue: 0,
        totalDiscount: 0,
        averageTransaction: 0,
        transactions: [],
      }
    }

    // Initialize day of week buckets (0=Sunday, 6=Saturday)
    for (let day = 0; day < 7; day++) {
      dayOfWeekData[day] = {
        dayOfWeek: day,
        dayName: getDayName(day),
        salesCount: 0,
        totalRevenue: 0,
        averageTransaction: 0,
      }
    }

    sales.forEach((sale) => {
      const saleDate = new Date(sale.saleDate)
      const hour = saleDate.getHours()
      const dayOfWeek = saleDate.getDay()
      const totalAmount = parseFloat(sale.totalAmount.toString())
      const discountAmount = parseFloat(sale.discountAmount?.toString() || '0')

      // Hourly aggregation
      hourlyData[hour].salesCount++
      hourlyData[hour].totalRevenue += totalAmount
      hourlyData[hour].totalDiscount += discountAmount
      hourlyData[hour].transactions.push({
        id: sale.id,
        time: saleDate.toISOString(),
        amount: totalAmount,
      })

      // Day of week aggregation
      dayOfWeekData[dayOfWeek].salesCount++
      dayOfWeekData[dayOfWeek].totalRevenue += totalAmount

      // Location-hour aggregation
      const locationKey = sale.location.name
      if (!locationHourlyData[locationKey]) {
        locationHourlyData[locationKey] = {}
        for (let h = 0; h < 24; h++) {
          locationHourlyData[locationKey][h] = {
            hour: h,
            salesCount: 0,
            totalRevenue: 0,
          }
        }
      }
      locationHourlyData[locationKey][hour].salesCount++
      locationHourlyData[locationKey][hour].totalRevenue += totalAmount
    })

    // Calculate averages and identify peaks
    let peakHour = 0
    let peakSales = 0
    let peakRevenue = 0
    let peakRevenueHour = 0

    Object.values(hourlyData).forEach((data: any) => {
      if (data.salesCount > 0) {
        data.averageTransaction = data.totalRevenue / data.salesCount
      }
      if (data.salesCount > peakSales) {
        peakSales = data.salesCount
        peakHour = data.hour
      }
      if (data.totalRevenue > peakRevenue) {
        peakRevenue = data.totalRevenue
        peakRevenueHour = data.hour
      }
      // Don't include transactions in final response (too large)
      delete data.transactions
    })

    // Day of week averages
    Object.values(dayOfWeekData).forEach((data: any) => {
      if (data.salesCount > 0) {
        data.averageTransaction = data.totalRevenue / data.salesCount
      }
    })

    // Filter day of week if requested
    let filteredDayOfWeekData = dayOfWeekData
    if (dayOfWeekParam !== null) {
      const requestedDay = parseInt(dayOfWeekParam)
      filteredDayOfWeekData = { [requestedDay]: dayOfWeekData[requestedDay] }
    }

    // Calculate overall summary
    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0)
    const totalDiscount = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.discountAmount?.toString() || '0'),
      0
    )
    const averageTransaction = totalSales > 0 ? totalRevenue / totalSales : 0

    // Identify busy hours (> 75th percentile of sales)
    const salesCounts = Object.values(hourlyData).map((d: any) => d.salesCount)
    const sortedCounts = [...salesCounts].sort((a, b) => a - b)
    const percentile75Index = Math.floor(sortedCounts.length * 0.75)
    const busyThreshold = sortedCounts[percentile75Index]

    const busyHours = Object.values(hourlyData)
      .filter((d: any) => d.salesCount >= busyThreshold && d.salesCount > 0)
      .map((d: any) => ({ hour: d.hour, hourLabel: d.hourLabel, salesCount: d.salesCount }))

    // Identify slow hours (bottom 25th percentile, but > 0)
    const percentile25Index = Math.floor(sortedCounts.length * 0.25)
    const slowThreshold = sortedCounts[percentile25Index]

    const slowHours = Object.values(hourlyData)
      .filter((d: any) => d.salesCount <= slowThreshold && d.salesCount > 0)
      .map((d: any) => ({ hour: d.hour, hourLabel: d.hourLabel, salesCount: d.salesCount }))

    const summary = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalSales,
      totalRevenue,
      totalDiscount,
      averageTransaction,
      peakHour: {
        hour: peakHour,
        hourLabel: formatHour(peakHour),
        salesCount: peakSales,
      },
      peakRevenueHour: {
        hour: peakRevenueHour,
        hourLabel: formatHour(peakRevenueHour),
        revenue: peakRevenue,
      },
      busyHours,
      slowHours,
    }

    return NextResponse.json({
      summary,
      hourlyBreakdown: Object.values(hourlyData),
      dayOfWeekBreakdown: Object.values(filteredDayOfWeekData),
      locationHourlyBreakdown: Object.entries(locationHourlyData).map(([location, hours]) => ({
        location,
        hourlyData: Object.values(hours),
      })),
    })
  } catch (error: any) {
    console.error('Error generating hourly sales report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}

function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day]
}
