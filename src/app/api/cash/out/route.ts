import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { withIdempotency } from '@/lib/idempotency'

/**
 * POST /api/cash/out - Record cash taken from drawer during shift
 * Used for expenses, withdrawals, etc.
 */
export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/cash/out', async () => {
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

    // ============================================================================
    // DUPLICATE DETECTION (Prevents network retry duplicates)
    // ============================================================================
    const DUPLICATE_WINDOW_MS = 300 * 1000 // 300 seconds (5 minutes)
    const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    const businessIdNumber = parseInt(user.businessId)
    const userIdNumber = parseInt(user.id)
    const amountNumber = parseFloat(amount)

    // Look for recent identical cash out from same user at same shift
    const recentSimilarTransactions = await prisma.cashInOut.findMany({
      where: {
        businessId: businessIdNumber,
        shiftId: parseInt(shiftId),
        type: 'cash_out',
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

      console.warn(`[CASH OUT] DUPLICATE BLOCKED: Transaction identical to ID ${latestTx.id} (${secondsAgo}s ago)`)
      console.warn(`[CASH OUT] User: ${userIdNumber}, Shift: ${shiftId}, Amount: ${amountNumber}`)

      return NextResponse.json(
        {
          error: 'Duplicate transaction detected',
          message: `An identical cash out of ₱${amountNumber.toFixed(2)} was recorded ${secondsAgo} seconds ago. If this was intentional, please wait 5 minutes before recording another identical transaction.`,
          existingTransactionId: latestTx.id,
          duplicateWindowSeconds: 300,
        },
        { status: 409 } // HTTP 409 Conflict
      )
    }
    // ============================================================================

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
  })
}
