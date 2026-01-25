/**
 * Data Correction Script: MSI KATANA 15 HX Invalid Transfer
 *
 * Problem:
 * - Bambang: -1 stock (should be 0)
 * - Main Warehouse: +1 stock (should be 0)
 *
 * Root Cause: Invalid transfer sent stock from Bambang that didn't exist
 *
 * This script:
 * 1. Updates stock levels to 0 for both locations
 * 2. Creates StockTransaction records for audit
 * 3. Creates ProductHistory entries for Stock History V3 report visibility
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMsiKatanaStock() {
  const VARIATION_ID = 1646
  const PRODUCT_SKU = '4711377401265'

  console.log('='.repeat(60))
  console.log('MSI KATANA 15 HX Stock Correction Script')
  console.log('='.repeat(60))
  console.log(`\nVariation ID: ${VARIATION_ID}`)
  console.log(`SKU: ${PRODUCT_SKU}`)

  // Find the product and variation
  const variation = await prisma.productVariation.findUnique({
    where: { id: VARIATION_ID },
    include: { product: true }
  })

  if (!variation) {
    throw new Error(`Variation ${VARIATION_ID} not found`)
  }

  console.log(`\nFound product: ${variation.product.name}`)
  console.log(`Business ID: ${variation.product.businessId}`)
  console.log(`Product ID: ${variation.productId}`)

  // Find Bambang and Main Warehouse locations
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId: variation.product.businessId,
      name: { in: ['Bambang', 'Main Warehouse'] }
    }
  })

  const bambang = locations.find(l => l.name === 'Bambang')
  const mainWarehouse = locations.find(l => l.name === 'Main Warehouse')

  if (!bambang) {
    throw new Error('Could not find Bambang location')
  }
  if (!mainWarehouse) {
    throw new Error('Could not find Main Warehouse location')
  }

  console.log(`\nLocations found:`)
  console.log(`  Bambang ID: ${bambang.id}`)
  console.log(`  Main Warehouse ID: ${mainWarehouse.id}`)

  // Get current stock levels
  const stockRecords = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: VARIATION_ID,
      locationId: { in: [bambang.id, mainWarehouse.id] }
    }
  })

  console.log('\n' + '-'.repeat(60))
  console.log('CURRENT STOCK LEVELS (BEFORE FIX):')
  console.log('-'.repeat(60))

  for (const record of stockRecords) {
    const locName = record.locationId === bambang.id ? 'Bambang' : 'Main Warehouse'
    console.log(`  ${locName}: ${record.qtyAvailable}`)
  }

  const bambangStock = stockRecords.find(r => r.locationId === bambang.id)
  const warehouseStock = stockRecords.find(r => r.locationId === mainWarehouse.id)

  // Check if fix is needed
  const bambangQty = bambangStock ? parseFloat(bambangStock.qtyAvailable.toString()) : 0
  const warehouseQty = warehouseStock ? parseFloat(warehouseStock.qtyAvailable.toString()) : 0

  if (bambangQty === 0 && warehouseQty === 0) {
    console.log('\n*** Both locations already at 0. No fix needed! ***')
    return
  }

  console.log('\n' + '-'.repeat(60))
  console.log('APPLYING FIX...')
  console.log('-'.repeat(60))

  // Fix in a transaction
  await prisma.$transaction(async (tx) => {
    const now = new Date()
    const userId = 1 // Admin user

    // Fix Bambang: -1 → 0 (add 1)
    if (bambangStock && bambangQty < 0) {
      const adjustment = Math.abs(bambangQty)

      await tx.variationLocationDetails.update({
        where: { id: bambangStock.id },
        data: { qtyAvailable: 0 }
      })

      // Create stock transaction for audit
      await tx.stockTransaction.create({
        data: {
          businessId: variation.product.businessId,
          productId: variation.productId,
          productVariationId: VARIATION_ID,
          locationId: bambang.id,
          type: 'adjustment',
          quantity: adjustment,
          balanceQty: 0,
          referenceType: 'inventory_correction',
          notes: 'Data correction: Invalid transfer deducted stock that did not exist',
          createdBy: userId,
          createdAt: now
        }
      })

      // Create product history for Stock History V3 report visibility
      await tx.productHistory.create({
        data: {
          businessId: variation.product.businessId,
          locationId: bambang.id,
          productId: variation.productId,
          productVariationId: VARIATION_ID,
          transactionType: 'adjustment',
          transactionDate: now,
          referenceType: 'correction',
          referenceId: 0,
          referenceNumber: 'DATA-CORRECTION-' + now.toISOString().slice(0, 10),
          quantityChange: adjustment,
          balanceQuantity: 0,
          createdBy: userId,
          createdByName: 'System Correction',
          reason: 'Data correction for invalid transfer that deducted stock Bambang did not have',
          createdAt: now
        }
      })

      console.log(`  Bambang: ${bambangQty} -> 0 (adjusted +${adjustment})`)
    } else if (bambangStock) {
      console.log(`  Bambang: ${bambangQty} (no fix needed)`)
    }

    // Fix Main Warehouse: 1 → 0 (deduct 1)
    if (warehouseStock && warehouseQty > 0) {
      const adjustment = warehouseQty

      await tx.variationLocationDetails.update({
        where: { id: warehouseStock.id },
        data: { qtyAvailable: 0 }
      })

      // Create stock transaction for audit
      await tx.stockTransaction.create({
        data: {
          businessId: variation.product.businessId,
          productId: variation.productId,
          productVariationId: VARIATION_ID,
          locationId: mainWarehouse.id,
          type: 'adjustment',
          quantity: -adjustment,
          balanceQty: 0,
          referenceType: 'inventory_correction',
          notes: 'Data correction: Invalid transfer added stock that should not exist',
          createdBy: userId,
          createdAt: now
        }
      })

      // Create product history for Stock History V3 report visibility
      await tx.productHistory.create({
        data: {
          businessId: variation.product.businessId,
          locationId: mainWarehouse.id,
          productId: variation.productId,
          productVariationId: VARIATION_ID,
          transactionType: 'adjustment',
          transactionDate: now,
          referenceType: 'correction',
          referenceId: 0,
          referenceNumber: 'DATA-CORRECTION-' + now.toISOString().slice(0, 10),
          quantityChange: -adjustment,
          balanceQuantity: 0,
          createdBy: userId,
          createdByName: 'System Correction',
          reason: 'Data correction for invalid transfer that added stock Main Warehouse should not have',
          createdAt: now
        }
      })

      console.log(`  Main Warehouse: ${warehouseQty} -> 0 (adjusted -${adjustment})`)
    } else if (warehouseStock) {
      console.log(`  Main Warehouse: ${warehouseQty} (no fix needed)`)
    }
  })

  // Verify the fix
  const verifyRecords = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: VARIATION_ID,
      locationId: { in: [bambang.id, mainWarehouse.id] }
    }
  })

  console.log('\n' + '-'.repeat(60))
  console.log('VERIFICATION (AFTER FIX):')
  console.log('-'.repeat(60))

  for (const record of verifyRecords) {
    const locName = record.locationId === bambang.id ? 'Bambang' : 'Main Warehouse'
    const status = parseFloat(record.qtyAvailable.toString()) === 0 ? '✓' : '✗'
    console.log(`  ${locName}: ${record.qtyAvailable} ${status}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('STOCK CORRECTION COMPLETED!')
  console.log('='.repeat(60))
  console.log('\nPlease verify by checking Stock History V3 report for:')
  console.log('  1. Bambang - Should show 0 current stock')
  console.log('  2. Main Warehouse - Should show 0 current stock')
  console.log('  3. Main Store - Should still show 2 current stock')
}

fixMsiKatanaStock()
  .catch((error) => {
    console.error('\n*** ERROR ***')
    console.error(error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
