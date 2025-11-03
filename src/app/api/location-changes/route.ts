import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/location-changes
 * List location change requests
 * Query params:
 *   - status: Filter by status (pending, approved, rejected)
 *   - userId: Filter by user
 *   - attendanceId: Filter by attendance record
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const attendanceId = searchParams.get('attendanceId')

    // Check permission
    const canViewAll = user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW) ||
                      user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE) ||
                      user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE)

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    // If user doesn't have view all permission, they can only see their own requests
    if (!canViewAll) {
      where.requestedBy = currentUserId
    } else if (userId) {
      where.requestedBy = parseInt(userId)
    }

    if (status) {
      where.status = status
    }

    if (attendanceId) {
      where.attendanceId = parseInt(attendanceId)
    }

    const requests = await prisma.locationChangeRequest.findMany({
      where,
      include: {
        attendance: {
          select: {
            id: true,
            clockInTime: true,
            clockOutTime: true,
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
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: [
        { requestedAt: 'desc' }
      ]
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching location change requests:', error)
    return NextResponse.json({ error: 'Failed to fetch location change requests' }, { status: 500 })
  }
}

/**
 * POST /api/location-changes
 * Create a location change request
 * Body:
 *   - attendanceId: Active attendance record ID
 *   - toLocationId: Destination location ID
 *   - reason: Reason for location change
 *   - xReadingData: Optional X-Reading data if required
 *   - cashCountData: Optional cash count data if required
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
    if (!user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_CREATE)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.attendanceId || !body.toLocationId || !body.reason) {
      return NextResponse.json({
        error: 'Missing required fields: attendanceId, toLocationId, reason'
      }, { status: 400 })
    }

    // Verify attendance record exists and belongs to the user
    const attendance = await prisma.attendance.findFirst({
      where: {
        id: parseInt(body.attendanceId),
        userId: currentUserId,
        businessId,
        clockOutTime: null, // Must be actively clocked in
        deletedAt: null,
      },
      include: {
        location: true
      }
    })

    if (!attendance) {
      return NextResponse.json({
        error: 'Active attendance record not found. You must be clocked in to request a location change.'
      }, { status: 404 })
    }

    // Validate destination location
    const toLocation = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(body.toLocationId),
        businessId,
      }
    })

    if (!toLocation) {
      return NextResponse.json({
        error: 'Destination location not found or does not belong to your business'
      }, { status: 404 })
    }

    // Cannot request change to same location
    if (attendance.locationId === parseInt(body.toLocationId)) {
      return NextResponse.json({
        error: 'Cannot request location change to the same location'
      }, { status: 400 })
    }

    // Check if there's already a pending request for this attendance
    const pendingRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        attendanceId: attendance.id,
        status: 'pending',
        deletedAt: null,
      }
    })

    if (pendingRequest) {
      return NextResponse.json({
        error: 'You already have a pending location change request for this shift',
        request: pendingRequest
      }, { status: 409 })
    }

    // Check if user has an open cashier shift at current location
    const openShift = await prisma.cashierShift.findFirst({
      where: {
        userId: currentUserId,
        locationId: attendance.locationId,
        businessId,
        status: 'open',
      }
    })

    // X-Reading is required if there's an open cashier shift
    const xReadingRequired = !!openShift

    // If X-Reading is provided, validate and store it
    let xReadingData = null
    if (body.xReadingData && xReadingRequired) {
      xReadingData = body.xReadingData
    }

    // Create the location change request
    const locationChangeRequest = await prisma.locationChangeRequest.create({
      data: {
        businessId,
        attendanceId: attendance.id,
        fromLocationId: attendance.locationId,
        toLocationId: parseInt(body.toLocationId),
        requestedBy: currentUserId,
        requestedAt: new Date(),
        reason: body.reason,
        xReadingRequired,
        xReadingData: xReadingData ? xReadingData : undefined,
        xReadingGeneratedAt: xReadingData ? new Date() : undefined,
        cashierShiftId: openShift?.id || undefined,
        status: 'pending',
      },
      include: {
        attendance: {
          select: {
            id: true,
            clockInTime: true,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'CREATE',
        entityType: 'LocationChangeRequest',
        entityId: locationChangeRequest.id,
        changes: {
          new: locationChangeRequest
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    // TODO: Create notification for managers to approve request

    return NextResponse.json({
      request: locationChangeRequest,
      message: `Location change request created. Waiting for manager approval to switch from ${attendance.location.name} to ${toLocation.name}.`
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating location change request:', error)
    return NextResponse.json({ error: 'Failed to create location change request' }, { status: 500 })
  }
}
