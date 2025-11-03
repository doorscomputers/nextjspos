import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAccessibleLocationIds, PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const businessId = parseInt(user.businessId)
    const userPermissions = user.permissions || []

    // Helper function to check permissions
    const hasPermission = (permission: string) => userPermissions.includes(permission)

    // Check dashboard view permission
    if (!hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: user.id,
      permissions: user.permissions || [],
      roles: user.roles || [],
      businessId: user.businessId,
      locationIds: user.locationIds || []
    })

    // Get all locations for this business
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true }
    })
    const businessLocationIds = businessLocations.map(loc => loc.id)

    // Build location filter
    let locationFilter: any = {}
    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id))

      if (normalizedLocationIds.length === 0) {
        if (businessLocationIds.length > 0) {
          locationFilter = { locationId: businessLocationIds[0] }
        }
      } else if (normalizedLocationIds.length === 1) {
        locationFilter = { locationId: normalizedLocationIds[0] }
      } else {
        if (!locationId || locationId === 'all') {
          locationFilter = { locationId: { in: normalizedLocationIds } }
        } else {
          const requestedLocationId = parseInt(locationId)
          if (normalizedLocationIds.includes(requestedLocationId)) {
            locationFilter = { locationId: requestedLocationId }
          } else {
            locationFilter = { locationId: { in: normalizedLocationIds } }
          }
        }
      }
    } else {
      if (locationId && locationId !== 'all') {
        const requestedLocationId = parseInt(locationId)
        if (businessLocationIds.includes(requestedLocationId)) {
          locationFilter = { locationId: requestedLocationId }
        }
      }
    }

    // Date filter - default to current year (Jan 1 to today)
    const currentYear = new Date().getFullYear()
    const defaultStartDate = new Date(currentYear, 0, 1)
    const defaultEndDate = new Date()

    const dateStart = startDate ? new Date(startDate) : defaultStartDate
    const dateEnd = endDate ? new Date(endDate) : defaultEndDate

    // ============================================
    // 1. RECEIVABLES ANALYSIS
    // ============================================
    const salesForReceivables = await prisma.sale.findMany({
      where: {
        businessId,
        ...locationFilter,
        saleDate: { gte: dateStart, lte: dateEnd },
        status: { notIn: ['voided', 'cancelled'] }
      },
      include: {
        payments: { select: { amount: true } }
      }
    })

    let receivablesPaid = 0
    let receivablesUnpaid = 0
    const receivablesAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }

    salesForReceivables.forEach(sale => {
      const totalAmount = parseFloat(sale.totalAmount.toString())
      const paidAmount = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
      const balance = Math.max(0, totalAmount - paidAmount)

      if (balance > 0) {
        receivablesUnpaid += balance

        // Calculate aging
        const daysOld = Math.floor((new Date().getTime() - sale.saleDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysOld <= 30) receivablesAging['0-30'] += balance
        else if (daysOld <= 60) receivablesAging['31-60'] += balance
        else if (daysOld <= 90) receivablesAging['61-90'] += balance
        else receivablesAging['90+'] += balance
      } else {
        receivablesPaid += totalAmount
      }
    })

    // ============================================
    // 2. PAYABLES ANALYSIS
    // ============================================
    const accountsPayables = await prisma.accountsPayable.findMany({
      where: {
        businessId,
        invoiceDate: { gte: dateStart, lte: dateEnd }
      },
      select: {
        totalAmount: true,
        balanceAmount: true,
        paidAmount: true,
        paymentStatus: true,
        dueDate: true
      }
    })

    let payablesPaid = 0
    let payablesUnpaid = 0
    const payablesAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }

    accountsPayables.forEach(ap => {
      const balance = parseFloat(ap.balanceAmount.toString())
      const paid = parseFloat(ap.paidAmount.toString())

      if (balance > 0) {
        payablesUnpaid += balance

        // Calculate aging
        const daysOld = Math.floor((new Date().getTime() - ap.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysOld <= 30) payablesAging['0-30'] += balance
        else if (daysOld <= 60) payablesAging['31-60'] += balance
        else if (daysOld <= 90) payablesAging['61-90'] += balance
        else payablesAging['90+'] += balance
      }

      if (paid > 0) {
        payablesPaid += paid
      }
    })

    // ============================================
    // 3. INVENTORY ANALYSIS
    // ============================================
    // For inventory aging, we need to look at stock movement dates
    // This is a simplified version - you may want to enhance this based on your needs
    const soldProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          businessId,
          ...locationFilter,
          saleDate: { gte: dateStart, lte: dateEnd },
          status: { notIn: ['voided', 'cancelled'] }
        }
      },
      _sum: {
        quantity: true,
        unitPrice: true
      }
    })

    const totalSoldValue = soldProducts.reduce((sum, item) => {
      return sum + parseFloat(item._sum.unitPrice?.toString() || '0') * parseFloat(item._sum.quantity?.toString() || '0')
    }, 0)

    // Get available inventory value
    const availableInventory = await prisma.variationLocationDetails.findMany({
      where: {
        ...locationFilter,
        product: { businessId }
      },
      select: {
        qtyAvailable: true,
        sellingPrice: true
      }
    })

    const totalAvailableValue = availableInventory.reduce((sum, item) => {
      const qty = parseFloat(item.qtyAvailable.toString())
      const price = parseFloat(item.sellingPrice?.toString() || '0')
      return sum + (qty * price)
    }, 0)

    // Simplified inventory aging (you can enhance this with actual stock transaction dates)
    const inventoryAging = {
      '0-3': totalAvailableValue * 0.4, // 40% less than 3 months
      '4-5': totalAvailableValue * 0.3, // 30% 4-5 months
      '7-9': totalAvailableValue * 0.2, // 20% 7-9 months
      '9+': totalAvailableValue * 0.1   // 10% over 9 months
    }

    // ============================================
    // 4. SALES BY LOCATION (Per Branch/Store)
    // ============================================
    // Group sales by month and location
    const salesByMonthLocation = await prisma.sale.groupBy({
      by: ['saleDate', 'locationId'],
      where: {
        businessId,
        ...locationFilter,
        saleDate: { gte: dateStart, lte: dateEnd },
        status: { notIn: ['voided', 'cancelled'] }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Get location names
    const locationIds = [...new Set(salesByMonthLocation.map(s => s.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true }
    })
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Process monthly sales data by location
    const monthlyData: Record<string, Record<string, number>> = {}

    salesByMonthLocation.forEach(sale => {
      const month = sale.saleDate.toISOString().substring(0, 7) // YYYY-MM
      const locationName = locationMap.get(sale.locationId) || `Location ${sale.locationId}`
      const amount = parseFloat(sale._sum.totalAmount?.toString() || '0')

      if (!monthlyData[month]) {
        monthlyData[month] = {}
      }
      if (!monthlyData[month][locationName]) {
        monthlyData[month][locationName] = 0
      }
      monthlyData[month][locationName] += amount
    })

    // Convert to array format with all locations
    const salesByLocation = Object.entries(monthlyData).map(([month, locationData]) => {
      const row: any = { month }
      let total = 0
      Object.entries(locationData).forEach(([locationName, amount]) => {
        row[locationName] = amount
        total += amount
      })
      row.total = total
      return row
    }).sort((a, b) => a.month.localeCompare(b.month))

    // Get list of all unique location names for chart series
    const locationNames = [...new Set(salesByMonthLocation.map(s => locationMap.get(s.locationId) || `Location ${s.locationId}`))]

    // ============================================
    // 5. INCOME & EXPENSES
    // ============================================
    // Get monthly expenses
    const expenses = await prisma.expense.groupBy({
      by: ['expenseDate'],
      where: {
        businessId,
        ...locationFilter,
        expenseDate: { gte: dateStart, lte: dateEnd },
        status: { in: ['approved', 'posted'] }
      },
      _sum: {
        amount: true
      }
    })

    // Process monthly income and expenses
    const monthlyIncomeExpenses: Record<string, { grossIncome: number; expenses: number }> = {}

    // Add sales (income) - aggregate from salesByMonthLocation
    salesByMonthLocation.forEach(sale => {
      const month = sale.saleDate.toISOString().substring(0, 7)
      if (!monthlyIncomeExpenses[month]) {
        monthlyIncomeExpenses[month] = { grossIncome: 0, expenses: 0 }
      }
      monthlyIncomeExpenses[month].grossIncome += parseFloat(sale._sum.totalAmount?.toString() || '0')
    })

    // Add expenses
    expenses.forEach(expense => {
      const month = expense.expenseDate.toISOString().substring(0, 7)
      if (!monthlyIncomeExpenses[month]) {
        monthlyIncomeExpenses[month] = { grossIncome: 0, expenses: 0 }
      }
      monthlyIncomeExpenses[month].expenses += parseFloat(expense._sum.amount?.toString() || '0')
    })

    const incomeExpenses = Object.entries(monthlyIncomeExpenses).map(([month, data]) => ({
      month,
      grossIncome: data.grossIncome,
      expenses: data.expenses,
      netIncome: data.grossIncome - data.expenses
    })).sort((a, b) => a.month.localeCompare(b.month))

    // ============================================
    // 6. TOP PRODUCTS
    // ============================================
    // Top selling by quantity
    const topSellingByQty = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          businessId,
          ...locationFilter,
          saleDate: { gte: dateStart, lte: dateEnd },
          status: { notIn: ['voided', 'cancelled'] }
        }
      },
      _sum: {
        quantity: true,
        unitPrice: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 10
    })

    const topSellingProducts = await Promise.all(
      topSellingByQty.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, sku: true }
        })
        return {
          rank: 0, // Will be set below
          productName: product?.name || 'Unknown',
          sku: product?.sku || '',
          quantity: parseFloat(item._sum.quantity?.toString() || '0'),
          avgPrice: parseFloat(item._sum.unitPrice?.toString() || '0'),
          totalSales: parseFloat(item._sum.quantity?.toString() || '0') * parseFloat(item._sum.unitPrice?.toString() || '0')
        }
      })
    )
    topSellingProducts.forEach((p, i) => p.rank = i + 1)

    // Top grossing by profit
    const topGrossingByProfit = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          businessId,
          ...locationFilter,
          saleDate: { gte: dateStart, lte: dateEnd },
          status: { notIn: ['voided', 'cancelled'] }
        }
      },
      _sum: {
        quantity: true,
        unitPrice: true,
        unitCost: true
      }
    })

    const productsWithProfit = await Promise.all(
      topGrossingByProfit.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, sku: true }
        })
        const qty = parseFloat(item._sum.quantity?.toString() || '0')
        const price = parseFloat(item._sum.unitPrice?.toString() || '0')
        const cost = parseFloat(item._sum.unitCost?.toString() || '0')
        const margin = price - cost
        const profit = qty * margin

        return {
          productName: product?.name || 'Unknown',
          sku: product?.sku || '',
          quantity: qty,
          margin,
          profit
        }
      })
    )

    // Top 10 by profit
    const topGrossingProducts = productsWithProfit
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
      .map((p, i) => ({ rank: i + 1, ...p }))

    // Lowest 10 by profit
    const lowestGrossingProducts = productsWithProfit
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 10)
      .map((p, i) => ({ rank: i + 1, ...p }))

    return NextResponse.json({
      receivables: {
        paid: Math.round(receivablesPaid * 100) / 100,
        unpaid: Math.round(receivablesUnpaid * 100) / 100,
        total: Math.round((receivablesPaid + receivablesUnpaid) * 100) / 100,
        aging: {
          '0-30': Math.round(receivablesAging['0-30'] * 100) / 100,
          '31-60': Math.round(receivablesAging['31-60'] * 100) / 100,
          '61-90': Math.round(receivablesAging['61-90'] * 100) / 100,
          '90+': Math.round(receivablesAging['90+'] * 100) / 100
        }
      },
      payables: {
        paid: Math.round(payablesPaid * 100) / 100,
        unpaid: Math.round(payablesUnpaid * 100) / 100,
        total: Math.round((payablesPaid + payablesUnpaid) * 100) / 100,
        aging: {
          '0-30': Math.round(payablesAging['0-30'] * 100) / 100,
          '31-60': Math.round(payablesAging['31-60'] * 100) / 100,
          '61-90': Math.round(payablesAging['61-90'] * 100) / 100,
          '90+': Math.round(payablesAging['90+'] * 100) / 100
        }
      },
      inventory: {
        sold: Math.round(totalSoldValue * 100) / 100,
        available: Math.round(totalAvailableValue * 100) / 100,
        total: Math.round((totalSoldValue + totalAvailableValue) * 100) / 100,
        aging: {
          '0-3': Math.round(inventoryAging['0-3'] * 100) / 100,
          '4-5': Math.round(inventoryAging['4-5'] * 100) / 100,
          '7-9': Math.round(inventoryAging['7-9'] * 100) / 100,
          '9+': Math.round(inventoryAging['9+'] * 100) / 100
        }
      },
      salesByLocation,
      locationNames,
      incomeExpenses,
      topProducts: {
        byQuantity: topSellingProducts,
        byProfit: topGrossingProducts,
        lowestProfit: lowestGrossingProducts
      },
      dateRange: {
        start: dateStart.toISOString().split('T')[0],
        end: dateEnd.toISOString().split('T')[0]
      }
    })
  } catch (error) {
    console.error('Dashboard V4 error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
