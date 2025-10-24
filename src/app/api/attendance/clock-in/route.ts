import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/attendance/clock-in
 * Clock in for work
 * Automatically assigns location based on active schedule
 * Body (optional):
 *   - notes: Optional notes for clock in
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ATTENDANCE_CLOCK_IN)) {
      return NextResponse.json({ error: 'Insufficient permissions to clock in' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))

    // Get current Manila time
    const now = new Date()

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = now.getDay()

    // Check if user already has an active clock-in (hasn't clocked out)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId: currentUserId,
        businessId,
        clockOut: null,
      }
    })

    if (activeAttendance) {
      return NextResponse.json({
        error: 'You are already clocked in',
        attendance: activeAttendance,
        message: 'Please clock out first before clocking in again'
      }, { status: 409 })
    }

    // Find active schedule for today
    const schedule = await prisma.employeeSchedule.findFirst({
      where: {
        userId: currentUserId,
        businessId,
        dayOfWeek,
        isActive: true,
        deletedAt: null,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } }
        ]
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json({
        error: 'No active schedule found for today',
        dayOfWeek,
        message: 'You do not have a schedule for today. Please contact your manager.'
      }, { status: 404 })
    }

    // Calculate if late
    const [scheduleHours, scheduleMinutes, scheduleSeconds] = schedule.startTime.split(':').map(Number)
    const expectedStartDateTime = new Date(now)
    expectedStartDateTime.setHours(scheduleHours, scheduleMinutes, scheduleSeconds || 0, 0)

    const isLate = now > expectedStartDateTime

    // Determine status
    let status = 'on_time'
    if (isLate) {
      status = 'late'
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        businessId,
        userId: currentUserId,
        locationId: schedule.locationId,
        date: new Date(now.setHours(0, 0, 0, 0)),
        clockIn: now,
        scheduledStart: schedule.startTime,
        scheduledEnd: schedule.endTime,
        status: status,
        notes: body.notes || null,
        xReadingPrinted: false,
        cashCountSubmitted: false,
        isOvertime: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
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

    const minutesLate = isLate ? Math.floor((new Date().getTime() - expectedStartDateTime.getTime()) / 1000 / 60) : 0

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        username: user.username || `user-${currentUserId}`,
        action: 'CLOCK_IN',
        entityType: 'Attendance',
        entityId: attendance.id,
        changes: {
          new: attendance,
          isLate,
          minutesLate
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      attendance,
      schedule: {
        id: schedule.id,
        location: schedule.location,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      isLate,
      minutesLate,
      message: isLate
        ? `Clocked in successfully at ${schedule.location.name}. You are ${minutesLate} minute(s) late.`
        : `Clocked in successfully at ${schedule.location.name}. You are on time!`
    }, { status: 201 })
  } catch (error) {
    console.error('Error clocking in:', error)
    return NextResponse.json({
      error: 'Failed to clock in',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
