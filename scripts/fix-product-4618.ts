import { prisma } from '../src/lib/prisma.simple'

async function fixProduct() {
  const productId = 4618

  console.log('Checking product', productId, '...')

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variations: true
    }
  })

  if (!product) {
    console.log('❌ Product not found!')
    return
  }

  console.log('\n📋 PRODUCT DETAILS:')
  console.log('  Created At:', product.createdAt)
  console.log('  Type:', product.type)
  console.log('  Business ID:', product.businessId)

  console.log('✅ Product found:', product.name)
  console.log('Type:', product.type)
  console.log('Variations count:', product.variations.length)

  if (product.variations.length === 0) {
    console.log('\n⚠️ Product has NO variations! Creating default variation...')

    // Step 1: Create ProductVariation (the variation group)
    const productVariation = await prisma.productVariation.create({
      data: {
        productId: product.id,
        name: 'default', // Standard name for single products
        isDefault: true
      }
    })

    console.log('✅ Created ProductVariation:', productVariation.id)

    // Step 2: Create Variation (the actual variant)
    const variation = await prisma.variation.create({
      data: {
        productId: product.id,
        productVariationId: productVariation.id,
        name: 'DUMMY', // Standard name for single products
        subSku: product.sku || `V-${product.id}`,
        defaultPurchasePrice: product.purchasePrice,
        defaultSellingPrice: product.sellingPrice
      }
    })

    console.log('✅ Created Variation:', variation.id)
    console.log('\n✅ Product fixed! You can now use it in Inventory Corrections.')
  } else {
    console.log('✅ Product already has variations')
    product.variations.forEach(v => {
      console.log(`  - ${v.name} (ID: ${v.id})`)
    })
  }

  await prisma.$disconnect()
}

fixProduct().catch(console.error)
