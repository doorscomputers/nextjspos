import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkInventory() {
  console.log('🔍 Checking inventory for Product Variation 3441...\n')

  // Get product details
  const product = await prisma.productVariation.findUnique({
    where: { id: 3441 },
    include: {
      product: true,
    },
  })

  if (!product) {
    console.log('❌ Product variation 3441 not found')
    return
  }

  console.log(`📦 Product: ${product.product.name}`)
  console.log(`   Variation: ${product.name}\n`)

  // Get inventory at all locations
  const inventory = await prisma.inventory.findMany({
    where: {
      productVariationId: 3441,
    },
    include: {
      location: true,
    },
  })

  console.log('📊 Inventory by Location:\n')

  if (inventory.length === 0) {
    console.log('   ⚠️  No inventory records found')
  } else {
    for (const inv of inventory) {
      console.log(`   ${inv.location.name} (ID: ${inv.locationId})`)
      console.log(`      Quantity: ${inv.quantity}`)
      console.log(`      Shelf Location: ${inv.shelfLocation || 'N/A'}`)
      console.log('')
    }
  }

  // Check total across all locations
  const total = inventory.reduce((sum, inv) => sum + parseFloat(String(inv.quantity)), 0)
  console.log(`   Total across all locations: ${total}`)

  await prisma.$disconnect()
}

checkInventory().catch(console.error)
