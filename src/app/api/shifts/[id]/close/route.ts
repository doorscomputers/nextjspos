import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, hasAnyRole } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { generateXReading, generateZReading } from '@/lib/readings-instant'
import bcrypt from 'bcryptjs'
import { sendShiftClosingAlert } from '@/lib/alert-service'

/**
 * POST /api/shifts/[id]/close - Close a cashier shift
 * Body: {
 *   endingCash: number,
 *   closingNotes?: string,
 *   managerPassword?: string (Branch Manager or Admin password)
 *   OR
 *   locationCode?: string (Location's RFID card code - alternative to password)
 *   cashDenomination: {
 *     count1000, count500, count200, count100, count50, count20, count10, count5, count1, count025
 *   }
 * }
 * Note: Either managerPassword OR locationCode must be provided for authorization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now() // ⏱️ Track total time
  try {
    console.log('[ShiftClose] 🚀 Starting shift close process...')

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SHIFT_CLOSE)) {
      return NextResponse.json({ error: 'Forbidden - Missing shift.close permission' }, { status: 403 })
    }

    const shiftId = parseInt((await params).id)
    const body = await request.json()
    const { endingCash, closingNotes, cashDenomination, managerPassword, locationCode } = body

    // Debug logging
    console.log('[ShiftClose] Shift ID:', shiftId)
    console.log('[ShiftClose] Ending Cash:', endingCash)
    console.log('[ShiftClose] Auth Method:', managerPassword ? 'password' : locationCode ? 'rfid' : 'none')

    // Validate required fields
    if (endingCash === undefined || endingCash === null || endingCash < 0) {
      console.log('❌ ERROR: Invalid ending cash')
      return NextResponse.json({ error: 'Ending cash must be a valid number' }, { status: 400 })
    }

    // Validate that at least one authorization method is provided
    if (!managerPassword && !locationCode) {
      console.log('❌ ERROR: No authorization method provided')
      return NextResponse.json({
        error: 'Authorization required. Please provide either manager password or location RFID code.'
      }, { status: 400 })
    }

    // Authorization verification - either password OR RFID
    const authStartTime = Date.now()
    let authorizationValid = false
    let authorizingUser = null
    let authMethod = ''

    if (managerPassword) {
      // Method 1: Manager Password Verification
      console.log('[ShiftClose] ⏱️ Verifying manager password...')
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
      for (const user of managerUsers) {
        const isMatch = await bcrypt.compare(managerPassword, user.password)
        if (isMatch) {
          authorizationValid = true
          authorizingUser = user
          authMethod = 'password'
          console.log(`[ShiftClose] ✓ Password verified for ${user.username}`)
          break
        }
      }

      if (!authorizationValid) {
        return NextResponse.json({
          error: 'Invalid manager password. Only Branch Managers or Admins can authorize shift closure.'
        }, { status: 403 })
      }
    } else if (locationCode) {
      // Method 2: Location RFID Code Verification
      console.log('[ShiftClose] Verifying location RFID code...')

      // Find the shift first to get its location
      const shift = await prisma.cashierShift.findUnique({
        where: { id: shiftId },
        select: { locationId: true }
      })

      if (!shift) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
      }

      // Verify the RFID code exists and matches the shift's location
      const location = await prisma.businessLocation.findFirst({
        where: {
          locationCode: locationCode.toUpperCase(),
          id: shift.locationId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          locationCode: true,
        }
      })

      if (location) {
        authorizationValid = true
        authMethod = 'rfid'
        console.log(`[ShiftClose] ✓ RFID verified for location: ${location.name}`)
      } else {
        return NextResponse.json({
          error: 'Invalid location RFID code. The code must match this shift\'s location.'
        }, { status: 403 })
      }
    }

    const authElapsed = Date.now() - authStartTime
    console.log(`[ShiftClose] ✅ Authorization completed in ${authElapsed}ms`)

    // 🚀 OPTIMIZATION: Fetch only shift data with cash records (NO sales/payments - using running totals)
    console.log('[ShiftClose] ⏱️ Fetching shift data...')
    const fetchStartTime = Date.now()

    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        cashInOutRecords: true, // Only need cash in/out records
      },
    })

    const fetchElapsed = Date.now() - fetchStartTime
    console.log(`[ShiftClose] ✅ Shift data fetched in ${fetchElapsed}ms`)

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

    // BIR COMPLIANCE: Check if shift already has a Z reading (prevent duplicates)
    const existingZReading = await prisma.cashierShiftReading.findFirst({
      where: {
        shiftId: shift.id,
        type: 'Z',
      },
    })

    if (existingZReading) {
      console.log('❌ ERROR: Shift already has a Z Reading')
      return NextResponse.json({
        error: 'BIR Compliance Error: This shift already has a Z Reading. Cannot generate duplicate Z Readings.',
        existingReading: {
          readingNumber: existingZReading.readingNumber,
          readingTime: existingZReading.readingTime,
          reportNumber: existingZReading.reportNumber,
        }
      }, { status: 400 })
    }

    // 🚀 OPTIMIZATION: Calculate system cash from RUNNING TOTALS (no query needed)
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

    // Calculate over/short
    const endingCashDecimal = parseFloat(endingCash)
    const variance = endingCashDecimal - parseFloat(systemCash.toString())

    const cashOver = variance > 0 ? variance : 0
    const cashShort = variance < 0 ? Math.abs(variance) : 0

    // 🚀 OPTIMIZATION: Get totals from RUNNING TOTALS (no query needed)
    const totalSales = parseFloat(shift.runningGrossSales.toString())
    const totalDiscounts = parseFloat(shift.runningTotalDiscounts.toString())
    const totalVoid = parseFloat(shift.runningVoidedSales.toString())
    const transactionCount = shift.runningTransactions

    // STEP 2.5: Save cash denomination FIRST (before generating readings)
    // This ensures the Z Reading can include the actual physical cash count
    console.log('[ShiftClose] ⏱️ Saving cash denomination...')
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

      await prisma.cashDenomination.create({
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
      console.log(`[ShiftClose] ✅ Cash denomination saved (₱${totalFromDenomination.toFixed(2)})`)
    }

    // 🚀 OPTIMIZATION: Generate X and Z readings in PARALLEL (instant mode ⚡)
    // NOW the readings will have access to the cash denomination data
    console.log('[ShiftClose] Generating X and Z readings in parallel...')
    const readingsStartTime = Date.now()

    let xReadingData, zReadingData
    try {
      [xReadingData, zReadingData] = await Promise.all([
        generateXReading(
          shift.id,
          parseInt(session.user.businessId),
          session.user.username,
          session.user.id,
          true // Increment X counter
        ),
        generateZReading(
          shift.id,
          parseInt(session.user.businessId),
          session.user.username,
          session.user.id,
          true // Increment Z counter
        ),
      ])

      const readingsElapsed = Date.now() - readingsStartTime
      console.log(`[ShiftClose] ✅ X and Z readings generated in ${readingsElapsed}ms`)
    } catch (error: any) {
      console.error('Error generating readings:', error)
      return NextResponse.json(
        { error: 'Failed to generate X/Z Reading', details: error.message },
        { status: 500 }
      )
    }

    // STEP 3: Update shift and close
    console.log('[ShiftClose] ⏱️ Starting database transaction...')
    const txStartTime = Date.now()

    const updatedShift = await prisma.$transaction(async (tx) => {

      // Update location BIR counters (per-location tracking)
      // ⚠️ IMPORTANT: This must be done BEFORE closing the shift to ensure atomicity
      await tx.businessLocation.update({
        where: { id: shift.locationId },
        data: {
          zCounter: { increment: 1 }, // Increment Z Reading counter
          accumulatedSales: { increment: totalSales }, // Add today's sales to accumulated
        },
      })

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
    }, {
      timeout: 600000, // 600 seconds (10 minutes) timeout for very long shifts (13+ hours) - matches frontend timeout
    })

    const txElapsed = Date.now() - txStartTime
    console.log(`[ShiftClose] ✅ Transaction completed in ${txElapsed}ms`)

    // Log audit trail with authorization info
    const authDescription = authMethod === 'password'
      ? `Authorized by: ${authorizingUser?.username} (password)`
      : `Authorized by: Location RFID scan`

    await createAuditLog({
      businessId: parseInt(session.user.businessId),
      userId: parseInt(session.user.id),
      username: session.user.username,
      action: AuditAction.SHIFT_CLOSE,
      entityType: EntityType.CASHIER_SHIFT,
      entityIds: [shift.id],
      description: `Closed shift ${shift.shiftNumber}. ${authDescription}. System: ${systemCash}, Actual: ${endingCash}, Over: ${cashOver}, Short: ${cashShort}`,
      metadata: {
        shiftNumber: shift.shiftNumber,
        systemCash: parseFloat(systemCash.toString()),
        endingCash: endingCashDecimal,
        cashOver,
        cashShort,
        totalSales,
        transactionCount,
        authorizationMethod: authMethod,
        authorizedBy: authorizingUser?.id,
        authorizedByUsername: authorizingUser?.username,
      },
      requiresPassword: true,
      passwordVerified: true,
    })

    // Send Telegram notification for shift closing
    try {
      const cashierUser = await prisma.user.findUnique({
        where: { id: shift.userId },
        select: { username: true, firstName: true, lastName: true }
      })

      const location = await prisma.businessLocation.findUnique({
        where: { id: shift.locationId },
        select: { name: true }
      })

      const cashierName = cashierUser
        ? [cashierUser.firstName, cashierUser.lastName].filter(Boolean).join(' ') || cashierUser.username
        : `User#${shift.userId}`

      const closedByName = authorizingUser
        ? [authorizingUser.firstName, authorizingUser.lastName].filter(Boolean).join(' ') || authorizingUser.username
        : session.user.username

      await sendShiftClosingAlert({
        shiftNumber: shift.shiftNumber,
        cashierName,
        locationName: location?.name || `Location#${shift.locationId}`,
        expectedCash: parseFloat(systemCash.toString()),
        actualCash: endingCashDecimal,
        discrepancy: variance,
        totalSales,
        closedBy: closedByName,
        timestamp: new Date()
      })
    } catch (alertError) {
      console.error('Alert notification failed (Telegram/SMS):', alertError)
    }

    const totalElapsed = Date.now() - startTime
    console.log(`[ShiftClose] 🎉 SHIFT CLOSED SUCCESSFULLY in ${totalElapsed}ms`)

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
