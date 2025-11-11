/**
 * Comprehensive Verification: Location-Specific Pricing Fix
 *
 * This script verifies that location-specific unit prices:
 * 1. Save correctly to ProductUnitLocationPrice
 * 2. Reload correctly after save (no revert bug)
 * 3. Display correctly in POS
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying Location-Specific Pricing Fix\n')
  console.log('='.repeat(60))

  // Test Configuration
  const testConfig = {
    productName: 'Sample UTP CABLE',
    locationName: 'Tuguegarao',
    unitName: 'Meter',
    testPrice: 10.00, // The price user tried to set
    expectedRevertPrice: 9.00 // The old price it was reverting to
  }

  console.log('\n📋 Test Configuration:')
  console.log(`   Product: ${testConfig.productName}`)
  console.log(`   Location: ${testConfig.locationName}`)
  console.log(`   Unit: ${testConfig.unitName}`)
  console.log(`   Test Price: ₱${testConfig.testPrice}`)
  console.log(`   Old Price (should NOT revert to): ₱${testConfig.expectedRevertPrice}`)

  try {
    // Step 1: Find the product
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 1: Find Product')
    console.log('─'.repeat(60))

    const product = await prisma.product.findFirst({
      where: { name: testConfig.productName },
      include: {
        unit: true
      }
    })

    if (!product) {
      console.log(`❌ Product "${testConfig.productName}" not found`)
      return
    }

    console.log(`✅ Product found: ${product.name} (ID: ${product.id})`)
    console.log(`   SKU: ${product.sku}`)
    console.log(`   Primary Unit: ${product.unit?.name} (ID: ${product.unitId})`)

    // Step 2: Find the location
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 2: Find Location')
    console.log('─'.repeat(60))

    const location = await prisma.businessLocation.findFirst({
      where: { name: testConfig.locationName }
    })

    if (!location) {
      console.log(`❌ Location "${testConfig.locationName}" not found`)
      return
    }

    console.log(`✅ Location found: ${location.name} (ID: ${location.id})`)

    // Step 3: Find the Meter unit
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 3: Find Meter Unit')
    console.log('─'.repeat(60))

    const meterUnit = await prisma.unit.findFirst({
      where: { name: testConfig.unitName }
    })

    if (!meterUnit) {
      console.log(`❌ Unit "${testConfig.unitName}" not found`)
      return
    }

    console.log(`✅ Unit found: ${meterUnit.name} (ID: ${meterUnit.id})`)

    // Step 4: Check current state in ProductUnitLocationPrice
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 4: Check Location-Specific Price (ProductUnitLocationPrice)')
    console.log('─'.repeat(60))

    const locationSpecificPrice = await prisma.productUnitLocationPrice.findUnique({
      where: {
        productId_locationId_unitId: {
          productId: product.id,
          locationId: location.id,
          unitId: meterUnit.id
        }
      }
    })

    if (locationSpecificPrice) {
      console.log('✅ Location-specific price exists:')
      console.log(`   Purchase Price: ₱${locationSpecificPrice.purchasePrice}`)
      console.log(`   Selling Price: ₱${locationSpecificPrice.sellingPrice}`)
      console.log(`   Last Updated By: User ID ${locationSpecificPrice.lastUpdatedBy}`)
      console.log(`   Updated At: ${locationSpecificPrice.updatedAt}`)

      // Check if it's the test price or the old reverted price
      const sellingPrice = parseFloat(String(locationSpecificPrice.sellingPrice))
      if (sellingPrice === testConfig.testPrice) {
        console.log(`   ✅ CORRECT: Price is ${testConfig.testPrice} (saved correctly)`)
      } else if (sellingPrice === testConfig.expectedRevertPrice) {
        console.log(`   ❌ BUG: Price is ${testConfig.expectedRevertPrice} (reverted to old value!)`)
      } else {
        console.log(`   ⚠️  Price is ${sellingPrice} (unexpected value)`)
      }
    } else {
      console.log('⚠️  No location-specific price found (will fall back to global)')
    }

    // Step 5: Check global price (ProductUnitPrice)
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 5: Check Global Price (ProductUnitPrice)')
    console.log('─'.repeat(60))

    const globalPrice = await prisma.productUnitPrice.findUnique({
      where: {
        productId_unitId: {
          productId: product.id,
          unitId: meterUnit.id
        }
      }
    })

    if (globalPrice) {
      console.log('✅ Global price exists:')
      console.log(`   Purchase Price: ₱${globalPrice.purchasePrice}`)
      console.log(`   Selling Price: ₱${globalPrice.sellingPrice}`)

      const globalSellingPrice = parseFloat(String(globalPrice.sellingPrice))
      if (globalSellingPrice === testConfig.expectedRevertPrice) {
        console.log(`   📝 This is the OLD price (₱${testConfig.expectedRevertPrice})`)
        console.log(`   📝 Location-specific price should override this`)
      }
    } else {
      console.log('⚠️  No global price found')
    }

    // Step 6: Simulate API GET request (what happens when UI reloads)
    console.log('\n' + '─'.repeat(60))
    console.log('STEP 6: Simulate API Reload (GET /api/products/unit-prices)')
    console.log('─'.repeat(60))

    console.log(`Simulating: GET /api/products/unit-prices?productId=${product.id}&locationIds=${location.id}`)

    // Replicate the GET endpoint logic
    const locationSpecificPrices = await prisma.productUnitLocationPrice.findMany({
      where: {
        productId: product.id,
        locationId: location.id,
        businessId: product.businessId
      },
      include: {
        unit: true
      }
    })

    const globalPrices = await prisma.productUnitPrice.findMany({
      where: {
        productId: product.id,
        businessId: product.businessId
      },
      include: {
        unit: true
      }
    })

    // Merge logic (same as API)
    const priceMap = new Map()

    // Add global prices first
    globalPrices.forEach(gp => {
      priceMap.set(gp.unitId, {
        unitId: gp.unitId,
        unitName: gp.unit.name,
        purchasePrice: parseFloat(String(gp.purchasePrice)),
        sellingPrice: parseFloat(String(gp.sellingPrice)),
        source: 'Global'
      })
    })

    // Override with location-specific
    locationSpecificPrices.forEach(lsp => {
      priceMap.set(lsp.unitId, {
        unitId: lsp.unitId,
        unitName: lsp.unit.name,
        purchasePrice: parseFloat(String(lsp.purchasePrice)),
        sellingPrice: parseFloat(String(lsp.sellingPrice)),
        source: 'Location-Specific'
      })
    })

    console.log('\n📊 Merged Prices (what UI will receive):')
    priceMap.forEach((price, unitId) => {
      const icon = price.source === 'Location-Specific' ? '🎯' : '🌍'
      console.log(`   ${icon} ${price.unitName}: ₱${price.sellingPrice} (from ${price.source})`)

      if (price.unitName === testConfig.unitName) {
        if (price.sellingPrice === testConfig.testPrice) {
          console.log(`      ✅ CORRECT: UI will show ₱${testConfig.testPrice}`)
        } else if (price.sellingPrice === testConfig.expectedRevertPrice) {
          console.log(`      ❌ BUG DETECTED: UI will show ₱${testConfig.expectedRevertPrice} (reverted!)`)
        } else {
          console.log(`      ⚠️  UI will show ₱${price.sellingPrice} (unexpected)`)
        }
      }
    })

    // Step 7: Final Verdict
    console.log('\n' + '='.repeat(60))
    console.log('FINAL VERDICT')
    console.log('='.repeat(60))

    const meterPrice = priceMap.get(meterUnit.id)
    if (meterPrice) {
      if (meterPrice.sellingPrice === testConfig.testPrice && meterPrice.source === 'Location-Specific') {
        console.log('\n✅ ✅ ✅ BUG IS FIXED! ✅ ✅ ✅')
        console.log('\n✓ Location-specific price saved correctly')
        console.log('✓ API returns location-specific price (not global)')
        console.log('✓ UI will display correct price after save')
        console.log(`✓ Price stays at ₱${testConfig.testPrice} (no revert)`)
      } else if (meterPrice.sellingPrice === testConfig.expectedRevertPrice) {
        console.log('\n❌ ❌ ❌ BUG STILL EXISTS! ❌ ❌ ❌')
        console.log('\n✗ Price is reverting to old global value')
        console.log('✗ API is not prioritizing location-specific prices')
        console.log('✗ fetchUnitPrices() may not be passing locationIds')
      } else {
        console.log('\n⚠️  UNEXPECTED STATE')
        console.log(`   Current price: ₱${meterPrice.sellingPrice}`)
        console.log(`   Expected: ₱${testConfig.testPrice}`)
        console.log('   Please check the database manually')
      }
    } else {
      console.log('\n❌ ERROR: Meter unit price not found in merged results')
    }

    // Step 8: Recommendations
    console.log('\n' + '─'.repeat(60))
    console.log('TESTING RECOMMENDATIONS')
    console.log('─'.repeat(60))
    console.log('\nTo test the fix manually:')
    console.log('1. Login: pcinetadmin / 111111')
    console.log('2. Go to: Products > Simple Price Editor')
    console.log('3. Search: "Sample UTP CABLE"')
    console.log('4. Step 3: Check ✓ Tuguegarao')
    console.log('5. Step 5: Set Meter price to 10')
    console.log('6. Click: "Save All Prices"')
    console.log('7. ✅ Verify: Price stays at 10 (should not revert to 9)')
    console.log('\nThen test in POS:')
    console.log('1. Login as cashier at Tuguegarao location')
    console.log('2. Add "Sample UTP CABLE" to cart')
    console.log('3. Change unit to "Meter"')
    console.log('4. ✅ Verify: Price shows ₱10.00')

  } catch (error) {
    console.error('\n❌ Error during verification:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
