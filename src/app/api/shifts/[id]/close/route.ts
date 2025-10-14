import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, hasAnyRole } from '@/lib/rbac'
import { logAuditTrail } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

/**
 * POST /api/shifts/[id]/close - Close a cashier shift
 * Body: {
 *   endingCash: number,
 *   closingNotes?: string,
 *   managerPassword: string (required - Branch Manager or Admin password)
 *   cashDenomination: {
 *     count1000, count500, count200, count100, count50, count20, count10, count5, count1, count025
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SHIFT_CLOSE)) {
      return NextResponse.json({ error: 'Forbidden - Missing shift.close permission' }, { status: 403 })
    }

    const shiftId = parseInt(params.id)
    const body = await request.json()
    const { endingCash, closingNotes, cashDenomination, managerPassword } = body

    // Validate required fields
    if (endingCash === undefined || endingCash === null || endingCash < 0) {
      return NextResponse.json({ error: 'Ending cash must be a valid number' }, { status: 400 })
    }

    // Validate manager password is provided
    if (!managerPassword) {
      return NextResponse.json({ error: 'Manager password is required to close shift' }, { status: 400 })
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
        error: 'Invalid manager password. Only Branch Managers or Admins can authorize shift closure.'
      }, { status: 403 })
    }

    // Find the shift
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        sales: {
          include: {
            salePayments: true,
          },
        },
        cashInOutRecords: true,
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    // Check ownership unless user has SHIFT_VIEW_ALL permission
    if (shift.userId !== parseInt(session.user.id) && !hasPermission(session.user, PERMISSIONS.SHIFT_VIEW_ALL)) {
      return NextResponse.json({ error: 'Forbidden - Cannot close another users shift' }, { status: 403 })
    }

    if (shift.status === 'closed') {
      return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 })
    }

    // Calculate system cash (beginning cash + sales cash - cash out + cash in)
    let systemCash = shift.beginningCash

    // Add cash sales
    const cashSales = shift.sales
      .filter(sale => sale.status === 'completed')
      .reduce((total, sale) => {
        const cashPayments = sale.salePayments
          .filter(payment => payment.paymentMethod === 'cash')
          .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)
        return total + cashPayments
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

    // Calculate over/short
    const endingCashDecimal = parseFloat(endingCash)
    const variance = endingCashDecimal - parseFloat(systemCash.toString())

    const cashOver = variance > 0 ? variance : 0
    const cashShort = variance < 0 ? Math.abs(variance) : 0

    // Calculate totals for the shift
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

    // Update shift
    const updatedShift = await prisma.$transaction(async (tx) => {
      // Save cash denomination if provided
      if (cashDenomination) {
        const totalFromDenomination =
          (cashDenomination.count1000 || 0) * 1000 +
          (cashDenomination.count500 || 0) * 500 +
          (cashDenomination.count200 || 0) * 200 +
          (cashDenomination.count100 || 0) * 100 +
          (cashDenomination.count50 || 0) * 50 +
          (cashDenomination.count20 || 0) * 20 +
          (cashDenomination.count10 || 0) * 10 +
          (cashDenomination.count5 || 0) * 5 +
          (cashDenomination.count1 || 0) * 1 +
          (cashDenomination.count025 || 0) * 0.25

        await tx.cashDenomination.create({
          data: {
            businessId: shift.businessId,
            locationId: shift.locationId,
            shiftId: shift.id,
            count1000: cashDenomination.count1000 || 0,
            count500: cashDenomination.count500 || 0,
            count200: cashDenomination.count200 || 0,
            count100: cashDenomination.count100 || 0,
            count50: cashDenomination.count50 || 0,
            count20: cashDenomination.count20 || 0,
            count10: cashDenomination.count10 || 0,
            count5: cashDenomination.count5 || 0,
            count1: cashDenomination.count1 || 0,
            count025: cashDenomination.count025 || 0,
            totalAmount: totalFromDenomination,
            countType: 'closing',
            countedBy: parseInt(session.user.id),
          },
        })
      }

      // Close the shift
      return await tx.cashierShift.update({
        where: { id: shiftId },
        data: {
          closedAt: new Date(),
          endingCash: endingCashDecimal,
          systemCash: parseFloat(systemCash.toString()),
          cashOver,
          cashShort,
          totalSales,
          totalDiscounts,
          totalVoid,
          transactionCount,
          closingNotes: closingNotes || null,
          status: 'closed',
        },
      })
    })

    // Log audit trail with authorizing manager info
    await logAuditTrail({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      action: 'shift_closed',
      entityType: 'cashier_shift',
      entityId: shift.id,
      details: `Closed shift ${shift.shiftNumber}. Authorized by: ${authorizingUser?.username}. System: ${systemCash}, Actual: ${endingCash}, Over: ${cashOver}, Short: ${cashShort}`,
      metadata: {
        shiftNumber: shift.shiftNumber,
        systemCash: parseFloat(systemCash.toString()),
        endingCash: endingCashDecimal,
        cashOver,
        cashShort,
        totalSales,
        transactionCount,
        authorizedBy: authorizingUser?.id,
        authorizedByUsername: authorizingUser?.username,
      },
    })

    return NextResponse.json({
      shift: updatedShift,
      variance: {
        systemCash: parseFloat(systemCash.toString()),
        endingCash: endingCashDecimal,
        cashOver,
        cashShort,
        isBalanced: cashOver === 0 && cashShort === 0,
      },
    })
  } catch (error: any) {
    console.error('Error closing shift:', error)
    return NextResponse.json(
      { error: 'Failed to close shift', details: error.message },
      { status: 500 }
    )
  }
}
