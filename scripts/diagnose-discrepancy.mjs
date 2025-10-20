/**
 * Inventory Discrepancy Diagnostic Script
 * Finds and displays ledger vs physical stock mismatches
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function calculateLedgerStock(productVariationId, locationId) {
  const result = await prisma.$queryRaw`
    SELECT SUM(
      CASE
        WHEN type IN ('opening_stock', 'purchase', 'transfer_in', 'customer_return', 'adjustment', 'correction')
        THEN CAST(quantity AS DECIMAL(15,4))
        WHEN type IN ('sale', 'transfer_out', 'supplier_return')
        THEN -CAST(quantity AS DECIMAL(15,4))
        ELSE 0
      END
    ) as total
    FROM stock_transactions
    WHERE product_variation_id = ${productVariationId}
      AND location_id = ${locationId}
  `

  return result[0]?.total ? parseFloat(result[0].total) : 0
}

async function findAllDiscrepancies(businessId) {
  console.log('🔍 Scanning inventory for discrepancies...\n')

  const results = await prisma.$queryRaw`
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
        CAST(vld.qty_available AS DECIMAL(15,4)) as physical_stock
      FROM variation_location_details vld
      WHERE EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = vld.product_id AND p.business_id = ${businessId}
      )
    )

    SELECT
      lc.product_variation_id as productVariationId,
      lc.location_id as locationId,
      p.name as productName,
      pv.name as variationName,
      pv.sku,
      bl.name as locationName,
      COALESCE(ps.physical_stock, 0) as physicalStock,
      lc.ledger_calculated_stock as ledgerCalculated,
      (lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0)) as variance,
      lc.transaction_count as transactionCount,
      CASE
        WHEN lc.ledger_calculated_stock > COALESCE(ps.physical_stock, 0)
        THEN 'Ledger Higher - Physical stock missing (possible missing addition or extra deduction)'
        WHEN lc.ledger_calculated_stock < COALESCE(ps.physical_stock, 0)
        THEN 'Physical Higher - Ledger entry missing (possible missing ledger entry or double addition)'
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

async function getTransactionHistory(productVariationId, locationId) {
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      productVariationId,
      locationId,
    },
    include: {
      createdByUser: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  })

  return transactions
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════')
    console.log('   INVENTORY INTEGRITY DIAGNOSTIC TOOL')
    console.log('═══════════════════════════════════════════════════════\n')

    // Get the first business ID (adjust if you have multiple)
    const business = await prisma.business.findFirst()

    if (!business) {
      console.error('❌ No business found in database')
      return
    }

    console.log(`Business: ${business.name} (ID: ${business.id})`)
    console.log(`Scanning inventory...\n`)

    // Find all discrepancies
    const discrepancies = await findAllDiscrepancies(business.id)

    if (discrepancies.length === 0) {
      console.log('✅ ═══════════════════════════════════════════════════')
      console.log('✅  EXCELLENT! NO DISCREPANCIES FOUND!')
      console.log('✅  Your inventory is 100% consistent!')
      console.log('✅ ═══════════════════════════════════════════════════\n')
      return
    }

    // Display discrepancies
    console.log(`⚠️  FOUND ${discrepancies.length} DISCREPANCY(IES)\n`)
    console.log('═══════════════════════════════════════════════════════\n')

    for (let i = 0; i < discrepancies.length; i++) {
      const d = discrepancies[i]

      console.log(`\n${'━'.repeat(55)}`)
      console.log(`DISCREPANCY #${i + 1}`)
      console.log('━'.repeat(55))
      console.log(`Product:          ${d.productName}`)
      console.log(`Variation:        ${d.variationName}`)
      console.log(`SKU:              ${d.sku}`)
      console.log(`Location:         ${d.locationName}`)
      console.log(``)
      console.log(`Physical Stock:   ${parseFloat(d.physicalStock).toFixed(4)} units`)
      console.log(`Ledger Calculated: ${parseFloat(d.ledgerCalculated).toFixed(4)} units`)
      console.log(`Variance:         ${parseFloat(d.variance).toFixed(4)} units`)
      console.log(``)
      console.log(`Diagnosis:        ${d.diagnosis}`)
      console.log(`Transaction Count: ${d.transactionCount}`)
      console.log('━'.repeat(55))

      // Get transaction history
      console.log(`\n📊 TRANSACTION HISTORY:\n`)
      console.log('┌─────────────────────┬─────────────────┬───────────┬───────────────┬──────────────────────┐')
      console.log('│ Date & Time         │ Type            │ Qty       │ Balance After │ Reference            │')
      console.log('├─────────────────────┼─────────────────┼───────────┼───────────────┼──────────────────────┤')

      const history = await getTransactionHistory(d.productVariationId, d.locationId)

      for (const tx of history) {
        const date = new Date(tx.createdAt).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })

        const qty = parseFloat(tx.quantity)
        const qtyStr = tx.type.includes('sale') || tx.type.includes('transfer_out') || tx.type.includes('supplier_return')
          ? `-${qty.toFixed(2)}`
          : `+${qty.toFixed(2)}`

        const balance = parseFloat(tx.balanceQty).toFixed(2)
        const ref = tx.referenceType && tx.referenceId
          ? `${tx.referenceType}#${tx.referenceId}`
          : tx.notes || 'N/A'

        console.log(
          `│ ${date.padEnd(19)} │ ${tx.type.padEnd(15)} │ ${qtyStr.padStart(9)} │ ${balance.padStart(13)} │ ${ref.slice(0, 20).padEnd(20)} │`
        )
      }

      console.log('└─────────────────────┴─────────────────┴───────────┴───────────────┴──────────────────────┘')
      console.log(``)
    }

    // Summary
    console.log(`\n${'═'.repeat(55)}`)
    console.log(' SUMMARY')
    console.log('═'.repeat(55))

    const totalVariance = discrepancies.reduce((sum, d) => sum + Math.abs(parseFloat(d.variance)), 0)

    console.log(`Total Discrepancies:  ${discrepancies.length}`)
    console.log(`Total Variance:       ${totalVariance.toFixed(4)} units`)
    console.log('═'.repeat(55))

    console.log(`\n${'═'.repeat(55)}`)
    console.log(' RECOMMENDED ACTIONS')
    console.log('═'.repeat(55))
    console.log(`
1. INVESTIGATE: Review the transaction history above to find:
   - Missing transactions (ledger gaps)
   - Extra transactions (shouldn't exist)
   - Incorrect quantities

2. FIX OPTIONS:

   Option A - Sync Physical Stock to Match Ledger (RECOMMENDED):
   ────────────────────────────────────────────────────────────
   Run: node scripts/fix-discrepancy.mjs

   This will update variation_location_details.qty_available
   to match the ledger calculated stock.

   Option B - Create Correction Entry:
   ────────────────────────────────────
   Create a manual correction transaction to bring ledger
   in line with physical stock (if physical is correct).

3. PREVENT: Enable post-transaction validation:
   ────────────────────────────────────────────
   Add to .env:  ENABLE_STOCK_VALIDATION=true
   Restart server

4. MONITOR: Set up daily reconciliation checks:
   ─────────────────────────────────────────────
   Schedule this script to run daily via cron
`)

    console.log('═'.repeat(55))
    console.log(`\n💡 TIP: Save this output for your records before fixing!\n`)

  } catch (error) {
    console.error('❌ Error during diagnostic:', error)
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
