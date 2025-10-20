import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Product 306 at BOTH Locations ===\n')

  // Check Location 1 (Main Store)
  const loc1 = await prisma.variationLocationDetails.findFirst({
    where: { productId: 306, locationId: 1 }
  })
  console.log('Location 1 (Main Store):')
  console.log(`  Current Stock: ${loc1?.qtyAvailable || 0} units\n`)

  // Check Location 2 (Main Warehouse)
  const loc2 = await prisma.variationLocationDetails.findFirst({
    where: { productId: 306, locationId: 2 }
  })
  console.log('Location 2 (Main Warehouse):')
  console.log(`  Current Stock: ${loc2?.qtyAvailable || 0} units\n`)

  // Check Product History for Location 2
  const history2 = await prisma.productHistory.findMany({
    where: { productId: 306, locationId: 2 },
    orderBy: { createdAt: 'asc' }
  })
  console.log(`Product History for Location 2 (Main Warehouse): ${history2.length} records`)
  history2.forEach(r => {
    console.log(`  - ${r.transactionType}: ${r.quantityChange} units (${r.referenceNumber || r.reason})`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
