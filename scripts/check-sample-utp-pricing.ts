/**
 * Diagnostic Script: Check Sample UTP CABLE Pricing
 *
 * This script investigates the pricing discrepancy for Sample UTP CABLE product.
 * It checks:
 * 1. Product base pricing
 * 2. Unit configuration (Roll vs Meter)
 * 3. ProductUnitPrice records
 * 4. VariationLocationDetails pricing
 * 5. POS pricing calculation
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Starting diagnostic for Sample UTP CABLE pricing...\n')

  // Find the product
  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'Sample UTP CABLE',
        mode: 'insensitive',
      },
    },
    include: {
      unit: true,
      variations: {
        include: {
          variationLocationDetails: true,
        },
      },
      unitPrices: {
        include: {
          unit: true,
        },
      },
    },
  })

  if (!product) {
    console.log('❌ Product "Sample UTP CABLE" not found')
    return
  }

  console.log('✅ Product Found:')
  console.log(`   ID: ${product.id}`)
  console.log(`   Name: ${product.name}`)
  console.log(`   SKU: ${product.sku}`)
  console.log(`   Primary Unit ID: ${product.unitId}`)
  console.log(`   Primary Unit: ${product.unit?.name} (${product.unit?.shortName})`)
  console.log(`   Sub-Unit IDs: ${product.subUnitIds}`)
  console.log(`   Base Purchase Price: ₱${product.purchasePrice}`)
  console.log(`   Base Selling Price: ₱${product.sellingPrice}\n`)

  // Get all configured units
  const subUnitIds = product.subUnitIds
    ? JSON.parse(product.subUnitIds as string)
    : []
  const allUnitIds = [product.unitId, ...subUnitIds]

  const units = await prisma.unit.findMany({
    where: {
      id: { in: allUnitIds },
    },
  })

  console.log('📏 Configured Units:')
  for (const unit of units) {
    const isPrimary = unit.id === product.unitId
    console.log(`   ${isPrimary ? '⭐' : '  '} ${unit.name} (${unit.shortName})`)
    console.log(`      ID: ${unit.id}`)
    console.log(`      Base Unit ID: ${unit.baseUnitId}`)
    console.log(`      Multiplier: ${unit.baseUnitMultiplier}`)
    console.log(`      Allows Decimal: ${unit.allowDecimal}`)
  }
  console.log('')

  // Check ProductUnitPrice records
  console.log('💰 ProductUnitPrice Records:')
  if (product.unitPrices.length === 0) {
    console.log('   ⚠️  NO unit-specific prices found in database!')
  } else {
    for (const up of product.unitPrices) {
      console.log(`   Unit: ${up.unit.name} (${up.unit.shortName})`)
      console.log(`      Purchase Price: ₱${up.purchasePrice}`)
      console.log(`      Selling Price: ₱${up.sellingPrice}`)
    }
  }
  console.log('')

  // Check variation location pricing
  console.log('🏪 Variation Location Pricing:')
  const variation = product.variations[0]
  if (variation) {
    console.log(`   Variation ID: ${variation.id}`)
    console.log(`   Variation SKU: ${variation.sku}`)

    // Fetch locations separately
    const locationIds = variation.variationLocationDetails.map(vld => vld.locationId)
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
    })

    for (const vld of variation.variationLocationDetails) {
      const location = locations.find(l => l.id === vld.locationId)
      console.log(`   Location ID ${vld.locationId}: ${location?.name || 'Unknown'}`)
      console.log(`      Selling Price: ₱${vld.sellingPrice}`)
      console.log(`      Available Qty: ${vld.qtyAvailable}`)
    }
  }
  console.log('')

  // Simulate POS pricing calculation
  console.log('🧮 POS Pricing Simulation:')
  const primaryUnit = product.unit
  const meterUnit = units.find(u => u.name.toLowerCase().includes('meter'))
  const rollUnit = units.find(u => u.name.toLowerCase().includes('roll'))

  if (primaryUnit && meterUnit && rollUnit) {
    console.log(`   Primary Unit: ${primaryUnit.name}`)
    console.log(`   Base Price (from variation): ₱${variation?.variationLocationDetails[0]?.sellingPrice || product.sellingPrice}`)

    // Check if explicit unit price exists for Meter
    const meterUnitPrice = product.unitPrices.find(up => up.unitId === meterUnit.id)
    if (meterUnitPrice) {
      console.log(`   ✅ Meter has explicit price: ₱${meterUnitPrice.sellingPrice}`)
    } else {
      console.log(`   ⚠️  Meter has NO explicit price, will calculate proportionally`)
      const basePrice = parseFloat(String(variation?.variationLocationDetails[0]?.sellingPrice || product.sellingPrice))
      const multiplier = parseFloat(String(meterUnit.baseUnitMultiplier || 1))
      const calculatedPrice = basePrice / multiplier
      console.log(`   Calculated Meter Price: ₱${basePrice} / ${multiplier} = ₱${calculatedPrice.toFixed(2)}`)
    }

    // Check Roll price
    const rollUnitPrice = product.unitPrices.find(up => up.unitId === rollUnit.id)
    if (rollUnitPrice) {
      console.log(`   ✅ Roll has explicit price: ₱${rollUnitPrice.sellingPrice}`)
    } else {
      console.log(`   ⚠️  Roll has NO explicit price, will use base price`)
    }
  }
  console.log('')

  console.log('✅ Diagnostic complete')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
