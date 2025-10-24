import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/my-schedule
 * Get current user's schedule for today and active attendance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const userId = parseInt(user.id)

    // Get current time in Manila timezone
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

    // Find active schedule for today
    const schedule = await prisma.employeeSchedule.findFirst({
      where: {
        userId,
        businessId,
        dayOfWeek,
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
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

    // Find active attendance (currently clocked in)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        businessId,
        clockOutTime: null,
        deletedAt: null,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        schedule: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        locationChanges: {
          include: {
            fromLocation: true,
            toLocation: true,
          },
          orderBy: {
            switchTime: 'desc'
          },
          take: 1
        }
      }
    })

    // Get pending location change requests
    const pendingLocationChanges = await prisma.locationChangeRequest.findMany({
      where: {
        requestedBy: userId,
        businessId,
        status: 'pending',
        deletedAt: null,
      },
      include: {
        fromLocation: true,
        toLocation: true,
        attendance: true,
      },
      orderBy: {
        requestedAt: 'desc'
      }
    })

    // Get today's attendance history
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const todayAttendance = await prisma.attendance.findMany({
      where: {
        userId,
        businessId,
        clockInTime: {
          gte: todayStart,
          lte: todayEnd
        },
        deletedAt: null,
      },
      include: {
        location: true,
      },
      orderBy: {
        clockInTime: 'desc'
      }
    })

    // Calculate schedule status
    let scheduleStatus = 'no_schedule'
    let minutesUntilShift = 0
    let isLate = false
    let minutesLate = 0

    if (schedule) {
      const [scheduleHours, scheduleMinutes, scheduleSeconds] = schedule.startTime.split(':').map(Number)
      const expectedStartDateTime = new Date(now)
      expectedStartDateTime.setHours(scheduleHours, scheduleMinutes, scheduleSeconds || 0, 0)

      if (now < expectedStartDateTime) {
        scheduleStatus = 'upcoming'
        minutesUntilShift = Math.floor((expectedStartDateTime.getTime() - now.getTime()) / 1000 / 60)
      } else {
        const [endHours, endMinutes, endSeconds] = schedule.endTime.split(':').map(Number)
        const expectedEndDateTime = new Date(now)
        expectedEndDateTime.setHours(endHours, endMinutes, endSeconds || 0, 0)

        if (now > expectedEndDateTime) {
          scheduleStatus = 'ended'
        } else {
          scheduleStatus = 'active'
          if (!activeAttendance) {
            isLate = true
            minutesLate = Math.floor((now.getTime() - expectedStartDateTime.getTime()) / 1000 / 60)
          }
        }
      }
    }

    return NextResponse.json({
      schedule: schedule || null,
      activeAttendance: activeAttendance || null,
      pendingLocationChanges,
      todayAttendance,
      scheduleStatus,
      minutesUntilShift,
      isLate,
      minutesLate,
      currentTime: now.toISOString(),
      dayOfWeek,
    })
  } catch (error) {
    console.error('Error fetching my schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
