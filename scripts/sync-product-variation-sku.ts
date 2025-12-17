import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncProductVariationSku() {
  console.log('🔍 Finding single products with mismatched SKUs...')

  // Find all single-type products with their default variations
  const singleProducts = await prisma.product.findMany({
    where: {
      type: 'single',
      deletedAt: null,
    },
    include: {
      variations: {
        where: { deletedAt: null }
      }
    }
  })

  console.log(`📦 Found ${singleProducts.length} single products`)

  let updatedCount = 0
  let skippedCount = 0

  for (const product of singleProducts) {
    // Get the default variation (or first if no default)
    const defaultVariation = product.variations.find(v => v.isDefault) || product.variations[0]

    if (!defaultVariation) {
      console.log(`  ⚠️ No variation found for: ${product.name} (Product ID: ${product.id})`)
      skippedCount++
      continue
    }

    // Check if SKUs are mismatched
    if (product.sku !== defaultVariation.sku) {
      console.log(`  🔄 Syncing SKU for: ${product.name}`)
      console.log(`     Product SKU: ${product.sku}`)
      console.log(`     Variation SKU (old): ${defaultVariation.sku}`)
      console.log(`     Variation ID: ${defaultVariation.id}`)

      // Update variation SKU to match product SKU
      await prisma.productVariation.update({
        where: { id: defaultVariation.id },
        data: { sku: product.sku }
      })

      console.log(`     ✅ Updated to: ${product.sku}`)
      updatedCount++
    } else {
      skippedCount++
    }
  }

  console.log('')
  console.log('📊 Summary:')
  console.log(`   ✅ Updated: ${updatedCount} products`)
  console.log(`   ⏭️ Skipped (already in sync): ${skippedCount} products`)
  console.log('✅ SKU sync completed!')
}

syncProductVariationSku()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
