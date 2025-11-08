import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMeterPricing() {
  console.log('🔍 Finding Sample UTP CABLE product...')

  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'Sample UTP CABLE',
        mode: 'insensitive'
      }
    },
    include: {
      unitPrices: {
        include: {
          unit: true
        }
      }
    }
  })

  if (!product) {
    console.error('❌ Sample UTP CABLE not found!')
    return
  }

  console.log(`✅ Found product: ${product.name} (ID: ${product.id})`)

  // Find Meter unit
  const meterUnit = await prisma.unit.findFirst({
    where: {
      name: {
        contains: 'Meter',
        mode: 'insensitive'
      }
    }
  })

  if (!meterUnit) {
    console.error('❌ Meter unit not found!')
    return
  }

  console.log(`✅ Found Meter unit (ID: ${meterUnit.id})`)

  // Current Meter pricing
  const currentMeterPrice = await prisma.productUnitPrice.findFirst({
    where: {
      productId: product.id,
      unitId: meterUnit.id
    }
  })

  if (currentMeterPrice) {
    console.log('\n📊 Current Meter Pricing:')
    console.log(`   Purchase Price: ₱${currentMeterPrice.purchasePrice}`)
    console.log(`   Selling Price:  ₱${currentMeterPrice.sellingPrice}`)
    console.log(`   Margin: ${((parseFloat(currentMeterPrice.sellingPrice) - parseFloat(currentMeterPrice.purchasePrice)) / parseFloat(currentMeterPrice.purchasePrice) * 100).toFixed(2)}%`)
  }

  // Calculate correct prices
  // Roll: Purchase ₱1900, Selling ₱2014
  // 1 Roll = 300 Meters
  // Meter Purchase = 1900 / 300 = ₱6.33
  // Meter Selling = 2014 / 300 = ₱6.71

  const rollPurchase = 1900
  const rollSelling = 2014
  const metersPerRoll = 300

  const correctMeterPurchase = (rollPurchase / metersPerRoll).toFixed(2)
  const correctMeterSelling = (rollSelling / metersPerRoll).toFixed(2)
  const correctMargin = ((correctMeterSelling - correctMeterPurchase) / correctMeterPurchase * 100).toFixed(2)

  console.log('\n✨ Correct Meter Pricing Should Be:')
  console.log(`   Purchase Price: ₱${correctMeterPurchase}`)
  console.log(`   Selling Price:  ₱${correctMeterSelling}`)
  console.log(`   Margin: ${correctMargin}%`)

  console.log('\n🔧 Updating Meter pricing...')

  await prisma.productUnitPrice.updateMany({
    where: {
      productId: product.id,
      unitId: meterUnit.id
    },
    data: {
      purchasePrice: parseFloat(correctMeterPurchase),
      sellingPrice: parseFloat(correctMeterSelling)
    }
  })

  console.log('✅ Meter pricing updated successfully!')

  // Verify
  const updatedPrice = await prisma.productUnitPrice.findFirst({
    where: {
      productId: product.id,
      unitId: meterUnit.id
    }
  })

  console.log('\n✅ Verified Updated Pricing:')
  console.log(`   Purchase Price: ₱${updatedPrice.purchasePrice}`)
  console.log(`   Selling Price:  ₱${updatedPrice.sellingPrice}`)
  console.log(`   Margin: ${((parseFloat(updatedPrice.sellingPrice) - parseFloat(updatedPrice.purchasePrice)) / parseFloat(updatedPrice.purchasePrice) * 100).toFixed(2)}%`)
}

fixMeterPricing()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
