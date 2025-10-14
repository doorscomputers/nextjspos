const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const corrections = await prisma.inventoryCorrection.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      productVariation: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      createdByUser: { select: { username: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  console.log(`\n📦 Found ${corrections.length} inventory corrections:\n`)

  corrections.forEach((c, i) => {
    console.log(`${i + 1}. ID: ${c.id}`)
    console.log(`   Product: ${c.product.name} (${c.product.sku})`)
    console.log(`   Variation: ${c.productVariation.name} (${c.productVariation.sku})`)
    console.log(`   Location: ${c.location.name}`)
    console.log(`   Status: ${c.status}`)
    console.log(`   System: ${c.systemCount}, Physical: ${c.physicalCount}, Diff: ${c.difference}`)
    console.log(`   Created by: ${c.createdByUser.username}`)
    console.log(`   Date: ${c.createdAt}`)
    console.log('')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
