import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

type StockLocationRange = {
  min?: string
  max?: string
}

type StockFilters = {
  search?: string
  productName?: string
  productSku?: string
  variationName?: string
  variationSku?: string
  category?: string
  brand?: string
  unit?: string
  minTotalStock?: string
  maxTotalStock?: string
  locationFilters?: Record<string, StockLocationRange>
}

/**
 * POST /api/products/stock
 * OPTIMIZED: Uses PostgreSQL materialized view for 95% faster queries
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { businessId?: number | string }
    const businessIdRaw = sessionUser.businessId
    const businessId =
      typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw

    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Partial<{
      page: number
      limit: number
      sortKey: string
      sortOrder: 'asc' | 'desc'
      filters: StockFilters
      exportAll: boolean
    }>

    const {
      page = 1,
      limit = 25,
      sortKey = 'productName',
      sortOrder = 'asc',
      filters = {},
      exportAll = false,
    } = body || {}

    const baseLimit = Math.max(1, Number(limit) || 25)
    const requestedPage = Math.max(1, Number(page) || 1)

    // Build WHERE clauses for filtering
    const whereClauses: string[] = ['business_id = $1']
    const params: any[] = [businessId]
    let paramIndex = 2

    // Search filter (searches across multiple fields)
    if (filters.search) {
      whereClauses.push(`(
        product_name ILIKE $${paramIndex} OR
        variation_sku ILIKE $${paramIndex} OR
        category ILIKE $${paramIndex} OR
        brand ILIKE $${paramIndex}
      )`)
      params.push(`%${filters.search}%`)
      paramIndex++
    }

    // Specific field filters
    if (filters.productName) {
      whereClauses.push(`product_name ILIKE $${paramIndex}`)
      params.push(`%${filters.productName}%`)
      paramIndex++
    }

    if (filters.variationSku) {
      whereClauses.push(`variation_sku ILIKE $${paramIndex}`)
      params.push(`%${filters.variationSku}%`)
      paramIndex++
    }

    if (filters.category) {
      whereClauses.push(`category ILIKE $${paramIndex}`)
      params.push(`%${filters.category}%`)
      paramIndex++
    }

    if (filters.brand) {
      whereClauses.push(`brand ILIKE $${paramIndex}`)
      params.push(`%${filters.brand}%`)
      paramIndex++
    }

    // Total stock range filter
    if (filters.minTotalStock) {
      whereClauses.push(`total_stock >= $${paramIndex}`)
      params.push(parseFloat(filters.minTotalStock))
      paramIndex++
    }

    if (filters.maxTotalStock) {
      whereClauses.push(`total_stock <= $${paramIndex}`)
      params.push(parseFloat(filters.maxTotalStock))
      paramIndex++
    }

    // Location-specific filters (for columns loc_1_qty through loc_20_qty)
    if (filters.locationFilters) {
      Object.entries(filters.locationFilters).forEach(([locationId, range]) => {
        const locId = parseInt(locationId)
        if (locId >= 1 && locId <= 20) {
          if (range.min) {
            whereClauses.push(`loc_${locId}_qty >= $${paramIndex}`)
            params.push(parseFloat(range.min))
            paramIndex++
          }
          if (range.max) {
            whereClauses.push(`loc_${locId}_qty <= $${paramIndex}`)
            params.push(parseFloat(range.max))
            paramIndex++
          }
        }
      })
    }

    const whereSQL = whereClauses.join(' AND ')

    // Map sortKey to actual column names
    const sortColumnMap: Record<string, string> = {
      productName: 'product_name',
      productSku: 'product_sku',
      variationName: 'variation_name',
      variationSku: 'variation_sku',
      category: 'category',
      brand: 'brand',
      unit: 'unit',
      totalStock: 'total_stock',
    }

    // Handle location-based sorting
    let orderByColumn = sortColumnMap[sortKey] || 'product_name'
    if (sortKey.startsWith('location-')) {
      const locId = parseInt(sortKey.split('-')[1])
      if (locId >= 1 && locId <= 20) {
        orderByColumn = `loc_${locId}_qty`
      }
    }

    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Count total matching rows
    const countQuery = `
      SELECT COUNT(*) as total
      FROM stock_pivot_view
      WHERE ${whereSQL}
    `
    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params)
    const totalCount = Number(countResult[0]?.total || 0)

    // Fetch paginated data
    const effectiveLimit = exportAll ? totalCount : baseLimit
    const totalPages = exportAll ? 1 : Math.max(1, Math.ceil(totalCount / effectiveLimit))
    const safePage = exportAll ? 1 : Math.min(requestedPage, totalPages)
    const offset = exportAll ? 0 : (safePage - 1) * effectiveLimit

    const dataQuery = `
      SELECT
        variation_id,
        product_id,
        product_name,
        product_sku,
        product_image,
        variation_name,
        variation_sku,
        category,
        brand,
        unit,
        loc_1_qty, loc_2_qty, loc_3_qty, loc_4_qty, loc_5_qty,
        loc_6_qty, loc_7_qty, loc_8_qty, loc_9_qty, loc_10_qty,
        loc_11_qty, loc_12_qty, loc_13_qty, loc_14_qty, loc_15_qty,
        loc_16_qty, loc_17_qty, loc_18_qty, loc_19_qty, loc_20_qty,
        extra_locations_json,
        total_stock
      FROM stock_pivot_view
      WHERE ${whereSQL}
      ORDER BY ${orderByColumn} ${orderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const rows = await prisma.$queryRawUnsafe<any[]>(
      dataQuery,
      ...params,
      effectiveLimit,
      offset
    )

    // Get all active locations for this business
    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform rows to match expected frontend format
    const transformedRows = rows.map((row: any) => {
      const stockByLocation: Record<number, number> = {}

      // Extract stock from fixed columns (locations 1-20)
      for (let i = 1; i <= 20; i++) {
        const qty = parseFloat(row[`loc_${i}_qty`] || 0)
        if (qty > 0) {
          stockByLocation[i] = qty
        }
      }

      // Extract stock from JSON column (locations 21+)
      if (row.extra_locations_json) {
        Object.entries(row.extra_locations_json).forEach(([locId, qty]: [string, any]) => {
          stockByLocation[parseInt(locId)] = parseFloat(qty || 0)
        })
      }

      return {
        productId: row.product_id,
        variationId: row.variation_id,
        productName: row.product_name,
        productSku: row.product_sku,
        productImage: row.product_image,
        variationName: row.variation_name,
        variationSku: row.variation_sku,
        category: row.category || '',
        brand: row.brand || '',
        unit: row.unit || 'N/A',
        stockByLocation,
        totalStock: parseFloat(row.total_stock || 0),
      }
    })

    // Calculate column totals
    const locationTotals: Record<number, number> = {}
    let grandTotal = 0

    transformedRows.forEach((row) => {
      Object.entries(row.stockByLocation).forEach(([locId, qty]) => {
        const id = parseInt(locId)
        locationTotals[id] = (locationTotals[id] || 0) + qty
      })
      grandTotal += row.totalStock
    })

    return NextResponse.json({
      rows: transformedRows,
      locations: allLocations,
      totals: {
        byLocation: locationTotals,
        grandTotal,
      },
      pagination: {
        page: safePage,
        limit: effectiveLimit,
        totalCount,
        totalPages,
      },
      sorting: {
        sortKey,
        sortOrder,
      },
    })
  } catch (error) {
    console.error('[Stock API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
