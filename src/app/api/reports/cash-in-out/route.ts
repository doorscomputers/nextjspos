import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/cash-in-out
 * Comprehensive Cash In/Out Report with date filtering, location filtering, and summary
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
    const locationIdParam = searchParams.get('locationId')
    const cashierIdParam = searchParams.get('cashierId')
    const typeParam = searchParams.get('type') // 'cash_in', 'cash_out', or 'all'
    const searchParam = searchParams.get('search') || ''

    // Default date range: last 30 days
    const today = new Date()
    const defaultStartDate = new Date(today)
    defaultStartDate.setDate(today.getDate() - 30)
    defaultStartDate.setHours(0, 0, 0, 0)

    const startDate = startDateParam ? new Date(startDateParam) : defaultStartDate
    startDate.setHours(0, 0, 0, 0)

    const endDate = endDateParam ? new Date(endDateParam) : new Date(today)
    endDate.setHours(23, 59, 59, 999)

    // Build where clause
    const cashInOutWhere: any = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Location access control
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (locationIdParam && locationIdParam !== 'all') {
      const requestedLocationId = parseInt(locationIdParam)
      // Check if user has access to this location
      if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
      cashInOutWhere.locationId = requestedLocationId
    } else if (accessibleLocationIds !== null) {
      // Restrict to accessible locations
      cashInOutWhere.locationId = { in: accessibleLocationIds }
    }

    // Type filter
    if (typeParam && typeParam !== 'all') {
      cashInOutWhere.type = typeParam
    }

    // Cashier filter
    if (cashierIdParam && cashierIdParam !== 'all') {
      cashInOutWhere.createdBy = parseInt(cashierIdParam)
    }

    // Search filter (reason field)
    if (searchParam) {
      cashInOutWhere.reason = {
        contains: searchParam,
        mode: 'insensitive',
      }
    }

    // Fetch cash in/out records
    const records = await prisma.cashInOut.findMany({
      where: cashInOutWhere,
      include: {
        cashierShift: {
          select: {
            id: true,
            shiftNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Fetch locations separately
    const locationIds = [...new Set(records.map(r => r.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    })
    const locationMap = new Map(locations.map(l => [l.id, l]))

    // Fetch users (creators) separately
    const userIds = [...new Set(records.map(r => r.createdBy))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, firstName: true, lastName: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    // Calculate summary metrics
    let totalCashIn = 0
    let totalCashOut = 0
    let countCashIn = 0
    let countCashOut = 0
    const locationBreakdown: Record<string, any> = {}
    const cashierBreakdown: Record<string, any> = {}
    const dailyBreakdown: Record<string, any> = {}
    const reasonBreakdown: Record<string, any> = {}

    records.forEach((record) => {
      const amount = parseFloat(record.amount.toString())
      const recordDate = new Date(record.createdAt).toISOString().split('T')[0]

      if (record.type === 'cash_in') {
        totalCashIn += amount
        countCashIn++
      } else {
        totalCashOut += amount
        countCashOut++
      }

      // Location breakdown
      const location = locationMap.get(record.locationId)
      const locationKey = location?.name || 'Unknown Location'
      if (!locationBreakdown[locationKey]) {
        locationBreakdown[locationKey] = {
          locationId: record.locationId,
          locationName: locationKey,
          cashIn: 0,
          cashOut: 0,
          netCash: 0,
          count: 0,
        }
      }
      if (record.type === 'cash_in') {
        locationBreakdown[locationKey].cashIn += amount
      } else {
        locationBreakdown[locationKey].cashOut += amount
      }
      locationBreakdown[locationKey].netCash =
        locationBreakdown[locationKey].cashIn - locationBreakdown[locationKey].cashOut
      locationBreakdown[locationKey].count++

      // Cashier breakdown
      const creator = userMap.get(record.createdBy)
      const cashierName = creator
        ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() ||
          creator.username
        : 'Unknown'
      const cashierKey = `${record.createdBy}-${cashierName}`
      if (!cashierBreakdown[cashierKey]) {
        cashierBreakdown[cashierKey] = {
          cashierId: record.createdBy,
          cashierName,
          cashIn: 0,
          cashOut: 0,
          netCash: 0,
          count: 0,
        }
      }
      if (record.type === 'cash_in') {
        cashierBreakdown[cashierKey].cashIn += amount
      } else {
        cashierBreakdown[cashierKey].cashOut += amount
      }
      cashierBreakdown[cashierKey].netCash =
        cashierBreakdown[cashierKey].cashIn - cashierBreakdown[cashierKey].cashOut
      cashierBreakdown[cashierKey].count++

      // Daily breakdown
      if (!dailyBreakdown[recordDate]) {
        dailyBreakdown[recordDate] = {
          date: recordDate,
          cashIn: 0,
          cashOut: 0,
          netCash: 0,
          count: 0,
        }
      }
      if (record.type === 'cash_in') {
        dailyBreakdown[recordDate].cashIn += amount
      } else {
        dailyBreakdown[recordDate].cashOut += amount
      }
      dailyBreakdown[recordDate].netCash =
        dailyBreakdown[recordDate].cashIn - dailyBreakdown[recordDate].cashOut
      dailyBreakdown[recordDate].count++

      // Reason breakdown (top reasons)
      if (!reasonBreakdown[record.reason]) {
        reasonBreakdown[record.reason] = {
          reason: record.reason,
          cashIn: 0,
          cashOut: 0,
          count: 0,
        }
      }
      if (record.type === 'cash_in') {
        reasonBreakdown[record.reason].cashIn += amount
      } else {
        reasonBreakdown[record.reason].cashOut += amount
      }
      reasonBreakdown[record.reason].count++
    })

    // Net cash flow
    const netCashFlow = totalCashIn - totalCashOut

    // Sort breakdowns
    const topLocations = Object.values(locationBreakdown).sort(
      (a: any, b: any) => Math.abs(b.netCash) - Math.abs(a.netCash)
    )

    const topCashiers = Object.values(cashierBreakdown).sort(
      (a: any, b: any) => b.count - a.count
    )

    const dailyTrend = Object.values(dailyBreakdown).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    )

    const topReasons = Object.values(reasonBreakdown)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)

    // Format records for response
    const formattedRecords = records.map((record) => {
      const location = locationMap.get(record.locationId)
      const creator = userMap.get(record.createdBy)

      return {
        id: record.id,
        date: record.createdAt.toISOString(),
        type: record.type,
        amount: parseFloat(record.amount.toString()),
        reason: record.reason,
        referenceNumber: record.referenceNumber,
        location: location
          ? {
              id: location.id,
              name: location.name,
            }
          : {
              id: record.locationId,
              name: 'Unknown Location',
            },
        shift: record.cashierShift
          ? {
              id: record.cashierShift.id,
              shiftNumber: record.cashierShift.shiftNumber,
            }
          : null,
        cashier: {
          id: creator?.id || record.createdBy,
          name: creator
            ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() ||
              creator.username
            : 'Unknown',
          username: creator?.username || 'unknown',
        },
        requiresApproval: record.requiresApproval,
      }
    })

    const summary = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalRecords: records.length,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      countCashIn,
      countCashOut,
      averageCashIn: countCashIn > 0 ? totalCashIn / countCashIn : 0,
      averageCashOut: countCashOut > 0 ? totalCashOut / countCashOut : 0,
      topLocations,
      topCashiers,
      dailyTrend,
      topReasons,
    }

    return NextResponse.json({
      summary,
      records: formattedRecords,
    })
  } catch (error: any) {
    console.error('Error generating cash in/out report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}
