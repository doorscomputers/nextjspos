import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/overtime/alerts
 * Get overtime alerts with filtering
 * Query params:
 *  - status: pending, acknowledged, resolved
 *  - severity: info, warning, critical
 *  - userId: filter by user
 *  - locationId: filter by location
 *  - startDate, endDate: date range
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)

    // Permission check
    const permissions = user.permissions || []
    const canViewAll = permissions.includes(PERMISSIONS.OVERTIME_ALERTS_VIEW) ||
                       permissions.includes(PERMISSIONS.OVERTIME_ALERTS_MANAGE)
    const canViewOwn = permissions.includes(PERMISSIONS.OVERTIME_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({
        error: 'You do not have permission to view overtime alerts'
      }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const userId = searchParams.get('userId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    // If user can only view own, filter to their alerts
    if (!canViewAll && canViewOwn) {
      where.userId = currentUserId
    }

    if (status) {
      where.status = status
    }

    if (severity) {
      where.severity = severity
    }

    if (userId) {
      where.userId = parseInt(userId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Fetch alerts
    const alerts = await prisma.overtimeAlert.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        attendance: {
          select: {
            id: true,
            clockIn: true,
            clockOut: true,
            totalHoursWorked: true,
            scheduledHours: true,
            overtimeHours: true,
          }
        },
        acknowledger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Get summary counts
    const summary = await prisma.overtimeAlert.groupBy({
      by: ['status', 'severity'],
      where: {
        businessId,
        deletedAt: null,
        ...((!canViewAll && canViewOwn) && { userId: currentUserId })
      },
      _count: true
    })

    return NextResponse.json({
      alerts,
      summary,
      total: alerts.length
    })
  } catch (error) {
    console.error('Error fetching overtime alerts:', error)
    return NextResponse.json({
      error: 'Failed to fetch overtime alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/overtime/alerts
 * Create a new overtime alert (typically called by system)
 * Body:
 *  - attendanceId
 *  - userId
 *  - locationId
 *  - alertType: daily_overtime, weekly_overtime, excessive_overtime
 *  - severity: info, warning, critical
 *  - overtimeHours
 *  - overtimeMinutes
 *  - message
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)

    // Permission check
    const permissions = user.permissions || []
    if (!permissions.includes(PERMISSIONS.OVERTIME_ALERTS_MANAGE)) {
      return NextResponse.json({
        error: 'You do not have permission to create overtime alerts'
      }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.attendanceId || !body.userId || !body.locationId ||
        !body.alertType || !body.severity || !body.message) {
      return NextResponse.json({
        error: 'Missing required fields: attendanceId, userId, locationId, alertType, severity, message'
      }, { status: 400 })
    }

    // Create alert
    const alert = await prisma.overtimeAlert.create({
      data: {
        businessId,
        attendanceId: body.attendanceId,
        userId: body.userId,
        locationId: body.locationId,
        alertType: body.alertType,
        severity: body.severity,
        overtimeHours: body.overtimeHours || 0,
        overtimeMinutes: body.overtimeMinutes || 0,
        message: body.message,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'CREATE',
        entityType: 'OvertimeAlert',
        entityId: alert.id,
        changes: {
          attendanceId: body.attendanceId,
          alertType: body.alertType,
          severity: body.severity,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: 'Overtime alert created successfully',
      alert
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating overtime alert:', error)
    return NextResponse.json({
      error: 'Failed to create overtime alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
