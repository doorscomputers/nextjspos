import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

/**
 * POST /api/shifts/force-close
 * Force-close a shift without generating readings (for extremely old shifts with too many transactions)
 * Requires manager/admin permission
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require manager/admin permission for force-close
    if (
      !hasPermission(session.user, PERMISSIONS.SHIFT_CLOSE) &&
      !hasPermission(session.user, PERMISSIONS.SHIFT_MANAGE)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Requires shift management permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { shiftId, reason } = body

    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId is required' }, { status: 400 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Get the shift
    const shift = await prisma.cashierShift.findFirst({
      where: {
        id: parseInt(shiftId),
        businessId: businessId,
        status: 'open',
      },
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found or already closed' },
        { status: 404 }
      )
    }

    // Force-close the shift with minimal processing
    const updatedShift = await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closingNotes: `FORCE-CLOSED by ${user.username}: ${reason || 'Shift too old to generate readings (40+ hours)'}`,
        // Set ending cash to current system cash (best estimate)
        endingCash: shift.beginningCash.add(shift.runningCashSales),
      },
    })

    // Log the force-close action
    await prisma.auditLog.create({
      data: {
        userId: parseInt(user.id),
        businessId: businessId,
        action: 'SHIFT_FORCE_CLOSED',
        entityType: 'CashierShift',
        entityId: shift.id,
        details: JSON.stringify({
          shiftNumber: shift.shiftNumber,
          locationId: shift.locationId,
          forceClosedBy: user.username,
          reason: reason || 'Shift too old to generate readings',
          openedAt: shift.openedAt,
          closedAt: updatedShift.closedAt,
          daysSinceOpen: Math.floor(
            (new Date().getTime() - new Date(shift.openedAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Shift force-closed successfully',
      shift: updatedShift,
    })
  } catch (error: any) {
    console.error('Error force-closing shift:', error)
    return NextResponse.json(
      { error: 'Failed to force-close shift', details: error.message },
      { status: 500 }
    )
  }
}
