import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/shifts - Get cashier shifts
 * Query params:
 * - status: 'open' | 'closed' | 'all'
 * - userId: Filter by specific user (defaults to current user)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'open'
    const userId = searchParams.get('userId') || session.user.id

    // Permission check - can view all shifts or just own shifts
    const canViewAll = hasPermission(session.user, PERMISSIONS.SHIFT_VIEW_ALL)
    if (!canViewAll && userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden - Cannot view other users shifts' }, { status: 403 })
    }

    const whereClause: any = {
      businessId: parseInt(session.user.businessId),
      userId: parseInt(userId),
    }

    if (status !== 'all') {
      whereClause.status = status
    }

    const shifts = await prisma.cashierShift.findMany({
      where: whereClause,
      orderBy: { openedAt: 'desc' },
      take: 50,
    })

    // Manually fetch location names for each shift
    const shiftsWithLocation = await Promise.all(
      shifts.map(async (shift) => {
        const location = await prisma.businessLocation.findUnique({
          where: { id: shift.locationId },
          select: { id: true, name: true },
        })
        return {
          ...shift,
          location,
        }
      })
    )

    return NextResponse.json({ shifts: shiftsWithLocation })
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

    const body = await request.json()
    const { beginningCash, locationId, openingNotes } = body

    // Validate required fields
    if (!beginningCash || beginningCash < 0) {
      return NextResponse.json({ error: 'Beginning cash must be a positive number' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    // Check if user already has an open shift
    const existingOpenShift = await prisma.cashierShift.findFirst({
      where: {
        userId: parseInt(session.user.id),
        status: 'open',
        businessId: parseInt(session.user.businessId),
      },
    })

    if (existingOpenShift) {
      return NextResponse.json(
        { error: 'You already have an open shift. Please close it before opening a new one.' },
        { status: 400 }
      )
    }

    // Generate shift number
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
    const shiftCount = await prisma.cashierShift.count({
      where: {
        businessId: parseInt(session.user.businessId),
        openedAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    })
    const shiftNumber = `SHIFT-${dateStr}-${String(shiftCount + 1).padStart(4, '0')}`

    // Create new shift
    const shift = await prisma.cashierShift.create({
      data: {
        businessId: parseInt(session.user.businessId),
        locationId: parseInt(locationId),
        userId: parseInt(session.user.id),
        shiftNumber,
        openedAt: new Date(),
        beginningCash: parseFloat(beginningCash),
        openingNotes: openingNotes || null,
        status: 'open',
      },
    })

    // Log audit trail
    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username || session.user.name || 'Unknown',
      action: AuditAction.SHIFT_OPEN,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Opened shift ${shiftNumber} with beginning cash ₱${beginningCash}`,
      metadata: { shiftNumber, beginningCash, locationId },
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
