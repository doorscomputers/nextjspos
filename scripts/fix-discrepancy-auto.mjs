/**
 * AUTO-FIX Inventory Discrepancies
 * Automatically syncs physical stock to match ledger (no prompts)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════')
    console.log('   INVENTORY DISCREPANCY AUTO-FIX')
    console.log('═══════════════════════════════════════════════════════\n')

    const business = await prisma.business.findFirst()

    if (!business) {
      console.error('❌ No business found')
      return
    }

    console.log(`Business: ${business.name} (ID: ${business.id})\n`)
    console.log('🔧 Finding and fixing discrepancies...\n')

    // Get discrepancies directly with PostgreSQL-compatible query
    const updated = await prisma.$executeRaw`
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
          END), 0) as ledger_calculated_stock
        FROM stock_transactions st
        WHERE st.business_id = ${business.id}
        GROUP BY st.product_variation_id, st.location_id
      )

      UPDATE variation_location_details vld
      SET
        qty_available = lc.ledger_calculated_stock,
        updated_at = NOW()
      FROM ledger_calculations lc
      WHERE vld.product_variation_id = lc.product_variation_id
        AND vld.location_id = lc.location_id
        AND vld.qty_available::numeric != lc.ledger_calculated_stock
    `

    console.log(`✅ Fixed ${updated} discrepancy(ies)\n`)

    // Verify fix
    const remaining = await prisma.$queryRaw`
      WITH ledger_calculations AS (
        SELECT
          st.product_variation_id,
          st.location_id,
          COALESCE(SUM(CASE
            WHEN st.type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
            THEN CAST(st.quantity AS DECIMAL(15,4))
            WHEN st.type IN ('sale', 'transfer_out', 'supplier_return')
            THEN -CAST(st.quantity AS DECIMAL(15,4))
            ELSE 0
          END), 0) as ledger_calculated_stock
        FROM stock_transactions st
        WHERE st.business_id = ${business.id}
        GROUP BY st.product_variation_id, st.location_id
      ),
      physical_stock AS (
        SELECT
          product_variation_id,
          location_id,
          CAST(qty_available AS DECIMAL(15,4)) as physical_stock
        FROM variation_location_details
      )
      SELECT COUNT(*) as count
      FROM ledger_calculations lc
      LEFT JOIN physical_stock ps
        ON lc.product_variation_id = ps.product_variation_id
        AND lc.location_id = ps.location_id
      WHERE lc.ledger_calculated_stock != COALESCE(ps.physical_stock, 0)
    `

    const remainingCount = Number(remaining[0]?.count || 0)

    console.log('═══════════════════════════════════════════════════════')
    console.log(' VERIFICATION')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`Remaining Discrepancies: ${remainingCount}`)

    if (remainingCount === 0) {
      console.log(`\n✅ SUCCESS! All discrepancies have been fixed!`)
      console.log(`Your inventory is now 100% consistent.\n`)
    } else {
      console.log(`\n⚠️  ${remainingCount} discrepancies still remain.`)
      console.log(`Run the diagnostic again to investigate.\n`)
    }

    console.log('═══════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
