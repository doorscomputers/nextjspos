const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📦 Adding test stock to location 4...')

  // Get all product variations
  const variations = await prisma.productVariation.findMany({
    where: {
      product: {
        businessId: 1
      }
    },
    include: {
      product: true
    }
  })

  console.log(`Found ${variations.length} product variations`)

  // Add stock to location 4 (Tuguegarao Downtown) for all variations
  for (const variation of variations) {
    // Check if stock record exists
    const existing = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variation.id,
          locationId: 4
        }
      }
    })

    if (existing) {
      // Update existing
      await prisma.variationLocationDetails.update({
        where: {
          productVariationId_locationId: {
            productVariationId: variation.id,
            locationId: 4
          }
        },
        data: {
          qtyAvailable: 100
        }
      })
      console.log(`  ✅ Updated stock for ${variation.product.name} - ${variation.name}: 100 units`)
    } else {
      // Create new
      await prisma.variationLocationDetails.create({
        data: {
          productId: variation.productId,
          productVariationId: variation.id,
          locationId: 4,
          qtyAvailable: 100
        }
      })
      console.log(`  ✅ Created stock for ${variation.product.name} - ${variation.name}: 100 units`)
    }
  }

  console.log('\n✅ Test stock added successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
