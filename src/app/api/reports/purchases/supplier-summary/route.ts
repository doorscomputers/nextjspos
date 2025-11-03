import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

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

    const businessId = parseInt(session.user.businessId)

    // Build date range (same logic as item-summary)
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

    // Build where clause
    const whereClause: any = {
      businessId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: { in: ['approved', 'received'] },
    }

    if (locationId) whereClause.locationId = parseInt(locationId)

    // Get all purchases for the period
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          },
        },
        items: true,
      },
    })

    // Group by supplier
    const supplierMap = new Map<number, any>()

    for (const purchase of purchases) {
      const supplierId = purchase.supplierId
      if (!supplierId) continue

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplierId,
          supplierName: purchase.supplier?.name || 'Unknown Supplier',
          supplierEmail: purchase.supplier?.email || '',
          supplierPhone: purchase.supplier?.mobile || '',
          totalPurchaseValue: 0,
          numberOfPOs: 0,
          numberOfItems: 0,
          orderValues: [],
        })
      }

      const supplierData = supplierMap.get(supplierId)!
      supplierData.totalPurchaseValue += parseFloat(purchase.totalAmount.toString())
      supplierData.numberOfPOs += 1
      supplierData.numberOfItems += purchase.items.length
      supplierData.orderValues.push(parseFloat(purchase.totalAmount.toString()))
    }

    // Calculate summary and format results
    const suppliers = Array.from(supplierMap.values()).map((supplier) => {
      const avgOrderValue = supplier.orderValues.length > 0
        ? supplier.orderValues.reduce((sum: number, val: number) => sum + val, 0) / supplier.orderValues.length
        : 0

      return {
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        supplierEmail: supplier.supplierEmail,
        supplierPhone: supplier.supplierPhone,
        totalPurchaseValue: Math.round(supplier.totalPurchaseValue * 100) / 100,
        numberOfPOs: supplier.numberOfPOs,
        numberOfItems: supplier.numberOfItems,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      }
    })

    // Sort by total purchase value descending
    suppliers.sort((a, b) => b.totalPurchaseValue - a.totalPurchaseValue)

    // Add ranking
    const rankedSuppliers = suppliers.map((supplier, index) => ({
      ...supplier,
      rank: index + 1,
    }))

    // Calculate totals
    const summary = {
      totalSuppliers: suppliers.length,
      totalPurchaseValue: suppliers.reduce((sum, s) => sum + s.totalPurchaseValue, 0),
      totalPOs: suppliers.reduce((sum, s) => sum + s.numberOfPOs, 0),
      totalItems: suppliers.reduce((sum, s) => sum + s.numberOfItems, 0),
      avgPurchasePerSupplier: 0,
    }

    if (summary.totalSuppliers > 0) {
      summary.avgPurchasePerSupplier = summary.totalPurchaseValue / summary.totalSuppliers
    }

    // Round summary values
    summary.totalPurchaseValue = Math.round(summary.totalPurchaseValue * 100) / 100
    summary.avgPurchasePerSupplier = Math.round(summary.avgPurchasePerSupplier * 100) / 100

    // Get outstanding payables per supplier
    const payables = await prisma.accountsPayable.groupBy({
      by: ['supplierId'],
      where: {
        businessId,
        paymentStatus: { in: ['unpaid', 'partial'] },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
    })

    const payablesMap = new Map(
      payables.map((p) => [
        p.supplierId,
        {
          totalDue: parseFloat(p._sum.totalAmount?.toString() || '0'),
          totalPaid: parseFloat(p._sum.paidAmount?.toString() || '0'),
        },
      ])
    )

    // Add payables info to suppliers
    const suppliersWithPayables = rankedSuppliers.map((supplier) => {
      const payable = payablesMap.get(supplier.supplierId)
      const outstanding = payable
        ? Math.round((payable.totalDue - payable.totalPaid) * 100) / 100
        : 0

      return {
        ...supplier,
        outstandingPayables: outstanding,
      }
    })

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
        suppliers: suppliersWithPayables,
      },
    })
  } catch (error) {
    console.error('Supplier Purchase Summary Report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate supplier purchase summary report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
