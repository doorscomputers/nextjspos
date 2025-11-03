import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/leave-requests/[id]/reject
 * Reject leave request
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
    if (!user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_REJECT) &&
        !user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

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

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({
        error: `Leave request is already ${existingRequest.status}`
      }, { status: 400 })
    }

    const body = await request.json()

    if (!body.reason) {
      return NextResponse.json({
        error: 'Rejection reason is required'
      }, { status: 400 })
    }

    // Reject the request
    const rejectedRequest = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'rejected',
        approvedBy: currentUserId,
        approvedAt: new Date(),
        approverNotes: body.reason,
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
      message: 'Leave request rejected successfully',
      leaveRequest: rejectedRequest
    })
  } catch (error) {
    console.error('Error rejecting leave request:', error)
    return NextResponse.json({ error: 'Failed to reject leave request' }, { status: 500 })
  }
}
