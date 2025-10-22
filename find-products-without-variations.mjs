import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findProductsWithoutVariations() {
  try {
    console.log('🔍 Scanning for products without active variations...\n')

    // Get all active products
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        variations: {
          where: { deletedAt: null }
        }
      }
    })

    // Find products without variations
    const productsWithoutVariations = products.filter(p => p.variations.length === 0)

    console.log(`📊 Total active products: ${products.length}`)
    console.log(`⚠️  Products without active variations: ${productsWithoutVariations.length}\n`)

    if (productsWithoutVariations.length === 0) {
      console.log('✅ All products have active variations!')
      return
    }

    console.log('📋 Products needing attention:\n')

    for (const product of productsWithoutVariations) {
      // Check if there are soft-deleted variations
      const deletedVariations = await prisma.productVariation.findMany({
        where: {
          productId: product.id,
          deletedAt: { not: null }
        }
      })

      console.log(`${product.id}. ${product.name} (SKU: ${product.sku})`)
      console.log(`   Type: ${product.type}`)
      console.log(`   Business ID: ${product.businessId}`)

      if (deletedVariations.length > 0) {
        console.log(`   🗑️  Has ${deletedVariations.length} soft-deleted variation(s)`)
      } else {
        console.log(`   ❌ No variations at all (need to create)`)
      }
      console.log('')
    }

    // Provide fix options
    console.log('\n💡 Solutions:')
    console.log('\n1. Restore soft-deleted variations:')
    console.log('   Run: node restore-all-deleted-variations.mjs')
    console.log('\n2. Create missing variations:')
    console.log('   Run: node create-missing-variations.mjs')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findProductsWithoutVariations()
