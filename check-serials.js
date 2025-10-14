const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const serials = await prisma.productSerialNumber.findMany({
    take: 10,
    include: {
      product: true,
      productVariation: true,
      purchaseReceipt: {
        include: {
          supplier: true
        }
      }
    }
  })

  console.log('=== Existing Serial Numbers in Database ===')
  console.log(`Total count: ${serials.length}`)
  serials.forEach(s => {
    console.log(`\nSerial: ${s.serialNumber}`)
    console.log(`Product: ${s.product.name}`)
    console.log(`Variation: ${s.productVariation.name}`)
    console.log(`Status: ${s.status}`)
    if (s.purchaseReceipt) {
      console.log(`Receipt: ${s.purchaseReceipt.receiptNumber}`)
      console.log(`Supplier: ${s.purchaseReceipt.supplier.name}`)
    }
  })

  await prisma.$disconnect()
}

main().catch(console.error)
