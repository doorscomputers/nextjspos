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
 * ⚠️ BIR COMPLIANCE: Z-Reading should ONLY be generated when closing a shift
 * - One shift = One Z Reading (no duplicates)
 * - Z Reading closes the shift permanently
 * - Reading numbers are globally sequential per location
 *
 * This endpoint is deprecated for manual use. Z Readings are automatically generated during shift closure.
 * For viewing historical Z readings, use /api/readings/history
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

    // BIR COMPLIANCE: Check if this is for a closed shift (view-only mode)
    const viewOnly = searchParams.get('viewOnly') === 'true'

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
        select: { id: true, status: true, locationId: true },
      })

      if (!shift) {
        return NextResponse.json(
          { error: 'No shift found for Z Reading at your assigned location' },
          { status: 404 }
        )
      }
      shiftId = shift.id

      // BIR COMPLIANCE: Check if shift already has a Z reading
      const existingZReading = await prisma.cashierShiftReading.findFirst({
        where: {
          shiftId: shift.id,
          type: 'Z',
        },
      })

      if (existingZReading && !viewOnly) {
        return NextResponse.json(
          {
            error: 'BIR Compliance Error: This shift already has a Z Reading. Z Reading can only be generated once per shift during shift closure.',
            existingReading: {
              readingNumber: existingZReading.readingNumber,
              readingTime: existingZReading.readingTime,
              reportNumber: existingZReading.reportNumber,
            }
          },
          { status: 400 }
        )
      }

      // BIR COMPLIANCE: Prevent Z reading generation for open shifts
      if (shift.status === 'open' && !viewOnly) {
        return NextResponse.json(
          {
            error: 'BIR Compliance Error: Cannot generate Z Reading for an open shift. Z Reading is automatically generated when you close the shift. Please use the shift close function.',
          },
          { status: 400 }
        )
      }

    } else {
      // Prevent automatic Z reading for current shift
      return NextResponse.json(
        {
          error: 'BIR Compliance Error: Manual Z Reading generation is not allowed. Z Readings are automatically generated when closing a shift. Please close your shift to generate the Z Reading.',
        },
        { status: 400 }
      )
    }

    // If viewOnly mode, just retrieve the existing Z reading data
    if (viewOnly) {
      const existingZReading = await prisma.cashierShiftReading.findFirst({
        where: {
          shiftId: shiftId,
          type: 'Z',
        },
      })

      if (existingZReading) {
        return NextResponse.json(existingZReading.payload)
      } else {
        return NextResponse.json(
          { error: 'No Z Reading found for this shift' },
          { status: 404 }
        )
      }
    }

    // This code should never be reached due to the validations above
    // But kept for backward compatibility with closed shifts that don't have Z readings yet
    const zReading = await generateZReading(
      shiftId,
      parseInt(businessId),
      session.user.username,
      user.id,
      false // Do NOT increment counter (already closed)
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
