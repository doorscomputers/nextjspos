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

    // CRITICAL SECURITY: Get user's assigned locations first
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: parseInt(session.user.id) },
      select: { locationId: true },
    })
    const userLocationIds = userLocations.map(ul => ul.locationId)

    if (userLocationIds.length === 0) {
      return NextResponse.json(
        { error: 'No location assigned. Please contact your administrator.' },
        { status: 403 }
      )
    }

    let shift
    if (shiftIdParam) {
      // CRITICAL: Validate that the requested shift belongs to user's assigned location
      shift = await prisma.cashierShift.findFirst({
        where: {
          id: parseInt(shiftIdParam),
          businessId: parseInt(session.user.businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only shifts from user's locations
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

      // Fetch location and business details separately
      if (shift) {
        const location = await prisma.businessLocation.findUnique({
          where: { id: shift.locationId },
          select: { name: true, address: true },
        })
        const business = await prisma.business.findUnique({
          where: { id: shift.businessId },
          select: { name: true },
        })
        ;(shift as any).location = location
        ;(shift as any).business = business
      }
    } else {
      // Get current open shift for this user at their assigned location(s)
      shift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(session.user.id),
          status: 'open',
          businessId: parseInt(session.user.businessId),
          locationId: { in: userLocationIds }, // SECURITY: Only user's locations
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

      // Fetch location and business details separately
      if (shift) {
        const location = await prisma.businessLocation.findUnique({
          where: { id: shift.locationId },
          select: { name: true, address: true },
        })
        const business = await prisma.business.findUnique({
          where: { id: shift.businessId },
          select: { name: true },
        })
        ;(shift as any).location = location
        ;(shift as any).business = business
      }
    }

    if (!shift) {
      return NextResponse.json(
        { error: 'No shift found for X Reading at your assigned location' },
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
    // IMPORTANT: Handle overpayment (change) correctly
    // If total payments > sale total, allocate proportionally to avoid counting change as sales
    const paymentBreakdown: any = {}
    completedSales.forEach(sale => {
      const saleTotal = parseFloat(sale.totalAmount.toString())
      const paymentsTotal = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

      // If overpaid (change given), allocate proportionally
      const allocationRatio = paymentsTotal > saleTotal ? saleTotal / paymentsTotal : 1

      sale.payments.forEach(payment => {
        const method = payment.paymentMethod
        const amount = parseFloat(payment.amount.toString())
        const allocatedAmount = amount * allocationRatio // Adjust for change
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + allocatedAmount
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
      locationName: (shift as any).location?.name || 'Unknown Location',
      locationAddress: (shift as any).location?.address || '',
      businessName: (shift as any).business?.name || 'Unknown Business',
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
