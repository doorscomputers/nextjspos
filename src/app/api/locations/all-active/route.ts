import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET - Fetch ALL active locations for the user's business
 * This endpoint is specifically for transfer reports where users need to see
 * all locations regardless of their assigned locations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    console.log('=== All Active Locations API ===')
    console.log('User:', user.username)
    console.log('Business ID:', businessId)

    // Fetch ALL active locations for this business (no RBAC filtering)
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    console.log('Returned all active locations count:', locations.length)
    console.log('Location names:', locations.map(l => l.name))

    return NextResponse.json({ success: true, data: locations })
  } catch (error) {
    console.error('Error fetching all active locations:', error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}

