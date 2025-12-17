import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/reports/invoice-payments/[invoiceId]
 * Get all payment details for a specific invoice (charge invoice)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const { invoiceId } = await params
    const saleId = parseInt(invoiceId)

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    // Fetch the sale with all payments
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
        deletedAt: null,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: {
          orderBy: {
            paidAt: 'asc',
          },
          include: {
            collectedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const totalAmount = parseFloat(sale.totalAmount.toString())
    const paidAmount = parseFloat(sale.paidAmount.toString())
    const balance = totalAmount - paidAmount

    // Separate credit marker from actual payments
    const creditMarker = sale.payments.find(p => p.paymentMethod === 'credit')
    const actualPayments = sale.payments.filter(p => p.paymentMethod !== 'credit')

    // Calculate running balance for each payment
    let runningBalance = totalAmount
    const paymentHistory = actualPayments.map((payment, index) => {
      const paymentAmount = parseFloat(payment.amount.toString())
      const balanceBeforePayment = runningBalance
      runningBalance = runningBalance - paymentAmount

      const collector = payment.collectedByUser
        ? `${payment.collectedByUser.firstName || ''} ${payment.collectedByUser.lastName || ''}`.trim() ||
          payment.collectedByUser.username
        : null

      return {
        id: payment.id,
        paymentNumber: index + 1,
        paymentDate: payment.paidAt.toISOString(),
        paymentMethod: payment.paymentMethod,
        amount: paymentAmount,
        balanceBefore: balanceBeforePayment,
        balanceAfter: Math.max(runningBalance, 0),
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        collectedBy: collector,
      }
    })

    // Determine invoice status
    let status = 'UNPAID'
    if (balance <= 0) {
      status = 'FULLY PAID'
    } else if (paidAmount > 0) {
      status = 'PARTIAL'
    }

    const createdBy = sale.creator
      ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() ||
        sale.creator.username
      : 'N/A'

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleDate: sale.saleDate.toISOString().split('T')[0],
          totalAmount,
          paidAmount,
          balance: Math.max(balance, 0),
          status,
          createdBy,
        },
        customer: {
          id: sale.customer?.id || null,
          name: sale.customer?.name || 'Walk-in Customer',
          mobile: sale.customer?.mobile,
          email: sale.customer?.email,
        },
        location: {
          id: sale.location?.id || null,
          name: sale.location?.name || 'Unknown',
        },
        creditAmount: creditMarker ? parseFloat(creditMarker.amount.toString()) : 0,
        payments: paymentHistory,
        summary: {
          totalPayments: paymentHistory.length,
          totalPaid: paidAmount,
          remainingBalance: Math.max(balance, 0),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching invoice payments:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice payments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
