import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface PriceUpdate {
  itemName: string
  newCost: number
  newSRP: number
}

const priceUpdates: PriceUpdate[] = [
  { itemName: 'HIKSEMI 128GB 2.5 SSD', newCost: 1385, newSRP: 1785 },
  { itemName: 'HIKSEMI 256GB 2.5 SSD', newCost: 2345, newSRP: 3175 },
  { itemName: 'HIKSEMI 512GB 2.5 SSD', newCost: 3905, newSRP: 5125 },
  { itemName: 'HIKSEMI 512GB M.2 NVME SSD GEN3', newCost: 4010, newSRP: 5800 },
  { itemName: 'HIKSEMI 512GB M.2 NVME SSD GEN4', newCost: 5260, newSRP: 7500 },
  { itemName: 'HIKSEMI 1TB 2.5 SSD', newCost: 7355, newSRP: 9500 },
  { itemName: 'HIKSEMI 1TB M.2 NVME SSD GEN4', newCost: 8520, newSRP: 10800 },
]

async function updateHiksemiPrices() {
  console.log('Starting HIKSEMI price updates...\n')

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  console.log(`Found ${locations.length} active locations:`)
  locations.forEach(loc => console.log(`  - ${loc.name} (ID: ${loc.id})`))
  console.log('')

  const now = new Date()
  let successCount = 0
  let errorCount = 0

  for (const update of priceUpdates) {
    console.log(`\nProcessing: ${update.itemName}`)
    console.log(`  New Cost: ${update.newCost}, New SRP: ${update.newSRP}`)

    // Find product by name (case insensitive)
    const product = await prisma.product.findFirst({
      where: {
        name: { equals: update.itemName, mode: 'insensitive' },
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: true,
          },
        },
      },
    })

    if (!product) {
      console.log(`  ❌ Product NOT FOUND: ${update.itemName}`)
      errorCount++
      continue
    }

    console.log(`  Found product ID: ${product.id}`)

    if (product.variations.length === 0) {
      console.log(`  ❌ No variations found for product`)
      errorCount++
      continue
    }

    const variation = product.variations[0]
    const oldCost = Number(variation.purchasePrice || 0)
    const oldPrice = Number(variation.sellingPrice || 0)

    console.log(`  Old Cost: ${oldCost}, Old Price: ${oldPrice}`)

    // Update ProductVariation
    await prisma.productVariation.update({
      where: { id: variation.id },
      data: {
        purchasePrice: update.newCost,
        sellingPrice: update.newSRP,
      },
    })

    // Update VariationLocationDetails for all locations
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

    console.log(`  ✅ Updated! Locations affected: ${locationsUpdated}`)
    console.log(`    Cost: ${oldCost} → ${update.newCost} (${update.newCost - oldCost >= 0 ? '+' : ''}${update.newCost - oldCost})`)
    console.log(`    SRP:  ${oldPrice} → ${update.newSRP} (${update.newSRP - oldPrice >= 0 ? '+' : ''}${update.newSRP - oldPrice})`)
    successCount++
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`Total items: ${priceUpdates.length}`)
  console.log(`Successful updates: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log('='.repeat(50))
}

updateHiksemiPrices()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
