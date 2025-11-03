import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const quarter = searchParams.get('quarter')
    const month = searchParams.get('month')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status') // pending|partial|paid

    const businessId = parseInt(session.user.businessId)

    // Build date range
    let dateFrom: Date
    let dateTo: Date

    if (period === 'custom' && startDate && endDate) {
      dateFrom = new Date(startDate)
      dateTo = new Date(endDate)
    } else if (period === 'year') {
      dateFrom = new Date(`${year}-01-01`)
      dateTo = new Date(`${year}-12-31`)
    } else if (period === 'quarter' && quarter) {
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: '01-01', end: '03-31' },
        Q2: { start: '04-01', end: '06-30' },
        Q3: { start: '07-01', end: '09-30' },
        Q4: { start: '10-01', end: '12-31' },
      }
      const q = quarterMap[quarter]
      dateFrom = new Date(`${year}-${q.start}`)
      dateTo = new Date(`${year}-${q.end}`)
    } else if (period === 'month') {
      const monthNum = month || new Date().getMonth() + 1
      const yearNum = parseInt(year)
      dateFrom = new Date(yearNum, parseInt(monthNum.toString()) - 1, 1)
      dateTo = new Date(yearNum, parseInt(monthNum.toString()), 0)
    } else {
      const now = new Date()
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    dateFrom.setHours(0, 0, 0, 0)
    dateTo.setHours(23, 59, 59, 999)

    // Build where clause for purchases
    const whereClause: any = {
      businessId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: { in: ['approved', 'received'] },
    }

    if (locationId) whereClause.locationId = parseInt(locationId)
    if (supplierId) whereClause.supplierId = parseInt(supplierId)

    // Get all purchases for the period
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        accountsPayable: {
          select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            dueDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate payment details for each purchase
    const now = new Date()
    const purchasePayments = purchases.map((purchase) => {
      const totalAmount = parseFloat(purchase.totalAmount.toString())
      const payable = purchase.accountsPayable[0] // Assuming one payable per purchase

      let paidAmount = 0
      let outstandingAmount = totalAmount
      let paymentStatus = 'unpaid'
      let dueDate = null
      let daysOverdue = 0

      if (payable) {
        paidAmount = parseFloat(payable.paidAmount?.toString() || '0')
        outstandingAmount = parseFloat(payable.totalAmount.toString()) - paidAmount

        if (payable.paymentStatus === 'paid') {
          paymentStatus = 'paid'
        } else if (paidAmount > 0 && paidAmount < parseFloat(payable.totalAmount.toString())) {
          paymentStatus = 'partial'
        } else {
          paymentStatus = 'pending'
        }

        dueDate = payable.dueDate

        // Calculate days overdue
        if (dueDate && paymentStatus !== 'paid') {
          const dueDateObj = new Date(dueDate)
          const diffTime = now.getTime() - dueDateObj.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          if (diffDays > 0) {
            daysOverdue = diffDays
          }
        }
      }

      // Aging category
      let agingCategory = 'current'
      if (daysOverdue > 90) agingCategory = '90+'
      else if (daysOverdue > 60) agingCategory = '60-90'
      else if (daysOverdue > 30) agingCategory = '30-60'
      else if (daysOverdue > 0) agingCategory = '0-30'

      return {
        purchaseId: purchase.id,
        refNo: purchase.purchaseOrderNumber,
        purchaseDate: purchase.createdAt.toISOString().split('T')[0],
        supplierName: purchase.supplier?.name || 'Unknown Supplier',
        totalAmount: Math.round(totalAmount * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstandingAmount: Math.round(outstandingAmount * 100) / 100,
        paymentStatus,
        dueDate: dueDate ? new Date(dueDate).toISOString().split('T')[0] : null,
        daysOverdue,
        agingCategory,
      }
    })

    // Filter by payment status if specified
    let filteredPayments = purchasePayments
    if (status) {
      filteredPayments = purchasePayments.filter((p) => p.paymentStatus === status)
    }

    // Calculate summary statistics
    const summary = {
      totalPurchases: filteredPayments.length,
      totalAmount: filteredPayments.reduce((sum, p) => sum + p.totalAmount, 0),
      totalPaid: filteredPayments.reduce((sum, p) => sum + p.paidAmount, 0),
      totalOutstanding: filteredPayments.reduce((sum, p) => sum + p.outstandingAmount, 0),
      fullyPaid: filteredPayments.filter((p) => p.paymentStatus === 'paid').length,
      partiallyPaid: filteredPayments.filter((p) => p.paymentStatus === 'partial').length,
      unpaid: filteredPayments.filter((p) => p.paymentStatus === 'pending').length,
      overdue: filteredPayments.filter((p) => p.daysOverdue > 0).length,
    }

    // Aging analysis
    const aging = {
      current: {
        count: filteredPayments.filter((p) => p.agingCategory === 'current').length,
        amount: filteredPayments
          .filter((p) => p.agingCategory === 'current')
          .reduce((sum, p) => sum + p.outstandingAmount, 0),
      },
      '0-30': {
        count: filteredPayments.filter((p) => p.agingCategory === '0-30').length,
        amount: filteredPayments
          .filter((p) => p.agingCategory === '0-30')
          .reduce((sum, p) => sum + p.outstandingAmount, 0),
      },
      '30-60': {
        count: filteredPayments.filter((p) => p.agingCategory === '30-60').length,
        amount: filteredPayments
          .filter((p) => p.agingCategory === '30-60')
          .reduce((sum, p) => sum + p.outstandingAmount, 0),
      },
      '60-90': {
        count: filteredPayments.filter((p) => p.agingCategory === '60-90').length,
        amount: filteredPayments
          .filter((p) => p.agingCategory === '60-90')
          .reduce((sum, p) => sum + p.outstandingAmount, 0),
      },
      '90+': {
        count: filteredPayments.filter((p) => p.agingCategory === '90+').length,
        amount: filteredPayments
          .filter((p) => p.agingCategory === '90+')
          .reduce((sum, p) => sum + p.outstandingAmount, 0),
      },
    }

    // Round aging amounts
    Object.keys(aging).forEach((key) => {
      aging[key as keyof typeof aging].amount =
        Math.round(aging[key as keyof typeof aging].amount * 100) / 100
    })

    // Payment method breakdown (if we have payment records)
    const paymentMethodBreakdown: Record<string, { count: number; amount: number }> = {}

    // Get payment transactions for these purchases
    const purchaseIds = filteredPayments.map(p => p.purchaseId)
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        accountsPayableId: {
          in: purchases
            .filter(p => purchaseIds.includes(p.id))
            .map(p => p.accountsPayable[0]?.id)
            .filter(Boolean) as number[]
        }
      },
      select: {
        paymentMethod: true,
        amount: true,
      }
    })

    payments.forEach(payment => {
      const method = payment.paymentMethod || 'cash'
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { count: 0, amount: 0 }
      }
      paymentMethodBreakdown[method].count += 1
      paymentMethodBreakdown[method].amount += parseFloat(payment.amount.toString())
    })

    // Round payment method amounts
    Object.keys(paymentMethodBreakdown).forEach(method => {
      paymentMethodBreakdown[method].amount =
        Math.round(paymentMethodBreakdown[method].amount * 100) / 100
    })

    // Round summary values
    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100
    summary.totalPaid = Math.round(summary.totalPaid * 100) / 100
    summary.totalOutstanding = Math.round(summary.totalOutstanding * 100) / 100

    return NextResponse.json({
      success: true,
      data: {
        period: {
          type: period,
          year,
          quarter,
          month,
          startDate: dateFrom.toISOString().split('T')[0],
          endDate: dateTo.toISOString().split('T')[0],
        },
        summary,
        aging,
        paymentMethodBreakdown,
        purchases: filteredPayments,
      },
    })
  } catch (error) {
    console.error('Payment Status Report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate payment status report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
