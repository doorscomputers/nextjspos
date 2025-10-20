/**
 * Inventory Discrepancy Fix Script
 * Syncs physical stock to match ledger calculations
 *
 * ⚠️ WARNING: This will modify variation_location_details.qty_available
 * ⚠️ BACKUP YOUR DATABASE FIRST!
 */

import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function findAllDiscrepancies(businessId) {
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
        END), 0) as ledger_calculated_stock
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
      (lc.ledger_calculated_stock - COALESCE(ps.physical_stock, 0)) as variance
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

async function syncPhysicalToLedger(productVariationId, locationId, newStock) {
  const updated = await prisma.variationLocationDetails.updateMany({
    where: {
      productVariationId,
      locationId,
    },
    data: {
      qtyAvailable: newStock,
      updatedAt: new Date(),
    },
  })

  return updated
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════')
    console.log('   INVENTORY DISCREPANCY FIX TOOL')
    console.log('═══════════════════════════════════════════════════════\n')
    console.log('⚠️  WARNING: This will modify your inventory data!')
    console.log('⚠️  Make sure you have a database backup!\n')

    const business = await prisma.business.findFirst()

    if (!business) {
      console.error('❌ No business found in database')
      return
    }

    console.log(`Business: ${business.name} (ID: ${business.id})\n`)

    // Find discrepancies
    const discrepancies = await findAllDiscrepancies(business.id)

    if (discrepancies.length === 0) {
      console.log('✅ No discrepancies found! Your inventory is already consistent.\n')
      return
    }

    console.log(`Found ${discrepancies.length} discrepancy(ies):\n`)

    // Display discrepancies
    for (let i = 0; i < discrepancies.length; i++) {
      const d = discrepancies[i]
      console.log(`${i + 1}. ${d.productName} - ${d.variationName}`)
      console.log(`   Location: ${d.locationName}`)
      console.log(`   Current Physical Stock: ${parseFloat(d.physicalStock).toFixed(4)}`)
      console.log(`   Ledger Calculated Stock: ${parseFloat(d.ledgerCalculated).toFixed(4)}`)
      console.log(`   Will change by: ${parseFloat(d.variance).toFixed(4)} units\n`)
    }

    console.log('═══════════════════════════════════════════════════════')
    console.log('This will UPDATE variation_location_details.qty_available')
    console.log('to MATCH the ledger calculated stock.')
    console.log('═══════════════════════════════════════════════════════\n')

    const answer = await question('Do you want to proceed with the fix? (yes/no): ')

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Fix cancelled. No changes made.\n')
      return
    }

    console.log('\n🔧 Fixing discrepancies...\n')

    let fixedCount = 0
    const fixes = []

    for (const d of discrepancies) {
      try {
        const result = await syncPhysicalToLedger(
          d.productVariationId,
          d.locationId,
          parseFloat(d.ledgerCalculated)
        )

        if (result.count > 0) {
          fixedCount++
          fixes.push({
            product: `${d.productName} - ${d.variationName}`,
            location: d.locationName,
            oldStock: parseFloat(d.physicalStock),
            newStock: parseFloat(d.ledgerCalculated),
            change: parseFloat(d.variance),
          })

          console.log(`✅ Fixed: ${d.productName} - ${d.variationName}`)
          console.log(`   ${d.locationName}: ${parseFloat(d.physicalStock).toFixed(4)} → ${parseFloat(d.ledgerCalculated).toFixed(4)}`)
        }
      } catch (error) {
        console.error(`❌ Error fixing ${d.productName}:`, error.message)
      }
    }

    console.log(`\n${'═'.repeat(55)}`)
    console.log(' FIX SUMMARY')
    console.log('═'.repeat(55))
    console.log(`Total Fixed: ${fixedCount} / ${discrepancies.length}`)
    console.log('═'.repeat(55) + '\n')

    if (fixes.length > 0) {
      console.log('Changes Made:')
      fixes.forEach((fix, i) => {
        console.log(`\n${i + 1}. ${fix.product}`)
        console.log(`   Location: ${fix.location}`)
        console.log(`   Old Stock: ${fix.oldStock.toFixed(4)}`)
        console.log(`   New Stock: ${fix.newStock.toFixed(4)}`)
        console.log(`   Change: ${fix.change > 0 ? '+' : ''}${fix.change.toFixed(4)}`)
      })
    }

    console.log(`\n✅ Fix completed!\n`)
    console.log('Next steps:')
    console.log('1. Run: node scripts/diagnose-discrepancy.mjs')
    console.log('   (Should show 0 discrepancies)')
    console.log('2. Add to .env: ENABLE_STOCK_VALIDATION=true')
    console.log('3. Restart your server\n')

  } catch (error) {
    console.error('❌ Error during fix:', error)
    throw error
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
