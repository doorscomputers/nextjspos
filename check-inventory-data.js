const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n=== Checking Product Variations ===')
  const variations = await prisma.productVariation.findMany({
    where: { sku: { in: ['PCI-0001', 'PCI-0002'] } },
    select: {
      id: true,
      sku: true,
      name: true,
      product: {
        select: {
          name: true
        }
      }
    }
  })
  console.log('Variations:', JSON.stringify(variations, null, 2))

  console.log('\n=== Checking Inventory at Location 2 ===')
  for (const variation of variations) {
    const inventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variation.id,
        locationId: 2
      },
      select: {
        id: true,
        productVariationId: true,
        locationId: true,
        qtyAvailable: true
      }
    })
    console.log(`\nVariation ${variation.sku} at Location 2:`, JSON.stringify(inventory, null, 2))
  }

  console.log('\n=== Checking Branch Manager User ===')
  const user = await prisma.user.findFirst({
    where: { username: 'branchmanager' },
    select: {
      id: true,
      username: true,
      locationIds: true
    }
  })
  console.log('Branch Manager:', JSON.stringify(user, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
