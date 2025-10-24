import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/overtime/configuration
 * Get overtime configuration for the business
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
    if (!permissions.includes(PERMISSIONS.OVERTIME_CONFIGURE) &&
        !permissions.includes(PERMISSIONS.OVERTIME_VIEW_ALL)) {
      return NextResponse.json({
        error: 'You do not have permission to view overtime configuration'
      }, { status: 403 })
    }

    // Fetch or create default configuration
    let config = await prisma.overtimeConfiguration.findUnique({
      where: { businessId }
    })

    if (!config) {
      // Create default configuration
      config = await prisma.overtimeConfiguration.create({
        data: {
          businessId,
          dailyStandardHours: 8,
          dailyOvertimeThreshold: 8,
          weeklyStandardHours: 40,
          weeklyOvertimeThreshold: 40,
          alertThresholdMinutes: 30,
          alertManagerOnOvertime: true,
          alertEmployeeOnOvertime: true,
          requireOvertimeApproval: false,
          autoApproveUnder: 30,
          overtimeRate: 1.5,
          weekendOvertimeRate: 2.0,
          holidayOvertimeRate: 3.0,
          isActive: true,
        }
      })
    }

    return NextResponse.json({ configuration: config })
  } catch (error) {
    console.error('Error fetching overtime configuration:', error)
    return NextResponse.json({
      error: 'Failed to fetch overtime configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/overtime/configuration
 * Update overtime configuration
 * Body: All overtime configuration fields (optional, only provided fields updated)
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
    if (!permissions.includes(PERMISSIONS.OVERTIME_CONFIGURE)) {
      return NextResponse.json({
        error: 'You do not have permission to configure overtime settings'
      }, { status: 403 })
    }

    const body = await request.json()

    // Update or create configuration
    const config = await prisma.overtimeConfiguration.upsert({
      where: { businessId },
      create: {
        businessId,
        dailyStandardHours: body.dailyStandardHours || 8,
        dailyOvertimeThreshold: body.dailyOvertimeThreshold || 8,
        weeklyStandardHours: body.weeklyStandardHours || 40,
        weeklyOvertimeThreshold: body.weeklyOvertimeThreshold || 40,
        alertThresholdMinutes: body.alertThresholdMinutes || 30,
        alertManagerOnOvertime: body.alertManagerOnOvertime ?? true,
        alertEmployeeOnOvertime: body.alertEmployeeOnOvertime ?? true,
        requireOvertimeApproval: body.requireOvertimeApproval ?? false,
        autoApproveUnder: body.autoApproveUnder || 30,
        overtimeRate: body.overtimeRate || 1.5,
        weekendOvertimeRate: body.weekendOvertimeRate || 2.0,
        holidayOvertimeRate: body.holidayOvertimeRate || 3.0,
        isActive: body.isActive ?? true,
      },
      update: {
        ...(body.dailyStandardHours !== undefined && { dailyStandardHours: body.dailyStandardHours }),
        ...(body.dailyOvertimeThreshold !== undefined && { dailyOvertimeThreshold: body.dailyOvertimeThreshold }),
        ...(body.weeklyStandardHours !== undefined && { weeklyStandardHours: body.weeklyStandardHours }),
        ...(body.weeklyOvertimeThreshold !== undefined && { weeklyOvertimeThreshold: body.weeklyOvertimeThreshold }),
        ...(body.alertThresholdMinutes !== undefined && { alertThresholdMinutes: body.alertThresholdMinutes }),
        ...(body.alertManagerOnOvertime !== undefined && { alertManagerOnOvertime: body.alertManagerOnOvertime }),
        ...(body.alertEmployeeOnOvertime !== undefined && { alertEmployeeOnOvertime: body.alertEmployeeOnOvertime }),
        ...(body.requireOvertimeApproval !== undefined && { requireOvertimeApproval: body.requireOvertimeApproval }),
        ...(body.autoApproveUnder !== undefined && { autoApproveUnder: body.autoApproveUnder }),
        ...(body.overtimeRate !== undefined && { overtimeRate: body.overtimeRate }),
        ...(body.weekendOvertimeRate !== undefined && { weekendOvertimeRate: body.weekendOvertimeRate }),
        ...(body.holidayOvertimeRate !== undefined && { holidayOvertimeRate: body.holidayOvertimeRate }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'OvertimeConfiguration',
        entityId: config.id,
        changes: body,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: 'Overtime configuration updated successfully',
      configuration: config
    })
  } catch (error) {
    console.error('Error updating overtime configuration:', error)
    return NextResponse.json({
      error: 'Failed to update overtime configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
