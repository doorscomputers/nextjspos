const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const transferId = 5 // TR-202510-0005

  console.log('🔍 Checking Transfer Items for TR-202510-0005...\n')

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          productVariation: { select: { name: true } },
        },
      },
    },
  })

  console.log('Transfer Status:', transfer.status)
  console.log('Items:\n')

  for (const item of transfer.items) {
    console.log(`  ${item.product.name} - ${item.productVariation.name}:`)
    console.log(`    quantity: ${item.quantity}`)
    console.log(`    receivedQuantity: ${item.receivedQuantity}`)
    console.log(`    verified: ${item.verified}`)
    console.log(`    serialNumbersReceived: ${JSON.stringify(item.serialNumbersReceived)}`)
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
