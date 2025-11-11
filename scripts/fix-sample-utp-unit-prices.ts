/**
 * Fix Sample UTP CABLE Unit Prices
 * Sets the unit prices to the correct values as specified by the user
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing Sample UTP CABLE unit prices...\n')

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
    },
  })

  if (!product) {
    console.log('❌ Product not found')
    return
  }

  console.log(`✅ Product: ${product.name} (ID: ${product.id})`)

  // Parse sub-unit IDs
  const subUnitIds = product.subUnitIds
    ? JSON.parse(product.subUnitIds as string)
    : []
  const allUnitIds = [product.unitId, ...subUnitIds]

  // Get units
  const units = await prisma.unit.findMany({
    where: {
      id: { in: allUnitIds },
    },
  })

  const rollUnit = units.find(u => u.name.toLowerCase().includes('roll'))
  const meterUnit = units.find(u => u.name.toLowerCase().includes('meter'))

  if (!rollUnit || !meterUnit) {
    console.log('❌ Could not find Roll or Meter units')
    return
  }

  console.log(`\n📏 Units found:`)
  console.log(`   Roll: ID ${rollUnit.id}`)
  console.log(`   Meter: ID ${meterUnit.id}`)

  // Get current unit prices
  const currentUnitPrices = await prisma.productUnitPrice.findMany({
    where: {
      productId: product.id,
    },
  })

  console.log(`\n💰 Current Unit Prices:`)
  for (const up of currentUnitPrices) {
    const unit = units.find(u => u.id === up.unitId)
    console.log(`   ${unit?.name}: Purchase ₱${up.purchasePrice}, Selling ₱${up.sellingPrice}`)
  }

  // NEW PRICES (as per user's requirement)
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

  console.log(`\n🆕 NEW Unit Prices (updating to):`)
  for (const price of newPrices) {
    console.log(`   ${price.unitName}: Purchase ₱${price.purchasePrice}, Selling ₱${price.sellingPrice}`)
  }

  console.log(`\n⏳ Updating unit prices...`)

  // Update unit prices in transaction
  await prisma.$transaction(async (tx) => {
    for (const price of newPrices) {
      await tx.productUnitPrice.upsert({
        where: {
          productId_unitId: {
            productId: product.id,
            unitId: price.unitId,
          },
        },
        update: {
          purchasePrice: price.purchasePrice,
          sellingPrice: price.sellingPrice,
        },
        create: {
          businessId: product.businessId,
          productId: product.id,
          unitId: price.unitId,
          purchasePrice: price.purchasePrice,
          sellingPrice: price.sellingPrice,
        },
      })
    }
  })

  console.log(`\n✅ Unit prices updated successfully!`)

  // Verify
  const updatedPrices = await prisma.productUnitPrice.findMany({
    where: {
      productId: product.id,
    },
    include: {
      unit: true,
    },
  })

  console.log(`\n📊 Verification - Updated prices:`)
  for (const up of updatedPrices) {
    console.log(`   ${up.unit.name}: Purchase ₱${up.purchasePrice}, Selling ₱${up.sellingPrice}`)
  }

  console.log(`\n🎉 Done! Please refresh your POS session to see the updated prices.`)
  console.log(`   IMPORTANT: Close and reopen the POS page, or log out and log back in.`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
