import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/shifts/check-unclosed - Check if user has any unclosed shifts
 * Returns unclosed shift details if found, used for warning on login/dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Find any open shifts for this user
    const unclosedShift = await prisma.cashierShift.findFirst({
      where: {
        userId: parseInt(user.id),
        status: 'open',
        businessId: parseInt(user.businessId),
      },
      include: {
        sales: {
          where: {
            status: 'completed',
          },
          select: {
            id: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        openedAt: 'asc', // Get oldest unclosed shift first
      },
    })

    if (!unclosedShift) {
      return NextResponse.json({ hasUnclosedShift: false })
    }

    // CRITICAL: Validate that shift has valid beginning cash
    // If beginningCash is null or <= 0, treat as invalid shift
    if (!unclosedShift.beginningCash || parseFloat(unclosedShift.beginningCash.toString()) <= 0) {
      console.warn('[check-unclosed] Found shift with invalid beginningCash:', {
        shiftId: unclosedShift.id,
        shiftNumber: unclosedShift.shiftNumber,
        beginningCash: unclosedShift.beginningCash
      })
      return NextResponse.json({
        hasUnclosedShift: false,
        invalidShift: {
          id: unclosedShift.id,
          shiftNumber: unclosedShift.shiftNumber,
          reason: 'Missing or invalid beginning cash'
        }
      })
    }

    // Fetch location separately since relation doesn't exist in schema
    const location = await prisma.businessLocation.findUnique({
      where: { id: unclosedShift.locationId },
      select: {
        id: true,
        name: true,
      },
    })

    // Calculate shift details
    const now = new Date()
    const shiftStart = new Date(unclosedShift.openedAt)
    const hoursSinceOpen = Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60))
    const daysSinceOpen = Math.floor(hoursSinceOpen / 24)

    // Check if shift was opened on a different calendar day (not just 24 hours ago)
    // Use setHours to normalize times to midnight for accurate date comparison
    const nowDate = new Date(now)
    nowDate.setHours(0, 0, 0, 0)

    const shiftDate = new Date(shiftStart)
    shiftDate.setHours(0, 0, 0, 0)

    const isFromDifferentDay = nowDate.getTime() > shiftDate.getTime()

    // Trigger warning only if:
    // 1. Shift was opened yesterday or earlier (different calendar day), OR
    // 2. Shift has been open for more than 12 hours (allows lunch breaks and no-customer periods)
    const shouldShowWarning = isFromDifferentDay || hoursSinceOpen >= 12

    // IMPORTANT: Always return the unclosed shift if it exists
    // Each component can decide whether to show warnings based on shouldShowWarning flag
    // Don't filter out shifts here - let the UI components make that decision

    // Calculate current cash (system expected)
    let systemCash = unclosedShift.beginningCash

    // Add cash sales
    const cashSales = unclosedShift.sales.reduce((total, sale) => {
      return total + parseFloat(sale.totalAmount.toString())
    }, 0)
    systemCash = systemCash.plus(cashSales)

    // Get cash in/out records
    const cashInOutRecords = await prisma.cashInOut.findMany({
      where: {
        shiftId: unclosedShift.id,
      },
    })

    for (const record of cashInOutRecords) {
      if (record.type === 'cash_in') {
        systemCash = systemCash.plus(record.amount)
      } else if (record.type === 'cash_out') {
        systemCash = systemCash.minus(record.amount)
      }
    }

    return NextResponse.json({
      hasUnclosedShift: true,
      shouldShowWarning, // Flag indicating if warning should be shown (different day OR 9+ hours)
      shift: {
        id: unclosedShift.id,
        shiftNumber: unclosedShift.shiftNumber,
        openedAt: unclosedShift.openedAt,
        locationName: location?.name || 'Unknown Location',
        locationId: location?.id || unclosedShift.locationId,
        beginningCash: parseFloat(unclosedShift.beginningCash.toString()),
        systemCash: parseFloat(systemCash.toString()),
        transactionCount: unclosedShift.sales.length,
        hoursSinceOpen,
        daysSinceOpen,
        isOverdue: isFromDifferentDay, // Flag if shift is from a different calendar day (yesterday or earlier)
        openingNotes: unclosedShift.openingNotes,
      },
    })
  } catch (error: any) {
    console.error('Error checking unclosed shifts:', error)
    return NextResponse.json(
      { error: 'Failed to check unclosed shifts', details: error.message },
      { status: 500 }
    )
  }
}
