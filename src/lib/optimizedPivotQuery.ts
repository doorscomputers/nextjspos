import { prisma } from '@/lib/prisma'

/**
 * Optimized pivot query using raw SQL with aggregation
 * This is MUCH faster than fetching all records and pivoting in JavaScript
 */
export async function getStockPivotOptimized(params: {
  businessId: number
  page: number
  limit: number
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  filters?: any
}) {
  const { businessId, page, limit, sortKey = 'product_name', sortOrder = 'asc' } = params

  const offset = (page - 1) * limit

  // Get all active locations for this business
  const locations = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
    SELECT id, name
    FROM business_locations
    WHERE business_id = ${businessId}
      AND is_active = true
      AND deleted_at IS NULL
    ORDER BY name ASC
  `

  // Build dynamic SQL for pivot columns
  const locationColumns = locations
    .map(
      (loc) => `
      MAX(CASE WHEN vld.location_id = ${loc.id} THEN vld.qty_available ELSE 0 END) AS "location_${loc.id}"
    `
    )
    .join(',')

  const totalStockSum = locations
    .map((loc) => `MAX(CASE WHEN vld.location_id = ${loc.id} THEN vld.qty_available ELSE 0 END)`)
    .join(' + ')

  // Optimized query with proper aggregation
  const query = `
    WITH stock_pivot AS (
      SELECT
        p.id AS product_id,
        pv.id AS variation_id,
        p.name AS product_name,
        p.sku AS product_sku,
        p.image AS product_image,
        p.is_active,
        pv.name AS variation_name,
        pv.sku AS variation_sku,
        pv.purchase_price AS cost,
        pv.selling_price AS price,
        COALESCE(c.name, '') AS category,
        COALESCE(b.name, '') AS brand,
        COALESCE(pv_unit.short_name, p_unit.short_name, 'N/A') AS unit,
        COALESCE(s.name, '') AS supplier,
        pv.last_purchase_date,
        COALESCE(pv.last_purchase_quantity, 0) AS last_qty_delivered,
        COALESCE(pv.last_purchase_cost, 0) AS last_purchase_cost,
        ${locationColumns},
        (${totalStockSum}) AS total_stock
      FROM products p
      INNER JOIN product_variations pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
      LEFT JOIN variation_location_details vld ON pv.id = vld.product_variation_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN units p_unit ON p.unit_id = p_unit.id
      LEFT JOIN units pv_unit ON pv.unit_id = pv_unit.id
      LEFT JOIN suppliers s ON pv.supplier_id = s.id
      WHERE p.business_id = $1
        AND p.is_active = true
        AND p.deleted_at IS NULL
      GROUP BY
        p.id, pv.id, p.name, p.sku, p.image, p.is_active,
        pv.name, pv.sku, pv.purchase_price, pv.selling_price,
        c.name, b.name, p_unit.short_name, pv_unit.short_name,
        s.name, pv.last_purchase_date, pv.last_purchase_quantity, pv.last_purchase_cost
    )
    SELECT *
    FROM stock_pivot
    ORDER BY ${sortKey} ${sortOrder.toUpperCase()}
    LIMIT $2 OFFSET $3
  `

  const rows = await prisma.$queryRawUnsafe<any[]>(query, businessId, limit, offset)

  // Get total count
  const countQuery = `
    SELECT COUNT(DISTINCT CONCAT(p.id, '-', pv.id)) as count
    FROM products p
    INNER JOIN product_variations pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
    WHERE p.business_id = $1
      AND p.is_active = true
      AND p.deleted_at IS NULL
  `

  const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(countQuery, businessId)
  const totalCount = Number(count)

  return {
    rows,
    locations,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    limit,
  }
}
