import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/location-changes/[id]/approve
 * Approve a location change request and switch the employee's location
 * Body (optional):
 *   - notes: Optional approval notes
 */
export async function POST(
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
    if (!user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE) &&
        !user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions to approve requests' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))

    // Fetch the request with all relations
    const locationRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      include: {
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        fromLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        toLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        requestedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    if (!locationRequest) {
      return NextResponse.json({ error: 'Location change request not found' }, { status: 404 })
    }

    if (locationRequest.status !== 'pending') {
      return NextResponse.json({
        error: `Request has already been ${locationRequest.status}`,
        request: locationRequest
      }, { status: 409 })
    }

    // Verify attendance is still active (not clocked out)
    if (locationRequest.attendance.clockOutTime) {
      return NextResponse.json({
        error: 'Cannot approve request. The employee has already clocked out.'
      }, { status: 409 })
    }

    // Verify X-Reading has been provided if required
    if (locationRequest.xReadingRequired && !locationRequest.xReadingData) {
      return NextResponse.json({
        error: 'X-Reading is required before approving this location change. The employee must generate an X-Reading first.',
        xReadingRequired: true,
        cashierShiftId: locationRequest.cashierShiftId
      }, { status: 400 })
    }

    const now = new Date()

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the location change request
      const updatedRequest = await tx.locationChangeRequest.update({
        where: {
          id: parseInt(id),
        },
        data: {
          status: 'approved',
          approvedBy: currentUserId,
          approvedAt: now,
          switchTime: now,
          notes: body.notes || null,
        }
      })

      // 2. Update the attendance record to reflect new location
      const updatedAttendance = await tx.attendance.update({
        where: {
          id: locationRequest.attendanceId,
        },
        data: {
          locationId: locationRequest.toLocationId,
          notes: locationRequest.attendance.notes
            ? `${locationRequest.attendance.notes}\n\n[${now.toISOString()}] Location changed from ${locationRequest.fromLocation.name} to ${locationRequest.toLocation.name} (Approved by manager)`
            : `[${now.toISOString()}] Location changed from ${locationRequest.fromLocation.name} to ${locationRequest.toLocation.name} (Approved by manager)`,
          updatedAt: now,
        }
      })

      return { updatedRequest, updatedAttendance }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'APPROVE',
        entityType: 'LocationChangeRequest',
        entityId: parseInt(id),
        changes: {
          old: { status: 'pending' },
          new: { status: 'approved' },
          approvedBy: {
            id: currentUserId,
            username: user.username
          },
          employee: locationRequest.requestedByUser,
          fromLocation: locationRequest.fromLocation,
          toLocation: locationRequest.toLocation,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    // TODO: Create notification for employee that request was approved

    return NextResponse.json({
      request: result.updatedRequest,
      message: `Location change approved. ${locationRequest.requestedByUser.firstName || locationRequest.requestedByUser.username} has been moved from ${locationRequest.fromLocation.name} to ${locationRequest.toLocation.name}.`
    })
  } catch (error) {
    console.error('Error approving location change request:', error)
    return NextResponse.json({
      error: 'Failed to approve location change request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
