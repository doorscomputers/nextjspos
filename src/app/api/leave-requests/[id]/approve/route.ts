import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/leave-requests/[id]/approve
 * Approve leave request
 */
export async function POST(
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

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_APPROVE) &&
        !user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        businessId,
        deletedAt: null,
      },
      include: {
        user: true
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({
        error: `Leave request is already ${existingRequest.status}`
      }, { status: 400 })
    }

    // Self-approval check
    if (existingRequest.userId === currentUserId) {
      return NextResponse.json({
        error: 'You cannot approve your own leave request'
      }, { status: 400 })
    }

    const body = await request.json()

    // Get affected schedules in the date range
    const startDate = new Date(existingRequest.startDate)
    const endDate = new Date(existingRequest.endDate)

    const affectedSchedules = await prisma.employeeSchedule.findMany({
      where: {
        userId: existingRequest.userId,
        businessId,
        isActive: true,
        deletedAt: null,
        startDate: { lte: endDate },
        OR: [
          { endDate: null },
          { endDate: { gte: startDate } }
        ]
      },
      select: {
        id: true,
        dayOfWeek: true,
        location: {
          select: {
            name: true
          }
        }
      }
    })

    // Approve the request
    const approvedRequest = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'approved',
        approvedBy: currentUserId,
        approvedAt: new Date(),
        approverNotes: body.notes || null,
        affectedSchedules: {
          schedules: affectedSchedules.map(s => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            location: s.location.name
          }))
        }
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
        }
      }
    })

    return NextResponse.json({
      message: 'Leave request approved successfully',
      leaveRequest: approvedRequest
    })
  } catch (error) {
    console.error('Error approving leave request:', error)
    return NextResponse.json({ error: 'Failed to approve leave request' }, { status: 500 })
  }
}
