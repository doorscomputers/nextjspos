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
    const businessIdInt = parseInt(businessId)
    const currentUserId = parseInt(user.id)

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
    const cashierId = searchParams.get('cashierId') || 'all' // Default to all cashiers
    const locationId = searchParams.get('locationId')
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const invoiceNumber = searchParams.get('invoiceNumber')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const productSearch = searchParams.get('productSearch')
    const paymentMethod = searchParams.get('paymentMethod')

    // View mode: invoice or item
    const viewMode = searchParams.get('viewMode') || 'invoice' // invoice or item

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Predefined date ranges
    const dateRange = searchParams.get('dateRange')

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

    // Filter by cashier (createdBy)
    if (cashierId && cashierId !== 'all') {
      where.createdBy = parseInt(cashierId)
    }

    if (locationId && locationId !== 'all') {
      where.locationId = parseInt(locationId)
    }

    if (customerId && customerId !== 'all') {
      where.customerId = parseInt(customerId)
    }

    if (status && status !== 'all') {
      where.status = status.toLowerCase()
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

    // Product search requires a different approach - search products first, then find sale items
    let productFilteredSaleIds: number[] = []
    if (productSearch) {
      // Search for matching products and variations
      const products = await prisma.product.findMany({
        where: {
          businessId: businessIdInt,
          deletedAt: null,
          name: {
            contains: productSearch,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })

      const variations = await prisma.productVariation.findMany({
        where: {
          businessId: businessIdInt,
          deletedAt: null,
          OR: [
            {
              name: {
                contains: productSearch,
                mode: 'insensitive',
              },
            },
            {
              sku: {
                contains: productSearch,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true },
      })

      const productIds = products.map((p) => p.id)
      const variationIds = variations.map((v) => v.id)

      // If no products or variations found, return empty result
      if (productIds.length === 0 && variationIds.length === 0) {
        return NextResponse.json({
          sales: [],
          items: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            totalSubtotal: 0,
            totalTax: 0,
            totalDiscount: 0,
            totalCOGS: 0,
            grossProfit: 0,
            totalItems: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
          viewMode,
        })
      }

      // Build OR conditions only for non-empty arrays
      const saleItemWhere: any[] = []
      if (productIds.length > 0) {
        saleItemWhere.push({ productId: { in: productIds } })
      }
      if (variationIds.length > 0) {
        saleItemWhere.push({ productVariationId: { in: variationIds } })
      }

      // Find sale items that match these products/variations
      const saleItems = await prisma.saleItem.findMany({
        where: {
          OR: saleItemWhere,
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
          items: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            totalSubtotal: 0,
            totalTax: 0,
            totalDiscount: 0,
            totalCOGS: 0,
            grossProfit: 0,
            totalItems: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
          viewMode,
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

    if (viewMode === 'invoice') {
      // INVOICE VIEW - Show sales grouped by invoice
      const salesPromise = prisma.sale.findMany({
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
          items: true,
          payments: true,
        },
        orderBy,
        skip: offset,
        take: limit,
      })

      const countPromise = prisma.sale.count({ where })

      const [sales, total] = await Promise.all([salesPromise, countPromise])

      // Fetch location and cashier data
      const locationIds = Array.from(
        new Set(
          sales
            .map((sale) => sale.locationId)
            .filter((id): id is number => typeof id === 'number')
        )
      )

      const cashierIds = Array.from(
        new Set(
          sales
            .map((sale) => sale.createdBy)
            .filter((id): id is number => typeof id === 'number')
        )
      )

      let locationMap: Record<number, { id: number; name: string }> = {}
      let cashierMap: Record<number, { id: number; name: string; username: string }> = {}

      if (locationIds.length > 0) {
        const locations = await prisma.businessLocation.findMany({
          where: {
            id: { in: locationIds },
            deletedAt: null,
            businessId: businessIdInt,
          },
          select: {
            id: true,
            name: true,
          },
        })

        locationMap = locations.reduce((acc, loc) => {
          acc[loc.id] = loc
          return acc
        }, {} as Record<number, { id: number; name: string }>)
      }

      if (cashierIds.length > 0) {
        const cashiers = await prisma.user.findMany({
          where: {
            id: { in: cashierIds },
            businessId: businessIdInt,
          },
          select: {
            id: true,
            firstName: true,
            surname: true,
            username: true,
          },
        })

        cashierMap = cashiers.reduce((acc, cashier) => {
          acc[cashier.id] = {
            id: cashier.id,
            name: `${cashier.firstName} ${cashier.surname}`,
            username: cashier.username,
          }
          return acc
        }, {} as Record<number, { id: number; name: string; username: string }>)
      }

      // Fetch product and variation data
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
            id: true,
            name: true,
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
            id: true,
            name: true,
            sku: true,
            productId: true,
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
        totalItems: 0,
      }

      // Calculate COGS and total items
      allSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const quantity = parseFloat(item.quantity.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          summary.totalCOGS += quantity * unitCost
          summary.totalItems += quantity
        })
      })

      summary.grossProfit = summary.totalRevenue - summary.totalCOGS

      // Format sales data for response
      const salesData = sales.map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate.toISOString().split('T')[0],
        cashier: cashierMap[sale.createdBy]?.name || 'Unknown',
        cashierId: sale.createdBy,
        cashierUsername: cashierMap[sale.createdBy]?.username || '',
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
          const product = productMap[item.productId]
          const variation = item.productVariationId ? variationMap[item.productVariationId] : null
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
        viewMode,
      })
    } else {
      // ITEM VIEW - Show individual sale items
      const itemWhere: any = {
        sale: where,
      }

      // Get all matching sales first
      const matchingSales = await prisma.sale.findMany({
        where,
        select: { id: true },
      })

      const saleIds = matchingSales.map(s => s.id)

      if (saleIds.length === 0) {
        return NextResponse.json({
          items: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            totalSubtotal: 0,
            totalTax: 0,
            totalDiscount: 0,
            totalCOGS: 0,
            grossProfit: 0,
            totalItems: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
          viewMode,
        })
      }

      // Now get sale items with pagination
      const itemsPromise = prisma.saleItem.findMany({
        where: {
          saleId: { in: saleIds },
        },
        include: {
          sale: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: sortOrder as 'asc' | 'desc',
        },
        skip: offset,
        take: limit,
      })

      const countPromise = prisma.saleItem.count({
        where: {
          saleId: { in: saleIds },
        },
      })

      const [items, total] = await Promise.all([itemsPromise, countPromise])

      // Fetch cashier and location data
      const cashierIds = Array.from(
        new Set(
          items
            .map((item) => item.sale.createdBy)
            .filter((id): id is number => typeof id === 'number')
        )
      )

      const locationIds = Array.from(
        new Set(
          items
            .map((item) => item.sale.locationId)
            .filter((id): id is number => typeof id === 'number')
        )
      )

      let cashierMap: Record<number, { id: number; name: string; username: string }> = {}
      let locationMap: Record<number, { id: number; name: string }> = {}

      if (cashierIds.length > 0) {
        const cashiers = await prisma.user.findMany({
          where: {
            id: { in: cashierIds },
            businessId: businessIdInt,
          },
          select: {
            id: true,
            firstName: true,
            surname: true,
            username: true,
          },
        })

        cashierMap = cashiers.reduce((acc, cashier) => {
          acc[cashier.id] = {
            id: cashier.id,
            name: `${cashier.firstName} ${cashier.surname}`,
            username: cashier.username,
          }
          return acc
        }, {} as Record<number, { id: number; name: string; username: string }>)
      }

      if (locationIds.length > 0) {
        const locations = await prisma.businessLocation.findMany({
          where: {
            id: { in: locationIds },
            deletedAt: null,
            businessId: businessIdInt,
          },
          select: {
            id: true,
            name: true,
          },
        })

        locationMap = locations.reduce((acc, loc) => {
          acc[loc.id] = loc
          return acc
        }, {} as Record<number, { id: number; name: string }>)
      }

      // Fetch product and variation data for items
      const productIds = Array.from(
        new Set(
          items.map((item) => item.productId).filter((id): id is number => typeof id === 'number')
        )
      )

      const variationIds = Array.from(
        new Set(
          items
            .map((item) => item.productVariationId)
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
            id: true,
            name: true,
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
            id: true,
            name: true,
            sku: true,
            productId: true,
          },
        })

        variationMap = variations.reduce((acc, variation) => {
          acc[variation.id] = variation
          return acc
        }, {} as Record<number, { id: number; name: string; sku: string | null; productId: number }>)
      }

      // Calculate summary
      const allSales = await prisma.sale.findMany({
        where,
        include: {
          items: true,
        },
      })

      const summary = {
        totalSales: matchingSales.length,
        totalRevenue: allSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0),
        totalSubtotal: allSales.reduce((sum, sale) => sum + parseFloat(sale.subtotal.toString()), 0),
        totalTax: allSales.reduce((sum, sale) => sum + parseFloat(sale.taxAmount.toString()), 0),
        totalDiscount: allSales.reduce((sum, sale) => sum + parseFloat(sale.discountAmount.toString()), 0),
        totalCOGS: 0,
        grossProfit: 0,
        totalItems: 0,
      }

      allSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const quantity = parseFloat(item.quantity.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          summary.totalCOGS += quantity * unitCost
          summary.totalItems += quantity
        })
      })

      summary.grossProfit = summary.totalRevenue - summary.totalCOGS

      // Format items data for response
      const itemsData = items.map((item) => {
        const product = productMap[item.productId]
        const variation = item.productVariationId ? variationMap[item.productVariationId] : null
        return {
          id: item.id,
          invoiceNumber: item.sale.invoiceNumber,
          saleId: item.saleId,
          saleDate: item.sale.saleDate.toISOString().split('T')[0],
          cashier: cashierMap[item.sale.createdBy]?.name || 'Unknown',
          cashierId: item.sale.createdBy,
          cashierUsername: cashierMap[item.sale.createdBy]?.username || '',
          customer: item.sale.customer?.name || 'Walk-in Customer',
          customerId: item.sale.customerId,
          location: locationMap[item.sale.locationId]?.name || 'Unknown',
          locationId: item.sale.locationId,
          status: item.sale.status,
          productName: product?.name || 'Unknown Product',
          productId: item.productId,
          variationName: variation?.name || 'Standard',
          variationId: item.productVariationId,
          sku: variation?.sku ?? '',
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
          profit: (parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString())) -
                  (parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())),
        }
      })

      return NextResponse.json({
        items: itemsData,
        summary,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        viewMode,
      })
    }
  } catch (error) {
    console.error('Error fetching sales per cashier report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales per cashier report' },
      { status: 500 }
    )
  }
}
