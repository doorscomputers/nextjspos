import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  // Find the ACER product
  const product = await prisma.product.findFirst({
    where: {
      name: { contains: 'ACER ANV16-71-524U' }
    },
    include: {
      variations: {
        where: { deletedAt: null }
      }
    }
  })

  if (product) {
    console.log('Product Name:', product.name)
    console.log('Product SKU:', product.sku)
    console.log('Variation SKU:', product.variations[0]?.sku)
    console.log('SKUs Match:', product.sku === product.variations[0]?.sku ? '✅ YES' : '❌ NO')
  } else {
    console.log('Product not found')
  }

  await prisma.$disconnect()
}

verify()
