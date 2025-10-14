import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/readings/z-reading - Generate Z Reading (end-of-day, BIR-compliant with counter increment)
 * Query params: shiftId (optional - uses current open shift if not provided)
 *
 * Z-Reading increments the Z-Counter and updates accumulated sales for BIR compliance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.Z_READING)) {
      return NextResponse.json({ error: 'Forbidden - Missing reading.z_reading permission' }, { status: 403 })
    }

    const user = session.user as any
    const businessId = user.businessId

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
              items: {
                include: {
                  product: {
                    select: { name: true, category: { select: { name: true } } },
                  },
                },
              },
            },
          },
          cashInOutRecords: true,
          cashDenominations: {
            where: { countType: 'closing' },
          },
        },
      })
    } else {
      // Get current open shift
      shift = await prisma.cashierShift.findFirst({
        where: {
          userId: parseInt(user.id),
          businessId: parseInt(businessId),
          status: 'open',
        },
        include: {
          sales: {
            include: {
              payments: true,
              items: {
                include: {
                  product: {
                    select: { name: true, category: { select: { name: true } } },
                  },
                },
              },
            },
          },
          cashInOutRecords: true,
          cashDenominations: {
            where: { countType: 'closing' },
          },
        },
      })
    }

    if (!shift) {
      return NextResponse.json({ error: 'No shift found for Z Reading' }, { status: 404 })
    }

    // Calculate all totals
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

    // Category sales breakdown
    const categorySales: any = {}
    completedSales.forEach(sale => {
      sale.items.forEach(item => {
        const category = item.product.category?.name || 'Uncategorized'
        const amount = parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString())
        categorySales[category] = (categorySales[category] || 0) + amount
      })
    })

    // Get business info for Z-Counter tracking
    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      select: {
        zCounter: true,
        resetCounter: true,
        accumulatedSales: true,
        lastZReadingDate: true,
        name: true,
        taxNumber1: true,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const previousAccumulatedSales = parseFloat(business.accumulatedSales.toString())
    const salesForTheDay = netSales
    const newAccumulatedSales = previousAccumulatedSales + salesForTheDay

    // Increment Z-Counter and update accumulated sales
    const updatedBusiness = await prisma.business.update({
      where: { id: parseInt(businessId) },
      data: {
        zCounter: {
          increment: 1,
        },
        accumulatedSales: newAccumulatedSales,
        lastZReadingDate: new Date(),
      },
    })

    // Cash movements
    const cashIn = shift.cashInOutRecords
      .filter(r => r.type === 'cash_in')
      .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

    const cashOut = shift.cashInOutRecords
      .filter(r => r.type === 'cash_out')
      .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

    // Get cash denomination if available
    const cashDenomination = shift.cashDenominations[0] || null

    const zReading = {
      // Report metadata
      reportType: 'Z-Reading',
      reportNumber: `Z${String(updatedBusiness.zCounter).padStart(4, '0')}`,
      generatedAt: new Date().toISOString(),

      // BIR Counter Tracking
      zCounter: updatedBusiness.zCounter,
      resetCounter: business.resetCounter,
      previousAccumulatedSales,
      salesForTheDay,
      accumulatedSales: newAccumulatedSales,
      lastZReadingDate: business.lastZReadingDate,

      // Business information
      business: {
        name: business.name,
        tin: business.taxNumber1,
      },

      // Shift information
      shift: {
        shiftNumber: shift.shiftNumber,
        cashier: session.user.username,
        cashierId: user.id,
        openedAt: shift.openedAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() || null,
        status: shift.status,
        xReadingCount: shift.xReadingCount,
      },

      // Sales summary
      sales: {
        transactionCount: completedSales.length,
        voidCount: voidedSales.length,
        grossSales,
        totalDiscounts,
        netSales,
        voidAmount,
      },

      // Payment breakdown
      payments: paymentBreakdown,

      // Cash reconciliation
      cash: {
        beginningCash: parseFloat(shift.beginningCash.toString()),
        endingCash: shift.endingCash ? parseFloat(shift.endingCash.toString()) : 0,
        systemCash: shift.systemCash ? parseFloat(shift.systemCash.toString()) : 0,
        cashOver: shift.cashOver ? parseFloat(shift.cashOver.toString()) : 0,
        cashShort: shift.cashShort ? parseFloat(shift.cashShort.toString()) : 0,
        cashIn,
        cashOut,
        cashInCount: shift.cashInOutRecords.filter(r => r.type === 'cash_in').length,
        cashOutCount: shift.cashInOutRecords.filter(r => r.type === 'cash_out').length,
      },

      // BIR Discount Breakdown
      discounts: {
        senior: {
          amount: completedSales
            .filter(s => s.discountType === 'senior')
            .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
          count: completedSales.filter(s => s.discountType === 'senior').length,
        },
        pwd: {
          amount: completedSales
            .filter(s => s.discountType === 'pwd')
            .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
          count: completedSales.filter(s => s.discountType === 'pwd').length,
        },
        regular: {
          amount: completedSales
            .filter(s => !s.discountType || s.discountType === 'regular')
            .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
          count: completedSales.filter(s => !s.discountType || s.discountType === 'regular').length,
        },
      },

      // Category breakdown
      categorySales,

      // Cash denomination (if counted)
      cashDenomination: cashDenomination ? {
        count1000: cashDenomination.count1000,
        count500: cashDenomination.count500,
        count200: cashDenomination.count200,
        count100: cashDenomination.count100,
        count50: cashDenomination.count50,
        count20: cashDenomination.count20,
        count10: cashDenomination.count10,
        count5: cashDenomination.count5,
        count1: cashDenomination.count1,
        count025: cashDenomination.count025,
        totalAmount: parseFloat(cashDenomination.totalAmount.toString()),
      } : null,
    }

    return NextResponse.json(zReading)
  } catch (error: any) {
    console.error('Error generating Z Reading:', error)
    return NextResponse.json(
      { error: 'Failed to generate Z Reading', details: error.message },
      { status: 500 }
    )
  }
}
