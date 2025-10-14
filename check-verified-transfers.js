const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkVerifiedTransfers() {
  try {
    console.log('Checking for verified transfers...\n')

    // Get all transfers with status='verified'
    const verifiedTransfers = await prisma.stockTransfer.findMany({
      where: {
        status: 'verified',
        deletedAt: null
      },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productVariationId: true,
            quantity: true
          }
        }
      },
      orderBy: {
        verifiedAt: 'desc'
      },
      take: 5
    })

    console.log(`Found ${verifiedTransfers.length} verified transfers:\n`)

    verifiedTransfers.forEach((transfer, index) => {
      console.log(`${index + 1}. Transfer ID: ${transfer.id}`)
      console.log(`   Transfer Number: ${transfer.transferNumber}`)
      console.log(`   Status: ${transfer.status}`)
      console.log(`   Verified At: ${transfer.verifiedAt}`)
      console.log(`   Items: ${transfer.items.length}`)

      if (transfer.items.length > 0) {
        console.log(`   Item Details:`)
        transfer.items.forEach((item, idx) => {
          console.log(`     ${idx + 1}. Product ID: ${item.productId}, Variation ID: ${item.productVariationId}, Qty: ${item.quantity}`)
        })
      }

      console.log(`   -------------------------`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkVerifiedTransfers()
