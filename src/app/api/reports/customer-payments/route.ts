import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/customer-payments
 * Customer Payment History Report
 *
 * Shows all payments made by customers towards their credit invoices
 *
 * Filters:
 * - startDate, endDate: Date range (default: this month)
 * - locationId: Filter by location (default: user's accessible locations)
 * - customerId: Filter by specific customer (optional)
 * - paymentMethod: Filter by payment method (optional)
 * - search: Search customer name or invoice number
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_CUSTOMER_PAYMENTS)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Date range filters
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Default to current month if no dates provided
    const today = new Date()
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)

    let startDate = firstDayOfMonth
    let endDate = lastDayOfMonth

    if (startDateParam) {
      const parts = startDateParam.split('-')
      startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0)
    }

    if (endDateParam) {
      const parts = endDateParam.split('-')
      endDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
    }

    // Other filters
    const locationIdParam = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const customerIdParam = searchParams.get('customerId')
    const paymentMethodParam = searchParams.get('paymentMethod')
    const searchQuery = searchParams.get('search')

    // Build where clause for sales
    const saleWhere: any = {
      businessId,
      deletedAt: null,
      status: 'completed',
      saleDate: {
        gte: startDate,
        lte: endDate,
      },
      // Only sales with credit payment method (had outstanding balance)
      payments: {
        some: {
          paymentMethod: 'credit',
        },
      },
    }

    // Location access control
    const accessibleLocationIds = getUserAccessibleLocationIds(user)

    if (locationIdParam && locationIdParam !== 'all') {
      const requestedLocationId = parseInt(locationIdParam)

      // Verify user has access to requested location
      if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }

      saleWhere.locationId = requestedLocationId
    } else if (accessibleLocationIds !== null) {
      // User doesn't have access to all locations, restrict to their locations
      saleWhere.locationId = { in: accessibleLocationIds }
    }

    // Customer filter
    if (customerIdParam && customerIdParam !== 'all') {
      saleWhere.customerId = parseInt(customerIdParam)
    }

    // Search filter (customer name or invoice number)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      saleWhere.OR = [
        { invoiceNumber: { contains: query, mode: 'insensitive' } },
        { customer: { name: { contains: query, mode: 'insensitive' } } },
      ]
    }

    // Fetch sales with their payments
    const sales = await prisma.sale.findMany({
      where: saleWhere,
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
      orderBy: {
        saleDate: 'desc',
      },
    })

    // Build payment history from sales
    const paymentHistory: any[] = []

    sales.forEach((sale) => {
      const totalAmount = parseFloat(sale.totalAmount.toString())
      let runningBalance = totalAmount

      // Get payments excluding credit (these are actual payments reducing balance)
      const actualPayments = sale.payments.filter(p => p.paymentMethod !== 'credit')

      actualPayments.forEach((payment, index) => {
        const paymentAmount = parseFloat(payment.amount.toString())
        const balanceAfterPayment = runningBalance - paymentAmount

        // Apply payment method filter if specified
        if (paymentMethodParam && paymentMethodParam !== 'all' && payment.paymentMethod !== paymentMethodParam) {
          runningBalance = balanceAfterPayment
          return // Skip this payment
        }

        const cashier = sale.creator
          ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() ||
            sale.creator.username
          : 'N/A'

        paymentHistory.push({
          id: payment.id,
          paymentDate: payment.createdAt.toISOString(),
          invoice: {
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            saleDate: sale.saleDate.toISOString().split('T')[0],
            totalAmount,
          },
          customer: {
            id: sale.customer?.id || null,
            name: sale.customer?.name || 'Walk-in Customer',
            mobile: sale.customer?.mobile,
            email: sale.customer?.email,
          },
          location: {
            id: sale.location?.id || null,
            name: sale.location?.name || 'Unknown Location',
          },
          paymentMethod: payment.paymentMethod,
          paymentAmount,
          balanceBeforePayment: runningBalance,
          balanceAfterPayment: Math.max(balanceAfterPayment, 0),
          isFullyPaid: balanceAfterPayment <= 0,
          receiptNumber: payment.referenceNumber || `PAY-${payment.id}`,
          cashier,
          notes: payment.notes,
        })

        runningBalance = balanceAfterPayment
      })
    })

    // Calculate summary
    const paymentMethodBreakdown: Record<string, { count: number; amount: number }> = {}

    paymentHistory.forEach((payment) => {
      const method = payment.paymentMethod
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { count: 0, amount: 0 }
      }
      paymentMethodBreakdown[method].count += 1
      paymentMethodBreakdown[method].amount += payment.paymentAmount
    })

    const summary = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalPayments: paymentHistory.length,
      totalAmount: paymentHistory.reduce((sum, p) => sum + p.paymentAmount, 0),
      uniqueCustomers: new Set(paymentHistory.map(p => p.customer.id)).size,
      uniqueInvoices: new Set(paymentHistory.map(p => p.invoice.id)).size,
      fullyPaidInvoices: new Set(
        paymentHistory.filter(p => p.isFullyPaid).map(p => p.invoice.id)
      ).size,
      paymentMethodBreakdown: Object.entries(paymentMethodBreakdown).map(([method, data]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '),
        count: data.count,
        amount: data.amount,
        percentage: paymentHistory.length > 0 ? (data.count / paymentHistory.length) * 100 : 0,
      })).sort((a, b) => b.amount - a.amount),
      topPayingCustomers: paymentHistory
        .reduce((acc: any[], payment) => {
          const existing = acc.find(c => c.customerId === payment.customer.id)
          if (existing) {
            existing.totalPaid += payment.paymentAmount
            existing.paymentCount += 1
          } else if (payment.customer.id) {
            acc.push({
              customerId: payment.customer.id,
              customerName: payment.customer.name,
              totalPaid: payment.paymentAmount,
              paymentCount: 1,
            })
          }
          return acc
        }, [])
        .sort((a: any, b: any) => b.totalPaid - a.totalPaid)
        .slice(0, 10), // Top 10 paying customers
    }

    return NextResponse.json({
      summary,
      payments: paymentHistory,
    })
  } catch (error) {
    console.error('Error fetching customer payments report:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch customer payments report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
