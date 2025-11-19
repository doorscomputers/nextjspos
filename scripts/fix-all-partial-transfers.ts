import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * EMERGENCY FIX: Fix all transfers with missing stock deductions
 * This corrects the catastrophic transaction failure where:
 * - Transfers show as "in_transit" or "completed"
 * - But stock was never deducted from source location
 * - Product history entries are missing
 */
async function fixAllPartialTransfers() {
  console.log('🚨 EMERGENCY FIX: Correcting all transfers with missing stock deductions\n')

  // Find all problematic transfers
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: { in: ['in_transit', 'arrived', 'verifying', 'verified', 'completed'] },
      stockDeducted: true, // Claims stock was deducted
    },
    include: {
      items: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  console.log(`📦 Checking ${transfers.length} transfers...\n`)

  const transfersToFix: any[] = []

  // Identify transfers with missing history
  for (const transfer of transfers) {
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
        itemsToFix.push(item)
      }
    }

    if (itemsToFix.length > 0) {
      transfersToFix.push({
        transfer,
        itemsToFix,
        itemsProcessed: transfer.items.length - itemsToFix.length,
      })
    }
  }

  if (transfersToFix.length === 0) {
    console.log('✅ No problematic transfers found!')
    return
  }

  console.log(`🚨 Found ${transfersToFix.length} transfers that need fixing:\n`)
  transfersToFix.forEach((t, idx) => {
    console.log(
      `${idx + 1}. ${t.transfer.transferNumber} - ${t.transfer.status} - ` +
        `${t.itemsProcessed} processed, ${t.itemsToFix.length} missing`
    )
  })

  console.log(`\n⚠️  This will deduct stock and create product history for ${
    transfersToFix.reduce((sum, t) => sum + t.itemsToFix.length, 0)
  } items`)
  console.log(`⚠️  Processing in 5 seconds... Press Ctrl+C to cancel\n`)

  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Fix each transfer
  let totalFixed = 0

  for (const { transfer, itemsToFix } of transfersToFix) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔧 Fixing: ${transfer.transferNumber}`)
    console.log(`   Status: ${transfer.status}`)
    console.log(`   Items to fix: ${itemsToFix.length}`)

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const results = []

          for (const item of itemsToFix) {
            const quantity = parseFloat(item.quantity.toString())

            // Get product details for logging
            const [product, variation] = await Promise.all([
              tx.product.findUnique({
                where: { id: item.productId },
                select: { name: true },
              }),
              tx.productVariation.findUnique({
                where: { id: item.productVariationId },
                select: { name: true },
              }),
            ])

            console.log(
              `   Processing: ${product?.name} - ${variation?.name} (Qty: ${quantity})`
            )

            // Get or create stock record at source location
            let sourceStock = await tx.variationLocationDetails.findFirst({
              where: {
                productId: item.productId,
                productVariationId: item.productVariationId,
                locationId: transfer.fromLocationId,
              },
            })

            if (!sourceStock) {
              console.log(`      ⚠️  No stock record - creating with 0 balance`)
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

            console.log(`      Stock: ${currentQty} → ${newQty}`)

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
                quantity: -quantity,
                balanceQty: newQty,
                referenceType: 'stock_transfer',
                referenceId: transfer.id,
                createdBy: transfer.sentBy || transfer.createdBy,
                notes: `CORRECTIVE ACTION: Transfer ${transfer.transferNumber} (transaction failure recovery)`,
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
                createdByName: `System (Emergency Fix)`,
                reason: `EMERGENCY CORRECTIVE ACTION: Recovered from transaction timeout failure - Transfer ${transfer.transferNumber} stock deduction`,
              },
            })

            results.push({
              productName: product?.name,
              variationName: variation?.name,
              quantity,
              newBalance: newQty,
            })

            console.log(`      ✅ Fixed`)
          }

          return results
        },
        {
          timeout: 180000, // 3 minutes for large transfers
          maxWait: 30000,
        }
      )

      console.log(`   ✅ Successfully fixed ${result.length} items`)
      totalFixed += result.length
    } catch (error: any) {
      console.error(`   ❌ Failed to fix ${transfer.transferNumber}:`, error.message)
      console.error(`   Continuing with next transfer...`)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\n✅ EMERGENCY FIX COMPLETE!`)
  console.log(`   Fixed ${totalFixed} items across ${transfersToFix.length} transfers`)
  console.log(`\n⚠️  IMPORTANT: Review your inventory reports to verify accuracy!`)
  console.log(`⚠️  Some transfers may have been completed without proper deductions`)
  console.log(`⚠️  You may need to adjust destination stock if duplicates were created\n`)
}

fixAllPartialTransfers()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
