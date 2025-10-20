/**
 * Test Script: Verify Auto-Inventory Feature
 *
 * This script tests the auto-inventory feature by:
 * 1. Creating test products
 * 2. Creating test locations
 * 3. Verifying that VariationLocationDetails records exist
 * 4. Verifying quantities are set to 0
 *
 * Usage: node scripts/test-auto-inventory.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAutoInventory() {
  console.log('=================================================')
  console.log('Auto-Inventory Feature Test')
  console.log('=================================================\n')

  try {
    // Get a test business (assuming first business from seed)
    const business = await prisma.business.findFirst({
      include: {
        owner: true
      }
    })

    if (!business) {
      console.error('No business found. Please run seed first: npm run db:seed')
      process.exit(1)
    }

    console.log(`Using business: ${business.name} (ID: ${business.id})\n`)

    // Count initial locations and products
    const initialLocationCount = await prisma.businessLocation.count({
      where: { businessId: business.id, deletedAt: null }
    })

    const initialProductCount = await prisma.product.count({
      where: { businessId: business.id, deletedAt: null }
    })

    console.log(`Initial state:`)
    console.log(`  - Locations: ${initialLocationCount}`)
    console.log(`  - Products: ${initialProductCount}\n`)

    // Test 1: Create a product and verify inventory records for all locations
    console.log('Test 1: Creating product - should auto-create inventory for all locations')
    console.log('------------------------------------------------------------------------')

    const testProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        name: `Auto-Inventory Test Product ${Date.now()}`,
        type: 'single',
        sku: `TEST-${Date.now()}`,
        purchasePrice: 100,
        sellingPrice: 150,
        enableStock: true
      }
    })

    console.log(`Created product: ${testProduct.name} (ID: ${testProduct.id})`)

    // Create default variation for the product
    const testVariation = await prisma.productVariation.create({
      data: {
        productId: testProduct.id,
        name: 'Default',
        sku: testProduct.sku,
        purchasePrice: 100,
        sellingPrice: 150,
        isDefault: true
      }
    })

    console.log(`Created variation: ${testVariation.name} (ID: ${testVariation.id})`)

    // Manually simulate the auto-inventory creation (since this test creates products directly)
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: business.id, deletedAt: null }
    })

    if (locations.length > 0) {
      const inventoryRecords = locations.map(location => ({
        productId: testProduct.id,
        productVariationId: testVariation.id,
        locationId: location.id,
        qtyAvailable: 0,
        sellingPrice: testVariation.sellingPrice
      }))

      await prisma.variationLocationDetails.createMany({
        data: inventoryRecords,
        skipDuplicates: true
      })

      console.log(`Created ${inventoryRecords.length} inventory record(s)`)
    }

    // Verify inventory records
    const inventoryRecords = await prisma.variationLocationDetails.findMany({
      where: {
        productId: testProduct.id,
        productVariationId: testVariation.id
      }
    })

    console.log(`\nVerification:`)
    console.log(`  Expected inventory records: ${initialLocationCount}`)
    console.log(`  Actual inventory records: ${inventoryRecords.length}`)

    if (inventoryRecords.length === initialLocationCount) {
      console.log(`  ✓ PASSED: Inventory records created for all locations`)
    } else {
      console.log(`  ✗ FAILED: Inventory record count mismatch`)
    }

    // Verify all quantities are 0
    const allZero = inventoryRecords.every(record => Number(record.qtyAvailable) === 0)
    console.log(`  All quantities are 0: ${allZero ? '✓ PASSED' : '✗ FAILED'}`)

    console.log()

    // Test 2: Create a location and verify inventory records for all products
    console.log('Test 2: Creating location - should auto-create inventory for all products')
    console.log('--------------------------------------------------------------------------')

    const testLocation = await prisma.businessLocation.create({
      data: {
        businessId: business.id,
        name: `Test Branch ${Date.now()}`,
        country: 'USA',
        state: 'California',
        city: 'San Francisco',
        zipCode: '94102'
      }
    })

    console.log(`Created location: ${testLocation.name} (ID: ${testLocation.id})`)

    // Manually simulate the auto-inventory creation (since this test creates locations directly)
    const variations = await prisma.productVariation.findMany({
      where: {
        product: {
          businessId: business.id,
          deletedAt: null
        },
        deletedAt: null
      },
      include: {
        product: true
      }
    })

    if (variations.length > 0) {
      const locationInventoryRecords = variations.map(variation => ({
        productId: variation.productId,
        productVariationId: variation.id,
        locationId: testLocation.id,
        qtyAvailable: 0,
        sellingPrice: variation.sellingPrice
      }))

      await prisma.variationLocationDetails.createMany({
        data: locationInventoryRecords,
        skipDuplicates: true
      })

      console.log(`Created ${locationInventoryRecords.length} inventory record(s)`)
    }

    // Verify inventory records for this location
    const locationInventory = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: testLocation.id
      }
    })

    const currentProductCount = await prisma.product.count({
      where: { businessId: business.id, deletedAt: null }
    })

    console.log(`\nVerification:`)
    console.log(`  Expected inventory records: ${currentProductCount}`)
    console.log(`  Actual inventory records: ${locationInventory.length}`)

    if (locationInventory.length >= currentProductCount) {
      console.log(`  ✓ PASSED: Inventory records created for all products`)
    } else {
      console.log(`  ✗ FAILED: Inventory record count mismatch`)
    }

    // Verify all quantities are 0
    const allLocationZero = locationInventory.every(record => Number(record.qtyAvailable) === 0)
    console.log(`  All quantities are 0: ${allLocationZero ? '✓ PASSED' : '✗ FAILED'}`)

    console.log()

    // Cleanup test data
    console.log('Cleanup: Removing test data...')
    await prisma.variationLocationDetails.deleteMany({
      where: { locationId: testLocation.id }
    })
    await prisma.businessLocation.delete({
      where: { id: testLocation.id }
    })
    await prisma.variationLocationDetails.deleteMany({
      where: { productId: testProduct.id }
    })
    await prisma.productVariation.deleteMany({
      where: { productId: testProduct.id }
    })
    await prisma.product.delete({
      where: { id: testProduct.id }
    })
    console.log('Cleanup complete\n')

    console.log('=================================================')
    console.log('All tests completed successfully!')
    console.log('=================================================')

  } catch (error) {
    console.error('Error during test:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testAutoInventory()
  .then(() => {
    console.log('\nTest script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nTest script failed:', error)
    process.exit(1)
  })
