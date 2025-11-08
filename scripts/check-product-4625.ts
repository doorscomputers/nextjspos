import { prisma } from '../src/lib/prisma.simple'

async function checkProduct() {
  const productId = 4625

  console.log('Checking product', productId, '...')

  const vars = await prisma.productVariation.findMany({
    where: { productId: productId }
  })

  console.log('\n=== VARIATIONS FOR PRODUCT 4625 ===')
  console.log('Total variations found:', vars.length)

  if (vars.length === 0) {
    console.log('❌ NO VARIATIONS FOUND!')
    console.log('This product was NOT created with a default variation.')
  } else {
    console.log('✅ Variations:')
    vars.forEach(v => {
      console.log(`  - ID: ${v.id}, Name: ${v.name}, SKU: ${v.sku}, IsDefault: ${v.isDefault}`)
    })
  }

  await prisma.$disconnect()
}

checkProduct().catch(console.error)
