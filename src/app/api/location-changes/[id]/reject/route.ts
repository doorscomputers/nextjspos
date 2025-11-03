import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/location-changes/[id]/reject
 * Reject a location change request
 * Body:
 *   - reason: Reason for rejection (required)
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
    if (!user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_REJECT) &&
        !user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)) {
      return NextResponse.json({ error: 'Insufficient permissions to reject requests' }, { status: 403 })
    }

    const body = await request.json()

    // Validate rejection reason
    if (!body.reason) {
      return NextResponse.json({
        error: 'Rejection reason is required'
      }, { status: 400 })
    }

    // Fetch the request
    const locationRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      include: {
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

    const now = new Date()

    // Update the request to rejected
    const updatedRequest = await prisma.locationChangeRequest.update({
      where: {
        id: parseInt(id),
      },
      data: {
        status: 'rejected',
        approvedBy: currentUserId,
        approvedAt: now,
        notes: `Rejected: ${body.reason}`,
      },
      include: {
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
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'REJECT',
        entityType: 'LocationChangeRequest',
        entityId: parseInt(id),
        changes: {
          old: { status: 'pending' },
          new: { status: 'rejected' },
          rejectedBy: {
            id: currentUserId,
            username: user.username
          },
          reason: body.reason,
          employee: locationRequest.requestedByUser,
          fromLocation: locationRequest.fromLocation,
          toLocation: locationRequest.toLocation,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    // TODO: Create notification for employee that request was rejected

    return NextResponse.json({
      request: updatedRequest,
      message: `Location change request rejected. ${locationRequest.requestedByUser.firstName || locationRequest.requestedByUser.username} will remain at ${locationRequest.fromLocation.name}.`
    })
  } catch (error) {
    console.error('Error rejecting location change request:', error)
    return NextResponse.json({
      error: 'Failed to reject location change request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
