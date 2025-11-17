/**
 * Fix Stock History Supplier Names
 *
 * Updates ProductHistory records for purchase transactions to display
 * supplier name instead of the approving user's name in the createdByName field.
 *
 * This script:
 * 1. Finds all ProductHistory records where transactionType = 'PURCHASE_RECEIPT'
 * 2. Looks up the associated PurchaseReceipt to get the supplier
 * 3. Updates the createdByName field to show the supplier name
 *
 * Run with: npx tsx scripts/fix-stock-history-supplier-names.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixStockHistorySupplierNames() {
  console.log('🔧 Starting Stock History Supplier Name Fix...\n')

  try {
    // Find all purchase receipt transactions
    const purchaseHistoryRecords = await prisma.productHistory.findMany({
      where: {
        transactionType: 'purchase',
        referenceType: 'purchase',
      },
    })

    console.log(`📦 Found ${purchaseHistoryRecords.length} purchase history records to check\n`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const record of purchaseHistoryRecords) {
      try {
        // Use referenceId to look up the purchase receipt
        const receiptId = record.referenceId

        if (!receiptId) {
          console.log(`⚠️  No reference ID for record ${record.id}`)
          skippedCount++
          continue
        }

        // Look up by receipt ID
        const receipt = await prisma.purchaseReceipt.findFirst({
          where: {
            id: receiptId,
            businessId: record.businessId,
          },
          include: {
            supplier: {
              select: { name: true }
            },
            purchase: {
              include: {
                supplier: {
                  select: { name: true }
                }
              }
            }
          }
        })

        if (receipt) {
          const supplierName = receipt.purchase?.supplier?.name || receipt.supplier?.name

          if (supplierName && record.createdByName !== supplierName) {
            // Update the createdByName to supplier name
            await prisma.productHistory.update({
              where: { id: record.id },
              data: { createdByName: supplierName }
            })

            console.log(`✅ Updated: ${receipt.receiptNumber} (Record ID: ${record.id})`)
            console.log(`   Old: ${record.createdByName} → New: ${supplierName}\n`)
            updatedCount++
          } else if (record.createdByName === supplierName) {
            console.log(`⏭️  Already correct: ${receipt.receiptNumber} (already showing ${supplierName})`)
            skippedCount++
          } else {
            console.log(`⚠️  No supplier found for receipt ID: ${receiptId}`)
            skippedCount++
          }
        } else {
          console.log(`⚠️  Receipt not found for ID: ${receiptId}`)
          skippedCount++
        }
      } catch (error: any) {
        console.error(`❌ Error processing record ${record.id}:`, error.message)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Summary:')
    console.log('='.repeat(60))
    console.log(`✅ Updated: ${updatedCount} records`)
    console.log(`⏭️  Skipped: ${skippedCount} records`)
    console.log(`❌ Errors: ${errorCount} records`)
    console.log('='.repeat(60))

    if (updatedCount > 0) {
      console.log('\n✨ Stock history has been updated!')
      console.log('   Navigate to /dashboard/reports/stock-history-v3 to verify')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixStockHistorySupplierNames()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
