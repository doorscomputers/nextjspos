import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/leave-requests/[id]
 * Get single leave request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const leaveRequestId = parseInt(params.id)

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        businessId,
        deletedAt: null,
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
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Check permissions
    const canViewAll = user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_VIEW_ALL) ||
                       user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_VIEW_OWN)

    if (!canViewAll && (!canViewOwn || leaveRequest.userId !== currentUserId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json({ leaveRequest })
  } catch (error) {
    console.error('Error fetching leave request:', error)
    return NextResponse.json({ error: 'Failed to fetch leave request' }, { status: 500 })
  }
}

/**
 * PUT /api/leave-requests/[id]
 * Update leave request (only pending requests can be updated by requestor)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const leaveRequestId = parseInt(params.id)

    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        businessId,
        deletedAt: null,
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Only the requestor can update their own pending request
    if (existingRequest.userId !== currentUserId) {
      return NextResponse.json({
        error: 'You can only update your own leave requests'
      }, { status: 403 })
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({
        error: 'Only pending leave requests can be updated'
      }, { status: 400 })
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

    // Check for overlapping leave requests (excluding current request)
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId: currentUserId,
        businessId,
        id: { not: leaveRequestId },
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

    // Update leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        leaveType: body.leaveType,
        startDate,
        endDate,
        totalDays,
        isStartHalfDay: body.isStartHalfDay || false,
        isEndHalfDay: body.isEndHalfDay || false,
        reason: body.reason,
        replacementUserId: body.replacementUserId ? parseInt(body.replacementUserId) : null,
        emergencyContact: body.emergencyContact,
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
      message: 'Leave request updated successfully',
      leaveRequest: updatedRequest
    })
  } catch (error) {
    console.error('Error updating leave request:', error)
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 })
  }
}

/**
 * DELETE /api/leave-requests/[id]
 * Cancel/delete leave request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const leaveRequestId = parseInt(params.id)

    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        businessId,
        deletedAt: null,
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Check if user can delete (own request or has manage permission)
    const canManage = user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)
    if (existingRequest.userId !== currentUserId && !canManage) {
      return NextResponse.json({
        error: 'You can only cancel your own leave requests'
      }, { status: 403 })
    }

    // Cannot delete approved requests that have already started
    if (existingRequest.status === 'approved' && new Date() >= existingRequest.startDate) {
      return NextResponse.json({
        error: 'Cannot cancel approved leave that has already started'
      }, { status: 400 })
    }

    // Soft delete
    await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        deletedAt: new Date(),
        status: 'cancelled'
      }
    })

    return NextResponse.json({ message: 'Leave request cancelled successfully' })
  } catch (error) {
    console.error('Error deleting leave request:', error)
    return NextResponse.json({ error: 'Failed to cancel leave request' }, { status: 500 })
  }
}
