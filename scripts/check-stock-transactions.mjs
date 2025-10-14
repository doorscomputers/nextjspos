import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking for stock transactions...\n')

  const transactions = await prisma.stockTransaction.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { name: true, sku: true } },
      productVariation: { select: { name: true, sku: true } },
      createdByUser: { select: { username: true } }
    }
  })

  console.log(`Found ${transactions.length} stock transactions`)
  console.log('\nLatest transactions:')
  transactions.forEach(t => {
    console.log(`- ${t.product.name} (${t.productVariation.name}): ${t.type} | Qty: ${t.quantity} | Balance: ${t.balanceQty} | Date: ${t.createdAt}`)
  })

  console.log('\n---\n')

  const products = await prisma.product.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      variations: {
        include: {
          variationLocationDetails: true
        }
      }
    }
  })

  console.log(`Found ${products.length} recent products`)
  products.forEach(p => {
    console.log(`\nProduct: ${p.name} (${p.sku})`)
    p.variations.forEach(v => {
      console.log(`  Variation: ${v.name} (${v.sku})`)
      v.variationLocationDetails.forEach(d => {
        console.log(`    Location ${d.locationId}: Qty = ${d.qtyAvailable}`)
      })
    })
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
