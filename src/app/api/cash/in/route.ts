import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/cash/in - Record cash received by cashier during shift
 * Used for additional cash from owner, change fund, etc.
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

    // Verify shift exists and is open
    const shift = await prisma.cashierShift.findUnique({
      where: { id: parseInt(shiftId) },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status !== 'open') {
      return NextResponse.json(
        { error: 'Cannot add cash to closed shift' },
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

    // Create cash in record
    const cashInRecord = await prisma.cashInOut.create({
      data: {
        businessId: parseInt(user.businessId),
        shiftId: parseInt(shiftId),
        locationId: shift.locationId,
        type: 'cash_in',
        amount: parseFloat(amount),
        reason: remarks || 'No remarks provided',
        createdBy: parseInt(user.id),
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: AuditAction.CASH_IN,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Cash In: ₱${parseFloat(amount).toFixed(2)} - ${remarks || 'No remarks'}`,
      metadata: {
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        amount: parseFloat(amount),
        remarks,
      },
    })

    return NextResponse.json({
      success: true,
      cashInRecord,
      message: 'Cash in recorded successfully',
    })
  } catch (error: any) {
    console.error('Error recording cash in:', error)
    return NextResponse.json(
      { error: 'Failed to record cash in', details: error.message },
      { status: 500 }
    )
  }
}
