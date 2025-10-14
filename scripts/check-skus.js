const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const variations = await prisma.productVariation.findMany({
    take: 10,
    select: {
      id: true,
      name: true,
      sku: true,
      product: {
        select: {
          name: true
        }
      }
    }
  })

  console.log('\n=== Available Product SKUs ===\n')
  variations.forEach(v => {
    console.log(`SKU: ${v.sku}`)
    console.log(`Product: ${v.product.name}`)
    console.log(`Variation: ${v.name}`)
    console.log('---')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
