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
    if (user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)) {
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

      return NextResponse.json({
        locations: allLocations,
        hasAccessToAll: true,
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
      .map(ul => ul.location)

    return NextResponse.json({
      locations,
      hasAccessToAll: false,
    })
  } catch (error) {
    console.error('Error fetching user locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user locations' },
      { status: 500 }
    )
  }
}
