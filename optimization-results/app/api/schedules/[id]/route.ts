import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const USER_SUMMARY_SELECT = {
  id: { select: { id: true, name: true } },
  username: { select: { id: true, name: true } },
  firstName: { select: { id: true, name: true } },
  lastName: { select: { id: true, name: true } },
}

async function resolveUserSummary(userId?: number | null) {
  if (!userId) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: USER_SUMMARY_SELECT,
  })
}

async function attachAuditUsers<T extends { createdBy?: number | null; updatedBy?: number | null }>(schedule: T) {
  if (!schedule) {
    return schedule
  }

  const [createdByUser, updatedByUser] = await Promise.all([
    resolveUserSummary(schedule.createdBy),
    resolveUserSummary(schedule.updatedBy),
  ])

  return {
    ...schedule,
    createdByUser,
    updatedByUser,
  }
}

/**
 * GET /api/schedules/[id]
 * Get a specific employee schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const { id } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SCHEDULE_VIEW) && !user.permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const scheduleRecord = await prisma.employeeSchedule.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      select: {
        user: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
      }
    })

    if (!scheduleRecord) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = await attachAuditUsers(scheduleRecord)

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

/**
 * PUT /api/schedules/[id]
 * Update an employee schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const { id } = await params
    const body = await request.json()

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SCHEDULE_UPDATE) && !user.permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch existing schedule
    const existingScheduleRecord = await prisma.employeeSchedule.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      select: {
        user: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
      },
    })

    if (!existingScheduleRecord) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {
      updatedBy: currentUserId,
      updatedAt: new Date(),
    }

    if (body.locationId !== undefined) {
      // Validate location
      const location = await prisma.businessLocation.findFirst({
        where: {
          id: parseInt(body.locationId),
          businessId,
        }
      })

      if (!location) {
        return NextResponse.json({
          error: 'Location not found or does not belong to your business'
        }, { status: 404 })
      }

      updateData.locationId = parseInt(body.locationId)
    }

    if (body.startDate !== undefined) {
      updateData.effectiveFrom = new Date(body.startDate)
    }

    if (body.endDate !== undefined) {
      updateData.effectiveTo = body.endDate ? new Date(body.endDate) : null
    }

    if (body.dayOfWeek !== undefined) {
      const dayOfWeek = parseInt(body.dayOfWeek)
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({
          error: 'Invalid dayOfWeek. Must be between 0 (Sunday) and 6 (Saturday)'
        }, { status: 400 })
      }
      updateData.dayOfWeek = dayOfWeek
    }

    if (body.startTime !== undefined) {
      updateData.startTime = body.startTime
    }

    if (body.endTime !== undefined) {
      updateData.endTime = body.endTime
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
    }

    // Check for overlapping schedules if relevant fields are being updated
    if (body.dayOfWeek !== undefined || body.startDate !== undefined || body.endDate !== undefined) {
      const dayOfWeek = body.dayOfWeek !== undefined ? parseInt(body.dayOfWeek) : existingScheduleRecord.dayOfWeek
      const startDate = body.startDate !== undefined ? new Date(body.startDate) : existingScheduleRecord.effectiveFrom
      const endDate = body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : existingScheduleRecord.effectiveTo

      const overlapping = await prisma.employeeSchedule.findFirst({
        where: {
          id: { not: parseInt(id) }, // Exclude current schedule
          userId: existingScheduleRecord.userId,
          locationId: body.locationId !== undefined ? parseInt(body.locationId) : existingScheduleRecord.locationId,
          dayOfWeek,
          isActive: { select: { id: true, name: true } },
          deletedAt: null,
          AND: [
            {
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: startDate } }
              ]
            },
            endDate ? {
              effectiveFrom: { lte: endDate }
            } : {}
          ]
        }
      })

      if (overlapping) {
        return NextResponse.json({
          error: 'An active schedule already exists for this employee on this day and location during the specified period',
          overlappingSchedule: overlapping
        }, { status: 409 })
      }
    }

    // Update the schedule
    const scheduleRecord = await prisma.employeeSchedule.update({
      where: {
        id: parseInt(id),
        businessId,
      },
      data: updateData,
      select: {
        user: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
      }
    })

    const [existingSchedule, schedule] = await Promise.all([
      attachAuditUsers(existingScheduleRecord),
      attachAuditUsers(scheduleRecord),
    ])

    // Create audit log
    const scheduleUserName = schedule.user?.username ?? `User ${schedule.userId}`
    const scheduleLocationName = schedule.location?.name ?? `Location ${schedule.locationId}`
    const scheduleDayName = DAY_NAMES[schedule.dayOfWeek] ?? `Day ${schedule.dayOfWeek}`

    await createAuditLog({
      businessId,
      userId: currentUserId,
      username: user.username || `user-${currentUserId}`,
      action: AuditAction.EMPLOYEE_SCHEDULE_UPDATE,
      entityType: EntityType.EMPLOYEE_SCHEDULE,
      entityIds: [schedule.id],
      description: `Updated schedule for ${scheduleUserName} at ${scheduleLocationName} (${scheduleDayName} ${schedule.startTime}-${schedule.endTime})`,
      metadata: {
        changes: {
          old: existingSchedule,
          new: schedule,
        },
      },
      ipAddress: getIpAddress(request) ?? 'unknown',
      userAgent: getUserAgent(request) ?? 'unknown',
    })

    return NextResponse.json({
      schedule,
      message: 'Employee schedule updated successfully'
    })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

/**
 * DELETE /api/schedules/[id]
 * Soft delete an employee schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const { id } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SCHEDULE_DELETE) && !user.permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch existing schedule for audit log
    const existingScheduleRecord = await prisma.employeeSchedule.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      select: {
        user: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
      },
    })

    if (!existingScheduleRecord) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Soft delete the schedule
    await prisma.employeeSchedule.update({
      where: {
        id: parseInt(id),
        businessId,
      },
      data: {
        deletedAt: new Date(),
      }
    })

    const existingSchedule = await attachAuditUsers(existingScheduleRecord)

    // Create audit log
    const deletedScheduleUserName = existingSchedule.user?.username ?? `User ${existingSchedule.userId}`
    const deletedScheduleLocationName = existingSchedule.location?.name ?? `Location ${existingSchedule.locationId}`
    const deletedScheduleDayName = DAY_NAMES[existingSchedule.dayOfWeek] ?? `Day ${existingSchedule.dayOfWeek}`

    await createAuditLog({
      businessId,
      userId: currentUserId,
      username: user.username || `user-${currentUserId}`,
      action: AuditAction.EMPLOYEE_SCHEDULE_DELETE,
      entityType: EntityType.EMPLOYEE_SCHEDULE,
      entityIds: [parseInt(id)],
      description: `Deleted schedule for ${deletedScheduleUserName} at ${deletedScheduleLocationName} (${deletedScheduleDayName} ${existingSchedule.startTime}-${existingSchedule.endTime})`,
      metadata: {
        changes: {
          old: existingSchedule,
        },
      },
      ipAddress: getIpAddress(request) ?? 'unknown',
      userAgent: getUserAgent(request) ?? 'unknown',
    })

    return NextResponse.json({ message: 'Employee schedule deleted successfully' })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
