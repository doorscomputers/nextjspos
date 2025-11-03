import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    console.log('=== My Location API Called ===')
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      console.log('No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    console.log('User ID:', userId)

    // Get user's assigned location(s)
    const userLocations = await prisma.userLocation.findMany({
      where: {
        userId: userId,
      },
      include: {
        location: true,
      },
      take: 1, // Get first assigned location
    })

    console.log('User locations found:', userLocations.length)

    if (userLocations.length === 0) {
      console.log('No location assigned to user')
      return NextResponse.json({
        error: 'No location assigned',
        location: null
      }, { status: 200 })
    }

    if (!userLocations[0]?.location) {
      console.log('Location relation is null')
      return NextResponse.json({
        error: 'Location data is missing',
        location: null
      }, { status: 200 })
    }

    const locationData = userLocations[0].location
    console.log('Returning location:', locationData.name)

    return NextResponse.json({
      location: {
        id: locationData.id,
        name: locationData.name,
        city: locationData.city || '',
        state: locationData.state || '',
      },
    })
  } catch (error: any) {
    console.error('=== ERROR in My Location API ===')
    console.error('Error:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
