import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { Prisma } from '@prisma/client'
import { PERMISSIONS } from '@/lib/rbac'
import { isSuperAdmin } from '@/lib/rbac'

/**
 * GET /api/reports/audit-trail/summary
 * Summary statistics and analytics for audit trail dashboard
 *
 * Query Parameters:
 * - startDate: Start date for analytics (default: 30 days ago)
 * - endDate: End date for analytics (default: now)
 * - businessId: Filter by business ID (super admin only)
 * - groupBy: Grouping level ('day', 'week', 'month')
 * - includeComparison: Include period-over-period comparison (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.AUDIT_LOG_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires AUDIT_LOG_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const filterBusinessId = searchParams.get('businessId')
    const groupBy = searchParams.get('groupBy') || 'day'
    const includeComparison = searchParams.get('includeComparison') === 'true'

    // Validate groupBy
    const allowedGroupBy = ['day', 'week', 'month']
    if (!allowedGroupBy.includes(groupBy)) {
      return NextResponse.json(
        { error: `Invalid groupBy. Allowed: ${allowedGroupBy.join(', ')}` },
        { status: 400 }
      )
    }

    // Set date range
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Previous period for comparison
    let previousStart: Date | null = null
    let previousEnd: Date | null = null
    if (includeComparison) {
      const periodLength = end.getTime() - start.getTime()
      previousEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000) // One day before current period
      previousEnd.setHours(23, 59, 59, 999)
      previousStart = new Date(previousEnd.getTime() - periodLength)
    }

    // Build base where clause
    const baseWhere: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    // Business filtering
    if (!isSuperAdmin(user) || (filterBusinessId && filterBusinessId !== businessId)) {
      if (!isSuperAdmin(user)) {
        baseWhere.businessId = parseInt(businessId)
      } else if (filterBusinessId) {
        baseWhere.businessId = parseInt(filterBusinessId)
      }
    }

    // Previous period where clause
    const previousWhere: any = previousStart && previousEnd ? {
      createdAt: {
        gte: previousStart,
        lte: previousEnd,
      },
    } : null

    // Add business filter to previous period if comparison is enabled
    if (previousWhere) {
      if (!isSuperAdmin(user)) {
        previousWhere.businessId = parseInt(businessId)
      } else if (filterBusinessId) {
        previousWhere.businessId = parseInt(filterBusinessId)
      }
    }

    // Execute all queries in parallel
    const [
      // Current period counts
      totalActivities,
      uniqueUsersCount,
      uniqueBusinessesCount,

      // Previous period counts (optional)
      prevTotalActivities,
      prevUniqueUsersCount,
      prevUniqueBusinessesCount,

      // Distributions and lists
      actionCounts,
      entityCounts,
      userCounts,
      businessCounts,
      passwordProtectedCounts,
      recentActivities,
      topUsers,
      dailyActivities
    ] = await Promise.all([
      prisma.auditLog.count({ where: baseWhere }),
      prisma.auditLog.count({ where: baseWhere, distinct: ['userId'] }),
      prisma.auditLog.count({ where: baseWhere, distinct: ['businessId'] }),

      includeComparison && previousWhere
        ? prisma.auditLog.count({ where: previousWhere })
        : Promise.resolve(null),
      includeComparison && previousWhere
        ? prisma.auditLog.count({ where: previousWhere, distinct: ['userId'] })
        : Promise.resolve(null),
      includeComparison && previousWhere
        ? prisma.auditLog.count({ where: previousWhere, distinct: ['businessId'] })
        : Promise.resolve(null),

      // Action type distribution
      prisma.auditLog.groupBy({
        by: ['action'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
      }),

      // Entity type distribution
      prisma.auditLog.groupBy({
        by: ['entityType'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
      }),

      // Most active users
      prisma.auditLog.groupBy({
        by: ['userId', 'username'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 10,
      }),

      // Business activity (super admin only)
      isSuperAdmin(user)
        ? prisma.auditLog.groupBy({
            by: ['businessId'],
            where: baseWhere,
            _count: { _all: true },
            orderBy: { _count: { _all: 'desc' } },
            take: 10,
          })
        : Promise.resolve([]),

      // Password-protected actions
      prisma.auditLog.groupBy({
        by: ['requiresPassword', 'passwordVerified'],
        where: { ...baseWhere, requiresPassword: true },
        _count: { _all: true },
      }),

      // Recent activities (last 24 hours)
      prisma.auditLog.findMany({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          username: true,
          action: true,
          entityType: true,
          description: true,
          requiresPassword: true,
          passwordVerified: true,
          ipAddress: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // Top users by activity count
      prisma.auditLog.groupBy({
        by: ['username'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 5,
      }),

      // Daily activities for chart (PostgreSQL)
      prisma.$queryRaw(Prisma.sql`
        SELECT
          DATE_TRUNC(${Prisma.raw(groupBy)}, "created_at") as date,
          COUNT(*) as count,
          COUNT(DISTINCT "user_id") as "uniqueUsers",
          COUNT(DISTINCT "business_id") as "uniqueBusinesses",
          COUNT(CASE WHEN "requires_password" = true THEN 1 END) as "passwordProtected",
          COUNT(CASE WHEN "password_verified" = true THEN 1 END) as "passwordVerified"
        FROM "audit_logs"
        WHERE
          "created_at" >= ${start}
          AND "created_at" <= ${end}
          ${!isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(businessId)}` : Prisma.empty}
          ${filterBusinessId && isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(filterBusinessId)}` : Prisma.empty}
        GROUP BY DATE_TRUNC(${Prisma.raw(groupBy)}, "created_at")
        ORDER BY date ASC
      `)
    ])

    // Calculate comparison metrics
    const comparison = includeComparison && prevTotalActivities !== null ? {
      totalActivities: {
        current: totalActivities,
        previous: prevTotalActivities as number,
        change: totalActivities - (prevTotalActivities as number),
        changePercent: (prevTotalActivities as number) > 0
          ? ((totalActivities - (prevTotalActivities as number)) / (prevTotalActivities as number)) * 100
          : null,
      },
      uniqueUsers: {
        current: uniqueUsersCount,
        previous: prevUniqueUsersCount as number,
        change: uniqueUsersCount - (prevUniqueUsersCount as number),
        changePercent: (prevUniqueUsersCount as number) > 0
          ? ((uniqueUsersCount - (prevUniqueUsersCount as number)) / (prevUniqueUsersCount as number)) * 100
          : null,
      },
      uniqueBusinesses: {
        current: uniqueBusinessesCount,
        previous: prevUniqueBusinessesCount as number,
        change: uniqueBusinessesCount - (prevUniqueBusinessesCount as number),
        changePercent: (prevUniqueBusinessesCount as number) > 0
          ? ((uniqueBusinessesCount - (prevUniqueBusinessesCount as number)) / (prevUniqueBusinessesCount as number)) * 100
          : null,
      },
    } : null

    // Get business details for top businesses
    let topBusinesses = []
    if (isSuperAdmin(user) && (businessCounts as any[]).length > 0) {
      const businessIds = (businessCounts as any[]).map((b: any) => b.businessId)
      const businesses = await prisma.business.findMany({
        where: {
          id: { in: businessIds }
        },
        select: {
          id: true,
          name: true,
        }
      })

      topBusinesses = (businessCounts as any[]).map((count: any) => {
        const business = businesses.find(b => b.id === count.businessId)
        return {
          businessId: count.businessId,
          businessName: business?.name || `Business ${count.businessId}`,
          count: count._count.businessId,
        }
      }).sort((a: any, b: any) => b.count - a.count)
    }

    // Format response
    const response = {
      summary: {
        totalActivities,
        uniqueUsers: uniqueUsersCount,
        uniqueBusinesses: uniqueBusinessesCount,
        periodRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        comparison,
      },
      distributions: {
        actionTypes: (actionCounts as any[]).map((item: any) => ({
          action: item.action,
          count: item._count._all,
          percentage: totalActivities > 0 ? (item._count._all / totalActivities) * 100 : 0,
        })),
        entityTypes: (entityCounts as any[]).map((item: any) => ({
          entityType: item.entityType,
          count: item._count._all,
          percentage: totalActivities > 0 ? (item._count._all / totalActivities) * 100 : 0,
        })),
      },
      topUsers: (userCounts as any[]).map((item: any) => ({
        userId: item.userId,
        username: item.username,
        count: item._count._all,
        percentage: totalActivities > 0 ? (item._count._all / totalActivities) * 100 : 0,
      })),
      topBusinesses,
      passwordProtected: {
        total: (passwordProtectedCounts as any[]).reduce((sum: number, item: any) => sum + item._count._all, 0),
        verified: (passwordProtectedCounts as any[])
          .filter((item: any) => item.passwordVerified)
          .reduce((sum: number, item: any) => sum + item._count._all, 0),
        unverified: (passwordProtectedCounts as any[])
          .filter((item: any) => !item.passwordVerified)
          .reduce((sum: number, item: any) => sum + item._count._all, 0),
      },
      recentActivities,
      analytics: {
        dailyActivities: (dailyActivities as any[]).map((item: any) => ({
          date: item.date,
          count: Number(item.count),
          uniqueUsers: Number(item.uniqueUsers),
          uniqueBusinesses: Number(item.uniqueBusinesses),
          passwordProtected: Number(item.passwordProtected),
          passwordVerified: Number(item.passwordVerified),
        })),
        groupBy,
      },
      permissions: {
        isSuperAdmin: isSuperAdmin(user),
        canViewAllBusinesses: isSuperAdmin(user),
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error generating audit trail summary:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate audit trail summary',
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    )
  }
}
