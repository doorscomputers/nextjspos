import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * POST /api/attendance/clock-out
 * Clock out from work
 * Body (optional):
 *   - notes: Optional notes for clock out
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
    if (!user.permissions?.includes(PERMISSIONS.ATTENDANCE_CLOCK_OUT)) {
      return NextResponse.json({ error: 'Insufficient permissions to clock out' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))

    // Get current Manila time
    const now = new Date()

    // Find active attendance record (clocked in but not clocked out)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId: currentUserId,
        businessId,
        clockOut: null,
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

    if (!activeAttendance) {
      return NextResponse.json({
        error: 'No active clock-in found',
        message: 'You are not currently clocked in. Please clock in first.'
      }, { status: 404 })
    }

    // Calculate total hours worked
    const clockInTime = new Date(activeAttendance.clockIn)
    const totalMilliseconds = now.getTime() - clockInTime.getTime()
    const totalHours = totalMilliseconds / (1000 * 60 * 60)
    const totalMinutes = totalMilliseconds / (1000 * 60)

    // Calculate if early departure or overtime
    const scheduledEnd = activeAttendance.scheduledEnd || '17:00'
    const [scheduleEndHours, scheduleEndMinutes] = scheduledEnd.split(':').map(Number)
    const expectedEndDateTime = new Date(clockInTime)
    expectedEndDateTime.setHours(scheduleEndHours, scheduleEndMinutes, 0, 0)

    const isEarlyDeparture = now < expectedEndDateTime
    const isOvertimeCheck = now > expectedEndDateTime
    const minutesEarly = isEarlyDeparture ? Math.floor((expectedEndDateTime.getTime() - now.getTime()) / 1000 / 60) : 0
    const minutesOvertime = isOvertimeCheck ? Math.floor((now.getTime() - expectedEndDateTime.getTime()) / 1000 / 60) : 0

    // Determine status based on current status and departure time
    let status = activeAttendance.status
    if (isEarlyDeparture && minutesEarly > 30) {
      status = 'early'
    }

    // Calculate scheduled hours
    let scheduledHours = 8 // Default
    if (activeAttendance.scheduledStart && activeAttendance.scheduledEnd) {
      const startTime = new Date(`2000-01-01T${activeAttendance.scheduledStart}`)
      const endTime = new Date(`2000-01-01T${activeAttendance.scheduledEnd}`)
      scheduledHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    }

    const overtimeHoursCalc = Math.max(0, totalHours - scheduledHours)
    const overtimeMinutesCalc = Math.max(0, Math.floor((totalHours - scheduledHours) * 60))
    const isOvertimeWork = overtimeHoursCalc > 0

    // Get overtime configuration
    const overtimeConfig = await prisma.overtimeConfiguration.findUnique({
      where: { businessId }
    })

    // Update attendance record
    const updateData: any = {
      clockOut: now,
      totalHoursWorked: new Decimal(totalHours.toFixed(2)),
      scheduledHours: new Decimal(scheduledHours.toFixed(2)),
      overtimeHours: new Decimal(overtimeHoursCalc.toFixed(2)),
      overtimeMinutes: overtimeMinutesCalc,
      isOvertime: isOvertimeWork,
      status,
    }

    // Check if overtime requires approval
    if (isOvertimeWork && overtimeConfig?.requireOvertimeApproval) {
      if (overtimeConfig.autoApproveUnder && overtimeMinutesCalc < overtimeConfig.autoApproveUnder) {
        updateData.overtimeApproved = true
        updateData.overtimeApprovedBy = null // Auto-approved
        updateData.overtimeApprovedAt = now
      } else {
        updateData.overtimeApproved = false
      }
    }

    // Append notes if provided
    if (body.notes) {
      const existingNotes = activeAttendance.notes || ''
      updateData.notes = existingNotes
        ? `${existingNotes}\n\n[Clock Out] ${body.notes}`
        : `[Clock Out] ${body.notes}`
    }

    const attendance = await prisma.attendance.update({
      where: {
        id: activeAttendance.id,
        businessId,
      },
      data: updateData,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        username: user.username || `user-${currentUserId}`,
        action: 'CLOCK_OUT',
        entityType: 'Attendance',
        entityId: attendance.id,
        changes: {
          old: activeAttendance,
          new: attendance,
          totalHoursWorked: totalHours.toFixed(2),
          totalMinutes: Math.floor(totalMinutes),
          isEarlyDeparture,
          minutesEarly,
          isOvertime: isOvertimeCheck,
          minutesOvertime,
          overtimeHours: overtimeHoursCalc.toFixed(2),
          overtimeMinutes: overtimeMinutesCalc,
          status
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    // Create overtime alerts if threshold exceeded
    if (isOvertimeWork && overtimeConfig?.isActive) {
      const shouldAlert = overtimeMinutesCalc >= (overtimeConfig.alertThresholdMinutes || 30)

      if (shouldAlert) {
        // Determine severity
        let severity = 'info'
        let alertType = 'daily_overtime'
        if (overtimeMinutesCalc >= 180) { // 3+ hours
          severity = 'critical'
          alertType = 'excessive_overtime'
        } else if (overtimeMinutesCalc >= 120) { // 2+ hours
          severity = 'warning'
        }

        const alertMessage = `${attendance.user.firstName} ${attendance.user.lastName} worked ${overtimeHoursCalc.toFixed(1)} hours overtime (${overtimeMinutesCalc} minutes) on ${now.toLocaleDateString()}`

        // Create alert
        await prisma.overtimeAlert.create({
          data: {
            businessId,
            attendanceId: attendance.id,
            userId: currentUserId,
            locationId: attendance.locationId,
            alertType,
            severity,
            overtimeHours: new Decimal(overtimeHoursCalc.toFixed(2)),
            overtimeMinutes: overtimeMinutesCalc,
            message: alertMessage,
            status: 'pending',
          }
        }).catch(err => {
          console.error('Failed to create overtime alert:', err)
        })
      }
    }

    // Build response message
    let message = `Clocked out successfully from ${activeAttendance.location.name}. `
    message += `Total hours worked: ${Math.floor(totalHours)}h ${Math.floor(totalMinutes % 60)}m. `
    message += `Scheduled: ${scheduledHours.toFixed(1)}h. `

    if (isEarlyDeparture && minutesEarly > 30) {
      message += `⚠️ Early departure: ${minutesEarly} minutes early.`
    } else if (isOvertimeWork) {
      message += `⏰ Overtime: ${overtimeHoursCalc.toFixed(1)}h (${overtimeMinutesCalc}m). `
      if (overtimeConfig?.requireOvertimeApproval && !updateData.overtimeApproved) {
        message += `Requires manager approval.`
      } else if (updateData.overtimeApproved) {
        message += `Auto-approved.`
      }
    } else {
      message += `Thank you for your hard work!`
    }

    return NextResponse.json({
      attendance,
      summary: {
        clockInTime: clockInTime.toISOString(),
        clockOutTime: now.toISOString(),
        totalHoursWorked: parseFloat(totalHours.toFixed(2)),
        totalMinutes: Math.floor(totalMinutes),
        scheduledHours: parseFloat(scheduledHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHoursCalc.toFixed(2)),
        overtimeMinutes: overtimeMinutesCalc,
        isOvertimeWork,
        overtimeApprovalRequired: overtimeConfig?.requireOvertimeApproval && !updateData.overtimeApproved,
        isEarlyDeparture,
        minutesEarly,
        isOvertime: isOvertimeCheck,
        minutesOvertime,
        status
      },
      message
    })
  } catch (error) {
    console.error('Error clocking out:', error)
    return NextResponse.json({
      error: 'Failed to clock out',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
