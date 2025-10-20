import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/profit
 * Calculate Net Profit = Revenue - (COGS + Expenses)
 *
 * Query Params:
 * - startDate: Start date for report
 * - endDate: End date for report
 * - locationId: Optional - Filter by specific location
 * - groupBy: Optional - 'location' | 'date' | 'expense_category'
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')
    const groupBy = searchParams.get('groupBy') // 'location' | 'date' | 'expense_category'

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Build where clause for sales
    const salesWhere: any = {
      businessId: parseInt(businessId),
      status: 'completed', // Only completed sales
      saleDate: {
        gte: start,
        lte: end,
      },
    }

    if (locationId && locationId !== 'all') {
      salesWhere.locationId = parseInt(locationId)
    }

    // Build where clause for expenses (cash_out transactions)
    const expensesWhere: any = {
      businessId: parseInt(businessId),
      type: 'cash_out', // Only cash-out transactions are expenses
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    if (locationId && locationId !== 'all') {
      expensesWhere.locationId = parseInt(locationId)
    }

    // Fetch sales data
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            unitCost: true,
          },
        },
      },
    })

    // Fetch expenses data (cash_out transactions)
    const expenses = await prisma.cashInOut.findMany({
      where: expensesWhere,
      select: {
        id: true,
        locationId: true,
        amount: true,
        reason: true,
        createdAt: true,
      },
    })

    // Fetch all locations for lookup (if grouping by location)
    const locations = groupBy === 'location'
      ? await prisma.businessLocation.findMany({
          where: { businessId: parseInt(businessId) },
          select: { id: true, name: true },
        })
      : []

    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Calculate metrics
    let totalRevenue = 0
    let totalCOGS = 0
    let totalExpenses = 0

    // Process sales
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const quantity = item.quantity ? parseFloat(item.quantity.toString()) : 0
        const unitPrice = item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0
        const unitCost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0

        totalRevenue += quantity * unitPrice
        totalCOGS += quantity * unitCost
      })
    })

    // Process expenses
    expenses.forEach(expense => {
      totalExpenses += expense.amount ? parseFloat(expense.amount.toString()) : 0
    })

    const grossProfit = totalRevenue - totalCOGS
    const netProfit = grossProfit - totalExpenses
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Build response
    const response: any = {
      summary: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossProfitMargin,
        totalExpenses,
        netProfit,
        netProfitMargin,
        totalSales: sales.length,
        totalExpenseRecords: expenses.length,
      },
    }

    // Group by location
    if (groupBy === 'location') {
      const locationMetrics = new Map<number, any>()

      // Add sales data by location
      sales.forEach(sale => {
        const locId = sale.locationId
        if (!locId) {
          return
        }
        if (!locationMetrics.has(locId)) {
          locationMetrics.set(locId, {
            locationId: locId,
            locationName: locationMap.get(locId) ?? 'Unknown Location',
            revenue: 0,
            cogs: 0,
            expenses: 0,
            grossProfit: 0,
            netProfit: 0,
            salesCount: 0,
          })
        }

        const lm = locationMetrics.get(locId)
        if (lm) {
          lm.salesCount++
        }

        sale.items.forEach(item => {
          const quantity = item.quantity ? parseFloat(item.quantity.toString()) : 0
          const unitPrice = item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0
          const unitCost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0

          const itemRevenue = quantity * unitPrice
          const itemCOGS = quantity * unitCost

          if (lm) {
            lm.revenue += itemRevenue
            lm.cogs += itemCOGS
          }
        })
      })

      // Add expenses by location
      expenses.forEach(expense => {
        const locId = expense.locationId
        if (!locId) {
          return
        }
        if (!locationMetrics.has(locId)) {
          locationMetrics.set(locId, {
            locationId: locId,
            locationName: locationMap.get(locId) ?? 'Unknown Location',
            revenue: 0,
            cogs: 0,
            expenses: 0,
            grossProfit: 0,
            netProfit: 0,
            salesCount: 0,
          })
        }

        const lm = locationMetrics.get(locId)
        if (lm) {
          const amount = expense.amount ? parseFloat(expense.amount.toString()) : 0
          lm.expenses += amount
        }
      })

      // Calculate profits
      locationMetrics.forEach(lm => {
        lm.grossProfit = lm.revenue - lm.cogs
        lm.netProfit = lm.grossProfit - lm.expenses
        lm.grossProfitMargin = lm.revenue > 0 ? (lm.grossProfit / lm.revenue) * 100 : 0
        lm.netProfitMargin = lm.revenue > 0 ? (lm.netProfit / lm.revenue) * 100 : 0
      })

      response.byLocation = Array.from(locationMetrics.values())
        .sort((a, b) => b.netProfit - a.netProfit)
    }

    // Group by date
    if (groupBy === 'date') {
      const dateMetrics = new Map<string, any>()

      // Add sales data by date
      sales.forEach(sale => {
        const dateKey = sale.saleDate ? sale.saleDate.toISOString().split('T')[0] : start.toISOString().split('T')[0]
        if (!dateMetrics.has(dateKey)) {
          dateMetrics.set(dateKey, {
            date: dateKey,
            revenue: 0,
            cogs: 0,
            expenses: 0,
            grossProfit: 0,
            netProfit: 0,
            salesCount: 0,
          })
        }

        const dm = dateMetrics.get(dateKey)
        if (dm) {
          dm.salesCount++
        }

        sale.items.forEach(item => {
          const quantity = item.quantity ? parseFloat(item.quantity.toString()) : 0
          const unitPrice = item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0
          const unitCost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0

          const itemRevenue = quantity * unitPrice
          const itemCOGS = quantity * unitCost

          if (dm) {
            dm.revenue += itemRevenue
            dm.cogs += itemCOGS
          }
        })
      })

      // Add expenses by date
      expenses.forEach(expense => {
        const dateKey = expense.createdAt ? expense.createdAt.toISOString().split('T')[0] : start.toISOString().split('T')[0]
        if (!dateMetrics.has(dateKey)) {
          dateMetrics.set(dateKey, {
            date: dateKey,
            revenue: 0,
            cogs: 0,
            expenses: 0,
            grossProfit: 0,
            netProfit: 0,
            salesCount: 0,
          })
        }

        const dm = dateMetrics.get(dateKey)
        if (dm) {
          const amount = expense.amount ? parseFloat(expense.amount.toString()) : 0
          dm.expenses += amount
        }
      })

      // Calculate profits
      dateMetrics.forEach(dm => {
        dm.grossProfit = dm.revenue - dm.cogs
        dm.netProfit = dm.grossProfit - dm.expenses
        dm.grossProfitMargin = dm.revenue > 0 ? (dm.grossProfit / dm.revenue) * 100 : 0
        dm.netProfitMargin = dm.revenue > 0 ? (dm.netProfit / dm.revenue) * 100 : 0
      })

      response.byDate = Array.from(dateMetrics.values())
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    // Group by expense reason
    if (groupBy === 'expense_category') {
      const reasonMetrics = new Map<string, any>()

      expenses.forEach(expense => {
        const reasonKey = expense.reason || 'No Reason Specified'
        if (!reasonMetrics.has(reasonKey)) {
          reasonMetrics.set(reasonKey, {
            reason: reasonKey,
            totalExpenses: 0,
            expenseCount: 0,
          })
        }

        const rm = reasonMetrics.get(reasonKey)
        if (rm) {
          const amount = expense.amount ? parseFloat(expense.amount.toString()) : 0
          rm.totalExpenses += amount
          rm.expenseCount++
        }
      })

      response.byExpenseReason = Array.from(reasonMetrics.values())
        .sort((a, b) => b.totalExpenses - a.totalExpenses)
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating profit report:', error)
    return NextResponse.json(
      { error: 'Failed to generate profit report', details: error.message },
      { status: 500 }
    )
  }
}




