import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addDefaultVariations() {
  console.log('🔍 Finding single products without variations...')

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

  const productsWithoutVariations = singleProducts.filter(p => p.variations.length === 0)

  console.log(`📦 Found ${productsWithoutVariations.length} single products without variations`)

  for (const product of productsWithoutVariations) {
    console.log(`  ➕ Creating default variation for: ${product.name} (${product.sku})`)

    await prisma.productVariation.create({
      data: {
        productId: product.id,
        name: 'DUMMY',
        sku: product.sku,
        purchasePrice: product.purchasePrice || 0,
        sellingPrice: product.sellingPrice || 0,
        isDefault: true,
        unitId: product.unitId,
      }
    })
  }

  console.log('✅ Default variations created successfully!')
}

addDefaultVariations()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
