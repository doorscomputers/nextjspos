import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/unpaid-invoices
 * Unpaid Charge Invoices / Accounts Receivable Report
 *
 * Shows all outstanding customer credit with aging analysis
 *
 * Filters:
 * - locationId: Filter by location (default: user's accessible locations)
 * - customerId: Filter by specific customer (optional)
 * - status: Filter by status (unpaid, partially_paid, overdue)
 * - agingPeriod: Filter by aging (current, 30days, 60days, 90days, over90)
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
    const userId = parseInt(String(user.id))

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_UNPAID_INVOICES)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const locationIdParam = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const customerIdParam = searchParams.get('customerId')
    const statusParam = searchParams.get('status')
    const agingPeriodParam = searchParams.get('agingPeriod')
    const searchQuery = searchParams.get('search')

    // Build where clause for sales with credit payments
    const saleWhere: any = {
      businessId,
      deletedAt: null,
      status: 'completed',
      // Only sales with credit payments
      payments: {
        some: {
          paymentMethod: 'credit',
        },
      },
    }

    // Location access control
    let accessibleLocationIds = getUserAccessibleLocationIds(user)

    if (accessibleLocationIds !== null && accessibleLocationIds.length === 0) {
      const assignments = await prisma.userLocation.findMany({
        where: { userId },
        select: {
          locationId: true,
          location: {
            select: {
              deletedAt: true,
              isActive: true,
            },
          },
        },
      })

      accessibleLocationIds = assignments
        .filter((assignment) => assignment.location && assignment.location.deletedAt === null && assignment.location.isActive !== false)
        .map((assignment) => assignment.locationId)
    }

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

    // Fetch sales with credit payments
    const saleInclude: any = {
      customer: {
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
          creditLimit: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      payments: true,
      creator: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    }

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: saleInclude,
      orderBy: {
        saleDate: 'desc',
      },
    }) as unknown as Array<any>

    // Calculate payment status and aging for each sale
    const today = new Date()
    const invoices = sales.map((sale) => {
      const totalAmount = parseFloat(sale.totalAmount.toString())

      // Calculate total paid (excluding credit method)
      const totalPaid = sale.payments
        .filter((p: any) => p.paymentMethod !== 'credit')
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0)

      const balanceDue = totalAmount - totalPaid

      // Only include if there's an outstanding balance
      if (balanceDue <= 0.01) {
        return null
      }

      // Calculate days overdue
      const saleDate = new Date(sale.saleDate)
      const daysOutstanding = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))

      // Determine aging period
      let agingPeriod: string
      if (daysOutstanding <= 30) {
        agingPeriod = 'current'
      } else if (daysOutstanding <= 60) {
        agingPeriod = '30days'
      } else if (daysOutstanding <= 90) {
        agingPeriod = '60days'
      } else {
        agingPeriod = 'over90'
      }

      // Determine status
      let paymentStatus: string
      if (totalPaid === 0) {
        paymentStatus = 'unpaid'
      } else if (totalPaid < totalAmount) {
        paymentStatus = 'partially_paid'
      } else {
        paymentStatus = 'paid'
      }

      // Add overdue status if more than 30 days
      if (daysOutstanding > 30 && paymentStatus !== 'paid') {
        paymentStatus = 'overdue'
      }

      const cashier = sale.creator
        ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() ||
        sale.creator.username
        : 'N/A'

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate.toISOString().split('T')[0],
        customer: {
          id: sale.customer?.id || null,
          name: sale.customer?.name || 'Walk-in Customer',
          mobile: sale.customer?.mobile,
          email: sale.customer?.email,
          creditLimit: sale.customer?.creditLimit ? parseFloat(sale.customer.creditLimit.toString()) : null,
        },
        location: {
          id: sale.location?.id || null,
          name: sale.location?.name || 'Unknown Location',
        },
        totalAmount,
        amountPaid: totalPaid,
        balanceDue,
        daysOutstanding,
        agingPeriod,
        status: paymentStatus,
        cashier,
        paymentTerms: 30, // Default payment terms (could be from customer settings)
        dueDate: new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }
    }).filter(Boolean) // Remove null entries

    // Apply status filter
    let filteredInvoices = invoices as any[]
    if (statusParam && statusParam !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.status === statusParam)
    }

    // Apply aging filter
    if (agingPeriodParam && agingPeriodParam !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.agingPeriod === agingPeriodParam)
    }

    // Calculate summary
    const summary = {
      totalInvoices: filteredInvoices.length,
      totalOutstanding: filteredInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0),
      totalOverdue: filteredInvoices.filter(inv => inv.status === 'overdue').length,
      totalOverdueAmount: filteredInvoices
        .filter(inv => inv.status === 'overdue')
        .reduce((sum, inv) => sum + inv.balanceDue, 0),
      agingBreakdown: {
        current: {
          count: filteredInvoices.filter(inv => inv.agingPeriod === 'current').length,
          amount: filteredInvoices
            .filter(inv => inv.agingPeriod === 'current')
            .reduce((sum, inv) => sum + inv.balanceDue, 0),
        },
        '30days': {
          count: filteredInvoices.filter(inv => inv.agingPeriod === '30days').length,
          amount: filteredInvoices
            .filter(inv => inv.agingPeriod === '30days')
            .reduce((sum, inv) => sum + inv.balanceDue, 0),
        },
        '60days': {
          count: filteredInvoices.filter(inv => inv.agingPeriod === '60days').length,
          amount: filteredInvoices
            .filter(inv => inv.agingPeriod === '60days')
            .reduce((sum, inv) => sum + inv.balanceDue, 0),
        },
        over90: {
          count: filteredInvoices.filter(inv => inv.agingPeriod === 'over90').length,
          amount: filteredInvoices
            .filter(inv => inv.agingPeriod === 'over90')
            .reduce((sum, inv) => sum + inv.balanceDue, 0),
        },
      },
      topDebtors: filteredInvoices
        .reduce((acc: any[], inv) => {
          const existing = acc.find(d => d.customerId === inv.customer.id)
          if (existing) {
            existing.totalDue += inv.balanceDue
            existing.invoiceCount += 1
          } else {
            acc.push({
              customerId: inv.customer.id,
              customerName: inv.customer.name,
              totalDue: inv.balanceDue,
              invoiceCount: 1,
            })
          }
          return acc
        }, [])
        .sort((a: any, b: any) => b.totalDue - a.totalDue)
        .slice(0, 10), // Top 10 debtors
    }

    return NextResponse.json({
      summary,
      invoices: filteredInvoices,
    })
  } catch (error) {
    console.error('Error fetching unpaid invoices report:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch unpaid invoices report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
