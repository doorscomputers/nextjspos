import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { PERMISSIONS } from '@/lib/rbac'
import { isSuperAdmin } from '@/lib/rbac'

/**
 * GET /api/reports/audit-trail/security
 * Security analysis and anomaly detection for audit trail
 *
 * Query Parameters:
 * - startDate: Start date for analysis (default: 7 days ago)
 * - endDate: End date for analysis (default: now)
 * - businessId: Filter by business ID (super admin only)
 * - analysisType: Type of analysis ('all', 'suspicious', 'high-risk', 'patterns')
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
    const analysisType = searchParams.get('analysisType') || 'all'

    // Validate analysisType
    const allowedTypes = ['all', 'suspicious', 'high-risk', 'patterns']
    if (!allowedTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: `Invalid analysisType. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Set date range (default to 7 days for security analysis)
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

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

    // Execute security analysis queries
    const [
      allAuditLogs,
      bulkOperations,
      unusualIPActivity,
      failedPasswordAttempts,
      userBehaviorAnalysis,
      timePatternAnalysis,
      riskScoreAnalysis,
      privilegedOperations
    ] = await Promise.all([
      // Get all audit logs for analysis
      prisma.auditLog.findMany({
        where: baseWhere,
        select: {
          id: { select: { id: true, name: true } },
          userId: { select: { id: true, name: true } },
          username: { select: { id: true, name: true } },
          action: { select: { id: true, name: true } },
          entityType: { select: { id: true, name: true } },
          entityIds: { select: { id: true, name: true } },
          description: { select: { id: true, name: true } },
          requiresPassword: { select: { id: true, name: true } },
          passwordVerified: { select: { id: true, name: true } },
          ipAddress: { select: { id: true, name: true } },
          userAgent: { select: { id: true, name: true } },
          createdAt: { select: { id: true, name: true } },
          businessId: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Bulk operations (potentially risky)
      prisma.auditLog.groupBy({
        by: ['userId', 'username', 'action', 'entityType'],
        where: {
          ...baseWhere,
          action: {
            in: ['bulk_delete', 'bulk_deactivate', 'bulk_remove_from_location']
          },
        },
        _count: {
          action: { select: { id: true, name: true } },
        },
        _sum: {
          // Note: entityIds is a text field, we'll calculate this in application logic
        },
        having: {
          action: {
            _count: {
              gt: 5, // More than 5 bulk operations
            },
          },
        },
      }),

      // Unusual IP activity (multiple users from same IP, or single user from multiple IPs)
      prisma.$queryRaw(Prisma.sql`
        SELECT
          "ip_address" as "ipAddress",
          COUNT(DISTINCT "user_id") as "uniqueUsers",
          COUNT(*) as totalActivities,
          ARRAY_AGG(DISTINCT "username") as usernames
        FROM "audit_logs"
        WHERE
          "created_at" >= ${start}
          AND "created_at" <= ${end}
          ${!isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(businessId)}` : Prisma.empty}
          ${filterBusinessId && isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(filterBusinessId)}` : Prisma.empty}
          AND "ip_address" IS NOT NULL
        GROUP BY "ip_address"
        HAVING COUNT(DISTINCT "user_id") > 1 OR COUNT(*) > 50
        ORDER BY totalActivities DESC
      `),

      // Failed password verification attempts
      prisma.auditLog.groupBy({
        by: ['userId', 'username', 'ipAddress'],
        where: {
          ...baseWhere,
          requiresPassword: { select: { id: true, name: true } },
          passwordVerified: false,
        },
        _count: {
          userId: { select: { id: true, name: true } },
        },
        having: {
          userId: {
            _count: {
              gt: 2, // More than 2 failed attempts
            },
          },
        },
      }),

      // User behavior analysis (unusual activity patterns)
      prisma.$queryRaw(Prisma.sql`
        SELECT
          "user_id" as "userId",
          "username",
          COUNT(*) as totalActivities,
          COUNT(DISTINCT DATE("created_at")) as activeDays,
          COUNT(DISTINCT "action") as uniqueActionTypes,
          COUNT(DISTINCT "entityType") as uniqueEntityTypes,
          MAX("created_at") as lastActivity,
          MIN("created_at") as firstActivity
        FROM "audit_logs"
        WHERE
          "created_at" >= ${start}
          AND "created_at" <= ${end}
          ${!isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(businessId)}` : Prisma.empty}
          ${filterBusinessId && isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(filterBusinessId)}` : Prisma.empty}
        GROUP BY "user_id", "username"
        HAVING COUNT(*) > 100 OR COUNT(DISTINCT DATE("created_at")) > 5
        ORDER BY totalActivities DESC
      `),

      // Time pattern analysis (off-hours activity)
      prisma.$queryRaw(Prisma.sql`
        SELECT
          EXTRACT(HOUR FROM "created_at") as hour,
          COUNT(*) as activityCount,
          COUNT(DISTINCT "user_id") as uniqueUsers
        FROM "audit_logs"
        WHERE
          "created_at" >= ${start}
          AND "created_at" <= ${end}
          ${!isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(businessId)}` : Prisma.empty}
          ${filterBusinessId && isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(filterBusinessId)}` : Prisma.empty}
        GROUP BY EXTRACT(HOUR FROM "created_at")
        ORDER BY hour ASC
      `),

      // Risk score analysis based on various factors
      prisma.$queryRaw(Prisma.sql`
        SELECT
          "user_id" as "userId",
          "username",
          "ip_address" as "ipAddress",
          COUNT(*) as totalActivities,
          COUNT(CASE WHEN "requires_password" = true THEN 1 END) as passwordProtected,
          COUNT(CASE WHEN "action" IN ('bulk_delete', 'bulk_deactivate') THEN 1 END) as highRiskActions,
          COUNT(CASE WHEN EXTRACT(HOUR FROM "created_at") NOT BETWEEN 8 AND 18 THEN 1 END) as offHoursActivity,
          MAX("created_at") as lastActivity
        FROM "audit_logs"
        WHERE
          "created_at" >= ${start}
          AND "created_at" <= ${end}
          ${!isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(businessId)}` : Prisma.empty}
          ${filterBusinessId && isSuperAdmin(user) ? Prisma.sql`AND "business_id" = ${parseInt(filterBusinessId)}` : Prisma.empty}
        GROUP BY "user_id", "username", "ip_address"
        HAVING COUNT(*) > 20 OR COUNT(CASE WHEN "action" IN ('bulk_delete', 'bulk_deactivate') THEN 1 END) > 0
        ORDER BY highRiskActions DESC, offHoursActivity DESC
      `),

      // Privileged operations tracking
      prisma.auditLog.findMany({
        where: {
          ...baseWhere,
          OR: [
            { requiresPassword: { select: { id: true, name: true } } },
            { action: { in: ['bulk_delete', 'bulk_deactivate', 'bulk_remove_from_location'] } },
            { entityType: { in: ['user', 'role'] } },
          ],
        },
        select: {
          id: { select: { id: true, name: true } },
          userId: { select: { id: true, name: true } },
          username: { select: { id: true, name: true } },
          action: { select: { id: true, name: true } },
          entityType: { select: { id: true, name: true } },
          description: { select: { id: true, name: true } },
          requiresPassword: { select: { id: true, name: true } },
          passwordVerified: { select: { id: true, name: true } },
          ipAddress: { select: { id: true, name: true } },
          createdAt: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    // Analyze data and identify anomalies
    const suspiciousIPs = (unusualIPActivity as any[]).filter((ip: any) => {
      const uniqueUsers = parseInt(ip.uniqueUsers)
      const totalActivities = parseInt(ip.totalActivities)
      return uniqueUsers > 3 || totalActivities > 100
    })

    const highRiskUsers = (userBehaviorAnalysis as any[]).filter((user: any) => {
      const totalActivities = parseInt(user.totalActivities)
      const activeDays = parseInt(user.activeDays)
      return totalActivities > 500 || activeDays > 6
    })

    const offHoursActivity = (timePatternAnalysis as any[]).filter((hour: any) => {
      const hourNum = parseInt(hour.hour)
      return hourNum < 8 || hourNum > 18
    }).reduce((sum: number, hour: any) => sum + parseInt(hour.activityCount), 0)

    // Calculate risk scores
    const riskAnalysis = (riskScoreAnalysis as any[]).map((item: any) => {
      const totalActivities = parseInt(item.totalActivities)
      const passwordProtected = parseInt(item.passwordProtected)
      const highRiskActions = parseInt(item.highRiskActions)
      const offHours = parseInt(item.offHoursActivity)

      // Simple risk scoring algorithm
      let riskScore = 0
      if (highRiskActions > 0) riskScore += highRiskActions * 20
      if (offHours > 0) riskScore += offHours * 5
      if (passwordProtected > 0) riskScore += passwordProtected * 10
      if (totalActivities > 100) riskScore += (totalActivities - 100) * 2

      return {
        userId: item.userId,
        username: item.username,
        ipAddress: item.ipAddress,
        riskScore,
        riskLevel: riskScore >= 100 ? 'high' : riskScore >= 50 ? 'medium' : 'low',
        totalActivities,
        highRiskActions,
        offHoursActivity: offHours,
        passwordProtected,
        lastActivity: item.lastActivity,
      }
    }).sort((a: any, b: any) => b.riskScore - a.riskScore)

    // Filter results based on analysis type
    let filteredResults = {
      suspiciousIPs,
      highRiskUsers,
      bulkOperations,
      failedPasswordAttempts,
      riskAnalysis,
      privilegedOperations,
    }

    if (analysisType === 'suspicious') {
      filteredResults = {
        suspiciousIPs,
        highRiskUsers: highRiskUsers.slice(0, 10),
        bulkOperations: bulkOperations.slice(0, 5),
        failedPasswordAttempts: failedPasswordAttempts.slice(0, 5),
        riskAnalysis: riskAnalysis.filter((r: any) => r.riskLevel === 'high').slice(0, 10),
        privilegedOperations: privilegedOperations.filter((op: any) => !op.passwordVerified).slice(0, 10),
      }
    } else if (analysisType === 'high-risk') {
      filteredResults = {
        suspiciousIPs: [],
        highRiskUsers: [],
        bulkOperations: [],
        failedPasswordAttempts: [],
        riskAnalysis: riskAnalysis.filter((r: any) => r.riskLevel === 'high'),
        privilegedOperations: privilegedOperations.filter((op: any) => !op.passwordVerified),
      }
    }

    // Format response
    const response = {
      summary: {
        analysisPeriod: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        totalAuditLogs: allAuditLogs.length,
        suspiciousIPCount: suspiciousIPs.length,
        highRiskUserCount: highRiskUsers.length,
        bulkOperationCount: bulkOperations.length,
        failedPasswordAttempts: failedPasswordAttempts.length,
        offHoursActivity,
        analysisType,
      },
      riskIndicators: {
        suspiciousIPActivity: suspiciousIPs.map((ip: any) => ({
          ipAddress: ip.ipAddress,
          uniqueUsers: parseInt(ip.uniqueUsers),
          totalActivities: parseInt(ip.totalActivities),
          usernames: ip.usernames,
          riskLevel: parseInt(ip.uniqueUsers) > 3 ? 'high' : 'medium',
        })),
        highRiskUsers: highRiskUsers.map((user: any) => ({
          userId: user.userId,
          username: user.username,
          totalActivities: parseInt(user.totalActivities),
          activeDays: parseInt(user.activeDays),
          uniqueActionTypes: parseInt(user.uniqueActionTypes),
          uniqueEntityTypes: parseInt(user.uniqueEntityTypes),
          activitySpan: {
            start: user.firstActivity,
            end: user.lastActivity,
          },
          riskLevel: parseInt(user.totalActivities) > 500 ? 'high' : 'medium',
        })),
        bulkOperations: bulkOperations.map((op: any) => ({
          userId: op.userId,
          username: op.username,
          action: op.action,
          entityType: op.entityType,
          count: op._count.action,
          riskLevel: op._count.action > 20 ? 'high' : 'medium',
        })),
        failedPasswordAttempts: failedPasswordAttempts.map((attempt: any) => ({
          userId: attempt.userId,
          username: attempt.username,
          ipAddress: attempt.ipAddress,
          failedCount: attempt._count.userId,
          riskLevel: attempt._count.userId > 5 ? 'high' : 'medium',
        })),
        riskScores: riskAnalysis,
        privilegedOperations: privilegedOperations.map((op: any) => ({
          id: op.id,
          userId: op.userId,
          username: op.username,
          action: op.action,
          entityType: op.entityType,
          description: op.description,
          requiresPassword: op.requiresPassword,
          passwordVerified: op.passwordVerified,
          ipAddress: op.ipAddress,
          createdAt: op.createdAt,
          riskLevel: op.requiresPassword && !op.passwordVerified ? 'high' : 'medium',
        })),
      },
      timePatterns: {
        hourlyActivity: (timePatternAnalysis as any[]).map((hour: any) => ({
          hour: parseInt(hour.hour),
          activityCount: parseInt(hour.activityCount),
          uniqueUsers: parseInt(hour.uniqueUsers),
          isOffHours: parseInt(hour.hour) < 8 || parseInt(hour.hour) > 18,
        })),
        offHoursActivityPercent: allAuditLogs.length > 0
          ? (offHoursActivity / allAuditLogs.length) * 100
          : 0,
      },
      recommendations: generateSecurityRecommendations({
        suspiciousIPs: suspiciousIPs.length,
        highRiskUsers: highRiskUsers.length,
        failedPasswordAttempts: failedPasswordAttempts.length,
        offHoursActivity,
        totalActivities: allAuditLogs.length,
      }),
      permissions: {
        isSuperAdmin: isSuperAdmin(user),
        canViewAllBusinesses: isSuperAdmin(user),
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error generating security analysis:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate security analysis',
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    )
  }
}

function generateSecurityRecommendations(analysis: any): string[] {
  const recommendations: string[] = []

  if (analysis.suspiciousIPs > 0) {
    recommendations.push(`${analysis.suspiciousIPs} IP addresses showing unusual activity patterns. Consider implementing IP-based access controls.`)
  }

  if (analysis.highRiskUsers > 0) {
    recommendations.push(`${analysis.highRiskUsers} users with high activity levels detected. Review user access levels and implement activity monitoring.`)
  }

  if (analysis.failedPasswordAttempts > 5) {
    recommendations.push(`${analysis.failedPasswordAttempts} failed password verification attempts detected. Consider implementing account lockout policies.`)
  }

  if (analysis.offHoursActivity / analysis.totalActivities > 0.2) {
    recommendations.push('High off-hours activity detected. Consider implementing time-based access restrictions.')
  }

  if (analysis.totalActivities > 1000) {
    recommendations.push('High system activity detected. Ensure proper monitoring and alerting systems are in place.')
  }

  if (recommendations.length === 0) {
    recommendations.push('No significant security risks detected. Continue monitoring system activity.')
  }

  return recommendations
}
