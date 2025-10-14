const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkProducts() {
  console.log('\n📦 Available Products in Database:\n')

  const products = await prisma.product.findMany({
    where: { businessId: 1 },
    include: {
      variations: {
        take: 1,
        orderBy: { id: 'asc' }
      }
    },
    orderBy: { id: 'asc' }
  })

  products.forEach((product, index) => {
    console.log(`${index + 1}. ID: ${product.id} - Name: "${product.name}"`)
    if (product.variations.length > 0) {
      console.log(`   Variation ID: ${product.variations[0].id}, Name: "${product.variations[0].name || 'Default'}"`)
    }
  })

  console.log(`\nTotal: ${products.length} products\n`)
}

checkProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
