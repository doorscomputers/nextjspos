import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking variation location details...\n')

  const details = await prisma.variationLocationDetails.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      productVariation: { select: { name: true, sku: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`Found ${details.length} variation location details`)
  details.forEach(d => {
    console.log(`\nProduct: ${d.product.name}`)
    console.log(`  Variation: ${d.productVariation.name} (${d.productVariation.sku})`)
    console.log(`  Location ID: ${d.locationId}`)
    console.log(`  Quantity Available: ${d.qtyAvailable}`)
    console.log(`  Selling Price: ${d.sellingPrice || 'N/A'}`)
    console.log(`  Created: ${d.createdAt}`)
  })

  console.log('\n---\nChecking product variations...\n')

  const variations = await prisma.productVariation.findMany({
    where: {
      product: { name: 'Generic Mouse' }
    },
    include: {
      product: { select: { name: true } },
      variationLocationDetails: true
    }
  })

  console.log(`Found ${variations.length} variations for Generic Mouse`)
  variations.forEach(v => {
    console.log(`\nVariation ID: ${v.id}`)
    console.log(`  Name: ${v.name}`)
    console.log(`  SKU: ${v.sku}`)
    console.log(`  Purchase Price: ${v.purchasePrice}`)
    console.log(`  Selling Price: ${v.sellingPrice}`)
    console.log(`  Is Default: ${v.isDefault}`)
    console.log(`  Location Details:`, v.variationLocationDetails.length)
    v.variationLocationDetails.forEach(d => {
      console.log(`    - Location ${d.locationId}: Qty = ${d.qtyAvailable}`)
    })
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
