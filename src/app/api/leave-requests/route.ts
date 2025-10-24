import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/leave-requests
 * List leave requests with filtering
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

    // Check permissions
    const canViewAll = user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_VIEW_ALL) ||
                       user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const leaveType = searchParams.get('leaveType')

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    // If user can only view own requests
    if (!canViewAll && canViewOwn) {
      where.userId = currentUserId
    } else if (userId) {
      where.userId = parseInt(userId)
    }

    if (status) {
      where.status = status
    }

    if (leaveType) {
      where.leaveType = leaveType
    }

    if (startDate || endDate) {
      where.startDate = {}
      if (startDate) {
        where.startDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate)
      }
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
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
        },
        replacementUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
      },
      orderBy: {
        requestedAt: 'desc'
      }
    })

    return NextResponse.json({ leaveRequests })
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

/**
 * POST /api/leave-requests
 * Create new leave request
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

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_CREATE)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()

    // Validation
    if (!body.leaveType || !body.startDate || !body.endDate || !body.reason) {
      return NextResponse.json({
        error: 'Missing required fields: leaveType, startDate, endDate, reason'
      }, { status: 400 })
    }

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    if (startDate > endDate) {
      return NextResponse.json({
        error: 'Start date must be before or equal to end date'
      }, { status: 400 })
    }

    // Check for overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId: currentUserId,
        businessId,
        status: {
          in: ['pending', 'approved']
        },
        deletedAt: null,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } }
            ]
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } }
            ]
          }
        ]
      }
    })

    if (overlapping) {
      return NextResponse.json({
        error: 'You already have a leave request for overlapping dates'
      }, { status: 400 })
    }

    // Calculate total days
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // Adjust for half days
    if (body.isStartHalfDay) {
      totalDays -= 0.5
    }
    if (body.isEndHalfDay) {
      totalDays -= 0.5
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        businessId,
        userId: currentUserId,
        leaveType: body.leaveType,
        startDate,
        endDate,
        totalDays,
        isStartHalfDay: body.isStartHalfDay || false,
        isEndHalfDay: body.isEndHalfDay || false,
        reason: body.reason,
        replacementUserId: body.replacementUserId ? parseInt(body.replacementUserId) : null,
        emergencyContact: body.emergencyContact,
        status: 'pending',
        requestedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        replacementUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Leave request created successfully',
      leaveRequest
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 })
  }
}
