import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Find transfers with partial stock deductions
 * These are transfers marked as "in_transit" but not all items have product history entries
 */
async function findPartialTransfers() {
  console.log('🔍 Searching for transfers with partial stock deductions...\n')

  // Find all transfers marked as in_transit or completed with stockDeducted=true
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: { in: ['in_transit', 'arrived', 'verifying', 'verified', 'completed'] },
      stockDeducted: true,
    },
    include: {
      items: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20, // Check last 20 transfers
  })

  console.log(`📦 Found ${transfers.length} transfers to check\n`)

  for (const transfer of transfers) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Transfer: ${transfer.transferNumber}`)
    console.log(`Status: ${transfer.status}`)
    console.log(`From: ${transfer.fromLocation.name} → To: ${transfer.toLocation.name}`)
    console.log(`Items: ${transfer.items.length}`)
    console.log(`Stock Deducted: ${transfer.stockDeducted}`)

    // For each item, check if product history exists
    let missingCount = 0
    const missingItems: any[] = []

    for (const item of transfer.items) {
      // Check for transfer_out history entry
      const historyEntry = await prisma.productHistory.findFirst({
        where: {
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId,
          transactionType: 'transfer_out',
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
        },
      })

      if (!historyEntry) {
        missingCount++
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        })
        const variation = await prisma.productVariation.findUnique({
          where: { id: item.productVariationId },
          select: { name: true },
        })

        missingItems.push({
          productId: item.productId,
          productName: product?.name,
          variationId: item.productVariationId,
          variationName: variation?.name,
          quantity: item.quantity.toString(),
        })
      }
    }

    if (missingCount > 0) {
      console.log(`\n🚨 PARTIAL TRANSFER DETECTED!`)
      console.log(`   ${transfer.items.length - missingCount} items processed successfully`)
      console.log(`   ${missingCount} items MISSING product history`)
      console.log(`\n   Missing items:`)
      missingItems.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.productName} - ${item.variationName}`)
        console.log(`      Variation ID: ${item.variationId}, Qty: ${item.quantity}`)
      })
    } else {
      console.log(`✅ All items have product history - transfer is complete`)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

findPartialTransfers()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
