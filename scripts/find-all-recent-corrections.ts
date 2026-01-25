/**
 * Find ALL recent inventory corrections and adjustments
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Searching ALL Recent Records ===\n')

  // Get the product ID for A4TECH KRS8372
  const product = await prisma.product.findFirst({
    where: {
      name: { contains: 'A4TECH KRS8372' }
    },
    select: { id: true, name: true }
  })

  if (product) {
    console.log(`Found product: ID ${product.id} - ${product.name}\n`)

    // Get Tuguegarao location
    const location = await prisma.businessLocation.findFirst({
      where: { name: { contains: 'Tuguegarao' } },
      select: { id: true, name: true }
    })

    if (location) {
      console.log(`Found location: ID ${location.id} - ${location.name}\n`)

      // Check current stock
      const stock = await prisma.variationLocationDetails.findFirst({
        where: {
          productId: product.id,
          locationId: location.id
        },
        include: {
          productVariation: { select: { id: true, name: true } }
        }
      })

      if (stock) {
        console.log(`Current stock: ${stock.qtyAvailable} units`)
        console.log(`Variation ID: ${stock.productVariationId}\n`)
      }
    }
  }

  // Get ALL inventory_corrections from today
  console.log('\n=== ALL inventory_corrections from Jan 22, 2026 ===\n')

  const allCorrections = await prisma.$queryRaw<any[]>`
    SELECT ic.*, p.name as product_name, bl.name as location_name
    FROM inventory_corrections ic
    JOIN products p ON p.id = ic.product_id
    JOIN business_locations bl ON bl.id = ic.location_id
    WHERE DATE(ic.created_at) = '2026-01-22'
    ORDER BY ic.created_at DESC
  `

  console.log(`Found ${allCorrections.length} corrections from today:`)
  for (const r of allCorrections) {
    console.log(`  ID: ${r.id} | ${r.product_name} | ${r.location_name} | diff: ${r.difference} | deleted: ${r.deleted_at ? 'YES' : 'NO'}`)
  }

  // Get ALL product_history adjustments from today
  console.log('\n\n=== ALL product_history adjustments from Jan 22, 2026 ===\n')

  const allAdjustments = await prisma.$queryRaw<any[]>`
    SELECT ph.*, p.name as product_name, bl.name as location_name
    FROM product_history ph
    JOIN products p ON p.id = ph.product_id
    JOIN business_locations bl ON bl.id = ph.location_id
    WHERE DATE(ph.created_at) = '2026-01-22'
      AND ph.transaction_type IN ('adjustment', 'correction')
    ORDER BY ph.created_at DESC
  `

  console.log(`Found ${allAdjustments.length} adjustments from today:`)
  for (const r of allAdjustments) {
    console.log(`  ID: ${r.id} | ${r.product_name} | ${r.location_name} | type: ${r.transaction_type} | ref: ${r.reference_type}#${r.reference_id} | qty: ${r.quantity_change}`)
  }

  // Check stock_transactions table too
  console.log('\n\n=== ALL stock_transactions adjustments from Jan 22, 2026 ===\n')

  const allStockTxns = await prisma.$queryRaw<any[]>`
    SELECT st.*, p.name as product_name, bl.name as location_name
    FROM stock_transactions st
    JOIN products p ON p.id = st.product_id
    JOIN business_locations bl ON bl.id = st.location_id
    WHERE DATE(st.created_at) = '2026-01-22'
      AND st.type IN ('adjustment', 'correction')
    ORDER BY st.created_at DESC
    LIMIT 50
  `

  console.log(`Found ${allStockTxns.length} stock transactions from today:`)
  for (const r of allStockTxns) {
    console.log(`  ID: ${r.id} | ${r.product_name} | ${r.location_name} | type: ${r.type} | ref: ${r.reference_type}#${r.reference_id} | qty: ${r.quantity}`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
