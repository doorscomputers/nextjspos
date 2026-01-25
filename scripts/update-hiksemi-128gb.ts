import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateProduct() {
  // Find by SKU
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '6974202725594' },
    include: { product: true }
  })

  if (!variation) {
    console.log('Product not found by SKU')
    return
  }

  console.log('Found:', variation.product.name)
  console.log('Old Cost:', Number(variation.purchasePrice))
  console.log('Old Price:', Number(variation.sellingPrice))

  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  })

  // Update variation
  await prisma.productVariation.update({
    where: { id: variation.id },
    data: {
      purchasePrice: 1385,
      sellingPrice: 1785,
    }
  })

  // Update all location prices
  let locationsUpdated = 0
  for (const loc of locations) {
    const result = await prisma.variationLocationDetails.updateMany({
      where: {
        productVariationId: variation.id,
        locationId: loc.id,
      },
      data: {
        sellingPrice: 1785,
        lastPriceUpdate: new Date(),
      }
    })
    locationsUpdated += result.count
  }

  console.log('\n✅ Updated HIKSEMI 128GB 2.5 SSD')
  console.log('   New Cost: 1385')
  console.log('   New SRP: 1785')
  console.log('   Locations updated:', locationsUpdated)

  await prisma.$disconnect()
}

updateProduct()
