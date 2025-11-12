/**
 * ============================================================================
 * ACTIVE USERS API V2 (Activity Tracking Based)
 * ============================================================================
 *
 * PURPOSE: Show currently active users using activity tracking (JWT compatible)
 *
 * WHAT'S DIFFERENT FROM V1:
 * - V1 used Session table (empty with JWT auth)
 * - V2 uses UserActivity table (tracks last seen timestamps)
 * - Works perfectly with JWT-based authentication
 *
 * ENDPOINT: GET /api/admin/active-users-v2
 *
 * QUERY PARAMETERS:
 * - minutesAgo: Time window to consider "active" (default: 5 minutes)
 *   Examples: ?minutesAgo=5  (last 5 minutes)
 *             ?minutesAgo=30 (last 30 minutes)
 *
 * PERMISSIONS REQUIRED:
 * - USER_VIEW_ACTIVE_SESSIONS
 *
 * RESPONSE FORMAT:
 * {
 *   locations: [
 *     {
 *       locationId: 1,
 *       locationName: "Main Store",
 *       locationCode: "MS",
 *       isActive: true,
 *       totalUsers: 3,
 *       totalCashiers: 1,
 *       users: [...],
 *       cashiers: [...]
 *     }
 *   ],
 *   unassignedUsers: [...],
 *   summary: {
 *     totalActiveUsers: 5,
 *     totalLocations: 2,
 *     totalUnassignedUsers: 1,
 *     timeWindow: 5
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'
import { getActiveUsers, trackUserActivity } from '@/lib/activity-tracker'

export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view active users' },
        { status: 403 }
      )
    }

    const businessId = session.user.businessId
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID not found' }, { status: 400 })
    }

    const businessIdInt = parseInt(businessId.toString(), 10)

    // Track current user's activity (they're using the system right now!)
    await trackUserActivity(parseInt(session.user.id.toString()), request)

    // ========================================================================
    // QUERY PARAMETERS
    // ========================================================================
    const searchParams = request.nextUrl.searchParams
    const minutesAgo = parseInt(searchParams.get('minutesAgo') || '5', 10)

    // Validate time window
    if (minutesAgo < 1 || minutesAgo > 1440) {
      // Max 24 hours
      return NextResponse.json(
        { error: 'Invalid time window. Must be between 1 and 1440 minutes.' },
        { status: 400 }
      )
    }

    // ========================================================================
    // FETCH ACTIVE USERS
    // ========================================================================
    const activeUsers = await getActiveUsers(businessIdInt, minutesAgo)

    // ========================================================================
    // GROUP BY LOCATION
    // ========================================================================
    const locationGroups: Record<string, any[]> = {}
    const unassignedUsers: any[] = []

    activeUsers.forEach((activity) => {
      const user = activity.user
      const roles = user.roles.map((ur) => ur.role.name)
      const isCashier = roles.some((role) =>
        role.toLowerCase().includes('cashier') || role.toLowerCase().includes('sale')
      )

      const userData = {
        id: user.id,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName || ''}`.trim(),
        surname: user.surname,
        roles: roles,
        isCashier: isCashier,
        lastSeenAt: activity.lastSeenAt,
        email: user.email,
        ipAddress: activity.ipAddress,
        deviceType: activity.deviceType,
        browser: activity.browser,
        currentUrl: activity.currentUrl
      }

      // Group by location
      if (user.userLocations.length > 0) {
        user.userLocations.forEach((ul) => {
          const locationId = ul.location.id.toString()

          if (!locationGroups[locationId]) {
            locationGroups[locationId] = []
          }

          locationGroups[locationId].push({
            ...userData,
            locationName: ul.location.name,
            locationId: ul.location.id,
            locationCode: ul.location.locationCode
          })
        })
      } else {
        // User not assigned to any location
        unassignedUsers.push(userData)
      }
    })

    // ========================================================================
    // FETCH LOCATION DETAILS
    // ========================================================================
    const locationIds = Object.keys(locationGroups).map((id) => parseInt(id))
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: businessIdInt,
        id: {
          in: locationIds
        }
      },
      select: {
        id: true,
        name: true,
        locationCode: true,
        isActive: true
      }
    })

    // ========================================================================
    // BUILD RESPONSE
    // ========================================================================
    const response = {
      locations: locations.map((location) => {
        const users = locationGroups[location.id.toString()] || []
        const cashiers = users.filter((u) => u.isCashier)

        return {
          locationId: location.id,
          locationName: location.name,
          locationCode: location.locationCode,
          isActive: location.isActive,
          totalUsers: users.length,
          totalCashiers: cashiers.length,
          users: users,
          cashiers: cashiers
        }
      }),
      unassignedUsers: unassignedUsers,
      summary: {
        totalActiveUsers: activeUsers.length,
        totalLocations: locations.length,
        totalUnassignedUsers: unassignedUsers.length,
        timeWindow: minutesAgo
      }
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[Active Users V2] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch active users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
