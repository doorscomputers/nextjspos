import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/user/locations
 * Get current user's assigned locations
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = parseInt(String(user.id))

    // Fetch user's assigned locations
    const userLocations = await prisma.userLocation.findMany({
      where: {
        userId,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        location: {
          name: 'asc',
        },
      },
    })

    const locations = userLocations.map(ul => ({
      locationId: ul.location.id,
      locationName: ul.location.name,
    }))

    return NextResponse.json({
      locations,
      hasLocations: locations.length > 0,
    })
  } catch (error: any) {
    console.error('Error fetching user locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user locations', details: error.message },
      { status: 500 }
    )
  }
}
