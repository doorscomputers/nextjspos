import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

// GET - Fetch all locations for user's business (filtered by user permissions)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = parseInt(user.id)

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Get query parameter to control whether to show inactive locations
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get accessible location IDs using the RBAC utility function
    let accessibleLocationIds = getUserAccessibleLocationIds(user)

    if (accessibleLocationIds !== null && accessibleLocationIds.length === 0) {
      const fallbackAssignments = await prisma.userLocation.findMany({
        where: { userId: userId },
        select: {
          locationId: true,
          location: {
            select: {
              deletedAt: true,
              isActive: true,
            },
          },
        },
      })

      accessibleLocationIds = fallbackAssignments
        .filter((assignment) => assignment.location && assignment.location.deletedAt === null && assignment.location.isActive !== false)
        .map((assignment) => assignment.locationId)
    }

    console.log('=== Locations API Debug ===')
    console.log('User ID:', userId)
    console.log('Business ID:', businessId)
    console.log('User:', user.username)
    console.log('Accessible Location IDs:', accessibleLocationIds)
    console.log('Include Inactive:', includeInactive)

    const baseWhere: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    if (!includeInactive) {
      baseWhere.isActive = true
    }

    const locations = accessibleLocationIds === null
      ? await prisma.businessLocation.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' }
      })
      : accessibleLocationIds.length === 0
        ? []
        : await prisma.businessLocation.findMany({
          where: {
            ...baseWhere,
            id: { in: accessibleLocationIds }
          },
          orderBy: { createdAt: 'desc' }
        })

    console.log('Returned locations count:', locations.length)

    return NextResponse.json({ success: true, data: locations })
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}

// POST - Create new location
export async function POST(request: NextRequest) {
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

    if (!user.permissions?.includes(PERMISSIONS.LOCATION_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      landmark,
      country,
      state,
      city,
      zipCode,
      mobile,
      alternateNumber,
      email,
      locationCode, // RFID card code
    } = body

    if (!name || !country || !state || !city || !zipCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate locationCode format if provided (10-15 alphanumeric)
    if (locationCode && !/^[A-Z0-9]{10,15}$/i.test(locationCode)) {
      return NextResponse.json({
        error: 'Invalid location code format. Must be 10-15 alphanumeric characters.'
      }, { status: 400 })
    }

    // Check locationCode uniqueness if provided
    if (locationCode) {
      const existingLocation = await prisma.businessLocation.findFirst({
        where: { locationCode: locationCode.toUpperCase() }
      })
      if (existingLocation) {
        return NextResponse.json({
          error: 'This RFID code is already assigned to another location. Please use a unique code.'
        }, { status: 409 })
      }
    }

    // Use transaction to create location and auto-initialize inventory
    const result = await prisma.$transaction(async (tx) => {
      // Create the new location
      const location = await tx.businessLocation.create({
        data: {
          businessId: parseInt(businessId),
          name,
          landmark,
          country,
          state,
          city,
          zipCode,
          mobile,
          alternateNumber,
          email,
          locationCode: locationCode ? locationCode.toUpperCase() : null,
          isActive: true
        } as any
      })

      // Get all product variations for this business
      const variations = await tx.productVariation.findMany({
        where: {
          product: {
            businessId: parseInt(businessId),
            deletedAt: null
          },
          deletedAt: null
        },
        include: {
          product: true
        }
      })

      if (variations.length > 0) {
        // Create zero inventory records for all variations at this location
        const variationLocationRecords = variations.map(variation => ({
          productId: variation.productId,
          productVariationId: variation.id,
          locationId: location.id,
          qtyAvailable: 0,
          sellingPrice: variation.sellingPrice
        }))

        // Bulk insert with skipDuplicates to handle edge cases
        await tx.variationLocationDetails.createMany({
          data: variationLocationRecords,
          skipDuplicates: true
        })

        console.log(`Created ${variationLocationRecords.length} zero-inventory records for new location: ${location.name}`)
      } else {
        console.log(`No products exist yet. Zero-inventory records will be created when products are added.`)
      }

      return location
    })

    return NextResponse.json({ location: result, message: 'Location created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
