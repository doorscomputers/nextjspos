import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function restoreProductVariation() {
  try {
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: 'ADATA 512GB', mode: 'insensitive' } },
          { sku: { contains: '4711085931528', mode: 'insensitive' } }
        ],
        deletedAt: null
      }
    })

    if (!product) {
      console.log('❌ Product not found')
      return
    }

    console.log('✅ Product found:', product.name, '(ID:', product.id, ')')

    // Find soft-deleted variations
    const deletedVariations = await prisma.productVariation.findMany({
      where: {
        productId: product.id,
        deletedAt: { not: null }
      }
    })

    if (deletedVariations.length === 0) {
      console.log('⚠️  No soft-deleted variations found')
      return
    }

    console.log(`\n🔄 Restoring ${deletedVariations.length} variation(s)...`)

    // Restore all soft-deleted variations
    const result = await prisma.productVariation.updateMany({
      where: {
        productId: product.id,
        deletedAt: { not: null }
      },
      data: {
        deletedAt: null
      }
    })

    console.log(`✅ Restored ${result.count} variation(s)`)

    // Verify
    const activeVariations = await prisma.productVariation.findMany({
      where: {
        productId: product.id,
        deletedAt: null
      }
    })

    console.log('\n📋 Active Variations After Restore:')
    activeVariations.forEach((v, i) => {
      console.log(`${i + 1}. ${v.name} (SKU: ${v.sku})`)
      console.log(`   Purchase Price: ${v.purchasePrice}`)
      console.log(`   Selling Price: ${v.sellingPrice}`)
    })

    console.log('\n✅ Done! The product should now show variations in the Inventory Ledger page.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

restoreProductVariation()
