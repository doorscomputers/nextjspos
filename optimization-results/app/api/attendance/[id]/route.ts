import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * GET /api/attendance/[id]
 * Get a specific attendance record
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
    const currentUserId = parseInt(user.id)
    const { id } = await params

    const attendance = await prisma.attendance.findFirst({
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
        schedule: {
          select: {
            id: { select: { id: true, name: true } },
            dayOfWeek: { select: { id: true, name: true } },
            startTime: { select: { id: true, name: true } },
            endTime: { select: { id: true, name: true } },
          }
        },
        locationChanges: {
          select: {
            fromLocation: {
              select: {
                id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                name: { select: { id: true, name: true } },
              }
            },
            toLocation: {
              select: {
                id: { select: { id: true, name: true } },
                name: { select: { id: true, name: true } },
              }
            },
            approvedByUser: {
              select: {
                id: { select: { id: true, name: true } },
                username: { select: { id: true, name: true } },
                firstName: { select: { id: true, name: true } },
                lastName: { select: { id: true, name: true } },
              }
            }
          },
          orderBy: {
            switchTime: 'asc'
          }
        }
      }
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Check permission - users can view their own records or if they have ATTENDANCE_VIEW permission
    const canViewAll = user.permissions?.includes(PERMISSIONS.ATTENDANCE_VIEW) ||
                      user.permissions?.includes(PERMISSIONS.ATTENDANCE_MANAGE)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.ATTENDANCE_VIEW_OWN)
    const isOwnRecord = attendance.userId === currentUserId

    if (!canViewAll && (!canViewOwn || !isOwnRecord)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Error fetching attendance record:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance record' }, { status: 500 })
  }
}

/**
 * PUT /api/attendance/[id]
 * Update an attendance record (admin/manager only)
 * Can manually adjust clock in/out times, status, etc.
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

    // Check permission - only managers can edit attendance
    if (!user.permissions?.includes(PERMISSIONS.ATTENDANCE_EDIT) &&
        !user.permissions?.includes(PERMISSIONS.ATTENDANCE_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions to edit attendance' }, { status: 403 })
    }

    // Fetch existing record
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      }
    })

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.clockInTime !== undefined) {
      updateData.clockInTime = new Date(body.clockInTime)
    }

    if (body.clockOutTime !== undefined) {
      updateData.clockOutTime = body.clockOutTime ? new Date(body.clockOutTime) : null
    }

    if (body.status !== undefined) {
      const validStatuses = ['present', 'absent', 'late', 'early_departure', 'on_leave', 'sick_leave']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    // Recalculate total hours if clock times are updated
    if (body.clockInTime !== undefined || body.clockOutTime !== undefined) {
      const clockInTime = body.clockInTime ? new Date(body.clockInTime) : existingAttendance.clockInTime
      const clockOutTime = body.clockOutTime ? new Date(body.clockOutTime) : existingAttendance.clockOutTime

      if (clockInTime && clockOutTime) {
        const totalMilliseconds = clockOutTime.getTime() - clockInTime.getTime()
        const totalHours = totalMilliseconds / (1000 * 60 * 60)
        updateData.totalHoursWorked = new Decimal(totalHours.toFixed(2))
      }
    }

    // Update the record
    const attendance = await prisma.attendance.update({
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
        schedule: {
          select: {
            id: { select: { id: true, name: true } },
            dayOfWeek: { select: { id: true, name: true } },
            startTime: { select: { id: true, name: true } },
            endTime: { select: { id: true, name: true } },
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'Attendance',
        entityId: attendance.id,
        changes: {
          old: existingAttendance,
          new: attendance,
          editedBy: {
            id: currentUserId,
            username: user.username
          }
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      attendance,
      message: 'Attendance record updated successfully'
    })
  } catch (error) {
    console.error('Error updating attendance record:', error)
    return NextResponse.json({ error: 'Failed to update attendance record' }, { status: 500 })
  }
}

/**
 * DELETE /api/attendance/[id]
 * Soft delete an attendance record
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

    // Check permission - only managers can delete attendance
    if (!user.permissions?.includes(PERMISSIONS.ATTENDANCE_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions to delete attendance' }, { status: 403 })
    }

    // Fetch existing record for audit
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      }
    })

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.attendance.update({
      where: {
        id: parseInt(id),
        businessId,
      },
      data: {
        deletedAt: new Date(),
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'DELETE',
        entityType: 'Attendance',
        entityId: parseInt(id),
        changes: {
          old: existingAttendance
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({ message: 'Attendance record deleted successfully' })
  } catch (error) {
    console.error('Error deleting attendance record:', error)
    return NextResponse.json({ error: 'Failed to delete attendance record' }, { status: 500 })
  }
}
