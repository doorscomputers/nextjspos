import { PrismaClient } from '@prisma/client'

// Connect directly to Supabase production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    }
  }
})

async function updateProduct() {
  console.log('Connecting to Supabase production database...\n')

  // Find by SKU
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '6974202725594' },
    include: { product: true }
  })

  if (!variation) {
    console.log('Product not found by SKU 6974202725594')
    console.log('\nSearching by name instead...')

    // Try by name
    const product = await prisma.product.findFirst({
      where: { name: { equals: 'HIKSEMI 128GB 2.5 SSD', mode: 'insensitive' } },
      include: { variations: true }
    })

    if (!product) {
      console.log('Product not found by name either')
      await prisma.$disconnect()
      return
    }

    console.log('Found by name:', product.name)
    if (product.variations.length > 0) {
      await updateVariation(product.variations[0], product.name)
    }
    return
  }

  console.log('Found:', variation.product.name)
  await updateVariation(variation, variation.product.name)
}

async function updateVariation(variation: any, productName: string) {
  console.log('Old Cost:', Number(variation.purchasePrice))
  console.log('Old Price:', Number(variation.sellingPrice))

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  })

  console.log(`\nFound ${locations.length} active locations`)

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

  console.log('\n✅ Updated ' + productName)
  console.log('   New Cost: 1385')
  console.log('   New SRP: 1785')
  console.log('   Locations updated:', locationsUpdated)

  await prisma.$disconnect()
}

updateProduct().catch(async (e) => {
  console.error('Error:', e)
  await prisma.$disconnect()
})
