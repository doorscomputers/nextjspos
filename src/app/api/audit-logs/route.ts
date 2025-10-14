import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/audit-logs
 * Fetch audit logs with filtering, pagination, and CSV export
 * Supports: entityType, entityId, userId, action, dateFrom, dateTo, page, pageSize, export
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission - only users with audit log view permission can access
    if (!user.permissions?.includes(PERMISSIONS.AUDIT_LOG_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view audit logs' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const exportData = searchParams.get('export') === 'true'

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId)
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (entityId) {
      // entityIds is stored as JSON string, use contains to search
      where.entityIds = {
        contains: entityId
      }
    }

    if (userId) {
      where.userId = parseInt(userId)
    }

    if (action) {
      where.action = action
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
      }
    }

    // If export, get all logs without pagination and return as CSV
    if (exportData) {
      const allLogs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      // Convert to CSV
      const csv = [
        'Timestamp,User ID,Username,Action,Entity Type,Entity IDs,Description,IP Address,User Agent',
        ...allLogs.map(log =>
          [
            new Date(log.createdAt).toISOString(),
            log.userId,
            log.username,
            log.action,
            log.entityType,
            JSON.stringify(log.entityIds),
            `"${log.description.replace(/"/g, '""')}"`,
            log.ipAddress,
            `"${log.userAgent.replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
        },
      })
    }

    // Get paginated logs with total count
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: error.message },
      { status: 500 }
    )
  }
}
