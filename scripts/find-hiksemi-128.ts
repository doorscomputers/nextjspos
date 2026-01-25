import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function search() {
  // Search for products with 128GB and SSD
  console.log('Searching for products containing "128" and "SSD"...\n')

  const products = await prisma.product.findMany({
    where: {
      AND: [
        { name: { contains: '128', mode: 'insensitive' } },
        { name: { contains: 'SSD', mode: 'insensitive' } },
      ]
    },
    include: {
      variations: {
        select: { id: true, sku: true, purchasePrice: true, sellingPrice: true }
      }
    }
  })

  console.log(`Found ${products.length} products:\n`)
  for (const p of products) {
    console.log(`ID: ${p.id}`)
    console.log(`Name: "${p.name}"`)
    console.log(`SKU: ${p.variations[0]?.sku || 'N/A'}`)
    console.log(`Cost: ${p.variations[0]?.purchasePrice || 'N/A'}`)
    console.log(`Price: ${p.variations[0]?.sellingPrice || 'N/A'}`)
    console.log('---')
  }

  // Also search by exact name
  console.log('\nSearching for exact name "HIKSEMI 128GB 2.5 SSD"...')
  const exact = await prisma.product.findFirst({
    where: { name: 'HIKSEMI 128GB 2.5 SSD' },
    include: { variations: true }
  })
  console.log('Exact match:', exact ? `Found ID ${exact.id}` : 'Not found')

  // Search case insensitive
  console.log('\nSearching case-insensitive...')
  const caseInsensitive = await prisma.product.findFirst({
    where: { name: { equals: 'HIKSEMI 128GB 2.5 SSD', mode: 'insensitive' } },
    include: { variations: true }
  })
  console.log('Case-insensitive match:', caseInsensitive ? `Found ID ${caseInsensitive.id}` : 'Not found')

  // Search variations by SKU
  console.log('\nSearching variations by SKU "6974202725594"...')
  const bySku = await prisma.productVariation.findMany({
    where: { sku: { contains: '6974202725594' } },
    include: { product: true }
  })
  console.log('SKU matches:', bySku.length)
  bySku.forEach(v => console.log(`  - ${v.product.name} (SKU: ${v.sku})`))

  await prisma.$disconnect()
}

search()
