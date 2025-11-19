import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Fix a partial transfer by completing the missing stock deductions
 *
 * USAGE: npx tsx scripts/fix-partial-transfer.ts <transferNumber>
 * Example: npx tsx scripts/fix-partial-transfer.ts TR-202501-0005
 */
async function fixPartialTransfer(transferNumber: string) {
  console.log(`🔧 Fixing partial transfer: ${transferNumber}\n`)

  // Find the transfer
  const transfer = await prisma.stockTransfer.findFirst({
    where: { transferNumber },
    include: {
      items: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
  })

  if (!transfer) {
    console.error(`❌ Transfer ${transferNumber} not found`)
    process.exit(1)
  }

  console.log(`📦 Transfer: ${transfer.transferNumber}`)
  console.log(`   Status: ${transfer.status}`)
  console.log(`   From: ${transfer.fromLocation.name} → To: ${transfer.toLocation.name}`)
  console.log(`   Items: ${transfer.items.length}`)
  console.log(`   Created by: ${transfer.createdBy}`)
  console.log(`   Sent by: ${transfer.sentBy}\n`)

  // Find items missing product history
  const itemsToFix: any[] = []

  for (const item of transfer.items) {
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
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      })
      const variation = await prisma.productVariation.findUnique({
        where: { id: item.productVariationId },
        select: { name: true, sku: true },
      })

      itemsToFix.push({
        ...item,
        productName: product?.name,
        variationName: variation?.name,
        variationSku: variation?.sku,
      })
    }
  }

  if (itemsToFix.length === 0) {
    console.log(`✅ No missing items found - transfer is already complete!`)
    return
  }

  console.log(`🚨 Found ${itemsToFix.length} items that need fixing:\n`)
  itemsToFix.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.productName} - ${item.variationName} (SKU: ${item.variationSku})`)
    console.log(`   Variation ID: ${item.productVariationId}, Qty: ${item.quantity}`)
  })

  console.log(`\n⚠️  This will deduct stock from ${transfer.fromLocation.name} for these items.`)
  console.log(`⚠️  Make sure you've verified this is correct before proceeding!\n`)

  // Execute fix in transaction
  console.log(`🔄 Starting transaction to fix ${itemsToFix.length} items...\n`)

  const result = await prisma.$transaction(
    async (tx) => {
      const results = []

      for (const item of itemsToFix) {
        const quantity = parseFloat(item.quantity.toString())
        console.log(`   Processing: ${item.productName} - ${item.variationName} (Qty: ${quantity})`)

        // Get or create stock record at source location
        let sourceStock = await tx.variationLocationDetails.findFirst({
          where: {
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: transfer.fromLocationId,
          },
        })

        if (!sourceStock) {
          console.log(`      ⚠️  No stock record found - creating with 0 quantity`)
          sourceStock = await tx.variationLocationDetails.create({
            data: {
              productId: item.productId,
              productVariationId: item.productVariationId,
              locationId: transfer.fromLocationId,
              qtyAvailable: 0,
            },
          })
        }

        const currentQty = parseFloat(sourceStock.qtyAvailable.toString())
        const newQty = currentQty - quantity

        console.log(`      Current stock: ${currentQty}, After deduction: ${newQty}`)

        // Update stock (deduct)
        await tx.variationLocationDetails.update({
          where: { id: sourceStock.id },
          data: {
            qtyAvailable: newQty,
            updatedAt: new Date(),
          },
        })

        // Create stock transaction
        await tx.stockTransaction.create({
          data: {
            businessId: transfer.businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: transfer.fromLocationId,
            type: 'transfer_out',
            quantity: -quantity, // Negative for deduction
            balanceQty: newQty,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
            createdBy: transfer.sentBy || transfer.createdBy,
            notes: `CORRECTIVE ACTION: Transfer ${transfer.transferNumber} sent (missed in original transaction)`,
          },
        })

        // Create product history
        await tx.productHistory.create({
          data: {
            businessId: transfer.businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: transfer.fromLocationId,
            quantityChange: -quantity,
            balanceQuantity: newQty,
            transactionType: 'transfer_out',
            transactionDate: transfer.sentAt || transfer.createdAt,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
            referenceNumber: transfer.transferNumber,
            createdBy: transfer.sentBy || transfer.createdBy,
            createdByName: `System (Corrective Action)`,
            reason: `CORRECTIVE ACTION: Transfer ${transfer.transferNumber} sent - missed in partial transaction timeout`,
          },
        })

        results.push({
          productName: item.productName,
          variationName: item.variationName,
          quantity,
          newBalance: newQty,
        })

        console.log(`      ✅ Fixed`)
      }

      return results
    },
    {
      timeout: 120000, // 2 minutes
      maxWait: 30000,
    }
  )

  console.log(`\n✅ Successfully fixed ${result.length} items!\n`)
  console.log(`Summary:`)
  result.forEach((item) => {
    console.log(`   • ${item.productName} - ${item.variationName}`)
    console.log(`     Deducted: ${item.quantity}, New Balance: ${item.newBalance}`)
  })

  console.log(`\n✅ Transfer ${transferNumber} is now complete!`)
}

// Get transfer number from command line
const transferNumber = process.argv[2]

if (!transferNumber) {
  console.error('❌ Usage: npx tsx scripts/fix-partial-transfer.ts <transferNumber>')
  console.error('   Example: npx tsx scripts/fix-partial-transfer.ts TR-202501-0005')
  process.exit(1)
}

fixPartialTransfer(transferNumber)
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
