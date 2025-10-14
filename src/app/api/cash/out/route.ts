import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/cash/out - Record cash taken from drawer during shift
 * Used for expenses, withdrawals, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!hasPermission(user, PERMISSIONS.CASH_IN_OUT)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing cash.in_out permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { shiftId, amount, remarks } = body

    // Validation
    if (!shiftId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Shift ID and valid amount are required' },
        { status: 400 }
      )
    }

    if (!remarks) {
      return NextResponse.json(
        { error: 'Remarks are required for cash out transactions' },
        { status: 400 }
      )
    }

    // Verify shift exists and is open
    const shift = await prisma.cashierShift.findUnique({
      where: { id: parseInt(shiftId) },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status !== 'open') {
      return NextResponse.json(
        { error: 'Cannot remove cash from closed shift' },
        { status: 400 }
      )
    }

    // Check ownership unless user has view all shifts permission
    if (
      shift.userId !== parseInt(user.id) &&
      !hasPermission(user, PERMISSIONS.SHIFT_VIEW_ALL)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot modify another users shift' },
        { status: 403 }
      )
    }

    // Create cash out record
    const cashOutRecord = await prisma.cashInOut.create({
      data: {
        businessId: parseInt(user.businessId),
        shiftId: parseInt(shiftId),
        locationId: shift.locationId,
        type: 'cash_out',
        amount: parseFloat(amount),
        reason: remarks,
        createdBy: parseInt(user.id),
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: AuditAction.CASH_OUT,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Cash Out: ₱${parseFloat(amount).toFixed(2)} - ${remarks}`,
      metadata: {
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        amount: parseFloat(amount),
        remarks,
      },
    })

    return NextResponse.json({
      success: true,
      cashOutRecord,
      message: 'Cash out recorded successfully',
    })
  } catch (error: any) {
    console.error('Error recording cash out:', error)
    return NextResponse.json(
      { error: 'Failed to record cash out', details: error.message },
      { status: 500 }
    )
  }
}
