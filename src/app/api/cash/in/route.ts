import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { withIdempotency } from '@/lib/idempotency'

/**
 * POST /api/cash/in - Record cash received by cashier during shift
 * Used for additional cash from owner, change fund, etc.
 */
export const POST = withIdempotency(async (request: NextRequest) => {
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

    // ============================================================================
    // DUPLICATE DETECTION (Prevents network retry duplicates)
    // ============================================================================
    const DUPLICATE_WINDOW_MS = 300 * 1000 // 300 seconds (5 minutes)
    const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    const businessIdNumber = parseInt(user.businessId)
    const userIdNumber = parseInt(user.id)
    const amountNumber = parseFloat(amount)

    // Look for recent identical cash in from same user at same shift
    const recentSimilarTransactions = await prisma.cashInOut.findMany({
      where: {
        businessId: businessIdNumber,
        shiftId: parseInt(shiftId),
        type: 'cash_in',
        amount: {
          gte: amountNumber - 0.01,
          lte: amountNumber + 0.01,
        },
        createdBy: userIdNumber,
        createdAt: {
          gte: duplicateCheckTime,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Only check last 5 similar transactions
    })

    if (recentSimilarTransactions.length > 0) {
      const latestTx = recentSimilarTransactions[0]
      const secondsAgo = Math.round((Date.now() - latestTx.createdAt.getTime()) / 1000)

      console.warn(`[CASH IN] DUPLICATE BLOCKED: Transaction identical to ID ${latestTx.id} (${secondsAgo}s ago)`)
      console.warn(`[CASH IN] User: ${userIdNumber}, Shift: ${shiftId}, Amount: ${amountNumber}`)

      return NextResponse.json(
        {
          error: 'Duplicate transaction detected',
          message: `An identical cash in of ₱${amountNumber.toFixed(2)} was recorded ${secondsAgo} seconds ago. If this was intentional, please wait 5 minutes before recording another identical transaction.`,
          existingTransactionId: latestTx.id,
          duplicateWindowSeconds: 300,
        },
        { status: 409 } // HTTP 409 Conflict
      )
    }
    // ============================================================================

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
})
