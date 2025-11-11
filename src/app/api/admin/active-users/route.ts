import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

/**
 * GET /api/admin/active-users
 * Fetches currently logged-in users grouped by location
 * Shows active sessions within the last 30 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Get session and check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission using RBAC function (handles Super Admin properly)
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view active users' }, { status: 403 })
    }

    const businessId = session.user.businessId
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID not found' }, { status: 400 })
    }

    // Parse businessId as integer (comes as string from session)
    const businessIdInt = parseInt(businessId.toString(), 10)

    // Calculate time threshold (30 minutes ago)
    const thirtyMinutesAgo = new Date()
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)

    // Fetch active sessions (not expired and recent)
    const activeSessions = await prisma.session.findMany({
      where: {
        expires: {
          gte: new Date(), // Session not expired
        },
        user: {
          businessId: businessIdInt,
        },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            userLocations: {
              include: {
                location: true,
              },
            },
          },
        },
      },
      orderBy: {
        expires: 'desc',
      },
    })

    // Group users by location
    const locationGroups: Record<string, any[]> = {}
    const unassignedUsers: any[] = []

    activeSessions.forEach((session) => {
      const user = session.user
      const roles = user.roles.map((ur) => ur.role.name)
      const isCashier = roles.some((role) =>
        role.toLowerCase().includes('cashier') ||
        role.toLowerCase().includes('sale')
      )

      const userData = {
        id: user.id,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName || ''}`.trim(),
        surname: user.surname,
        roles: roles,
        isCashier: isCashier,
        sessionExpires: session.expires,
        email: user.email,
      }

      // Add to location groups
      if (user.userLocations.length > 0) {
        user.userLocations.forEach((ul) => {
          const locationName = ul.location.name
          const locationId = ul.location.id.toString()

          if (!locationGroups[locationId]) {
            locationGroups[locationId] = []
          }

          locationGroups[locationId].push({
            ...userData,
            locationName: locationName,
            locationId: ul.location.id,
          })
        })
      } else {
        // User not assigned to any location
        unassignedUsers.push(userData)
      }
    })

    // Format response with location details
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: businessIdInt,
        id: {
          in: Object.keys(locationGroups).map(id => parseInt(id)),
        },
      },
      select: {
        id: true,
        name: true,
        locationCode: true,
        isActive: true,
      },
    })

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
          cashiers: cashiers,
        }
      }),
      unassignedUsers: unassignedUsers,
      summary: {
        totalActiveSessions: activeSessions.length,
        totalLocations: locations.length,
        totalUnassignedUsers: unassignedUsers.length,
      },
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error fetching active users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
