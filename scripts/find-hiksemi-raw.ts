import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function search() {
  // Raw search for any product with HIKSEMI in name
  console.log('All products with "HIKSEMI" in name:\n')

  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'HIKSEMI', mode: 'insensitive' }
    },
    orderBy: { name: 'asc' },
    include: {
      variations: {
        select: { id: true, sku: true }
      }
    }
  })

  for (const p of products) {
    const sku = p.variations[0]?.sku || 'N/A'
    console.log(`${p.id}: ${p.name} [SKU: ${sku}]`)
  }

  console.log(`\nTotal: ${products.length} products`)

  // Also check if the SKU exists anywhere
  console.log('\n\nSearching all variations for SKU starting with 697...')
  const variations = await prisma.productVariation.findMany({
    where: { sku: { startsWith: '697' } },
    include: { product: { select: { id: true, name: true } } }
  })

  for (const v of variations) {
    console.log(`SKU: ${v.sku} -> ${v.product.name} (ID: ${v.product.id})`)
  }

  await prisma.$disconnect()
}

search()
