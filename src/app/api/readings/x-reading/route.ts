import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/readings/x-reading - Generate X Reading (mid-shift, non-resetting)
 * Query params: shiftId (optional, defaults to current open shift)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.X_READING)) {
      return NextResponse.json({ error: 'Forbidden - Missing reading.x_reading permission' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const shiftIdParam = searchParams.get('shiftId')

    let shift
    if (shiftIdParam) {
      shift = await prisma.cashierShift.findUnique({
        where: { id: parseInt(shiftIdParam) },
        include: {
          sales: {
            include: {
              payments: true,
              items: true,
            },
          },
          cashInOutRecords: true,
        },
      })
    } else {
      // Get current open shift
      shift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(session.user.id),
          status: 'open',
          businessId: parseInt(session.user.businessId),
        },
        include: {
          sales: {
            include: {
              payments: true,
              items: true,
            },
          },
          cashInOutRecords: true,
        },
      })
    }

    if (!shift) {
      return NextResponse.json(
        { error: 'No shift found for X Reading' },
        { status: 404 }
      )
    }

    // Calculate totals
    const completedSales = shift.sales.filter(sale => sale.status === 'completed')
    const voidedSales = shift.sales.filter(sale => sale.status === 'voided')

    const grossSales = completedSales.reduce((sum, sale) => {
      return sum + parseFloat(sale.subtotal.toString())
    }, 0)

    const totalDiscounts = completedSales.reduce((sum, sale) => {
      return sum + parseFloat(sale.discountAmount.toString())
    }, 0)

    const netSales = completedSales.reduce((sum, sale) => {
      return sum + parseFloat(sale.totalAmount.toString())
    }, 0)

    const voidAmount = voidedSales.reduce((sum, sale) => {
      return sum + parseFloat(sale.totalAmount.toString())
    }, 0)

    // Payment method breakdown
    const paymentBreakdown: any = {}
    completedSales.forEach(sale => {
      sale.payments.forEach(payment => {
        const method = payment.paymentMethod
        const amount = parseFloat(payment.amount.toString())
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amount
      })
    })

    // Cash movements
    const cashIn = shift.cashInOutRecords
      .filter(r => r.type === 'cash_in')
      .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

    const cashOut = shift.cashInOutRecords
      .filter(r => r.type === 'cash_out')
      .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

    // Expected cash in drawer
    const expectedCash =
      parseFloat(shift.beginningCash.toString()) +
      (paymentBreakdown['cash'] || 0) +
      cashIn -
      cashOut

    // Increment X Reading count
    await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        xReadingCount: {
          increment: 1,
        },
      },
    })

    const xReading = {
      shiftNumber: shift.shiftNumber,
      cashierName: session.user.username,
      openedAt: shift.openedAt,
      readingTime: new Date(),
      xReadingNumber: shift.xReadingCount + 1,
      beginningCash: parseFloat(shift.beginningCash.toString()),
      grossSales,
      totalDiscounts,
      netSales,
      voidAmount,
      transactionCount: completedSales.length,
      voidCount: voidedSales.length,
      paymentBreakdown,
      cashIn,
      cashOut,
      expectedCash,
      discountBreakdown: {
        senior: completedSales
          .filter(s => s.discountType === 'senior')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
        pwd: completedSales
          .filter(s => s.discountType === 'pwd')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
        regular: completedSales
          .filter(s => !s.discountType || s.discountType === 'regular')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
      },
    }

    return NextResponse.json({ xReading })
  } catch (error: any) {
    console.error('Error generating X Reading:', error)
    return NextResponse.json(
      { error: 'Failed to generate X Reading', details: error.message },
      { status: 500 }
    )
  }
}
