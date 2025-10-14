import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

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
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filters
    const locationId = searchParams.get('locationId')
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const invoiceNumber = searchParams.get('invoiceNumber')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const productSearch = searchParams.get('productSearch')
    const paymentMethod = searchParams.get('paymentMethod')

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt' // createdAt, saleDate, totalAmount, invoiceNumber
    const sortOrder = searchParams.get('sortOrder') || 'desc' // asc, desc

    // Predefined date ranges
    const dateRange = searchParams.get('dateRange') // today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth

    let dateFilter: any = {}

    if (dateRange) {
      const now = new Date()
      switch (dateRange) {
        case 'today':
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          dateFilter = { gte: todayStart, lte: todayEnd }
          break
        case 'yesterday':
          const yesterday = new Date(now)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
          const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
          dateFilter = { gte: yesterdayStart, lte: yesterdayEnd }
          break
        case 'thisWeek':
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          weekStart.setHours(0, 0, 0, 0)
          dateFilter = { gte: weekStart }
          break
        case 'lastWeek':
          const lastWeekStart = new Date(now)
          lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7)
          lastWeekStart.setHours(0, 0, 0, 0)
          const lastWeekEnd = new Date(lastWeekStart)
          lastWeekEnd.setDate(lastWeekEnd.getDate() + 6)
          lastWeekEnd.setHours(23, 59, 59, 999)
          dateFilter = { gte: lastWeekStart, lte: lastWeekEnd }
          break
        case 'thisMonth':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          dateFilter = { gte: monthStart }
          break
        case 'lastMonth':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
          dateFilter = { gte: lastMonthStart, lte: lastMonthEnd }
          break
      }
    } else if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) {
        const endDateObj = new Date(endDate)
        endDateObj.setHours(23, 59, 59, 999)
        dateFilter.lte = endDateObj
      }
    }

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    if (locationId && locationId !== 'all') {
      where.locationId = parseInt(locationId)
    }

    if (customerId && customerId !== 'all') {
      where.customerId = parseInt(customerId)
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (invoiceNumber) {
      where.invoiceNumber = {
        contains: invoiceNumber,
      }
    }

    if (Object.keys(dateFilter).length > 0) {
      where.saleDate = dateFilter
    }

    if (paymentMethod && paymentMethod !== 'all') {
      where.payments = {
        some: {
          paymentMethod: paymentMethod,
        },
      }
    }

    // Product search requires a different approach
    let productFilteredSaleIds: number[] = []
    if (productSearch) {
      const saleItems = await prisma.saleItem.findMany({
        where: {
          OR: [
            {
              product: {
                name: {
                  contains: productSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              productVariation: {
                name: {
                  contains: productSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              productVariation: {
                sku: {
                  contains: productSearch,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
        select: {
          saleId: true,
        },
      })

      productFilteredSaleIds = [...new Set(saleItems.map(item => item.saleId))]

      if (productFilteredSaleIds.length === 0) {
        // No sales match product search
        return NextResponse.json({
          sales: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            totalSubtotal: 0,
            totalTax: 0,
            totalDiscount: 0,
            totalCOGS: 0,
            grossProfit: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        })
      }

      where.id = {
        in: productFilteredSaleIds,
      }
    }

    // Build sort order
    const orderBy: any = {}
    if (sortBy === 'createdAt' || sortBy === 'saleDate' || sortBy === 'totalAmount' || sortBy === 'invoiceNumber') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = 'desc'
    }

    // Fetch data with pagination
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
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
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              productVariation: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          payments: true,
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ])

    // Calculate summary for all matching records (not just current page)
    const allSales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
      },
    })

    const summary = {
      totalSales: total,
      totalRevenue: allSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0),
      totalSubtotal: allSales.reduce((sum, sale) => sum + parseFloat(sale.subtotal.toString()), 0),
      totalTax: allSales.reduce((sum, sale) => sum + parseFloat(sale.taxAmount.toString()), 0),
      totalDiscount: allSales.reduce((sum, sale) => sum + parseFloat(sale.discountAmount.toString()), 0),
      totalCOGS: 0,
      grossProfit: 0,
    }

    // Calculate COGS
    allSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const quantity = parseFloat(item.quantity.toString())
        const unitCost = parseFloat(item.unitCost.toString())
        summary.totalCOGS += quantity * unitCost
      })
    })

    summary.grossProfit = summary.totalRevenue - summary.totalCOGS

    // Format sales data for response
    const salesData = sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString().split('T')[0],
      customer: sale.customer?.name || 'Walk-in Customer',
      customerId: sale.customerId,
      customerEmail: sale.customer?.email || null,
      customerMobile: sale.customer?.mobile || null,
      location: sale.location?.name || 'Unknown',
      locationId: sale.locationId,
      status: sale.status,
      subtotal: parseFloat(sale.subtotal.toString()),
      taxAmount: parseFloat(sale.taxAmount.toString()),
      discountAmount: parseFloat(sale.discountAmount.toString()),
      shippingCost: parseFloat(sale.shippingCost.toString()),
      totalAmount: parseFloat(sale.totalAmount.toString()),
      discountType: sale.discountType,
      notes: sale.notes,
      itemCount: sale.items.length,
      items: sale.items.map((item) => ({
        productName: item.product.name,
        variationName: item.productVariation.name,
        sku: item.productVariation.sku,
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitPrice.toString()),
        unitCost: parseFloat(item.unitCost.toString()),
        total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
      })),
      payments: sale.payments.map((p) => ({
        method: p.paymentMethod,
        amount: parseFloat(p.amount.toString()),
        referenceNumber: p.referenceNumber,
        paidAt: p.paidAt.toISOString(),
      })),
    }))

    return NextResponse.json({
      sales: salesData,
      summary,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching sales history report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales history report' },
      { status: 500 }
    )
  }
}
