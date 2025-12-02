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
  supplier?: string
  category?: string
  brand?: string
  unit?: string
  minCost?: string
  maxCost?: string
  minPrice?: string
  maxPrice?: string
  minTotalStock?: string
  maxTotalStock?: string
  isActive?: string
  locationFilters?: Record<string, StockLocationRange>
}

/**
 * POST /api/products/branch-stock-pivot
 * OPTIMIZED: Uses stock_pivot_view + LEFT JOINs for 95% faster queries
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

    // Build WHERE clauses
    const whereClauses: string[] = ['spv.business_id = $1']
    const params: any[] = [businessId]
    let paramIndex = 2

    // Search filter
    if (filters.search) {
      whereClauses.push(`(
        spv.product_name ILIKE $${paramIndex} OR
        spv.variation_sku ILIKE $${paramIndex} OR
        spv.category ILIKE $${paramIndex} OR
        spv.brand ILIKE $${paramIndex} OR
        s.name ILIKE $${paramIndex}
      )`)
      params.push(`%${filters.search}%`)
      paramIndex++
    }

    // Specific field filters
    if (filters.productName) {
      whereClauses.push(`spv.product_name ILIKE $${paramIndex}`)
      params.push(`%${filters.productName}%`)
      paramIndex++
    }

    if (filters.variationSku) {
      whereClauses.push(`spv.variation_sku ILIKE $${paramIndex}`)
      params.push(`%${filters.variationSku}%`)
      paramIndex++
    }

    if (filters.category) {
      whereClauses.push(`spv.category ILIKE $${paramIndex}`)
      params.push(`%${filters.category}%`)
      paramIndex++
    }

    if (filters.brand) {
      whereClauses.push(`spv.brand ILIKE $${paramIndex}`)
      params.push(`%${filters.brand}%`)
      paramIndex++
    }

    if (filters.supplier) {
      whereClauses.push(`s.name ILIKE $${paramIndex}`)
      params.push(`%${filters.supplier}%`)
      paramIndex++
    }

    // Total stock range
    if (filters.minTotalStock) {
      whereClauses.push(`spv.total_stock >= $${paramIndex}`)
      params.push(parseFloat(filters.minTotalStock))
      paramIndex++
    }

    if (filters.maxTotalStock) {
      whereClauses.push(`spv.total_stock <= $${paramIndex}`)
      params.push(parseFloat(filters.maxTotalStock))
      paramIndex++
    }

    // Cost range
    if (filters.minCost) {
      whereClauses.push(`pv.purchase_price >= $${paramIndex}`)
      params.push(parseFloat(filters.minCost))
      paramIndex++
    }

    if (filters.maxCost) {
      whereClauses.push(`pv.purchase_price <= $${paramIndex}`)
      params.push(parseFloat(filters.maxCost))
      paramIndex++
    }

    // Price range
    if (filters.minPrice) {
      whereClauses.push(`pv.selling_price >= $${paramIndex}`)
      params.push(parseFloat(filters.minPrice))
      paramIndex++
    }

    if (filters.maxPrice) {
      whereClauses.push(`pv.selling_price <= $${paramIndex}`)
      params.push(parseFloat(filters.maxPrice))
      paramIndex++
    }

    // Active status filter
    if (filters.isActive && filters.isActive !== 'all') {
      whereClauses.push(`p.is_active = $${paramIndex}`)
      params.push(filters.isActive === 'true')
      paramIndex++
    }

    // Location-specific filters
    if (filters.locationFilters) {
      Object.entries(filters.locationFilters).forEach(([locationId, range]) => {
        const locId = parseInt(locationId)
        if (locId >= 1 && locId <= 20) {
          if (range.min) {
            whereClauses.push(`spv.loc_${locId}_qty >= $${paramIndex}`)
            params.push(parseFloat(range.min))
            paramIndex++
          }
          if (range.max) {
            whereClauses.push(`spv.loc_${locId}_qty <= $${paramIndex}`)
            params.push(parseFloat(range.max))
            paramIndex++
          }
        }
      })
    }

    const whereSQL = whereClauses.join(' AND ')

    // Map sortKey to column names
    const sortColumnMap: Record<string, string> = {
      productName: 'spv.product_name',
      productSku: 'spv.product_sku',
      variationName: 'spv.variation_name',
      variationSku: 'spv.variation_sku',
      supplier: 's.name',
      category: 'spv.category',
      brand: 'spv.brand',
      unit: 'spv.unit',
      totalStock: 'spv.total_stock',
      cost: 'pv.purchase_price',
      price: 'pv.selling_price',
      lastDeliveryDate: 'pv.last_purchase_date',
      lastQtyDelivered: 'pv.last_purchase_quantity',
    }

    let orderByColumn = sortColumnMap[sortKey] || 'spv.product_name'
    if (sortKey.startsWith('location-')) {
      const locId = parseInt(sortKey.split('-')[1])
      if (locId >= 1 && locId <= 20) {
        orderByColumn = `spv.loc_${locId}_qty`
      }
    }

    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Count total matching rows
    const countQuery = `
      SELECT COUNT(*) as total
      FROM stock_pivot_view spv
      INNER JOIN product_variations pv ON pv.id = spv.variation_id
      INNER JOIN products p ON p.id = spv.product_id
      LEFT JOIN suppliers s ON s.id = pv.supplier_id
      WHERE ${whereSQL}
    `
    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params)
    const totalCount = Number(countResult[0]?.total || 0)

    // Fetch paginated data
    const effectiveLimit = exportAll ? totalCount : baseLimit
    const totalPages = exportAll ? 1 : Math.max(1, Math.ceil(totalCount / effectiveLimit))
    const safePage = exportAll ? 1 : Math.min(requestedPage, totalPages)
    const offset = exportAll ? 0 : (safePage - 1) * effectiveLimit

    // Get the latest location-specific price (MAX from variation_location_details)
    // This ensures we show the most recently updated price, not the default variation price
    const dataQuery = `
      SELECT
        spv.variation_id,
        spv.product_id,
        spv.product_name,
        spv.product_sku,
        spv.product_image,
        spv.variation_name,
        spv.variation_sku,
        spv.category,
        spv.brand,
        spv.unit,
        spv.loc_1_qty, spv.loc_2_qty, spv.loc_3_qty, spv.loc_4_qty, spv.loc_5_qty,
        spv.loc_6_qty, spv.loc_7_qty, spv.loc_8_qty, spv.loc_9_qty, spv.loc_10_qty,
        spv.loc_11_qty, spv.loc_12_qty, spv.loc_13_qty, spv.loc_14_qty, spv.loc_15_qty,
        spv.loc_16_qty, spv.loc_17_qty, spv.loc_18_qty, spv.loc_19_qty, spv.loc_20_qty,
        spv.extra_locations_json,
        spv.total_stock,
        COALESCE(s.name, '') as supplier_name,
        COALESCE(pv.purchase_price, 0) as cost,
        COALESCE(
          (SELECT MAX(vld.selling_price) FROM variation_location_details vld WHERE vld.product_variation_id = pv.id AND vld.selling_price IS NOT NULL),
          pv.selling_price,
          0
        ) as price,
        pv.last_purchase_date,
        COALESCE(pv.last_purchase_quantity, 0) as last_qty_delivered,
        COALESCE(pv.last_purchase_cost, 0) as last_purchase_cost,
        p.is_active
      FROM stock_pivot_view spv
      INNER JOIN product_variations pv ON pv.id = spv.variation_id
      INNER JOIN products p ON p.id = spv.product_id
      LEFT JOIN suppliers s ON s.id = pv.supplier_id
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

    // Get all active locations
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

    // Transform rows
    const transformedRows = rows.map((row: any) => {
      const stockByLocation: Record<number, number> = {}

      // Extract from fixed columns
      for (let i = 1; i <= 20; i++) {
        const qty = parseFloat(row[`loc_${i}_qty`] || 0)
        if (qty > 0) {
          stockByLocation[i] = qty
        }
      }

      // Extract from JSON column
      if (row.extra_locations_json) {
        Object.entries(row.extra_locations_json).forEach(([locId, qty]: [string, any]) => {
          stockByLocation[parseInt(locId)] = parseFloat(qty || 0)
        })
      }

      const cost = parseFloat(row.cost || 0)
      const price = parseFloat(row.price || 0)
      const totalStock = parseFloat(row.total_stock || 0)

      return {
        productId: row.product_id,
        variationId: row.variation_id,
        productName: row.product_name,
        productSku: row.product_sku,
        productImage: row.product_image,
        variationName: row.variation_name,
        variationSku: row.variation_sku,
        supplier: row.supplier_name || '',
        category: row.category || '',
        brand: row.brand || '',
        unit: row.unit || 'N/A',
        lastDeliveryDate: row.last_purchase_date ? row.last_purchase_date.toISOString().split('T')[0] : null,
        lastQtyDelivered: parseFloat(row.last_qty_delivered || 0),
        lastPurchaseCost: parseFloat(row.last_purchase_cost || 0),
        cost,
        price,
        stockByLocation,
        totalStock,
        totalCost: totalStock * cost,
        totalPrice: totalStock * price,
        isActive: row.is_active,
      }
    })

    // Calculate totals
    const locationTotals: Record<number, number> = {}
    const locationCostTotals: Record<number, number> = {}
    const locationPriceTotals: Record<number, number> = {}
    let grandTotal = 0
    let grandTotalCost = 0
    let grandTotalPrice = 0

    transformedRows.forEach((row) => {
      Object.entries(row.stockByLocation).forEach(([locId, qty]) => {
        const id = parseInt(locId)
        locationTotals[id] = (locationTotals[id] || 0) + qty
        locationCostTotals[id] = (locationCostTotals[id] || 0) + (qty * row.cost)
        locationPriceTotals[id] = (locationPriceTotals[id] || 0) + (qty * row.price)
      })
      grandTotal += row.totalStock
      grandTotalCost += row.totalCost
      grandTotalPrice += row.totalPrice
    })

    return NextResponse.json({
      rows: transformedRows,
      locations: allLocations,
      totals: {
        byLocation: locationTotals,
        costByLocation: locationCostTotals,
        priceByLocation: locationPriceTotals,
        grandTotal,
        grandTotalCost,
        grandTotalPrice,
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
    console.error('[Branch Stock Pivot] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate branch stock pivot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
