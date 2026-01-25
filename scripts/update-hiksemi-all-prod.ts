import { PrismaClient } from '@prisma/client'

// Connect directly to Supabase production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    }
  }
})

interface PriceUpdate {
  itemName: string
  newCost: number
  newSRP: number
}

const priceUpdates: PriceUpdate[] = [
  { itemName: 'HIKSEMI 256GB 2.5 SSD', newCost: 2345, newSRP: 3175 },
  { itemName: 'HIKSEMI 512GB 2.5 SSD', newCost: 3905, newSRP: 5125 },
  { itemName: 'HIKSEMI 512GB M.2 NVME SSD GEN3', newCost: 4010, newSRP: 5800 },
  { itemName: 'HIKSEMI 512GB M.2 NVME SSD GEN4', newCost: 5260, newSRP: 7500 },
  { itemName: 'HIKSEMI 1TB 2.5 SSD', newCost: 7355, newSRP: 9500 },
  { itemName: 'HIKSEMI 1TB M.2 NVME SSD GEN4', newCost: 8520, newSRP: 10800 },
]

async function updateHiksemiPrices() {
  console.log('Connecting to Supabase production database...')
  console.log('Updating remaining HIKSEMI SSD prices...\n')

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  console.log(`Found ${locations.length} active locations`)

  const now = new Date()
  let successCount = 0
  let errorCount = 0

  for (const update of priceUpdates) {
    console.log(`\nProcessing: ${update.itemName}`)

    // Find product by name
    const product = await prisma.product.findFirst({
      where: {
        name: { equals: update.itemName, mode: 'insensitive' },
      },
      include: {
        variations: true,
      },
    })

    if (!product) {
      console.log(`  ❌ NOT FOUND`)
      errorCount++
      continue
    }

    if (product.variations.length === 0) {
      console.log(`  ❌ No variations`)
      errorCount++
      continue
    }

    const variation = product.variations[0]
    const oldCost = Number(variation.purchasePrice || 0)
    const oldPrice = Number(variation.sellingPrice || 0)

    // Update ProductVariation
    await prisma.productVariation.update({
      where: { id: variation.id },
      data: {
        purchasePrice: update.newCost,
        sellingPrice: update.newSRP,
      },
    })

    // Update all location prices
    let locationsUpdated = 0
    for (const location of locations) {
      const result = await prisma.variationLocationDetails.updateMany({
        where: {
          productVariationId: variation.id,
          locationId: location.id,
        },
        data: {
          sellingPrice: update.newSRP,
          lastPriceUpdate: now,
        },
      })
      locationsUpdated += result.count
    }

    console.log(`  ✅ Cost: ${oldCost} → ${update.newCost} | SRP: ${oldPrice} → ${update.newSRP} | Locations: ${locationsUpdated}`)
    successCount++
  }

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total: ${priceUpdates.length} | Success: ${successCount} | Errors: ${errorCount}`)
  console.log('='.repeat(60))
}

updateHiksemiPrices()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
