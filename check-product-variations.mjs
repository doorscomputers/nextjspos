import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProductVariations() {
  try {
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: 'ADATA 512GB', mode: 'insensitive' } },
          { sku: { contains: '4711085931528', mode: 'insensitive' } }
        ],
        deletedAt: null
      },
      include: {
        variations: {
          where: { deletedAt: null }
        }
      }
    })

    if (!product) {
      console.log('❌ Product "ADATA 512GB 2.5 SSD" not found')
      return
    }

    console.log('\n✅ Product Found:')
    console.log('ID:', product.id)
    console.log('Name:', product.name)
    console.log('SKU:', product.sku)
    console.log('Type:', product.type)
    console.log('Number of Variations:', product.variations.length)

    if (product.variations.length === 0) {
      console.log('\n⚠️  This product has NO variations!')
      console.log('\nPossible Reasons:')
      console.log('1. Product was created without variations')
      console.log('2. Variations were soft-deleted (deletedAt is not null)')
      console.log('3. Database migration or seeding issue')

      // Check if there are soft-deleted variations
      const deletedVariations = await prisma.productVariation.findMany({
        where: {
          productId: product.id,
          deletedAt: { not: null }
        }
      })

      if (deletedVariations.length > 0) {
        console.log(`\n🗑️  Found ${deletedVariations.length} soft-deleted variation(s):`)
        deletedVariations.forEach((v, i) => {
          console.log(`   ${i + 1}. ${v.name} (SKU: ${v.sku}) - Deleted at: ${v.deletedAt}`)
        })
      }

      // Check for any variations regardless of deletedAt
      const allVariations = await prisma.productVariation.findMany({
        where: { productId: product.id }
      })

      console.log(`\n📊 Total variations (including deleted): ${allVariations.length}`)
    } else {
      console.log('\n📋 Variations:')
      product.variations.forEach((v, i) => {
        console.log(`${i + 1}. ${v.name} (SKU: ${v.sku})`)
        console.log(`   Purchase Price: ${v.purchasePrice}`)
        console.log(`   Selling Price: ${v.sellingPrice}`)
        console.log(`   Is Default: ${v.isDefault}`)
      })
    }

    // Suggest fix
    if (product.variations.length === 0) {
      console.log('\n💡 Solution:')
      console.log('You need to create a variation for this product.')
      console.log('\nFor a single product, you should have a "Default" variation.')
      console.log('For a variable product, you should have at least one variation (e.g., size, color).')
      console.log('\nYou can:')
      console.log('1. Edit the product in the UI and add variations')
      console.log('2. Or run a migration script to create default variations for all products without variations')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProductVariations()
