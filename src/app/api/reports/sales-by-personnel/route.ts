import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

/**
 * GET /api/reports/sales-by-personnel
 *
 * Sales Report grouped by Sales Personnel showing detailed item breakdown.
 * Returns all invoices with items sold per salesperson.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_BY_PERSONNEL)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const salesPersonnelId = searchParams.get('salesPersonnelId')
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter
    let dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      dateFilter.lte = endDateObj
    }

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
      salesPersonnelId: { not: null }, // Only sales with personnel assigned
    }

    if (salesPersonnelId && salesPersonnelId !== 'all') {
      where.salesPersonnelId = parseInt(salesPersonnelId)
    }

    if (locationId && locationId !== 'all') {
      where.locationId = parseInt(locationId)
    }

    if (Object.keys(dateFilter).length > 0) {
      where.saleDate = dateFilter
    }

    // Fetch sales with items, grouped by personnel
    const sales = await prisma.sale.findMany({
      where,
      include: {
        salesPersonnel: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                variations: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { salesPersonnelId: 'asc' },
        { saleDate: 'desc' },
      ],
    })

    // Transform data for frontend
    const salesData = sales.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      status: sale.status,
      // Sales Personnel
      salesPersonnelId: sale.salesPersonnelId,
      salesPersonnelName: sale.salesPersonnel
        ? `${sale.salesPersonnel.firstName} ${sale.salesPersonnel.lastName}`
        : 'Unknown',
      salesPersonnelCode: sale.salesPersonnel?.employeeCode || '',
      // Customer
      customerName: sale.customer?.name || 'Walk-in Customer',
      // Location
      locationName: sale.location?.name || '',
      // Amounts
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      totalAmount: Number(sale.totalAmount),
      // Items
      items: sale.items.map(item => {
        // Find the variation from product's variations array using productVariationId
        const variation = item.product?.variations?.find(
          (v: any) => v.id === item.productVariationId
        )
        return {
          id: item.id,
          productName: item.product?.name || 'Unknown Product',
          variationName: variation?.name || '',
          sku: variation?.sku || item.product?.sku || '',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: Number(item.discountAmount),
          lineTotal: Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount),
        }
      }),
      itemCount: sale.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    }))

    // Calculate summary by personnel
    const personnelSummary: Record<number, {
      id: number
      name: string
      code: string
      salesCount: number
      itemCount: number
      totalRevenue: number
      totalDiscount: number
      netAmount: number
    }> = {}

    salesData.forEach(sale => {
      if (!sale.salesPersonnelId) return

      if (!personnelSummary[sale.salesPersonnelId]) {
        personnelSummary[sale.salesPersonnelId] = {
          id: sale.salesPersonnelId,
          name: sale.salesPersonnelName,
          code: sale.salesPersonnelCode,
          salesCount: 0,
          itemCount: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          netAmount: 0,
        }
      }

      const summary = personnelSummary[sale.salesPersonnelId]
      summary.salesCount += 1
      summary.itemCount += sale.itemCount
      summary.totalRevenue += sale.subtotal
      summary.totalDiscount += sale.discountAmount
      summary.netAmount += sale.totalAmount
    })

    // Calculate grand totals
    const grandTotals = {
      totalSales: salesData.length,
      totalItems: salesData.reduce((sum, sale) => sum + sale.itemCount, 0),
      totalRevenue: salesData.reduce((sum, sale) => sum + sale.subtotal, 0),
      totalDiscount: salesData.reduce((sum, sale) => sum + sale.discountAmount, 0),
      netAmount: salesData.reduce((sum, sale) => sum + sale.totalAmount, 0),
    }

    // Find top performer
    const topPerformer = Object.values(personnelSummary).reduce(
      (top, person) => (person.netAmount > (top?.netAmount || 0) ? person : top),
      null as typeof personnelSummary[number] | null
    )

    return NextResponse.json({
      sales: salesData,
      summary: Object.values(personnelSummary),
      grandTotals,
      topPerformer,
      filters: {
        startDate,
        endDate,
        salesPersonnelId,
        locationId,
      },
    })
  } catch (error) {
    console.error('Error fetching sales by personnel report:', error)
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
