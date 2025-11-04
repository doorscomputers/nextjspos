import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { Prisma } from '@prisma/client'
import { getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * SALES PER ITEM REPORT - V2 OPTIMIZED
 *
 * Uses Prisma.$queryRaw with safe template literals
 * Based on user's recommended SQL style
 *
 * Key improvements:
 * - Type-safe SQL with Prisma generics
 * - Safe from SQL injection with Prisma.join()
 * - Proper pagination
 * - All filters included
 * - Separate summary query for accurate totals
 */

type ProductSalesItem = {
  productId: number
  productName: string
  sku: string | null
  categoryId: number | null
  categoryName: string | null
  totalQuantity: string // PostgreSQL returns DECIMAL as string
  totalRevenue: string
  totalCost: string
  transactionCount: number
}

type SummaryResult = {
  totalProducts: number
  totalQuantitySold: string
  totalRevenue: string
  totalCost: string
  totalProfit: string
}

type LocationBreakdown = {
  productId: number
  locationId: number
  locationName: string
  quantity: string
  revenue: string
}

export async function GET(request: NextRequest) {
  try {
    console.time('⏱️ [SALES-PER-ITEM-V2] Total execution time')

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(user.id)

    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = (page - 1) * limit

    // Filters
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const searchTerm = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'totalRevenue'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // RBAC: Get accessible locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: userId,
      permissions: user.permissions || [],
      roles: user.roles || [],
      businessId: user.businessId,
      locationIds: user.locationIds || []
    })

    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true }
    })
    const businessLocationIds = businessLocations.map(loc => loc.id)

    let allowedLocationIds: number[]
    if (accessibleLocationIds !== null) {
      allowedLocationIds = accessibleLocationIds
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && businessLocationIds.includes(id))

      if (allowedLocationIds.length === 0) {
        return NextResponse.json({
          items: [],
          summary: { totalProducts: 0, totalQuantitySold: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 },
          pagination: { total: 0, page, limit, totalPages: 0 }
        })
      }
    } else {
      allowedLocationIds = businessLocationIds
    }

    // Build date filters
    const startDateObj = startDate ? new Date(startDate) : null
    let endDateObj = endDate ? new Date(endDate) : null
    if (endDateObj) {
      endDateObj.setHours(23, 59, 59, 999)
    }

    // Map sort column names
    const sortColumnMap: Record<string, string> = {
      'totalRevenue': '"totalRevenue"',
      'totalQuantity': '"totalQuantity"',
      'totalProfit': '("totalRevenue" - "totalCost")',
      'productName': '"productName"',
      'transactionCount': '"transactionCount"'
    }
    const sortColumn = sortColumnMap[sortBy] || '"totalRevenue"'
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    console.time('⏱️ [SALES-PER-ITEM-V2] Main aggregation query')

    // === MAIN QUERY: Product Sales Aggregation ===
    let productQuery = Prisma.sql`
      SELECT
        p.id AS "productId",
        p.name AS "productName",
        p.sku AS "sku",
        c.id AS "categoryId",
        c.name AS "categoryName",
        SUM(si.quantity) AS "totalQuantity",
        SUM(si.quantity * si.unit_price) AS "totalRevenue",
        SUM(si.quantity * COALESCE(si.unit_cost, p.purchase_price, 0)) AS "totalCost",
        COUNT(DISTINCT si.sale_id) AS "transactionCount"
      FROM
        sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
      WHERE
        s.business_id = ${businessId}
        AND s.location_id IN (${Prisma.join(allowedLocationIds)})
        AND s.status != 'voided'
        AND s.deleted_at IS NULL
    `

    // Add date filters
    if (startDateObj) {
      productQuery = Prisma.sql`${productQuery} AND s.sale_date >= ${startDateObj}`
    }
    if (endDateObj) {
      productQuery = Prisma.sql`${productQuery} AND s.sale_date <= ${endDateObj}`
    }

    // Add category filter
    if (categoryId && categoryId !== 'all') {
      const categoryIdInt = parseInt(categoryId)
      productQuery = Prisma.sql`${productQuery} AND p.category_id = ${categoryIdInt}`
    }

    // Add search filter
    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`
      productQuery = Prisma.sql`${productQuery} AND (p.name ILIKE ${searchPattern} OR p.sku ILIKE ${searchPattern})`
    }

    // Add GROUP BY and ORDER BY
    productQuery = Prisma.sql`
      ${productQuery}
      GROUP BY p.id, p.name, p.sku, c.id, c.name
      ORDER BY ${Prisma.raw(sortColumn)} ${Prisma.raw(sortDirection)}
      LIMIT ${limit} OFFSET ${offset}
    `

    const items = await prisma.$queryRaw<ProductSalesItem[]>(productQuery)

    console.timeEnd('⏱️ [SALES-PER-ITEM-V2] Main aggregation query')

    // === SUMMARY QUERY: Totals Across ALL Products ===
    console.time('⏱️ [SALES-PER-ITEM-V2] Summary query')

    let summaryQuery = Prisma.sql`
      SELECT
        COUNT(DISTINCT p.id) AS "totalProducts",
        COALESCE(SUM(si.quantity), 0) AS "totalQuantitySold",
        COALESCE(SUM(si.quantity * si.unit_price), 0) AS "totalRevenue",
        COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, p.purchase_price, 0)), 0) AS "totalCost",
        COALESCE(SUM(si.quantity * si.unit_price) - SUM(si.quantity * COALESCE(si.unit_cost, p.purchase_price, 0)), 0) AS "totalProfit"
      FROM
        sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
      WHERE
        s.business_id = ${businessId}
        AND s.location_id IN (${Prisma.join(allowedLocationIds)})
        AND s.status != 'voided'
        AND s.deleted_at IS NULL
    `

    if (startDateObj) {
      summaryQuery = Prisma.sql`${summaryQuery} AND s.sale_date >= ${startDateObj}`
    }
    if (endDateObj) {
      summaryQuery = Prisma.sql`${summaryQuery} AND s.sale_date <= ${endDateObj}`
    }
    if (categoryId && categoryId !== 'all') {
      const categoryIdInt = parseInt(categoryId)
      summaryQuery = Prisma.sql`${summaryQuery} AND p.category_id = ${categoryIdInt}`
    }
    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`
      summaryQuery = Prisma.sql`${summaryQuery} AND (p.name ILIKE ${searchPattern} OR p.sku ILIKE ${searchPattern})`
    }

    const summaryResult = await prisma.$queryRaw<SummaryResult[]>(summaryQuery)
    const summary = summaryResult[0] || {
      totalProducts: 0,
      totalQuantitySold: '0',
      totalRevenue: '0',
      totalCost: '0',
      totalProfit: '0'
    }

    console.timeEnd('⏱️ [SALES-PER-ITEM-V2] Summary query')

    // === LOCATION BREAKDOWN: Only for current page products ===
    let locationBreakdown: LocationBreakdown[] = []
    if (items.length > 0) {
      console.time('⏱️ [SALES-PER-ITEM-V2] Location breakdown query')

      const productIds = items.map(item => item.productId)

      let locationQuery = Prisma.sql`
        SELECT
          si.product_id AS "productId",
          s.location_id AS "locationId",
          bl.name AS "locationName",
          SUM(si.quantity) AS "quantity",
          SUM(si.quantity * si.unit_price) AS "revenue"
        FROM
          sale_items si
          INNER JOIN sales s ON si.sale_id = s.id
          INNER JOIN business_locations bl ON s.location_id = bl.id
        WHERE
          s.business_id = ${businessId}
          AND s.location_id IN (${Prisma.join(allowedLocationIds)})
          AND s.status != 'voided'
          AND s.deleted_at IS NULL
          AND si.product_id IN (${Prisma.join(productIds)})
      `

      if (startDateObj) {
        locationQuery = Prisma.sql`${locationQuery} AND s.sale_date >= ${startDateObj}`
      }
      if (endDateObj) {
        locationQuery = Prisma.sql`${locationQuery} AND s.sale_date <= ${endDateObj}`
      }

      locationQuery = Prisma.sql`
        ${locationQuery}
        GROUP BY si.product_id, s.location_id, bl.name
        ORDER BY si.product_id, revenue DESC
      `

      locationBreakdown = await prisma.$queryRaw<LocationBreakdown[]>(locationQuery)

      console.timeEnd('⏱️ [SALES-PER-ITEM-V2] Location breakdown query')
    }

    // === FORMAT RESPONSE ===
    const formattedItems = items.map(item => {
      const totalRevenue = parseFloat(item.totalRevenue || '0')
      const totalCost = parseFloat(item.totalCost || '0')
      const totalProfit = totalRevenue - totalCost
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
      const avgPrice = parseFloat(item.totalQuantity || '0') > 0
        ? totalRevenue / parseFloat(item.totalQuantity)
        : 0

      // Get location breakdown for this product
      const locations = locationBreakdown
        .filter(loc => loc.productId === item.productId)
        .map(loc => ({
          locationId: loc.locationId,
          locationName: loc.locationName,
          quantity: parseFloat(loc.quantity || '0'),
          revenue: parseFloat(loc.revenue || '0')
        }))

      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        category: item.categoryName || 'Uncategorized',
        categoryId: item.categoryId,
        quantitySold: parseFloat(item.totalQuantity || '0'),
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin,
        averagePrice: avgPrice,
        transactionCount: item.transactionCount,
        locations
      }
    })

    const totalCount = parseInt(String(summary.totalProducts || 0))
    const totalPages = Math.ceil(totalCount / limit)

    console.timeEnd('⏱️ [SALES-PER-ITEM-V2] Total execution time')
    console.log(`✅ [SALES-PER-ITEM-V2] Returned ${items.length} products (Page ${page}/${totalPages})`)
    console.log(`📊 [SALES-PER-ITEM-V2] Summary: ${totalCount} total products, ${summary.totalQuantitySold} total quantity, ₱${parseFloat(summary.totalRevenue || '0').toFixed(2)} revenue`)

    return NextResponse.json({
      items: formattedItems,
      summary: {
        totalProducts: totalCount,
        totalQuantitySold: parseFloat(summary.totalQuantitySold || '0'),
        totalRevenue: parseFloat(summary.totalRevenue || '0'),
        totalCost: parseFloat(summary.totalCost || '0'),
        totalProfit: parseFloat(summary.totalProfit || '0'),
        profitMargin: parseFloat(summary.totalRevenue || '0') > 0
          ? (parseFloat(summary.totalProfit || '0') / parseFloat(summary.totalRevenue || '0')) * 100
          : 0
      },
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages
      }
    })

  } catch (error) {
    console.error('❌ [SALES-PER-ITEM-V2] Error:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    if (stack) {
      console.error('Error stack:', stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch sales per item report',
        details,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined
      },
      { status: 500 }
    )
  }
}
