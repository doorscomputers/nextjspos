import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { businessId?: number | string; permissions?: string[] }
    const businessIdRaw = sessionUser.businessId
    const businessId = typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw

    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Check if user has permission to view sales
    const userPermissions = sessionUser.permissions || []
    if (!userPermissions.includes(PERMISSIONS.SELL_VIEW)) {
      // Return empty data structure instead of error for users without permission
      return NextResponse.json({
        period: 'day',
        locations: [],
        salesByLocation: {},
        totals: [],
      })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'day' // day, month, quarter, year

    // Get all active locations for this business (excluding Main Warehouse as it doesn't sell)
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true, // Only show active locations
        NOT: {
          name: {
            contains: 'Main Warehouse',
            mode: 'insensitive',
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // IMPORTANT: Use Philippine Time (Asia/Manila, UTC+8) for date calculations
    // Vercel servers run in UTC, but business operates in Philippine Time
    const nowUtc = new Date()
    const phOffset = 8 * 60 * 60 * 1000 // UTC+8 in milliseconds
    const now = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() * 60 * 1000) + phOffset)

    let startDate: Date
    let groupBy: 'hour' | 'day' | 'week' | 'month'

    switch (period) {
      case 'day':
        // Today's sales by hour (Philippine Time)
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - phOffset)
        groupBy = 'hour'
        break
      case 'month':
        // This month's sales by day (Philippine Time)
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - phOffset)
        groupBy = 'day'
        break
      case 'quarter':
        // This quarter's sales by week (Philippine Time)
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(Date.UTC(now.getFullYear(), quarter * 3, 1) - phOffset)
        groupBy = 'week'
        break
      case 'year':
        // This year's sales by month (Philippine Time)
        startDate = new Date(Date.UTC(now.getFullYear(), 0, 1) - phOffset)
        groupBy = 'month'
        break
      default:
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - phOffset)
        groupBy = 'hour'
    }

    console.log(`[Sales by Location] Period: ${period}, PH Date: ${now.toISOString()}, Start Date: ${startDate.toISOString()}`)

    // OPTIMIZATION: Fetch ALL sales data in a single query instead of N queries (one per location)
    // This eliminates the N+1 query problem
    const startQueryTime = Date.now()

    const allSales = await prisma.sale.findMany({
      where: {
        businessId,
        locationId: { in: locations.map(l => l.id) },
        saleDate: { gte: startDate },
        status: { notIn: ['cancelled', 'draft'] },
      },
      select: {
        locationId: true,
        saleDate: true,
        totalAmount: true,
      },
      orderBy: {
        saleDate: 'asc',
      },
    })

    console.log(`[Sales by Location] Fetched ${allSales.length} sales in ${Date.now() - startQueryTime}ms`)

    // Group sales by location and time period
    const salesByLocation: Record<string, any[]> = {}

    // Initialize empty arrays for each location
    locations.forEach(location => {
      salesByLocation[location.name] = []
    })

    // Create location ID to name map for fast lookup
    const locationIdToName = new Map(locations.map(l => [l.id, l.name]))

    // Group all sales by location first
    const salesByLocationId = new Map<number, typeof allSales>()
    allSales.forEach(sale => {
      if (!salesByLocationId.has(sale.locationId)) {
        salesByLocationId.set(sale.locationId, [])
      }
      salesByLocationId.get(sale.locationId)!.push(sale)
    })

    // Process each location's sales
    salesByLocationId.forEach((sales, locationId) => {
      const locationName = locationIdToName.get(locationId)
      if (!locationName) return

      const grouped = new Map<string, number>()

      sales.forEach((sale) => {
        const date = new Date(sale.saleDate)
        let key: string

        switch (groupBy) {
          case 'hour':
            key = `${date.getHours()}:00`
            break
          case 'day':
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            break
          case 'week':
            const weekStart = new Date(date)
            weekStart.setDate(date.getDate() - date.getDay())
            key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            break
          case 'month':
            key = date.toLocaleDateString('en-US', { month: 'short' })
            break
        }

        const amount = parseFloat(sale.totalAmount.toString())
        grouped.set(key, (grouped.get(key) || 0) + amount)
      })

      salesByLocation[locationName] = Array.from(grouped.entries()).map(([period, amount]) => ({
        period,
        amount,
      }))
    })

    // Calculate totals
    const totals = locations.map((location) => {
      const total = salesByLocation[location.name]?.reduce((sum, item) => sum + item.amount, 0) || 0
      return {
        location: location.name,
        total,
      }
    })

    return NextResponse.json({
      period,
      locations: locations.map((l) => l.name),
      salesByLocation,
      totals,
    })
  } catch (error) {
    console.error('[Dashboard Sales by Location] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch sales by location',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
