import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Fetch user's assigned locations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = user.id
    const businessId = user.businessId

    // If user has ACCESS_ALL_LOCATIONS permission, return all business locations
    // BUT prioritize their actual assigned locations first
    if (user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)) {
      // First, get user's actual assigned locations
      const userAssignments = await prisma.userLocation.findMany({
        where: {
          userId: parseInt(userId),
        },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              deletedAt: true,
            },
          },
        },
      })

      const assignedLocationIds = userAssignments
        .filter(ul => ul.location && ul.location.deletedAt === null)
        .map(ul => ul.location.id)

      // Then get all business locations
      const allLocations = await prisma.businessLocation.findMany({
        where: {
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      })

      // Mark which locations are assigned vs accessible
      const locationsWithFlags = allLocations.map(loc => ({
        ...loc,
        isAssigned: assignedLocationIds.includes(loc.id),
      }))

      // Sort so assigned locations come first, then others alphabetically
      const sortedLocations = locationsWithFlags.sort((a, b) => {
        // Assigned locations come first
        if (a.isAssigned && !b.isAssigned) return -1
        if (!a.isAssigned && b.isAssigned) return 1
        // Within each group, sort alphabetically
        return a.name.localeCompare(b.name)
      })

      return NextResponse.json({
        locations: sortedLocations,
        hasAccessToAll: true,
        primaryLocationId: assignedLocationIds.length > 0 ? assignedLocationIds[0] : null,
      })
    }

    // Otherwise, fetch user's assigned locations
    const userLocations = await prisma.userLocation.findMany({
      where: {
        userId: parseInt(userId),
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    })

    const locations = userLocations
      .filter(ul => ul.location && ul.location.deletedAt === null)
      .map(ul => ({
        ...ul.location,
        isAssigned: true, // All locations here are assigned
      }))

    return NextResponse.json({
      locations,
      hasAccessToAll: false,
      primaryLocationId: locations.length > 0 ? locations[0].id : null,
    })
  } catch (error) {
    console.error('Error fetching user locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user locations' },
      { status: 500 }
    )
  }
}
