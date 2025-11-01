import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, hasAnyRole } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { generateXReadingData, generateZReadingData } from '@/lib/readings'
import bcrypt from 'bcryptjs'
import { sendTelegramShiftClosingAlert } from '@/lib/telegram'

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SHIFT_CLOSE)) {
      return NextResponse.json({ error: 'Forbidden - Missing shift.close permission' }, { status: 403 })
    }

    const shiftId = parseInt((await params).id)
    const body = await request.json()
    const { endingCash, closingNotes, cashDenomination, managerPassword } = body

    // Debug logging
    console.log('=== SHIFT CLOSE DEBUG ===')
    console.log('Shift ID:', shiftId)
    console.log('Request Body:', JSON.stringify(body, null, 2))
    console.log('Ending Cash:', endingCash, 'Type:', typeof endingCash)
    console.log('Manager Password Present:', !!managerPassword)

    // Validate required fields
    if (endingCash === undefined || endingCash === null || endingCash < 0) {
      console.log('❌ ERROR: Invalid ending cash')
      return NextResponse.json({ error: 'Ending cash must be a valid number' }, { status: 400 })
    }

    // Validate manager password is provided
    if (!managerPassword) {
      console.log('❌ ERROR: Manager password missing')
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
        id: { select: { id: true, name: true } },
        username: { select: { id: true, name: true } },
        password: { select: { id: true, name: true } },
        roles: {
          select: {
            role: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
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
      select: {
        sales: {
          select: {
            payments: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
          },
        },
        cashInOutRecords: { select: { id: true, name: true } },
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
      console.log('❌ ERROR: Shift already closed')
      return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 })
    }

    // Calculate system cash (beginning cash + sales cash - cash out + cash in)
    let systemCash = shift.beginningCash

    // Add cash sales - IMPORTANT: Account for overpayment/change
    const cashSales = shift.sales
      .filter(sale => sale.status === 'completed')
      .reduce((total, sale) => {
        const saleTotal = parseFloat(sale.totalAmount.toString())
        const totalPayments = sale.payments
          .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)

        const cashPayments = sale.payments
          .filter(payment => payment.paymentMethod === 'cash')
          .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)

        // If overpayment (change given), allocate proportionally
        // Example: Sale ₱100, paid Cash ₱150 + Digital ₱50 = ₱200 total
        // Overpayment: ₱100, so we keep only 50% = Cash ₱75 + Digital ₱25
        let actualCashInDrawer = cashPayments
        if (totalPayments > saleTotal) {
          // There was overpayment (change given)
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

    // Add AR payments collected during this shift (cash only)
    const arPayments = await prisma.salePayment.findMany({
      where: {
        shiftId: shift.id,
        paymentMethod: 'cash'
      }
    })

    const arPaymentsCash = arPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount.toString()),
      0
    )

    systemCash = systemCash.plus(arPaymentsCash)

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

    // STEP 1: Generate X Reading (Before Closing Shift)
    let xReadingData
    try {
      xReadingData = await generateXReadingData(
        shift.id,
        parseInt(session.user.businessId),
        session.user.username,
        session.user.id,
        true // Increment X counter
      )
    } catch (error: any) {
      console.error('Error generating X Reading:', error)
      return NextResponse.json(
        { error: 'Failed to generate X Reading', details: error.message },
        { status: 500 }
      )
    }

    // STEP 2: Generate Z Reading (Before Closing Shift)
    let zReadingData
    try {
      zReadingData = await generateZReadingData(
        shift.id,
        parseInt(session.user.businessId),
        session.user.username,
        session.user.id,
        true // Increment Z counter
      )
    } catch (error: any) {
      console.error('Error generating Z Reading:', error)
      return NextResponse.json(
        { error: 'Failed to generate Z Reading', details: error.message },
        { status: 500 }
      )
    }

    // STEP 3: Update shift with cash denomination and close
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
    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username,
      action: AuditAction.SHIFT_CLOSE,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Closed shift ${shift.shiftNumber}. Authorized by: ${authorizingUser?.username}. System: ${systemCash}, Actual: ${endingCash}, Over: ${cashOver}, Short: ${cashShort}`,
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
      requiresPassword: { select: { id: true, name: true } },
      passwordVerified: { select: { id: true, name: true } },
    })

    // Send Telegram notification for shift closing
    try {
      const cashierUser = await prisma.user.findUnique({
        where: { id: shift.userId },
        select: { username: { select: { id: true, name: true } }, firstName: { select: { id: true, name: true } }, lastName: { select: { id: true, name: true } } }
      })

      const location = await prisma.businessLocation.findUnique({
        where: { id: shift.locationId },
        select: { name: { select: { id: true, name: true } } }
      })

      const cashierName = cashierUser
        ? [cashierUser.firstName, cashierUser.lastName].filter(Boolean).join(' ') || cashierUser.username
        : `User#${shift.userId}`

      const closedByName = authorizingUser
        ? [authorizingUser.firstName, authorizingUser.lastName].filter(Boolean).join(' ') || authorizingUser.username
        : session.user.username

      await sendTelegramShiftClosingAlert({
        shiftNumber: shift.shiftNumber,
        cashierName,
        locationName: location?.name || `Location#${shift.locationId}`,
        openingCash: parseFloat(shift.openingCash.toString()),
        expectedCash: parseFloat(systemCash.toString()),
        actualCash: endingCashDecimal,
        discrepancy: variance,
        totalSales,
        totalTransactions: transactionCount,
        closedBy: closedByName,
        timestamp: new Date()
      })
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError)
    }

    return NextResponse.json({
      shift: updatedShift,
      variance: {
        systemCash: parseFloat(systemCash.toString()),
        endingCash: endingCashDecimal,
        cashOver,
        cashShort,
        isBalanced: cashOver === 0 && cashShort === 0,
      },
      xReading: xReadingData, // Include X Reading data
      zReading: zReadingData, // Include Z Reading data
    })
  } catch (error: any) {
    console.error('Error closing shift:', error)
    return NextResponse.json(
      { error: 'Failed to close shift', details: error.message },
      { status: 500 }
    )
  }
}
