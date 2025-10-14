const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const purchase = await prisma.purchase.findUnique({
    where: { id: 3 },
    include: {
      items: {
        include: {
          product: true,
          productVariation: true
        }
      }
    }
  })

  console.log('=== Purchase Order 3 Items ===')
  purchase.items.forEach(item => {
    console.log(`\nItem ID: ${item.id}`)
    console.log(`Product: ${item.product.name}`)
    console.log(`Variation: ${item.productVariation.name}`)
    console.log(`Product ID: ${item.productId}`)
    console.log(`Variation ID: ${item.productVariationId}`)
    console.log(`Quantity: ${item.quantity}`)
    console.log(`requiresSerial: ${item.requiresSerial}`)
    console.log(`Product enableProductInfo: ${item.product.enableProductInfo}`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)
