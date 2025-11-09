import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateXReadingDataOptimized } from '@/lib/readings-optimized'

/**
 * GET /api/readings/x-reading - Generate X Reading (mid-shift, non-resetting)
 * Query params: shiftId (optional, defaults to current open shift)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.X_READING)) {
      return NextResponse.json({ error: 'Forbidden - Missing reading.x_reading permission' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const shiftIdParam = searchParams.get('shiftId')

    // CRITICAL SECURITY: Get user's assigned locations first
    // EXCEPTION: Super Admin and All Branch Admin can access all locations
    const user = session.user as any
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAllBranchAdmin = user.roles?.includes('All Branch Admin')

    let userLocationIds: number[] = []

    if (isSuperAdmin || isAllBranchAdmin) {
      // Super Admin / All Branch Admin: Get ALL locations in their business
      const allLocations = await prisma.businessLocation.findMany({
        where: {
          businessId: parseInt(user.businessId),
          deletedAt: null
        },
        select: { id: true },
      })
      userLocationIds = allLocations.map(loc => loc.id)
    } else {
      // Regular users: Get only assigned locations
      const userLocations = await prisma.userLocation.findMany({
        where: { userId: parseInt(user.id) },
        select: { locationId: true },
      })
      userLocationIds = userLocations.map(ul => ul.locationId)

      if (userLocationIds.length === 0) {
        return NextResponse.json(
          { error: 'No location assigned. Please contact your administrator.' },
          { status: 403 }
        )
      }
    }

    let shiftId: number | null = null

    if (shiftIdParam) {
      // CRITICAL: Validate that the requested shift belongs to user's assigned location
      const shift = await prisma.cashierShift.findFirst({
        where: {
          id: parseInt(shiftIdParam),
          businessId: parseInt(session.user.businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only shifts from user's locations
        },
        select: { id: true },
      })

      if (!shift) {
        return NextResponse.json(
          { error: 'No shift found for X Reading at your assigned location' },
          { status: 404 }
        )
      }
      shiftId = shift.id
    } else {
      // Get current open shift for this user at their assigned location(s)
      const shift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(session.user.id),
          status: 'open',
          businessId: parseInt(session.user.businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only user's locations
        },
        select: { id: true },
      })

      if (!shift) {
        return NextResponse.json(
          { error: 'No open shift found for X Reading at your assigned location' },
          { status: 404 }
        )
      }
      shiftId = shift.id
    }

    // Use OPTIMIZED library function to generate X Reading
    const xReading = await generateXReadingDataOptimized(
      shiftId,
      parseInt(session.user.businessId),
      session.user.username,
      session.user.id,
      true // Increment counter
    )

    return NextResponse.json({ xReading })
  } catch (error: any) {
    console.error('Error generating X Reading:', error)
    return NextResponse.json(
      { error: 'Failed to generate X Reading', details: error.message },
      { status: 500 }
    )
  }
}
