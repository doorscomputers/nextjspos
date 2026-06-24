import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { isSuperAdmin } from '@/lib/rbac'

/**
 * GET /api/reports/inventory-discrepancies
 *
 * Super-Admin diagnostic: lists every product/location where the on-hand stock
 * (variation_location_details.qty_available) does NOT match the movement ledger
 * (sum of stock_transactions.quantity), OR where the stored running balance
 * (balance_qty) has drifted from the true cumulative.
 *
 * Read-only. Scoped to products that HAVE movement history (so legitimate
 * bulk-imported opening stock with no ledger is not reported as noise).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Restrict to Super Admin (platform owner) only
    if (!isSuperAdmin(session.user as any)) {
      return NextResponse.json(
        { error: 'Forbidden - this report is restricted to Super Admin' },
        { status: 403 }
      )
    }

    const businessIdRaw = (session.user as any).businessId
    const businessId =
      typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw
    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Single aggregate: on-hand vs ledger total + internal running-balance drift.
    const rows = await prisma.$queryRaw<any[]>`
      WITH tot AS (
        SELECT product_variation_id, location_id, SUM(quantity) AS ledger_total
        FROM stock_transactions
        WHERE business_id = ${businessId}
        GROUP BY product_variation_id, location_id
      ),
      drift AS (
        SELECT product_variation_id, location_id, MAX(ABS(balance_qty - cum)) AS internal_drift
        FROM (
          SELECT product_variation_id, location_id, balance_qty,
                 SUM(quantity) OVER (
                   PARTITION BY product_variation_id, location_id
                   ORDER BY created_at ASC, id ASC
                 ) AS cum
          FROM stock_transactions
          WHERE business_id = ${businessId}
        ) z
        GROUP BY product_variation_id, location_id
      )
      SELECT
        p.id            AS product_id,
        p.name          AS product,
        pv.name         AS variation,
        COALESCE(NULLIF(pv.sku, ''), p.sku) AS sku,
        bl.name         AS location,
        vld.qty_available                       AS on_hand,
        tot.ledger_total                        AS ledger_total,
        (vld.qty_available - tot.ledger_total)  AS difference,
        COALESCE(d.internal_drift, 0)           AS internal_drift,
        (
          SELECT MAX(s.created_at) FROM stock_transactions s
          WHERE s.product_variation_id = tot.product_variation_id
            AND s.location_id = tot.location_id
        )                                       AS last_movement
      FROM tot
      JOIN drift d
        ON d.product_variation_id = tot.product_variation_id
       AND d.location_id = tot.location_id
      JOIN variation_location_details vld
        ON vld.product_variation_id = tot.product_variation_id
       AND vld.location_id = tot.location_id
      JOIN products p ON p.id = vld.product_id
      JOIN product_variations pv ON pv.id = vld.product_variation_id
      JOIN business_locations bl ON bl.id = tot.location_id
      WHERE p.business_id = ${businessId}
        AND (ABS(vld.qty_available - tot.ledger_total) > 0.0001
             OR COALESCE(d.internal_drift, 0) > 0.0001)
      ORDER BY ABS(vld.qty_available - tot.ledger_total) DESC, p.name ASC
    `

    const data = rows.map((r) => ({
      productId: Number(r.product_id),
      product: r.product as string,
      variation: r.variation as string,
      sku: (r.sku as string) || '',
      location: r.location as string,
      onHand: Number(r.on_hand),
      ledgerTotal: Number(r.ledger_total),
      difference: Number(r.difference),
      internalDrift: Number(r.internal_drift),
      lastMovement: r.last_movement ? new Date(r.last_movement).toISOString() : null,
    }))

    const summary = {
      totalDiscrepancies: data.length,
      totalAbsDifference: data.reduce((s, r) => s + Math.abs(r.difference), 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: data,
        summary,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Inventory discrepancies report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate inventory discrepancies report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
