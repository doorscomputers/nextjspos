/**
 * Test Location-Specific Unit Pricing
 * Tests the complete flow for EricsonChanCashierTugue at location 1322774315
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Testing Location-Specific Unit Pricing\n')

  // Test Configuration
  const USERNAME = 'EricsonChanCashierTugue'
  const LOCATION_ID = 4 // Tuguegarao location
  const PRODUCT_NAME = 'Sample UTP CABLE'

  // Step 1: Verify user exists
  console.log('Step 1: Verifying user...')
  const user = await prisma.user.findUnique({
    where: { username: USERNAME },
    select: {
      id: true,
      username: true,
      businessId: true,
      userLocations: {
        select: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    console.log(`❌ User "${USERNAME}" not found`)
    return
  }

  console.log(`✅ User found: ${user.username} (ID: ${user.id})`)
  console.log(`   Business ID: ${user.businessId}`)
  console.log(`   Assigned Locations:`)
  for (const ul of user.userLocations) {
    console.log(`      - ${ul.location.name} (ID: ${ul.location.id})`)
  }
  console.log('')

  // Step 2: Verify location exists
  console.log('Step 2: Verifying location...')
  const location = await prisma.businessLocation.findUnique({
    where: { id: LOCATION_ID },
    select: {
      id: true,
      name: true,
      businessId: true,
    },
  })

  if (!location) {
    console.log(`❌ Location ID ${LOCATION_ID} not found`)
    return
  }

  console.log(`✅ Location found: ${location.name} (ID: ${location.id})`)
  console.log(`   Business ID: ${location.businessId}`)

  // Verify location belongs to user's business
  if (location.businessId !== user.businessId) {
    console.log(`❌ Location does not belong to user's business`)
    return
  }
  console.log(`✅ Location belongs to user's business`)
  console.log('')

  // Step 3: Find Sample UTP CABLE product
  console.log('Step 3: Finding product...')
  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: PRODUCT_NAME,
        mode: 'insensitive',
      },
      businessId: user.businessId,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unitId: true,
      subUnitIds: true,
      businessId: true,
      unit: {
        select: {
          id: true,
          name: true,
          shortName: true,
        },
      },
    },
  })

  if (!product) {
    console.log(`❌ Product "${PRODUCT_NAME}" not found`)
    return
  }

  console.log(`✅ Product found: ${product.name} (ID: ${product.id})`)
  console.log(`   SKU: ${product.sku}`)
  console.log(`   Primary Unit: ${product.unit?.name} (ID: ${product.unitId})`)
  console.log('')

  // Get all units for this product
  const subUnitIds = product.subUnitIds
    ? JSON.parse(product.subUnitIds as string)
    : []
  const allUnitIds = [product.unitId, ...subUnitIds]

  const units = await prisma.unit.findMany({
    where: {
      id: { in: allUnitIds },
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      baseUnitMultiplier: true,
    },
  })

  console.log('📏 Available Units:')
  for (const unit of units) {
    const isPrimary = unit.id === product.unitId
    console.log(`   ${isPrimary ? '⭐' : '  '} ${unit.name} (${unit.shortName}) - ID: ${unit.id}`)
  }
  console.log('')

  // Step 4: Set location-specific unit prices
  console.log('Step 4: Setting location-specific unit prices...')

  const rollUnit = units.find(u => u.name.toLowerCase().includes('roll'))
  const meterUnit = units.find(u => u.name.toLowerCase().includes('meter'))

  if (!rollUnit || !meterUnit) {
    console.log('❌ Could not find Roll or Meter units')
    return
  }

  const newPrices = [
    {
      unitId: rollUnit.id,
      unitName: rollUnit.name,
      purchasePrice: 1900,
      sellingPrice: 2014,
    },
    {
      unitId: meterUnit.id,
      unitName: meterUnit.name,
      purchasePrice: 8,
      sellingPrice: 9,
    },
  ]

  console.log('💰 Setting these prices for location:', location.name)
  for (const price of newPrices) {
    console.log(`   ${price.unitName}: Purchase ₱${price.purchasePrice}, Selling ₱${price.sellingPrice}`)
  }
  console.log('')

  // Save location-specific prices
  await prisma.$transaction(async (tx) => {
    for (const price of newPrices) {
      await tx.productUnitLocationPrice.upsert({
        where: {
          productId_locationId_unitId: {
            productId: product.id,
            locationId: LOCATION_ID,
            unitId: price.unitId,
          },
        },
        update: {
          purchasePrice: price.purchasePrice,
          sellingPrice: price.sellingPrice,
          lastUpdatedBy: user.id,
          updatedAt: new Date(),
        },
        create: {
          businessId: user.businessId,
          productId: product.id,
          locationId: LOCATION_ID,
          unitId: price.unitId,
          purchasePrice: price.purchasePrice,
          sellingPrice: price.sellingPrice,
          lastUpdatedBy: user.id,
        },
      })
    }
  })

  console.log('✅ Location-specific prices saved successfully!')
  console.log('')

  // Step 5: Verify prices were saved
  console.log('Step 5: Verifying saved prices...')
  const savedPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      productId: product.id,
      locationId: LOCATION_ID,
    },
    include: {
      unit: true,
    },
  })

  console.log('📊 Saved Location-Specific Prices:')
  for (const sp of savedPrices) {
    console.log(`   ${sp.unit.name}: Purchase ₱${sp.purchasePrice}, Selling ₱${sp.sellingPrice}`)
  }
  console.log('')

  // Step 6: Simulate POS API call
  console.log('Step 6: Simulating POS API call...')
  console.log(`   GET /api/pos/product-units?productId=${product.id}&locationId=${LOCATION_ID}`)
  console.log('')

  // Get location-specific prices (same logic as API)
  const locationUnitPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      productId: product.id,
      locationId: LOCATION_ID,
      businessId: user.businessId,
    },
    select: {
      unitId: true,
      purchasePrice: true,
      sellingPrice: true,
    },
  })

  // Get global unit prices as fallback
  const globalUnitPrices = await prisma.productUnitPrice.findMany({
    where: {
      productId: product.id,
      businessId: user.businessId,
    },
    select: {
      unitId: true,
      purchasePrice: true,
      sellingPrice: true,
    },
  })

  console.log('🔍 API Response Preview:')
  console.log('   Location-Specific Prices Found:')
  for (const lup of locationUnitPrices) {
    const unit = units.find(u => u.id === lup.unitId)
    console.log(`      ${unit?.name}: ₱${lup.sellingPrice} (location-specific)`)
  }

  console.log('   Global Prices (fallback):')
  for (const gup of globalUnitPrices) {
    const hasLocationSpecific = locationUnitPrices.some(lup => lup.unitId === gup.unitId)
    if (!hasLocationSpecific) {
      const unit = units.find(u => u.id === gup.unitId)
      console.log(`      ${unit?.name}: ₱${gup.sellingPrice} (global fallback)`)
    }
  }
  console.log('')

  // Step 7: Summary
  console.log('=' .repeat(60))
  console.log('📋 TEST SUMMARY')
  console.log('=' .repeat(60))
  console.log(`User: ${user.username}`)
  console.log(`Location: ${location.name} (ID: ${LOCATION_ID})`)
  console.log(`Product: ${product.name}`)
  console.log('')
  console.log('✅ Location-specific prices set:')
  for (const price of newPrices) {
    console.log(`   ${price.unitName}: ₱${price.sellingPrice}`)
  }
  console.log('')
  console.log('🎯 Next Steps:')
  console.log('   1. Start dev server: npm run dev')
  console.log('   2. Login as: EricsonChanCashierTugue / 111111')
  console.log('   3. Start shift at location:', location.name)
  console.log('   4. Add "Sample UTP CABLE" to cart')
  console.log('   5. Click "Change Unit & Quantity"')
  console.log('   6. Select "Meter" unit')
  console.log('   7. Verify price shows: ₱9.00 per Meter')
  console.log('')
  console.log('✨ Test setup complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
