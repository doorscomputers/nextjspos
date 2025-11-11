/**
 * Update Bambang prices to correct values
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Updating Bambang Prices\n')

  const productName = 'Sample UTP CABLE'
  const locationName = 'Bambang'

  // Find product
  const product = await prisma.product.findFirst({
    where: { name: productName },
    select: { id: true, name: true, businessId: true }
  })

  if (!product) {
    console.log(`❌ Product "${productName}" not found`)
    return
  }

  // Find Bambang location
  const bambang = await prisma.businessLocation.findFirst({
    where: {
      name: locationName,
      businessId: product.businessId
    }
  })

  if (!bambang) {
    console.log(`❌ Location "${locationName}" not found`)
    return
  }

  console.log(`📦 Product: ${product.name} (ID: ${product.id})`)
  console.log(`📍 Location: ${bambang.name} (ID: ${bambang.id})`)

  // Update prices
  const updates = [
    { unitId: 3, unitName: 'Roll', purchasePrice: 1900, sellingPrice: 2014 },
    { unitId: 4, unitName: 'Meter', purchasePrice: 8, sellingPrice: 9 }
  ]

  console.log(`\n🔄 Updating prices...`)

  for (const { unitId, unitName, purchasePrice, sellingPrice } of updates) {
    const result = await prisma.productUnitLocationPrice.upsert({
      where: {
        productId_locationId_unitId: {
          productId: product.id,
          locationId: bambang.id,
          unitId
        }
      },
      update: {
        purchasePrice,
        sellingPrice,
        lastUpdatedBy: 1,
        updatedAt: new Date()
      },
      create: {
        businessId: product.businessId,
        productId: product.id,
        locationId: bambang.id,
        unitId,
        purchasePrice,
        sellingPrice,
        lastUpdatedBy: 1
      }
    })

    console.log(`   ✅ ${unitName}: ₱${purchasePrice} → ₱${sellingPrice}`)
  }

  console.log(`\n✅ Bambang prices updated successfully!`)
  console.log(`\nNow test in POS:`)
  console.log(`1. Login as Bambang cashier`)
  console.log(`2. Add "Sample UTP CABLE" to cart`)
  console.log(`3. Should show: ₱2,014.00 × 1 Roll`)
  console.log(`4. Change to Meter`)
  console.log(`5. Should show: ₱9.00 / Meter`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
