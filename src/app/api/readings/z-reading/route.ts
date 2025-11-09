import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateZReading } from '@/lib/readings-instant'

/**
 * GET /api/readings/z-reading - Generate Z Reading (end-of-day, BIR-compliant with counter increment)
 * Query params: shiftId (optional - uses current open shift if not provided)
 *
 * Z-Reading increments the Z-Counter and updates accumulated sales for BIR compliance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.Z_READING)) {
      return NextResponse.json({ error: 'Forbidden - Missing reading.z_reading permission' }, { status: 403 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const { searchParams } = new URL(request.url)
    const shiftIdParam = searchParams.get('shiftId')

    // CRITICAL SECURITY: Get user's assigned locations first
    // EXCEPTION: Super Admin and All Branch Admin can access all locations
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
          businessId: parseInt(businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only shifts from user's locations
        },
        select: { id: true },
      })

      if (!shift) {
        return NextResponse.json(
          { error: 'No shift found for Z Reading at your assigned location' },
          { status: 404 }
        )
      }
      shiftId = shift.id
    } else {
      // Get current open shift for this user at their assigned location(s)
      const shift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(user.id),
          businessId: parseInt(businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only user's locations
          status: 'open',
        },
        select: { id: true },
      })

      if (!shift) {
        return NextResponse.json(
          { error: 'No open shift found for Z Reading at your assigned location' },
          { status: 404 }
        )
      }
      shiftId = shift.id
    }

    // Use DUAL-MODE library function (Instant or SQL aggregation fallback)
    // Automatically uses real-time totals if available, otherwise SQL aggregation
    const zReading = await generateZReading(
      shiftId,
      parseInt(businessId),
      session.user.username,
      user.id,
      true // Increment counter
    )

    return NextResponse.json(zReading)
  } catch (error: any) {
    console.error('Error generating Z Reading:', error)
    return NextResponse.json(
      { error: 'Failed to generate Z Reading', details: error.message },
      { status: 500 }
    )
  }
}
