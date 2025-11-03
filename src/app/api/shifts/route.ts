import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/shifts - Get cashier shifts
 * Query params:
 * - status: 'open' | 'closed' | 'all'
 * - userId: Filter by specific user (defaults to current user)
 * - shiftId: Get a specific shift by ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'open'
    const userId = searchParams.get('userId')
    const shiftId = searchParams.get('shiftId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const user = session.user as any

    // CRITICAL: Get user's assigned locations with Super Admin/All Branch Admin exception
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
    }

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(session.user.businessId),
    }

    // Filter by specific shift ID if provided
    if (shiftId) {
      whereClause.id = parseInt(shiftId)
    }

    // Filter by status if not 'all' (and no specific shiftId)
    if (status !== 'all' && !shiftId) {
      whereClause.status = status
    }

    // Filter by location access
    if (userLocationIds.length > 0) {
      whereClause.locationId = { in: userLocationIds }
    }

    // Filter by specific user if requested AND has permission
    if (userId) {
      const canViewAll = hasPermission(session.user, PERMISSIONS.SHIFT_VIEW_ALL)
      if (!canViewAll && userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden - Cannot view other users shifts' }, { status: 403 })
      }
      whereClause.userId = parseInt(userId)
    }

    // Get all unique user IDs and location IDs from shifts
    const shifts = await prisma.cashierShift.findMany({
      where: whereClause,
      orderBy: { openedAt: 'desc' },
      take: Math.min(limit, 200), // Max 200 to prevent abuse
    })

    // Batch fetch all users and locations to avoid N+1 queries
    const userIds = [...new Set(shifts.map(shift => shift.userId))]
    const locationIds = [...new Set(shifts.map(shift => shift.locationId))]

    const [users, locations] = await Promise.all([
      // Fetch all users in one query
      userIds.length > 0 ? prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          surname: true,
        },
      }) : [],
      // Fetch all locations in one query
      locationIds.length > 0 ? prisma.businessLocation.findMany({
        where: { id: { in: locationIds } },
        select: {
          id: true,
          name: true,
        },
      }) : [],
    ])

    // Create lookup maps for O(1) access
    const userMap = new Map(users.map(user => [user.id, user]))
    const locationMap = new Map(locations.map(location => [location.id, location]))

    // Combine data without additional database queries
    const shiftsWithDetails = shifts.map(shift => {
      const user = userMap.get(shift.userId)
      const location = locationMap.get(shift.locationId)

      return {
        ...shift,
        user: user ? {
          id: user.id,
          username: user.username,
          name: `${user.firstName} ${user.lastName || ''}`.trim() || user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          surname: user.surname,
        } : {
          id: shift.userId,
          username: 'Unknown',
          name: 'Unknown User',
          firstName: 'Unknown',
          lastName: null,
          surname: 'Unknown',
        },
        location: location || { id: shift.locationId, name: 'Unknown Location' },
      }
    })

    return NextResponse.json({ shifts: shiftsWithDetails })
  } catch (error: any) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shifts - Open a new cashier shift
 * Body: { beginningCash: number, locationId: number, openingNotes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SHIFT_OPEN)) {
      return NextResponse.json({ error: 'Forbidden - Missing shift.open permission' }, { status: 403 })
    }

    const user = session.user as any

    const body = await request.json()
    const { beginningCash, locationId, openingNotes } = body

    console.log('[POST /api/shifts] Shift creation request:', {
      userId: user.id,
      username: user.username,
      beginningCash,
      locationId,
      hasOpeningNotes: !!openingNotes
    })

    // Validate required fields
    if (!beginningCash || parseFloat(beginningCash) <= 0) {
      console.error('[POST /api/shifts] REJECTED: Invalid beginning cash:', beginningCash)
      return NextResponse.json({
        error: 'Beginning cash is required and must be greater than zero'
      }, { status: 400 })
    }

    if (!locationId) {
      console.error('[POST /api/shifts] REJECTED: Missing location ID')
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    // Check if user already has an open shift
    const existingOpenShift = await prisma.cashierShift.findFirst({
      where: {
        userId: parseInt(user.id),
        status: 'open',
        businessId: parseInt(user.businessId),
      },
    })

    if (existingOpenShift) {
      // Fetch location separately since relation doesn't exist in schema
      const location = await prisma.businessLocation.findUnique({
        where: { id: existingOpenShift.locationId },
        select: { name: true },
      })

      const shiftStart = new Date(existingOpenShift.openedAt)
      const hoursSinceOpen = Math.floor((new Date().getTime() - shiftStart.getTime()) / (1000 * 60 * 60))
      const daysSinceOpen = Math.floor(hoursSinceOpen / 24)

      return NextResponse.json(
        {
          error: 'You already have an open shift. Please close it before opening a new one.',
          unclosedShift: {
            shiftNumber: existingOpenShift.shiftNumber,
            openedAt: existingOpenShift.openedAt,
            locationName: location?.name || 'Unknown Location',
            hoursSinceOpen,
            daysSinceOpen,
            isOverdue: daysSinceOpen >= 1,
          },
        },
        { status: 400 }
      )
    }

    // Generate shift number
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
    const shiftCount = await prisma.cashierShift.count({
      where: {
        businessId: parseInt(user.businessId),
        openedAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    })
    const shiftNumber = `SHIFT-${dateStr}-${String(shiftCount + 1).padStart(4, '0')}`

    // Create new shift
    const shift = await prisma.cashierShift.create({
      data: {
        businessId: parseInt(user.businessId),
        locationId: parseInt(locationId),
        userId: parseInt(user.id),
        shiftNumber,
        openedAt: new Date(),
        beginningCash: parseFloat(beginningCash),
        openingNotes: openingNotes || null,
        status: 'open',
      },
    })

    // Log audit trail
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username || user.name || 'Unknown',
      action: AuditAction.SHIFT_OPEN,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Opened shift ${shiftNumber} with beginning cash ₱${beginningCash}`,
      metadata: { shiftNumber, beginningCash, locationId },
    })

    console.log('[POST /api/shifts] ✓ Shift created successfully:', {
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      beginningCash: shift.beginningCash,
      locationId: shift.locationId,
      userId: shift.userId
    })

    return NextResponse.json({ shift }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift', details: error.message },
      { status: 500 }
    )
  }
}
