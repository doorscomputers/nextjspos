import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Get single location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const { id } = await params

    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json({ location })
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 })
  }
}

// PUT - Update location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    if (!user.permissions?.includes(PERMISSIONS.LOCATION_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { locationCode } = body

    // Validate locationCode format if provided (10-15 alphanumeric)
    if (locationCode && !/^[A-Z0-9]{10,15}$/i.test(locationCode)) {
      return NextResponse.json({
        error: 'Invalid location code format. Must be 10-15 alphanumeric characters.'
      }, { status: 400 })
    }

    // Check locationCode uniqueness if provided and changed
    if (locationCode) {
      const existingLocation = await prisma.businessLocation.findFirst({
        where: {
          locationCode: locationCode.toUpperCase(),
          id: { not: parseInt(id) } // Exclude current location
        }
      })
      if (existingLocation) {
        return NextResponse.json({
          error: 'This RFID code is already assigned to another location. Please use a unique code.'
        }, { status: 409 })
      }
    }

    const location = await prisma.businessLocation.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        name: body.name,
        landmark: body.landmark,
        country: body.country,
        state: body.state,
        city: body.city,
        zipCode: body.zipCode,
        mobile: body.mobile,
        alternateNumber: body.alternateNumber,
        email: body.email,
        locationCode: locationCode ? locationCode.toUpperCase() : null,
      }
    })

    return NextResponse.json({ location, message: 'Location updated successfully' })
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}

// DELETE - Soft delete location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    if (!user.permissions?.includes(PERMISSIONS.LOCATION_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.businessLocation.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Location deleted successfully' })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
  }
}
