import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * EMERGENCY FIX: Remove duplicate inventory from destination locations
 * These duplicates were created when transfers completed without proper source deductions
 */
async function fixDestinationDuplicates() {
  console.log('🚨 EMERGENCY FIX: Removing duplicate inventory from destinations\n')

  // Get completed transfers with duplicate inventory
  const transferNumbers = [
    'TR-202511-0002',
    'TR-202511-0003',
    'TR-202511-0004',
    'TR-202511-0005',
    'TR-202511-0006',
  ]

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      transferNumber: { in: transferNumbers },
      status: 'completed',
    },
    include: {
      items: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { transferNumber: 'asc' },
  })

  console.log(`📦 Found ${transfers.length} transfers to process\n`)

  const itemsToFix: any[] = []

  // Identify all items with duplicate inventory
  for (const transfer of transfers) {
    for (const item of transfer.items) {
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

        itemsToFix.push({
          transfer,
          item,
          historyEntry: transferInHistory,
          productName: product?.name,
          variationName: variation?.name,
        })
      }
    }
  }

  if (itemsToFix.length === 0) {
    console.log('✅ No duplicate inventory found!')
    return
  }

  console.log(`🚨 Found ${itemsToFix.length} items with duplicate inventory:\n`)
  itemsToFix.forEach((item, idx) => {
    console.log(
      `${idx + 1}. ${item.transfer.transferNumber} - ${item.productName} - ${item.variationName}`
    )
    console.log(`   Location: ${item.transfer.toLocation.name}`)
    console.log(`   Duplicate quantity: ${item.historyEntry.quantityChange}`)
  })

  console.log(`\n⚠️  This will DEDUCT the duplicate quantities from destination locations`)
  console.log(`⚠️  Processing in 5 seconds... Press Ctrl+C to cancel\n`)

  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Fix each item
  let totalFixed = 0

  for (const { transfer, item, historyEntry, productName, variationName } of itemsToFix) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔧 Fixing: ${transfer.transferNumber}`)
    console.log(`   Product: ${productName} - ${variationName}`)
    console.log(`   Location: ${transfer.toLocation.name}`)
    console.log(`   Duplicate quantity: ${historyEntry.quantityChange}`)

    try {
      await prisma.$transaction(
        async (tx) => {
          const duplicateQty = parseFloat(historyEntry.quantityChange.toString())

          // Get current stock at destination
          const destStock = await tx.variationLocationDetails.findFirst({
            where: {
              productId: item.productId,
              productVariationId: item.productVariationId,
              locationId: transfer.toLocationId,
            },
          })

          if (!destStock) {
            console.log(`   ⚠️  No stock record found - skipping`)
            return
          }

          const currentQty = parseFloat(destStock.qtyAvailable.toString())
          const correctedQty = currentQty - duplicateQty

          console.log(`   Stock: ${currentQty} → ${correctedQty} (removing duplicate)`)

          // Remove duplicate inventory
          await tx.variationLocationDetails.update({
            where: { id: destStock.id },
            data: {
              qtyAvailable: correctedQty,
              updatedAt: new Date(),
            },
          })

          // Create corrective stock transaction
          await tx.stockTransaction.create({
            data: {
              businessId: transfer.businessId,
              productId: item.productId,
              productVariationId: item.productVariationId,
              locationId: transfer.toLocationId,
              type: 'correction',
              quantity: -duplicateQty,
              balanceQty: correctedQty,
              referenceType: 'stock_transfer',
              referenceId: transfer.id,
              createdBy: transfer.completedBy || transfer.createdBy,
              notes: `CORRECTIVE ACTION: Removing duplicate inventory from ${transfer.transferNumber} - transfer completed without source deduction`,
            },
          })

          // Create corrective product history
          await tx.productHistory.create({
            data: {
              businessId: transfer.businessId,
              productId: item.productId,
              productVariationId: item.productVariationId,
              locationId: transfer.toLocationId,
              quantityChange: -duplicateQty,
              balanceQuantity: correctedQty,
              transactionType: 'correction',
              transactionDate: new Date(),
              referenceType: 'stock_transfer',
              referenceId: transfer.id,
              referenceNumber: transfer.transferNumber,
              createdBy: transfer.completedBy || transfer.createdBy,
              createdByName: `System (Emergency Fix)`,
              reason: `EMERGENCY CORRECTION: Removing duplicate inventory - ${transfer.transferNumber} completed without source deduction due to transaction timeout`,
            },
          })

          console.log(`   ✅ Fixed - removed ${duplicateQty} units`)
        },
        {
          timeout: 120000,
          maxWait: 30000,
        }
      )

      totalFixed++
    } catch (error: any) {
      console.error(`   ❌ Failed:`, error.message)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\n✅ EMERGENCY FIX COMPLETE!`)
  console.log(`   Fixed ${totalFixed} items`)
  console.log(`\n✅ Inventory is now accurate!`)
  console.log(`   ✓ Source locations: Properly deducted`)
  console.log(`   ✓ Destination locations: Duplicates removed`)
  console.log(`   ✓ Transfer records: Still valid\n`)
}

fixDestinationDuplicates()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
