import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    // Get all active locations for this business
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true, // Only show active locations
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    const now = new Date()
    let startDate: Date
    let groupBy: 'hour' | 'day' | 'week' | 'month'

    switch (period) {
      case 'day':
        // Today's sales by hour
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        groupBy = 'hour'
        break
      case 'month':
        // This month's sales by day
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        groupBy = 'day'
        break
      case 'quarter':
        // This quarter's sales by week
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        groupBy = 'week'
        break
      case 'year':
        // This year's sales by month
        startDate = new Date(now.getFullYear(), 0, 1)
        groupBy = 'month'
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        groupBy = 'hour'
    }

    // Fetch sales data for each location
    const salesByLocation: Record<string, any[]> = {}

    for (const location of locations) {
      const sales = await prisma.sale.findMany({
        where: {
          businessId,
          locationId: location.id,
          saleDate: {
            gte: startDate,
          },
          status: {
            notIn: ['cancelled', 'draft'],
          },
        },
        select: {
          saleDate: true,
          totalAmount: true,
        },
        orderBy: {
          saleDate: 'asc',
        },
      })

      // Group sales by time period
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

      salesByLocation[location.name] = Array.from(grouped.entries()).map(([period, amount]) => ({
        period,
        amount,
      }))
    }

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
