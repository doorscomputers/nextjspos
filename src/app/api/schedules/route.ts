import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/**
 * GET /api/schedules
 * List all employee schedules for the business
 * Query params:
 *   - userId: Filter by specific user
 *   - locationId: Filter by location
 *   - startDate: Filter schedules starting from this date
 *   - endDate: Filter schedules ending before this date
 *   - status: Filter by status (active, inactive)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SCHEDULE_VIEW) && !user.permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    if (userId) {
      where.userId = parseInt(userId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      where.AND = []

      if (startDate) {
        where.AND.push({
          effectiveTo: {
            gte: new Date(startDate)
          }
        })
      }

      if (endDate) {
        where.AND.push({
          effectiveFrom: {
            lte: new Date(endDate)
          }
        })
      }
    }

    if (status) {
      where.isActive = status === 'active'
    }

    // Fetch schedules with relations
    const schedules = await prisma.employeeSchedule.findMany({
      where,
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
        },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { user: { username: 'asc' } }
      ]
    })

    return NextResponse.json({ schedules })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

/**
 * POST /api/schedules
 * Create a new employee schedule
 * Body:
 *   - userId: Employee user ID
 *   - locationId: Business location ID
 *   - startDate: Schedule start date
 *   - endDate: Schedule end date (optional)
 *   - dayOfWeek: Day of week (0-6, Sunday=0)
 *   - startTime: Shift start time (HH:MM:SS)
 *   - endTime: Shift end time (HH:MM:SS)
 *   - isActive: Active status (default: true)
 *   - notes: Optional notes
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
    if (!user.permissions?.includes(PERMISSIONS.SCHEDULE_CREATE) && !user.permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE_ALL)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.userId || !body.locationId || !body.startDate || body.dayOfWeek === undefined || !body.startTime || !body.endTime) {
      return NextResponse.json({
        error: 'Missing required fields: userId, locationId, startDate, dayOfWeek, startTime, endTime'
      }, { status: 400 })
    }

    // Validate that the employee belongs to the same business
    const employee = await prisma.user.findFirst({
      where: {
        id: parseInt(body.userId),
        businessId,
        deletedAt: null,
      }
    })

    if (!employee) {
      return NextResponse.json({
        error: 'Employee not found or does not belong to your business'
      }, { status: 404 })
    }

    // Validate that the location belongs to the business
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

    // Validate day of week (0-6)
    const dayOfWeek = parseInt(body.dayOfWeek)
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({
        error: 'Invalid dayOfWeek. Must be between 0 (Sunday) and 6 (Saturday)'
      }, { status: 400 })
    }

    // Check for overlapping schedules
    const overlapping = await prisma.employeeSchedule.findFirst({
      where: {
        userId: parseInt(body.userId),
        locationId: parseInt(body.locationId),
        dayOfWeek,
        isActive: true,
        deletedAt: null,
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date(body.startDate) } }
            ]
          },
          body.endDate ? {
            effectiveFrom: { lte: new Date(body.endDate) }
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

    // Create the schedule
    const schedule = await prisma.employeeSchedule.create({
      data: {
        businessId,
        userId: parseInt(body.userId),
        locationId: parseInt(body.locationId),
        effectiveFrom: new Date(body.startDate),
        effectiveTo: body.endDate ? new Date(body.endDate) : null,
        dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdBy: currentUserId,
        updatedBy: currentUserId,
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
        },
      }
    })

    // Create audit log
    const scheduleUserName = schedule.user?.username ?? `User ${schedule.userId}`
    const scheduleLocationName = schedule.location?.name ?? `Location ${schedule.locationId}`
    const scheduleDayName = DAY_NAMES[schedule.dayOfWeek] ?? `Day ${schedule.dayOfWeek}`

    await createAuditLog({
      businessId,
      userId: currentUserId,
      username: user.username || `user-${currentUserId}`,
      action: AuditAction.EMPLOYEE_SCHEDULE_CREATE,
      entityType: EntityType.EMPLOYEE_SCHEDULE,
      entityIds: [schedule.id],
      description: `Created schedule for ${scheduleUserName} at ${scheduleLocationName} on ${scheduleDayName} ${schedule.startTime}-${schedule.endTime}`,
      metadata: {
        changes: {
          new: schedule,
        },
      },
      ipAddress: getIpAddress(request) ?? 'unknown',
      userAgent: getUserAgent(request) ?? 'unknown',
    })

    return NextResponse.json({
      schedule,
      message: 'Employee schedule created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
