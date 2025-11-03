import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/attendance
 * List attendance records
 * Query params:
 *   - userId: Filter by specific user
 *   - locationId: Filter by location
 *   - startDate: Filter records from this date
 *   - endDate: Filter records to this date
 *   - status: Filter by status (clocked_in, clocked_out)
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
    const userId = searchParams.get('userId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    // Check permission - users can always view their own attendance
    const canViewAll = user.permissions?.includes(PERMISSIONS.ATTENDANCE_VIEW) ||
                      user.permissions?.includes(PERMISSIONS.ATTENDANCE_MANAGE)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.ATTENDANCE_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    // If user can only view own, restrict to their records
    if (!canViewAll && canViewOwn) {
      where.userId = currentUserId
    } else if (userId) {
      // If user can view all and filtered by userId
      where.userId = parseInt(userId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      where.clockIn = {}

      if (startDate) {
        where.clockIn.gte = new Date(startDate)
      }

      if (endDate) {
        where.clockIn.lte = new Date(endDate)
      }
    }

    if (status === 'clocked_in') {
      where.clockOut = null
    } else if (status === 'clocked_out') {
      where.clockOut = { not: null }
    }

    // Fetch attendance records with relations
    const attendanceRecords = await prisma.attendance.findMany({
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
        switchedToLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        switchApprover: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        locationChangeRequests: {
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
            approvedByUser: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              }
            }
          },
          orderBy: {
            requestedAt: 'desc'
          }
        }
      },
      orderBy: [
        { clockIn: 'desc' }
      ]
    })

    return NextResponse.json({ attendanceRecords })
  } catch (error) {
    console.error('Error fetching attendance records:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }
}
