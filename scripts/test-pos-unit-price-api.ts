/**
 * Test POS Unit Price API
 * Tests the /api/pos/product-units endpoint to see what it returns
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Testing POS Unit Price API Logic...\n')

  // Find Sample UTP CABLE
  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'Sample UTP CABLE',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unitId: true,
      subUnitIds: true,
    },
  })

  if (!product) {
    console.log('❌ Product not found')
    return
  }

  console.log(`✅ Product: ${product.name} (ID: ${product.id})`)
  console.log(`   Primary Unit ID: ${product.unitId}`)
  console.log(`   Sub-Unit IDs: ${product.subUnitIds}\n`)

  // Parse sub-unit IDs (same logic as API)
  const subUnitIds = product.subUnitIds
    ? (typeof product.subUnitIds === 'string'
        ? JSON.parse(product.subUnitIds)
        : product.subUnitIds)
    : []

  // Get all units (primary + sub-units) - same as API
  const allUnitIds = [product.unitId, ...subUnitIds].filter(Boolean)
  const units = await prisma.unit.findMany({
    where: {
      id: { in: allUnitIds },
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      allowDecimal: true,
      baseUnitId: true,
      baseUnitMultiplier: true,
    },
  })

  console.log('📏 Units returned by API:')
  for (const unit of units) {
    console.log(`   ${unit.name} (${unit.shortName})`)
    console.log(`      ID: ${unit.id}`)
    console.log(`      Base Unit ID: ${unit.baseUnitId}`)
    console.log(`      Multiplier: ${unit.baseUnitMultiplier}`)
  }
  console.log('')

  // Get unit prices - same as API
  const unitPrices = await prisma.productUnitPrice.findMany({
    where: {
      productId: product.id,
    },
    select: {
      unitId: true,
      purchasePrice: true,
      sellingPrice: true,
    },
  })

  console.log('💰 Unit Prices returned by API:')
  for (const up of unitPrices) {
    const unit = units.find(u => u.id === up.unitId)
    console.log(`   ${unit?.name || `Unit ${up.unitId}`}`)
    console.log(`      Purchase: ₱${up.purchasePrice}`)
    console.log(`      Selling: ₱${up.sellingPrice}`)
  }
  console.log('')

  // Simulate getUnitPrice function from uomConverter.ts
  console.log('🧮 Simulating getUnitPrice() function:')

  const baseUnitPrice = 1650 // Roll price from variation
  const meterUnit = units.find(u => u.name.toLowerCase().includes('meter'))

  if (meterUnit) {
    console.log(`   Looking for unit price for: ${meterUnit.name} (ID: ${meterUnit.id})`)

    // Check if we have a specific price for this unit
    const unitPrice = unitPrices.find(up => up.unitId === meterUnit.id)

    if (unitPrice) {
      console.log(`   ✅ Found explicit unit price: ₱${unitPrice.sellingPrice}`)
      console.log(`   >>> POS SHOULD show: ₱${unitPrice.sellingPrice} per ${meterUnit.name}`)
    } else {
      console.log(`   ⚠️  NO explicit unit price found`)

      // Calculate proportionally
      if (meterUnit.baseUnitId && meterUnit.baseUnitMultiplier) {
        const multiplier = parseFloat(String(meterUnit.baseUnitMultiplier))
        const calculatedPrice = baseUnitPrice / multiplier
        console.log(`   Calculating: ₱${baseUnitPrice} / ${multiplier} = ₱${calculatedPrice.toFixed(2)}`)
        console.log(`   >>> POS SHOULD show: ₱${calculatedPrice.toFixed(2)} per ${meterUnit.name}`)
      }
    }
  }
  console.log('')

  console.log('📊 Summary:')
  console.log(`   Database has explicit Meter price: ₱6.71`)
  console.log(`   POS shows: ₱5.71`)
  console.log(`   Expected (user wants): ₱9.00`)
  console.log('')
  console.log('🔍 Conclusion:')
  console.log('   If POSUnitSelector receives the correct unitPrices array from the API,')
  console.log('   and getUnitPrice() finds the explicit price (₱6.71), then POS should show ₱6.71.')
  console.log('   But POS shows ₱5.71, which suggests either:')
  console.log('   1. The API is not returning the unitPrices correctly')
  console.log('   2. Or POSUnitSelector is not passing unitPrices to getUnitPrice()')
  console.log('   3. Or there is a different baseUnitPrice being used (₱1,713 instead of ₱1,650)')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
