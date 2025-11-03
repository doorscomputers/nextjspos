import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

/**
 * POST /api/locations/[id]/toggle-status
 * Toggle active/inactive status of a business location
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission - Only admins can enable/disable locations
    if (!hasPermission(user, PERMISSIONS.LOCATION_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to modify locations' },
        { status: 403 }
      )
    }

    const { id } = await params
    const locationId = parseInt(id)

    if (isNaN(locationId)) {
      return NextResponse.json({ error: 'Invalid location ID' }, { status: 400 })
    }

    // Get current location
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: locationId,
        businessId,
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Toggle the isActive status
    const newStatus = !(location as any).isActive

    // Update location
    const updatedLocation = await prisma.businessLocation.update({
      where: { id: locationId },
      data: {
        isActive: newStatus
      } as any
    })

    return NextResponse.json({
      success: true,
      message: `Location ${newStatus ? 'enabled' : 'disabled'} successfully`,
      location: {
        id: updatedLocation.id,
        name: updatedLocation.name,
        isActive: newStatus
      }
    })

  } catch (error) {
    console.error('Error toggling location status:', error)
    return NextResponse.json(
      { error: 'Failed to toggle location status' },
      { status: 500 }
    )
  }
}
