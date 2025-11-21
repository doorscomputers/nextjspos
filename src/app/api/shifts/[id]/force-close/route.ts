import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, hasAnyRole } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

/**
 * POST /api/shifts/[id]/force-close - Emergency force-close for very old shifts
 * Used for shifts 24+ hours old that cannot be closed normally due to power outages/internet disruptions
 * IMPORTANT: This closes the shift WITHOUT generating BIR-compliant X/Z readings
 * Body: {
 *   closingNotes: string (required - min 10 chars explaining why)
 *   managerPassword: string (required - admin/manager password)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[ForceClose] 🚨 Emergency force-close initiated...')

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only these roles can force-close: Super Admin, All Branch Admin, Branch Admin, Branch Manager, Main Branch Manager
    const allowedRoles = ['Super Admin', 'All Branch Admin', 'Branch Admin', 'Branch Manager', 'Main Branch Manager']
    const hasRequiredRole = hasAnyRole(session.user, allowedRoles)

    if (!hasRequiredRole) {
      return NextResponse.json({
        error: 'Forbidden - Only Super Admin, Branch Admin, All Branch Admin, Branch Manager, or Main Branch Manager can force-close shifts'
      }, { status: 403 })
    }

    const shiftId = parseInt((await params).id)
    const body = await request.json()
    const { closingNotes, managerPassword } = body

    // Validate required fields
    if (!closingNotes || closingNotes.trim().length < 10) {
      return NextResponse.json({
        error: 'Closing notes are required and must be at least 10 characters explaining why force-close is necessary'
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
                in: allowedRoles
              }
            }
          }
        }
      },
      select: {
        id: true,
        username: true,
        password: true,
        firstName: true,
        lastName: true,
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
        error: 'Invalid manager password. Only authorized managers/admins can force-close shifts.'
      }, { status: 403 })
    }

    console.log(`[ForceClose] ✓ Password verified for ${authorizingUser?.username}`)

    // Find the shift
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        cashInOutRecords: true, // Only need cash in/out records
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status === 'closed') {
      return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 })
    }

    // Check shift age - warn if less than 24 hours
    const shiftAge = Date.now() - new Date(shift.openedAt).getTime()
    const hoursOld = Math.floor(shiftAge / (1000 * 60 * 60))
    const daysOld = Math.floor(hoursOld / 24)

    if (hoursOld < 24) {
      console.log(`[ForceClose] ⚠️ WARNING: Shift is only ${hoursOld} hours old (recommended 24+ hours)`)
    } else {
      console.log(`[ForceClose] ✓ Shift is ${daysOld} day(s) old - force-close is appropriate`)
    }

    // Calculate system cash using RUNNING TOTALS (same as normal close)
    console.log('[ForceClose] Calculating cash variance using running totals...')
    let systemCash = shift.beginningCash

    // Add cash sales from running totals (already accounts for overpayment/change)
    const cashSales = parseFloat(shift.runningCashSales.toString())
    systemCash = systemCash.plus(cashSales)

    // Add cash in, subtract cash out
    for (const record of shift.cashInOutRecords) {
      if (record.type === 'cash_in') {
        systemCash = systemCash.plus(record.amount)
      } else if (record.type === 'cash_out') {
        systemCash = systemCash.minus(record.amount)
      }
    }

    // Add AR payments collected during this shift (cash only) - from running totals
    const arPaymentsCash = parseFloat(shift.runningArPaymentsCash.toString())
    systemCash = systemCash.plus(arPaymentsCash)

    // For force-close, use system cash as ending cash (auto-reconcile)
    const endingCash = parseFloat(systemCash.toString())
    const variance = 0 // No variance when auto-reconciling
    const cashOver = 0
    const cashShort = 0

    // Get totals from RUNNING TOTALS
    const totalSales = parseFloat(shift.runningGrossSales.toString())
    const totalDiscounts = parseFloat(shift.runningTotalDiscounts.toString())
    const totalVoid = parseFloat(shift.runningVoidedSales.toString())
    const transactionCount = shift.runningTransactions

    console.log(`[ForceClose] System Cash: ${systemCash}, Auto-reconciled Ending: ${endingCash}`)

    // Update shift with force-close flag (NO X/Z readings generated)
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
        closingNotes: `🚨 [FORCE CLOSED - EMERGENCY]\n\nShift Age: ${daysOld} day(s) ${hoursOld % 24} hour(s)\nReason: ${closingNotes}\n\nAuthorized by: ${authorizingUser?.username} (${authorizingUser.firstName} ${authorizingUser.lastName})\nExecuted by: ${session.user.username}\n\n⚠️ WARNING: NO X/Z READINGS GENERATED\nThis shift was closed without BIR-compliant readings due to emergency circumstances.\nCash auto-reconciled to system calculated amount.`,
        status: 'closed',
      },
    })

    // Log audit trail with FORCE CLOSED marker
    const cashierName = [shift.user.firstName, shift.user.lastName].filter(Boolean).join(' ') || shift.user.username
    const authName = [authorizingUser.firstName, authorizingUser.lastName].filter(Boolean).join(' ') || authorizingUser.username

    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username,
      action: AuditAction.SHIFT_CLOSE,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `🚨 FORCE CLOSED shift ${shift.shiftNumber} (${daysOld}d ${hoursOld % 24}h old). Original cashier: ${cashierName}. Reason: ${closingNotes}. Authorized by: ${authName}. NO X/Z READINGS GENERATED. Auto-reconciled: ₱${endingCash.toFixed(2)}`,
      metadata: {
        shiftNumber: shift.shiftNumber,
        shiftAge: { days: daysOld, hours: hoursOld },
        originalCashier: shift.user.username,
        originalCashierId: shift.user.id,
        systemCash: parseFloat(systemCash.toString()),
        endingCash,
        cashOver,
        cashShort,
        totalSales,
        transactionCount,
        forceClose: true,
        emergencyClose: true,
        noReadingsGenerated: true,
        autoReconciled: true,
        reason: closingNotes,
        authorizedBy: authorizingUser.id,
        authorizedByUsername: authorizingUser.username,
        authorizedByName: authName,
      },
      requiresPassword: true,
      passwordVerified: true,
    })

    console.log(`[ForceClose] ✅ Shift ${shift.shiftNumber} force-closed successfully (${daysOld}d ${hoursOld % 24}h old)`)

    return NextResponse.json({
      success: true,
      message: `Shift force-closed successfully. WARNING: No X/Z readings were generated.`,
      shift: updatedShift,
      shiftAge: {
        days: daysOld,
        hours: hoursOld,
        totalHours: hoursOld
      },
      variance: {
        systemCash: parseFloat(systemCash.toString()),
        endingCash,
        cashOver,
        cashShort,
        isBalanced: true, // Always balanced when auto-reconciled
        autoReconciled: true,
      },
      warning: 'This shift was closed WITHOUT BIR-compliant X/Z readings. Use only for emergency situations.'
    })
  } catch (error: any) {
    console.error('Error force-closing shift:', error)
    return NextResponse.json(
      { error: 'Failed to force-close shift', details: error.message },
      { status: 500 }
    )
  }
}
