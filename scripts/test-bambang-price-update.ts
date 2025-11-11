/**
 * Test script to reproduce the Bambang price update issue
 *
 * User reports: Setting Roll=₱2025, Meter=₱12 for Bambang shows success
 * but database still has Roll=₱2014, Meter=₱9
 *
 * This script simulates the exact API call to debug the issue.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 TEST: Bambang Price Update\n')
  console.log('='.repeat(80))

  // Step 1: Find the product
  const product = await prisma.product.findFirst({
    where: { name: 'Sample UTP CABLE' },
    select: {
      id: true,
      name: true,
      businessId: true,
      unitId: true,
      subUnitIds: true
    }
  })

  if (!product) {
    console.log('❌ Product "Sample UTP CABLE" not found')
    return
  }

  console.log('\n📦 Product found:')
  console.log(`   ID: ${product.id}`)
  console.log(`   Name: ${product.name}`)
  console.log(`   Business ID: ${product.businessId}`)

  // Step 2: Find Bambang location
  const bambang = await prisma.businessLocation.findFirst({
    where: { name: 'Bambang' },
    select: { id: true, name: true, businessId: true }
  })

  if (!bambang) {
    console.log('❌ Location "Bambang" not found')
    return
  }

  console.log('\n📍 Location found:')
  console.log(`   ID: ${bambang.id}`)
  console.log(`   Name: ${bambang.name}`)

  // Step 3: Find unit IDs for Roll and Meter
  const rollUnit = await prisma.unit.findFirst({
    where: { name: 'Roll' },
    select: { id: true, name: true }
  })

  const meterUnit = await prisma.unit.findFirst({
    where: { name: 'Meter' },
    select: { id: true, name: true }
  })

  if (!rollUnit || !meterUnit) {
    console.log('❌ Units not found')
    return
  }

  console.log('\n📏 Units found:')
  console.log(`   Roll ID: ${rollUnit.id}`)
  console.log(`   Meter ID: ${meterUnit.id}`)

  // Step 4: Check current prices
  console.log('\n' + '─'.repeat(80))
  console.log('📊 BEFORE UPDATE - Current Prices:')
  console.log('─'.repeat(80))

  const currentPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      productId: product.id,
      locationId: bambang.id,
      unitId: { in: [rollUnit.id, meterUnit.id] }
    },
    include: { unit: true }
  })

  for (const price of currentPrices) {
    console.log(`   ${price.unit.name}: Purchase ₱${price.purchasePrice}, Selling ₱${price.sellingPrice}`)
    console.log(`      Record ID: ${price.id}, Updated: ${price.updatedAt}`)
  }

  // Step 5: Simulate the API update
  console.log('\n' + '─'.repeat(80))
  console.log('🔄 SIMULATING UPDATE: Roll=₱2025, Meter=₱12')
  console.log('─'.repeat(80))

  const userId = 1 // Assuming admin user ID = 1

  try {
    const results = await prisma.$transaction(async (tx) => {
      const updates = []

      // Update Roll to ₱2025
      console.log('\n🔵 Upserting Roll...')
      console.log('   WHERE: productId=%d, locationId=%d, unitId=%d', product.id, bambang.id, rollUnit.id)
      console.log('   DATA: purchasePrice=1900, sellingPrice=2025')

      const rollResult = await tx.productUnitLocationPrice.upsert({
        where: {
          productId_locationId_unitId: {
            productId: product.id,
            locationId: bambang.id,
            unitId: rollUnit.id,
          },
        },
        update: {
          purchasePrice: 1900,
          sellingPrice: 2025,
          lastUpdatedBy: userId,
          updatedAt: new Date(),
        },
        create: {
          businessId: product.businessId,
          productId: product.id,
          locationId: bambang.id,
          unitId: rollUnit.id,
          purchasePrice: 1900,
          sellingPrice: 2025,
          lastUpdatedBy: userId,
        },
      })

      console.log('   ✅ Result: ID=%d, sellingPrice=%s, updatedAt=%s',
        rollResult.id,
        rollResult.sellingPrice.toString(),
        rollResult.updatedAt.toISOString()
      )

      updates.push(rollResult)

      // Update Meter to ₱12
      console.log('\n🔵 Upserting Meter...')
      console.log('   WHERE: productId=%d, locationId=%d, unitId=%d', product.id, bambang.id, meterUnit.id)
      console.log('   DATA: purchasePrice=8, sellingPrice=12')

      const meterResult = await tx.productUnitLocationPrice.upsert({
        where: {
          productId_locationId_unitId: {
            productId: product.id,
            locationId: bambang.id,
            unitId: meterUnit.id,
          },
        },
        update: {
          purchasePrice: 8,
          sellingPrice: 12,
          lastUpdatedBy: userId,
          updatedAt: new Date(),
        },
        create: {
          businessId: product.businessId,
          productId: product.id,
          locationId: bambang.id,
          unitId: meterUnit.id,
          purchasePrice: 8,
          sellingPrice: 12,
          lastUpdatedBy: userId,
        },
      })

      console.log('   ✅ Result: ID=%d, sellingPrice=%s, updatedAt=%s',
        meterResult.id,
        meterResult.sellingPrice.toString(),
        meterResult.updatedAt.toISOString()
      )

      updates.push(meterResult)

      return updates
    })

    console.log('\n✅ Transaction committed successfully!')
    console.log(`   Updated ${results.length} price records`)

  } catch (error) {
    console.error('\n❌ Transaction failed:', error)
    throw error
  }

  // Step 6: Verify the update
  console.log('\n' + '─'.repeat(80))
  console.log('📊 AFTER UPDATE - Verifying Changes:')
  console.log('─'.repeat(80))

  const updatedPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      productId: product.id,
      locationId: bambang.id,
      unitId: { in: [rollUnit.id, meterUnit.id] }
    },
    include: { unit: true }
  })

  for (const price of updatedPrices) {
    console.log(`   ${price.unit.name}: Purchase ₱${price.purchasePrice}, Selling ₱${price.sellingPrice}`)
    console.log(`      Record ID: ${price.id}, Updated: ${price.updatedAt}`)
  }

  // Step 7: Check if values match expected
  console.log('\n' + '─'.repeat(80))
  console.log('✅ VERIFICATION RESULT:')
  console.log('─'.repeat(80))

  const rollPrice = updatedPrices.find(p => p.unitId === rollUnit.id)
  const meterPrice = updatedPrices.find(p => p.unitId === meterUnit.id)

  let success = true

  if (rollPrice?.sellingPrice.toString() === '2025') {
    console.log('   ✅ Roll price correctly updated to ₱2025')
  } else {
    console.log('   ❌ Roll price NOT updated! Still: ₱%s (expected ₱2025)', rollPrice?.sellingPrice.toString())
    success = false
  }

  if (meterPrice?.sellingPrice.toString() === '12') {
    console.log('   ✅ Meter price correctly updated to ₱12')
  } else {
    console.log('   ❌ Meter price NOT updated! Still: ₱%s (expected ₱12)', meterPrice?.sellingPrice.toString())
    success = false
  }

  if (success) {
    console.log('\n🎉 TEST PASSED! Prices updated successfully in database.')
  } else {
    console.log('\n🚨 TEST FAILED! Prices were NOT updated despite transaction success.')
    console.log('   This confirms the bug: API returns success but database unchanged.')
  }

  console.log('\n' + '='.repeat(80))
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
