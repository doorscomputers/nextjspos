/**
 * PRE-FIX VERIFICATION: MSI KATANA 15 HX
 *
 * This script is READ-ONLY. It verifies the data before applying any fix.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyBeforeFix() {
  const VARIATION_ID = 1646
  const PRODUCT_SKU = '4711377401265'

  console.log('='.repeat(70))
  console.log('PRE-FIX VERIFICATION: MSI KATANA 15 HX')
  console.log('='.repeat(70))
  console.log('\nThis is a READ-ONLY check. No changes will be made.\n')

  // 1. Find the product and variation
  const variation = await prisma.productVariation.findUnique({
    where: { id: VARIATION_ID },
    include: {
      product: true
    }
  })

  if (!variation) {
    console.log(`ERROR: Variation ID ${VARIATION_ID} not found!`)
    return
  }

  console.log('-'.repeat(70))
  console.log('PRODUCT DETAILS:')
  console.log('-'.repeat(70))
  console.log(`  Product Name: ${variation.product.name}`)
  console.log(`  Product ID: ${variation.productId}`)
  console.log(`  Variation ID: ${variation.id}`)
  console.log(`  SKU: ${variation.sku}`)
  console.log(`  Business ID: ${variation.product.businessId}`)

  // Verify SKU matches
  if (variation.sku !== PRODUCT_SKU) {
    console.log(`\n  *** WARNING: SKU mismatch! Expected ${PRODUCT_SKU}, got ${variation.sku} ***`)
  } else {
    console.log(`  SKU Verified: ✓`)
  }

  // 2. Get ALL locations for this business
  const allLocations = await prisma.businessLocation.findMany({
    where: { businessId: variation.product.businessId },
    orderBy: { name: 'asc' }
  })

  // 3. Get stock at ALL locations for this product
  const allStockRecords = await prisma.variationLocationDetails.findMany({
    where: { productVariationId: VARIATION_ID }
  })

  console.log('\n' + '-'.repeat(70))
  console.log('CURRENT STOCK AT ALL LOCATIONS:')
  console.log('-'.repeat(70))

  let totalStock = 0
  for (const loc of allLocations) {
    const stockRecord = allStockRecords.find(r => r.locationId === loc.id)
    const qty = stockRecord ? parseFloat(stockRecord.qtyAvailable.toString()) : 0
    totalStock += qty

    const marker = loc.name === 'Bambang' || loc.name === 'Main Warehouse' ? ' <-- TO BE FIXED' : ''
    console.log(`  ${loc.name.padEnd(20)} : ${qty.toFixed(2)}${marker}`)
  }
  console.log('  ' + '-'.repeat(30))
  console.log(`  ${'TOTAL'.padEnd(20)} : ${totalStock.toFixed(2)}`)

  // 4. Show recent product history for Bambang and Main Warehouse
  const bambang = allLocations.find(l => l.name === 'Bambang')
  const mainWarehouse = allLocations.find(l => l.name === 'Main Warehouse')

  if (bambang) {
    console.log('\n' + '-'.repeat(70))
    console.log('RECENT HISTORY AT BAMBANG (last 10 transactions):')
    console.log('-'.repeat(70))

    const bambangHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: VARIATION_ID,
        locationId: bambang.id
      },
      orderBy: { transactionDate: 'desc' },
      take: 10
    })

    if (bambangHistory.length === 0) {
      console.log('  No history records found')
    } else {
      console.log('  Date                 | Type          | Change | Balance | Reference')
      console.log('  ' + '-'.repeat(65))
      for (const h of bambangHistory) {
        const date = h.transactionDate.toISOString().slice(0, 10)
        const type = h.transactionType.padEnd(13)
        const changeNum = parseFloat(h.quantityChange.toString())
        const change = (changeNum >= 0 ? '+' : '') + changeNum.toFixed(2)
        const balance = parseFloat(h.balanceQuantity.toString()).toFixed(2)
        const ref = h.referenceNumber || '-'
        console.log(`  ${date}           | ${type} | ${change.padStart(6)} | ${balance.padStart(7)} | ${ref}`)
      }
    }
  }

  if (mainWarehouse) {
    console.log('\n' + '-'.repeat(70))
    console.log('RECENT HISTORY AT MAIN WAREHOUSE (last 10 transactions):')
    console.log('-'.repeat(70))

    const warehouseHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: VARIATION_ID,
        locationId: mainWarehouse.id
      },
      orderBy: { transactionDate: 'desc' },
      take: 10
    })

    if (warehouseHistory.length === 0) {
      console.log('  No history records found')
    } else {
      console.log('  Date                 | Type          | Change | Balance | Reference')
      console.log('  ' + '-'.repeat(65))
      for (const h of warehouseHistory) {
        const date = h.transactionDate.toISOString().slice(0, 10)
        const type = h.transactionType.padEnd(13)
        const changeNum = parseFloat(h.quantityChange.toString())
        const change = (changeNum >= 0 ? '+' : '') + changeNum.toFixed(2)
        const balance = parseFloat(h.balanceQuantity.toString()).toFixed(2)
        const ref = h.referenceNumber || '-'
        console.log(`  ${date}           | ${type} | ${change.padStart(6)} | ${balance.padStart(7)} | ${ref}`)
      }
    }
  }

  // 5. Summary and recommendation
  console.log('\n' + '='.repeat(70))
  console.log('VERIFICATION SUMMARY:')
  console.log('='.repeat(70))

  const bambangStock = allStockRecords.find(r => r.locationId === bambang?.id)
  const warehouseStock = allStockRecords.find(r => r.locationId === mainWarehouse?.id)

  const bambangQty = bambangStock ? parseFloat(bambangStock.qtyAvailable.toString()) : 0
  const warehouseQty = warehouseStock ? parseFloat(warehouseStock.qtyAvailable.toString()) : 0

  console.log(`\n  Bambang current stock:        ${bambangQty.toFixed(2)} (should be 0.00)`)
  console.log(`  Main Warehouse current stock: ${warehouseQty.toFixed(2)} (should be 0.00)`)
  console.log(`  Total across all locations:   ${totalStock.toFixed(2)}`)

  if (bambangQty < 0) {
    console.log(`\n  ✓ Bambang has NEGATIVE stock (${bambangQty}) - needs +${Math.abs(bambangQty)} adjustment`)
  }
  if (warehouseQty > 0) {
    console.log(`  ✓ Main Warehouse has POSITIVE stock (${warehouseQty}) - needs -${warehouseQty} adjustment`)
  }

  if (bambangQty === 0 && warehouseQty === 0) {
    console.log('\n  *** NO FIX NEEDED - Both locations already at 0 ***')
  } else {
    console.log('\n  READY TO APPLY FIX')
    console.log('  After fix:')
    console.log(`    - Bambang: ${bambangQty} → 0`)
    console.log(`    - Main Warehouse: ${warehouseQty} → 0`)
    console.log(`    - Total will remain: ${totalStock.toFixed(2)} (unchanged)`)
  }

  console.log('\n' + '='.repeat(70))
}

verifyBeforeFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
