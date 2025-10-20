/**
 * Test script to verify CSV import creates stock transactions
 *
 * This script:
 * 1. Checks if products were imported
 * 2. Verifies stock_transactions were created for opening stock
 * 3. Tests the specific product mentioned in the bug report
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('========================================')
  console.log('CSV Import Stock Transaction Test')
  console.log('========================================\n')

  // Get the first business
  const business = await prisma.business.findFirst({
    select: { id: true, name: true }
  })

  if (!business) {
    console.error('No business found. Please run seed first.')
    return
  }

  console.log(`Testing for business: ${business.name} (ID: ${business.id})\n`)

  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: business.id },
    select: { id: true, name: true }
  })

  console.log(`Found ${locations.length} location(s):`)
  locations.forEach(loc => console.log(`  - ${loc.name} (ID: ${loc.id})`))
  console.log()

  // Test the specific product from the bug report (if it exists)
  const testProductId = 1
  const testVariationId = 1
  const testLocationId = 1

  console.log(`\nTesting specific product mentioned in bug report:`)
  console.log(`  Product ID: ${testProductId}`)
  console.log(`  Variation ID: ${testVariationId}`)
  console.log(`  Location ID: ${testLocationId}`)

  const specificTransactions = await prisma.stockTransaction.findMany({
    where: {
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocationId,
      type: 'opening_stock'
    }
  })

  console.log(`  Result: ${specificTransactions.length} transaction(s) found`)

  if (specificTransactions.length > 0) {
    console.log('  ✅ FIXED! Transactions found for this product.')
    specificTransactions.forEach(txn => {
      console.log(`    - Qty: ${txn.quantity}, Balance: ${txn.balanceQty}, Type: ${txn.type}`)
    })
  } else {
    console.log('  ❌ No transactions found. Bug still exists OR product not imported.')
  }

  // Get all opening stock transactions
  console.log('\n\nOverall Opening Stock Transaction Stats:')
  console.log('========================================')

  const allOpeningStock = await prisma.stockTransaction.findMany({
    where: {
      businessId: business.id,
      type: 'opening_stock',
      referenceType: 'product_import'
    },
    select: {
      id: true,
      productId: true,
      productVariationId: true,
      locationId: true,
      quantity: true,
      balanceQty: true,
      createdAt: true,
      product: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  console.log(`Total opening stock transactions from CSV import: ${allOpeningStock.length}`)

  if (allOpeningStock.length > 0) {
    console.log('\nRecent opening stock transactions (last 10):')
    allOpeningStock.forEach((txn, idx) => {
      console.log(`  ${idx + 1}. ${txn.product.name}`)
      console.log(`     Qty: ${txn.quantity}, Balance: ${txn.balanceQty}`)
      console.log(`     Product: ${txn.productId}, Variation: ${txn.productVariationId}, Location: ${txn.locationId}`)
      console.log(`     Created: ${txn.createdAt}`)
    })
  }

  // Test variation_location_details
  console.log('\n\nVariation Location Details Check:')
  console.log('========================================')

  const vldCount = await prisma.variationLocationDetails.count({
    where: {
      product: {
        businessId: business.id
      }
    }
  })

  console.log(`Total variation_location_details records: ${vldCount}`)

  // Sample some VLD records
  const sampleVld = await prisma.variationLocationDetails.findMany({
    where: {
      product: {
        businessId: business.id
      }
    },
    include: {
      product: {
        select: { name: true }
      }
    },
    take: 5
  })

  if (sampleVld.length > 0) {
    console.log('\nSample stock levels (first 5):')
    sampleVld.forEach((vld, idx) => {
      console.log(`  ${idx + 1}. ${vld.product.name}`)
      console.log(`     Product: ${vld.productId}, Variation: ${vld.productVariationId}, Location: ${vld.locationId}`)
      console.log(`     Qty Available: ${vld.qtyAvailable}`)
    })
  }

  // Summary
  console.log('\n\n========================================')
  console.log('SUMMARY')
  console.log('========================================')

  const productCount = await prisma.product.count({
    where: { businessId: business.id }
  })

  const variationCount = await prisma.productVariation.count({
    where: { businessId: business.id }
  })

  const openingStockTxnCount = await prisma.stockTransaction.count({
    where: {
      businessId: business.id,
      type: 'opening_stock'
    }
  })

  console.log(`Products: ${productCount}`)
  console.log(`Variations: ${variationCount}`)
  console.log(`Opening Stock Transactions: ${openingStockTxnCount}`)
  console.log(`Variation Location Details: ${vldCount}`)

  if (openingStockTxnCount === 0 && productCount > 0) {
    console.log('\n❌ BUG CONFIRMED: Products exist but no opening stock transactions!')
  } else if (openingStockTxnCount > 0) {
    console.log('\n✅ SUCCESS: Opening stock transactions are being created!')
  }

  console.log('\n========================================\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
