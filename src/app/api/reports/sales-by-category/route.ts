import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

/**
 * GET /api/reports/sales-by-category
 *
 * Sales Report grouped by Customer Category.
 * Returns sales data with totals per category.
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
    if (!hasPermission(user, PERMISSIONS.SALES_REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const customerCategory = searchParams.get('customerCategory')
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
      status: { not: 'voided' },
    }

    if (customerCategory && customerCategory !== 'all') {
      where.customerCategory = customerCategory
    }

    if (locationId && locationId !== 'all') {
      where.locationId = parseInt(locationId)
    }

    if (Object.keys(dateFilter).length > 0) {
      where.saleDate = dateFilter
    }

    // Fetch sales
    const sales = await prisma.sale.findMany({
      where,
      include: {
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
        salesPersonnel: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: [
        { customerCategory: 'asc' },
        { saleDate: 'desc' },
      ],
    })

    // Transform data for frontend
    const salesData = sales.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      status: sale.status,
      customerCategory: sale.customerCategory || 'Uncategorized',
      customerName: sale.customer?.name || 'Walk-in Customer',
      locationName: sale.location?.name || '',
      salesPersonnelName: sale.salesPersonnel
        ? `${sale.salesPersonnel.firstName} ${sale.salesPersonnel.lastName}`
        : '',
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      totalAmount: Number(sale.totalAmount),
      itemCount: sale.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    }))

    // Calculate summary by category
    const categorySummary: Record<string, {
      category: string
      salesCount: number
      itemCount: number
      totalRevenue: number
      totalDiscount: number
      netAmount: number
    }> = {}

    salesData.forEach(sale => {
      const cat = sale.customerCategory

      if (!categorySummary[cat]) {
        categorySummary[cat] = {
          category: cat,
          salesCount: 0,
          itemCount: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          netAmount: 0,
        }
      }

      const summary = categorySummary[cat]
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

    return NextResponse.json({
      sales: salesData,
      summary: Object.values(categorySummary),
      grandTotals,
      filters: {
        startDate,
        endDate,
        customerCategory,
        locationId,
      },
    })
  } catch (error) {
    console.error('Error fetching sales by category report:', error)
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
