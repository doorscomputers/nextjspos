import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, hasAnyRole } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

/**
 * POST /api/shifts/[id]/force-close - Admin/Manager force-close a shift
 * Used when a cashier cannot close their shift (forgot, absent, emergency)
 * Body: {
 *   reason: string (required - explanation for force close)
 *   managerPassword: string (required - admin/manager password)
 *   autoReconcile?: boolean (default true - use system cash as ending cash)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has SHIFT_VIEW_ALL permission (managers/admins)
    if (!hasPermission(session.user, PERMISSIONS.SHIFT_VIEW_ALL)) {
      return NextResponse.json({
        error: 'Forbidden - Only managers and admins can force-close shifts'
      }, { status: 403 })
    }

    const shiftId = parseInt((await params).id)
    const body = await request.json()
    const { reason, managerPassword, autoReconcile = true } = body

    // Validate required fields
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({
        error: 'Reason is required and must be at least 10 characters'
      }, { status: 400 })
    }

    if (!managerPassword) {
      return NextResponse.json({
        error: 'Manager password is required to force-close shift'
      }, { status: 400 })
    }

    // Verify manager/admin password
    const managerUsers = await prisma.user.findMany({
      where: {
        businessId: parseInt(session.user.businessId),
        roles: {
          some: {
            role: {
              name: {
                in: ['Branch Manager', 'Main Branch Manager', 'Branch Admin', 'All Branch Admin', 'Super Admin']
              }
            }
          }
        }
      },
      select: {
        id: true,
        username: true,
        password: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // Check password against all manager/admin users
    let passwordValid = false
    let authorizingUser = null

    for (const user of managerUsers) {
      const isMatch = await bcrypt.compare(managerPassword, user.password)
      if (isMatch) {
        passwordValid = true
        authorizingUser = user
        break
      }
    }

    if (!passwordValid) {
      return NextResponse.json({
        error: 'Invalid manager password. Only Branch Managers or Admins can authorize force-close.'
      }, { status: 403 })
    }

    // Find the shift
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        sales: {
          include: {
            payments: true,
          },
        },
        cashInOutRecords: true,
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status === 'closed') {
      return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 })
    }

    // Calculate system cash (same logic as normal close)
    let systemCash = shift.beginningCash

    // Add cash sales with overpayment handling
    const cashSales = shift.sales
      .filter(sale => sale.status === 'completed')
      .reduce((total, sale) => {
        const saleTotal = parseFloat(sale.totalAmount.toString())
        const totalPayments = sale.payments
          .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)

        const cashPayments = sale.payments
          .filter(payment => payment.paymentMethod === 'cash')
          .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)

        let actualCashInDrawer = cashPayments
        if (totalPayments > saleTotal) {
          const allocationRatio = saleTotal / totalPayments
          actualCashInDrawer = cashPayments * allocationRatio
        }

        return total + actualCashInDrawer
      }, 0)

    systemCash = systemCash.plus(cashSales)

    // Add cash in, subtract cash out
    for (const record of shift.cashInOutRecords) {
      if (record.type === 'cash_in') {
        systemCash = systemCash.plus(record.amount)
      } else if (record.type === 'cash_out') {
        systemCash = systemCash.minus(record.amount)
      }
    }

    // For force-close, use system cash as ending cash by default
    const endingCash = autoReconcile ? parseFloat(systemCash.toString()) : 0
    const variance = endingCash - parseFloat(systemCash.toString())
    const cashOver = variance > 0 ? variance : 0
    const cashShort = variance < 0 ? Math.abs(variance) : 0

    // Calculate totals
    const totalSales = shift.sales
      .filter(sale => sale.status === 'completed')
      .reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0)

    const totalDiscounts = shift.sales
      .filter(sale => sale.status === 'completed')
      .reduce((sum, sale) => sum + parseFloat(sale.discountAmount.toString()), 0)

    const totalVoid = shift.sales
      .filter(sale => sale.status === 'voided')
      .reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0)

    const transactionCount = shift.sales.filter(sale => sale.status === 'completed').length

    // Update shift with force-close flag
    const updatedShift = await prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        closedAt: new Date(),
        endingCash,
        systemCash: parseFloat(systemCash.toString()),
        cashOver,
        cashShort,
        totalSales,
        totalDiscounts,
        totalVoid,
        transactionCount,
        closingNotes: `[FORCE-CLOSED BY ADMIN]\nReason: ${reason}\nAuthorized by: ${authorizingUser?.username}\nClosed by: ${session.user.username}`,
        status: 'closed',
      },
    })

    // Log audit trail with force-close details
    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username,
      action: AuditAction.SHIFT_CLOSE,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `FORCE-CLOSED shift ${shift.shiftNumber}. Original cashier: ${shift.user.username}. Reason: ${reason}. Authorized by: ${authorizingUser?.username}. ${autoReconcile ? 'Auto-reconciled with system cash.' : 'Manual reconciliation required.'}`,
      metadata: {
        shiftNumber: shift.shiftNumber,
        originalCashier: shift.user.username,
        originalCashierId: shift.user.id,
        systemCash: parseFloat(systemCash.toString()),
        endingCash,
        cashOver,
        cashShort,
        totalSales,
        transactionCount,
        forceClose: true,
        autoReconcile,
        reason,
        authorizedBy: authorizingUser?.id,
        authorizedByUsername: authorizingUser?.username,
      },
      requiresPassword: true,
      passwordVerified: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Shift force-closed successfully',
      shift: updatedShift,
      variance: {
        systemCash: parseFloat(systemCash.toString()),
        endingCash,
        cashOver,
        cashShort,
        isBalanced: cashOver === 0 && cashShort === 0,
        autoReconciled: autoReconcile,
      },
    })
  } catch (error: any) {
    console.error('Error force-closing shift:', error)
    return NextResponse.json(
      { error: 'Failed to force-close shift', details: error.message },
      { status: 500 }
    )
  }
}
