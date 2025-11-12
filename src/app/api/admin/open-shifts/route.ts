/**
 * ============================================================================
 * OPEN SHIFTS MONITOR API
 * ============================================================================
 *
 * PURPOSE: Monitor currently open (unclosed) cashier shifts across all locations
 *
 * ENDPOINT: GET /api/admin/open-shifts
 *
 * WHO NEEDS THIS:
 * - Managers: See which cashiers are currently working
 * - Supervisors: Monitor multiple locations
 * - Admins: Identify shifts left open accidentally
 *
 * WHAT IT SHOWS:
 * - User who owns the shift
 * - Location name
 * - Shift opened time
 * - Duration (how long shift has been open)
 * - Beginning cash
 * - Current sales total
 * - Transaction count
 * - Status
 *
 * PERMISSIONS REQUIRED:
 * - USER_VIEW or USER_VIEW_ACTIVE_SESSIONS
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission, hasAnyPermission } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission (either USER_VIEW or USER_VIEW_ACTIVE_SESSIONS)
    if (
      !hasAnyPermission(session.user, [
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
      ])
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: You do not have permission to view open shifts',
        },
        { status: 403 }
      )
    }

    const businessId = session.user.businessId
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID not found' },
        { status: 400 }
      )
    }

    const businessIdInt = parseInt(businessId.toString(), 10)

    // ========================================================================
    // FETCH OPEN SHIFTS
    // ========================================================================
    const openShifts = await prisma.cashierShift.findMany({
      where: {
        businessId: businessIdInt,
        status: 'open',
        // Optional: Also check closedAt is null for safety
        closedAt: null,
      },
      include: {
        // Note: If User and BusinessLocation relations don't exist in schema,
        // we'll fetch them separately
        sales: {
          select: {
            id: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        openedAt: 'desc', // Most recent first
      },
    })

    // ========================================================================
    // FETCH USER AND LOCATION DATA
    // ========================================================================
    // Get unique user IDs and location IDs
    const userIds = [...new Set(openShifts.map((s) => s.userId))]
    const locationIds = [...new Set(openShifts.map((s) => s.locationId))]

    // Fetch users
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        surname: true,
        roles: {
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Fetch locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: locationIds },
      },
      select: {
        id: true,
        name: true,
        locationCode: true,
        isActive: true,
      },
    })

    // Create lookup maps
    const userMap = new Map(users.map((u) => [u.id, u]))
    const locationMap = new Map(locations.map((l) => [l.id, l]))

    // ========================================================================
    // BUILD RESPONSE
    // ========================================================================
    const now = new Date()
    const response = openShifts.map((shift) => {
      const user = userMap.get(shift.userId)
      const location = locationMap.get(shift.locationId)

      // Calculate duration
      const openedAt = new Date(shift.openedAt)
      const durationMs = now.getTime() - openedAt.getTime()
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60))
      const durationMinutes = Math.floor(
        (durationMs % (1000 * 60 * 60)) / (1000 * 60)
      )

      // Calculate current sales total from running fields
      const currentSales = parseFloat(shift.runningNetSales.toString())
      const transactionCount = shift.transactionCount

      return {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        status: shift.status,

        // User info
        userId: shift.userId,
        username: user?.username || 'Unknown',
        userFullName: user
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : 'Unknown',
        userSurname: user?.surname || '',
        userRoles: user?.roles.map((ur) => ur.role.name) || [],

        // Location info
        locationId: shift.locationId,
        locationName: location?.name || 'Unknown',
        locationCode: location?.locationCode || null,
        locationActive: location?.isActive || false,

        // Time info
        openedAt: shift.openedAt,
        duration: {
          hours: durationHours,
          minutes: durationMinutes,
          formatted: `${durationHours}h ${durationMinutes}m`,
        },

        // Financial info
        beginningCash: shift.beginningCash,
        currentSales: currentSales,
        transactionCount: transactionCount,
        xReadingCount: shift.xReadingCount,
        zReadingCount: shift.zReadingCount,

        // Running totals
        runningGrossSales: shift.runningGrossSales,
        runningNetSales: shift.runningNetSales,
        runningTotalDiscounts: shift.runningTotalDiscounts,
        runningVoidAmount: shift.runningVoidAmount,

        // Cash operations
        runningCashInAmount: shift.runningCashInAmount,
        runningCashOutAmount: shift.runningCashOutAmount,
      }
    })

    // ========================================================================
    // SUMMARY STATS
    // ========================================================================
    const summary = {
      totalOpenShifts: response.length,
      totalLocationsWithOpenShifts: new Set(response.map((r) => r.locationId))
        .size,
      totalUsers: new Set(response.map((r) => r.userId)).size,
      totalSales: response.reduce((sum, r) => sum + r.currentSales, 0),
      totalTransactions: response.reduce(
        (sum, r) => sum + r.transactionCount,
        0
      ),
    }

    return NextResponse.json(
      {
        shifts: response,
        summary,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Open Shifts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch open shifts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
