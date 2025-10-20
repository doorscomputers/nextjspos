/**
 * Stock Validation and Integrity Checking
 * Ensures ledger entries always match physical stock
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export interface StockDiscrepancy {
  productVariationId: number
  locationId: number
  productName: string
  variationName: string
  sku: string
  locationName: string
  physicalStock: number
  ledgerCalculated: number
  variance: number
  transactionCount: number
  diagnosis: string
}

/**
 * Calculate expected stock from ledger entries
 */
export async function calculateLedgerStock(
  productVariationId: number,
  locationId: number,
  tx?: TransactionClient
): Promise<number> {
  const client = tx ?? prisma

  const result = await client.$queryRaw<{ total: Prisma.Decimal | null }[]>`
    SELECT SUM(
      CASE
        WHEN type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
        THEN quantity::numeric
        WHEN type IN ('sale', 'transfer_out', 'supplier_return')
        THEN -quantity::numeric
        ELSE 0
      END
    ) as total
    FROM stock_transactions
    WHERE product_variation_id = ${productVariationId}
      AND location_id = ${locationId}
  `

  const total = result[0]?.total
  return total ? parseFloat(total.toString()) : 0
}

/**
 * Get physical stock from variation_location_details
 */
export async function getPhysicalStock(
  productVariationId: number,
  locationId: number,
  tx?: TransactionClient
): Promise<number> {
  const client = tx ?? prisma

  const stock = await client.variationLocationDetails.findFirst({
    where: {
      productVariationId,
      locationId,
    },
    select: {
      qtyAvailable: true,
    },
  })

  return stock ? parseFloat(stock.qtyAvailable.toString()) : 0
}

/**
 * Validate that physical stock matches ledger calculation
 * Throws error if mismatch detected
 */
export async function validateStockConsistency(
  productVariationId: number,
  locationId: number,
  tx?: TransactionClient,
  context?: string
): Promise<void> {
  const ledgerStock = await calculateLedgerStock(productVariationId, locationId, tx)
  const physicalStock = await getPhysicalStock(productVariationId, locationId, tx)

  // Allow small floating point differences (0.0001)
  const difference = Math.abs(ledgerStock - physicalStock)
  const tolerance = 0.0001

  if (difference > tolerance) {
    const contextMsg = context ? ` (Context: ${context})` : ''

    throw new Error(
      `INVENTORY INTEGRITY ERROR${contextMsg}: ` +
      `Variation ${productVariationId} at Location ${locationId} - ` +
      `Physical Stock: ${physicalStock}, Ledger Calculated: ${ledgerStock}, ` +
      `Variance: ${physicalStock - ledgerStock}. ` +
      `Ledger and physical stock MUST match. This indicates a critical data integrity issue.`
    )
  }
}

/**
 * Find all stock discrepancies across the system
 */
export async function findAllDiscrepancies(
  businessId: number,
  tx?: TransactionClient
): Promise<StockDiscrepancy[]> {
  const client = tx ?? prisma

  const results = await client.$queryRaw<StockDiscrepancy[]>`
    WITH ledger_calculations AS (
      SELECT
        st.product_variation_id,
        st.location_id,
        COALESCE(SUM(CASE
          WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
          THEN st.quantity::numeric
          WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
          THEN -st.quantity::numeric
          ELSE 0
        END), 0) as ledger_calculated_stock,
        COUNT(*) as transaction_count
      FROM stock_transactions st
      WHERE st.business_id = ${businessId}
      GROUP BY st.product_variation_id, st.location_id
    ),

    physical_stock AS (
      SELECT
        vld.product_variation_id,
        vld.location_id,
        vld.qty_available::numeric as physical_stock
      FROM variation_location_details vld
      WHERE EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = vld.product_id AND p.business_id = ${businessId}
      )
    )

    SELECT
      lc.product_variation_id as "productVariationId",
      lc.location_id as "locationId",
      p.name as "productName",
      pv.name as "variationName",
      pv.sku,
      bl.name as "locationName",
      COALESCE(ps.physical_stock, 0)::float as "physicalStock",
      lc.ledger_calculated_stock::float as "ledgerCalculated",
      (lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0))::float as variance,
      lc.transaction_count::int as "transactionCount",
      CASE
        WHEN lc.ledger_calculated_stock > COALESCE(ps.physical_stock, 0)
        THEN 'Ledger Higher - Missing stock addition or extra deduction in system'
        WHEN lc.ledger_calculated_stock < COALESCE(ps.physical_stock, 0)
        THEN 'Physical Higher - Missing ledger entry or double addition in system'
        ELSE 'Matched'
      END as diagnosis
    FROM ledger_calculations lc
    LEFT JOIN physical_stock ps
      ON lc.product_variation_id = ps.product_variation_id
      AND lc.location_id = ps.location_id
    INNER JOIN product_variations pv ON lc.product_variation_id = pv.id
    INNER JOIN products p ON pv.product_id = p.id
    INNER JOIN business_locations bl ON lc.location_id = bl.id
    WHERE lc.ledger_calculated_stock != COALESCE(ps.physical_stock, 0)
    ORDER BY ABS(lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0)) DESC
  `

  return results
}

/**
 * Fix discrepancy by syncing physical stock to ledger
 * ⚠️ WARNING: This overwrites physical stock - use with caution!
 */
export async function syncPhysicalToLedger(
  productVariationId: number,
  locationId: number,
  tx?: TransactionClient
): Promise<{ oldStock: number; newStock: number; variance: number }> {
  const client = tx ?? prisma

  const ledgerStock = await calculateLedgerStock(productVariationId, locationId, client)
  const physicalStock = await getPhysicalStock(productVariationId, locationId, client)

  if (ledgerStock === physicalStock) {
    return {
      oldStock: physicalStock,
      newStock: ledgerStock,
      variance: 0,
    }
  }

  // Update physical stock to match ledger
  await client.variationLocationDetails.updateMany({
    where: {
      productVariationId,
      locationId,
    },
    data: {
      qtyAvailable: ledgerStock,
      updatedAt: new Date(),
    },
  })

  return {
    oldStock: physicalStock,
    newStock: ledgerStock,
    variance: ledgerStock - physicalStock,
  }
}

/**
 * Get detailed transaction history for a product at a location
 */
export async function getTransactionHistory(
  productVariationId: number,
  locationId: number,
  tx?: TransactionClient
) {
  const client = tx ?? prisma

  return await client.stockTransaction.findMany({
    where: {
      productVariationId,
      locationId,
    },
    include: {
      product: {
        select: { name: true },
      },
      productVariation: {
        select: { name: true, sku: true },
      },
      user: {
        select: { username: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

/**
 * Comprehensive inventory integrity check
 * Run this periodically to detect issues
 */
export async function performIntegrityCheck(businessId: number): Promise<{
  totalVariations: number
  discrepanciesFound: number
  totalVariance: number
  discrepancies: StockDiscrepancy[]
}> {
  const discrepancies = await findAllDiscrepancies(businessId)

  const totalVariance = discrepancies.reduce(
    (sum, d) => sum + Math.abs(d.variance),
    0
  )

  // Count total variations with stock
  const totalVariations = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT (product_variation_id, location_id))::bigint as count
    FROM variation_location_details vld
    WHERE EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = vld.product_id AND p.business_id = ${businessId}
    )
  `

  return {
    totalVariations: Number(totalVariations[0]?.count || 0),
    discrepanciesFound: discrepancies.length,
    totalVariance,
    discrepancies,
  }
}
