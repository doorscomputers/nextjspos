import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/schedule-login-config
 * Get schedule-based login configuration for the business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Permission check
    const permissions = user.permissions || []
    if (!permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_VIEW) &&
        !permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
      return NextResponse.json({
        error: 'You do not have permission to view schedule login configuration'
      }, { status: 403 })
    }

    // Fetch or create default configuration
    let config = await prisma.scheduleLoginConfiguration.findUnique({
      where: { businessId }
    })

    if (!config) {
      // Create default configuration
      config = await prisma.scheduleLoginConfiguration.create({
        data: {
          businessId,
          enforceScheduleLogin: true,
          earlyClockInGraceMinutes: 30,
          lateClockOutGraceMinutes: 60,
          exemptRoles: "Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)",
        }
      })
    }

    return NextResponse.json({ configuration: config })
  } catch (error) {
    console.error('Error fetching schedule login configuration:', error)
    return NextResponse.json({
      error: 'Failed to fetch schedule login configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/schedule-login-config
 * Update schedule-based login configuration
 * Body:
 *  - enforceScheduleLogin: boolean
 *  - earlyClockInGraceMinutes: number
 *  - lateClockOutGraceMinutes: number
 *  - exemptRoles: string (comma-separated)
 *  - tooEarlyMessage: string (optional)
 *  - tooLateMessage: string (optional)
 */
export async function PUT(request: NextRequest) {
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
    if (!permissions.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
      return NextResponse.json({
        error: 'You do not have permission to edit schedule login configuration'
      }, { status: 403 })
    }

    const body = await request.json()

    // Validate grace periods
    if (body.earlyClockInGraceMinutes !== undefined &&
        (body.earlyClockInGraceMinutes < 0 || body.earlyClockInGraceMinutes > 240)) {
      return NextResponse.json({
        error: 'Early clock-in grace period must be between 0 and 240 minutes (4 hours)'
      }, { status: 400 })
    }

    if (body.lateClockOutGraceMinutes !== undefined &&
        (body.lateClockOutGraceMinutes < 0 || body.lateClockOutGraceMinutes > 240)) {
      return NextResponse.json({
        error: 'Late clock-out grace period must be between 0 and 240 minutes (4 hours)'
      }, { status: 400 })
    }

    // Update or create configuration
    const config = await prisma.scheduleLoginConfiguration.upsert({
      where: { businessId },
      create: {
        businessId,
        enforceScheduleLogin: body.enforceScheduleLogin ?? true,
        earlyClockInGraceMinutes: body.earlyClockInGraceMinutes ?? 30,
        lateClockOutGraceMinutes: body.lateClockOutGraceMinutes ?? 60,
        exemptRoles: body.exemptRoles ?? "Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)",
        tooEarlyMessage: body.tooEarlyMessage,
        tooLateMessage: body.tooLateMessage,
      },
      update: {
        ...(body.enforceScheduleLogin !== undefined && { enforceScheduleLogin: body.enforceScheduleLogin }),
        ...(body.earlyClockInGraceMinutes !== undefined && { earlyClockInGraceMinutes: body.earlyClockInGraceMinutes }),
        ...(body.lateClockOutGraceMinutes !== undefined && { lateClockOutGraceMinutes: body.lateClockOutGraceMinutes }),
        ...(body.exemptRoles !== undefined && { exemptRoles: body.exemptRoles }),
        ...(body.tooEarlyMessage !== undefined && { tooEarlyMessage: body.tooEarlyMessage }),
        ...(body.tooLateMessage !== undefined && { tooLateMessage: body.tooLateMessage }),
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'ScheduleLoginConfiguration',
        entityId: config.id,
        changes: body,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: 'Schedule login configuration updated successfully',
      configuration: config
    })
  } catch (error) {
    console.error('Error updating schedule login configuration:', error)
    return NextResponse.json({
      error: 'Failed to update schedule login configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
