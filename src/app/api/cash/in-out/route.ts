import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/cash/in-out - Record cash in or cash out transaction
 * Body: { type: 'cash_in' | 'cash_out', amount: number, reason: string, referenceNumber?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.CASH_IN_OUT)) {
      return NextResponse.json({ error: 'Forbidden - Missing cash.in_out permission' }, { status: 403 })
    }

    const body = await request.json()
    const { type, amount, reason, referenceNumber } = body

    if (!type || !['cash_in', 'cash_out'].includes(type)) {
      return NextResponse.json({ error: 'Type must be cash_in or cash_out' }, { status: 400 })
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    // Get current open shift
    const currentShift = await prisma.cashierShift.findFirst({
      where: {
        userId: parseInt(session.user.id),
        status: 'open',
        businessId: parseInt(session.user.businessId),
      },
    })

    if (!currentShift) {
      return NextResponse.json(
        { error: 'No open shift found. Please start your shift first.' },
        { status: 400 }
      )
    }

    // Check if large amount requires approval
    const amountFloat = parseFloat(amount)
    const requiresApproval = amountFloat >= 10000 // Amounts 10,000 and above require approval

    const cashInOut = await prisma.cashInOut.create({
      data: {
        businessId: parseInt(session.user.businessId),
        locationId: currentShift.locationId,
        shiftId: currentShift.id,
        type,
        amount: amountFloat,
        reason,
        referenceNumber: referenceNumber || null,
        requiresApproval,
        createdBy: parseInt(session.user.id),
      },
    })

    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username,
      action: type === 'cash_in' ? AuditAction.CASH_IN : AuditAction.CASH_OUT,
      entityType: EntityType.CASH_IN_OUT,
      entityIds: [cashInOut.id],
      description: `${type === 'cash_in' ? 'Cash In' : 'Cash Out'} of ${amount} - ${reason}`,
      metadata: { type, amount: amountFloat, reason, requiresApproval },
    })

    return NextResponse.json({ cashInOut }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating cash in/out:', error)
    return NextResponse.json(
      { error: 'Failed to create cash in/out record', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cash/in-out - Get cash in/out records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shiftId = searchParams.get('shiftId')

    const whereClause: any = {
      businessId: parseInt(session.user.businessId),
    }

    if (shiftId) {
      whereClause.shiftId = parseInt(shiftId)
    }

    const records = await prisma.cashInOut.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ records })
  } catch (error: any) {
    console.error('Error fetching cash in/out records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cash in/out records', details: error.message },
      { status: 500 }
    )
  }
}
