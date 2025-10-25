import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        isOverdue: daysSinceOpen >= 1, // Flag if shift is >24 hours old
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
