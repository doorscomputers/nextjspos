import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Check if completed transfers added stock to destination without deducting from source
 * This creates duplicate inventory that needs to be removed
 */
async function checkDestinationDuplicates() {
  console.log('🔍 Checking for duplicate inventory at destination locations...\n')

  // Get completed/verified transfers
  const completedTransfers = await prisma.stockTransfer.findMany({
    where: {
      transferNumber: {
        in: [
          'TR-202511-0001',
          'TR-202511-0002',
          'TR-202511-0003',
          'TR-202511-0004',
          'TR-202511-0005',
          'TR-202511-0006',
        ],
      },
      status: { in: ['verified', 'completed'] },
    },
    include: {
      items: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { transferNumber: 'asc' },
  })

  console.log(`📦 Found ${completedTransfers.length} completed/verified transfers to check\n`)

  for (const transfer of completedTransfers) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Transfer: ${transfer.transferNumber} (${transfer.status})`)
    console.log(`From: ${transfer.fromLocation.name} → To: ${transfer.toLocation.name}`)
    console.log(`Completed At: ${transfer.completedAt}`)

    // Check each item for transfer_in history
    for (const item of transfer.items) {
      const [product, variation] = await Promise.all([
        prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        }),
        prisma.productVariation.findUnique({
          where: { id: item.productVariationId },
          select: { name: true },
        }),
      ])

      console.log(`\n   Product: ${product?.name} - ${variation?.name}`)
      console.log(`   Quantity: ${item.quantity}`)

      // Check for transfer_in history at destination
      const transferInHistory = await prisma.productHistory.findFirst({
        where: {
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId,
          transactionType: 'transfer_in',
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
        },
      })

      if (transferInHistory) {
        console.log(`   ✅ Found transfer_in history at destination`)
        console.log(`      Quantity added: ${transferInHistory.quantityChange}`)
        console.log(`      Balance after: ${transferInHistory.balanceQuantity}`)
        console.log(`   ⚠️  This stock was ADDED without proper source deduction!`)
        console.log(`   🔴 DUPLICATE INVENTORY - needs to be removed`)
      } else {
        console.log(`   ❓ No transfer_in history found`)
        console.log(`      Transfer may not have completed properly`)
      }

      // Check current stock at destination
      const destStock = await prisma.variationLocationDetails.findFirst({
        where: {
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId,
        },
      })

      if (destStock) {
        console.log(`      Current destination stock: ${destStock.qtyAvailable}`)
      } else {
        console.log(`      No stock record at destination`)
      }
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  console.log(`⚠️  Summary:`)
  console.log(`   Checked ${completedTransfers.length} completed transfers`)
  console.log(`   If transfer_in history was found, those quantities are DUPLICATES`)
  console.log(`   They were added to destination without deducting from source`)
  console.log(`\n   Use fix-destination-duplicates.ts to remove the duplicate inventory\n`)
}

checkDestinationDuplicates()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
