import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const businessIdInt = parseInt(businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_SALES_HISTORY)) {
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
        case 'thisQuarter': {
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1)
          dateFilter = { gte: quarterStart }
          break
        }
        case 'lastQuarter': {
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const lastQuarterStart = new Date(now.getFullYear(), quarterStartMonth - 3, 1)
          const lastQuarterEnd = new Date(
            now.getFullYear(),
            quarterStartMonth,
            0,
            23,
            59,
            59,
            999
          )
          dateFilter = { gte: lastQuarterStart, lte: lastQuarterEnd }
          break
        }
        case 'thisYear':
          const yearStart = new Date(now.getFullYear(), 0, 1)
          dateFilter = { gte: yearStart }
          break
        case 'lastYear':
          const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
          const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
          dateFilter = { gte: lastYearStart, lte: lastYearEnd }
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
      businessId: businessIdInt,
      deletedAt: null,
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: user.id,
      permissions: user.permissions || [],
      roles: user.roles || [],
      businessId: user.businessId,
      locationIds: user.locationIds || []
    })

    // Get all locations for this business to ensure business ID filtering
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId: businessIdInt, deletedAt: null },
      select: { id: { select: { id: true, name: true } } }
    })
    const businessLocationIds = businessLocations.map(loc => loc.id)

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id)) // Ensure they're in current business

      if (normalizedLocationIds.length === 0) {
        // User has no location access - return empty results
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
      where.locationId = { in: normalizedLocationIds }
    } else {
      // User has access to all locations, but still filter by business
      where.locationId = { in: businessLocationIds }
    }

    // Override with specific location filter if provided
    if (locationId && locationId !== 'all') {
      const requestedLocationId = parseInt(locationId)
      // Verify the requested location is in the user's accessible locations
      if (accessibleLocationIds !== null) {
        const normalizedIds = accessibleLocationIds.map((id) => Number(id))
        if (normalizedIds.includes(requestedLocationId)) {
          where.locationId = requestedLocationId
        }
      } else if (businessLocationIds.includes(requestedLocationId)) {
        where.locationId = requestedLocationId
      }
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
          saleId: { select: { id: true, name: true } },
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
    const salesPromise = prisma.sale.findMany({
      where,
      select: {
        customer: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          },
        },
        items: { select: { id: true, name: true } },
        payments: { select: { id: true, name: true } },
      },
      orderBy,
      skip: offset,
      take: limit,
    })

    const countPromise = prisma.sale.count({ where })

    const [sales, total] = await Promise.all([salesPromise, countPromise])

    const locationIds = Array.from(
      new Set(
        sales
          .map((sale) => sale.locationId)
          .filter((id): id is number => typeof id === 'number')
      )
    )

    let locationMap: Record<number, { id: number; name: string }> = {}

    if (locationIds.length > 0) {
      const locations = await prisma.businessLocation.findMany({
        where: {
          id: { in: locationIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      locationMap = locations.reduce((acc, loc) => {
        acc[loc.id] = loc
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    const productIds = Array.from(
      new Set(
        sales.flatMap((sale) => sale.items.map((item) => item.productId)).filter(
          (id): id is number => typeof id === 'number'
        )
      )
    )

    const variationIds = Array.from(
      new Set(
        sales
          .flatMap((sale) => sale.items.map((item) => item.productVariationId))
          .filter((id): id is number => typeof id === 'number')
      )
    )

    let productMap: Record<number, { id: number; name: string }> = {}
    let variationMap: Record<
      number,
      { id: number; name: string; sku: string | null; productId: number }
    > = {}

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      productMap = products.reduce((acc, product) => {
        acc[product.id] = product
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    if (variationIds.length > 0) {
      const variations = await prisma.productVariation.findMany({
        where: {
          id: { in: variationIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
          sku: { select: { id: true, name: true } },
          productId: { select: { id: true, name: true } },
        },
      })

      variationMap = variations.reduce((acc, variation) => {
        acc[variation.id] = variation
        return acc
      }, {} as Record<number, { id: number; name: string; sku: string | null; productId: number }>)
    }

    // Calculate summary for all matching records (not just current page)
    const allSales = await prisma.sale.findMany({
      where,
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
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
      location: locationMap[sale.locationId]?.name || 'Unknown',
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
      items: sale.items.map((item) => {
        const variation = variationMap[item.productVariationId]
        const product = variation ? productMap[variation.productId] : productMap[item.productId]

        return {
          productName: product?.name || 'Unknown Product',
          variationName: variation?.name || 'Standard',
          sku: variation?.sku ?? '',
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
        }
      }),
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
