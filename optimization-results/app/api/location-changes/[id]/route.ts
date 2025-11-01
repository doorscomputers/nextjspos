import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/location-changes/[id]
 * Get a specific location change request
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

    const locationRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      },
      select: {
        attendance: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            clockInTime: { select: { id: true, name: true } },
            clockOutTime: { select: { id: true, name: true } },
            user: {
              select: {
                id: { select: { id: true, name: true } },
                username: { select: { id: true, name: true } },
                firstName: { select: { id: true, name: true } },
                lastName: { select: { id: true, name: true } },
              }
            }
          }
        },
        fromLocation: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
        toLocation: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
        requestedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
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
      }
    })

    if (!locationRequest) {
      return NextResponse.json({ error: 'Location change request not found' }, { status: 404 })
    }

    // Check permission - users can view their own requests or if they have permission
    const canViewAll = user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW) ||
                      user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)
    const isOwnRequest = locationRequest.requestedBy === currentUserId

    if (!canViewAll && !isOwnRequest) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json({ request: locationRequest })
  } catch (error) {
    console.error('Error fetching location change request:', error)
    return NextResponse.json({ error: 'Failed to fetch location change request' }, { status: 500 })
  }
}

/**
 * DELETE /api/location-changes/[id]
 * Cancel a location change request (only if pending)
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

    // Fetch the request
    const locationRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      }
    })

    if (!locationRequest) {
      return NextResponse.json({ error: 'Location change request not found' }, { status: 404 })
    }

    // Only the requester or managers can cancel
    const canManage = user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)
    const isOwnRequest = locationRequest.requestedBy === currentUserId

    if (!canManage && !isOwnRequest) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Can only cancel pending requests
    if (locationRequest.status !== 'pending') {
      return NextResponse.json({
        error: `Cannot cancel request that has already been ${locationRequest.status}`
      }, { status: 409 })
    }

    // Soft delete (cancel) the request
    await prisma.locationChangeRequest.update({
      where: {
        id: parseInt(id),
      },
      data: {
        deletedAt: new Date(),
        status: 'cancelled',
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'CANCEL',
        entityType: 'LocationChangeRequest',
        entityId: parseInt(id),
        changes: {
          old: locationRequest,
          cancelledBy: {
            id: currentUserId,
            username: user.username
          }
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({ message: 'Location change request cancelled successfully' })
  } catch (error) {
    console.error('Error cancelling location change request:', error)
    return NextResponse.json({ error: 'Failed to cancel location change request' }, { status: 500 })
  }
}
