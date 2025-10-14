/**
 * Automatic Transaction Cleanup Script (No Prompts)
 *
 * Use this for automated testing - skips all confirmation prompts
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanupTransactions() {
  console.log('\n' + '='.repeat(60))
  console.log('  🧹 AUTO CLEANUP - NO PROMPTS')
  console.log('='.repeat(60))
  console.log('\n⚠️  Deleting ALL transactions automatically...\n')

  const deletionOrder = [
    // Order matters due to foreign key constraints

    { name: 'Cashier Shifts', model: 'cashierShift' },
    { name: 'Bank Transactions', model: 'bankTransaction' },
    { name: 'Payments', model: 'payment' },
    { name: 'Accounts Payable', model: 'accountsPayable' },
    { name: 'Serial Number Movements', model: 'serialNumberMovement' },
    { name: 'Product Serial Numbers', model: 'productSerialNumber' },
    { name: 'Customer Return Items', model: 'customerReturnItem' },
    { name: 'Customer Returns', model: 'customerReturn' },
    { name: 'Purchase Return Items', model: 'purchaseReturnItem' },
    { name: 'Purchase Returns', model: 'purchaseReturn' },
    { name: 'Sale Payments', model: 'salePayment' },
    { name: 'Sale Items', model: 'saleItem' },
    { name: 'Sales', model: 'sale' },
    { name: 'Stock Transfer Items', model: 'stockTransferItem' },
    { name: 'Stock Transfers', model: 'stockTransfer' },
    { name: 'Inventory Corrections', model: 'inventoryCorrection' },
    { name: 'Purchase Receipt Items', model: 'purchaseReceiptItem' },
    { name: 'Purchase Receipts', model: 'purchaseReceipt' },
    { name: 'Purchase Items', model: 'purchaseItem' },
    { name: 'Purchase Amendments', model: 'purchaseAmendment' },
    { name: 'Purchase Orders', model: 'purchase' },
  ]

  let totalDeleted = 0

  console.log('🗑️  Deleting transactions...\n')

  for (const { name, model } of deletionOrder) {
    try {
      const count = await prisma[model].count()
      if (count > 0) {
        await prisma[model].deleteMany({})
        console.log(`  ✓ Deleted ${count.toLocaleString()} ${name}`)
        totalDeleted += count
      } else {
        console.log(`  ○ Skipped ${name} (0 records)`)
      }
    } catch (error) {
      console.error(`  ✗ Error deleting ${name}:`, error.message)
    }
  }

  // Reset inventory levels
  console.log('\n🔄 Resetting inventory levels...')
  const inventoryCount = await prisma.variationLocationDetails.count()
  await prisma.variationLocationDetails.updateMany({
    data: {
      qtyAvailable: 0,
    }
  })
  console.log(`  ✓ Reset ${inventoryCount} inventory records to 0`)

  console.log(`\n📊 TOTAL RECORDS DELETED: ${totalDeleted.toLocaleString()}`)

  // Verify cleanup
  console.log('\n✅ Verification:')
  console.log('================')

  const remaining = {
    purchases: await prisma.purchase.count(),
    receipts: await prisma.purchaseReceipt.count(),
    sales: await prisma.sale.count(),
    transfers: await prisma.stockTransfer.count(),
    corrections: await prisma.inventoryCorrection.count(),
  }

  Object.entries(remaining).forEach(([key, count]) => {
    console.log(`  ${key}: ${count}`)
  })

  const totalRemaining = Object.values(remaining).reduce((sum, count) => sum + count, 0)

  if (totalRemaining === 0) {
    console.log('\n✅ SUCCESS: All transactions cleaned!')
  } else {
    console.log(`\n⚠️  WARNING: ${totalRemaining} transactions still remain`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('  ✅ CLEANUP COMPLETED')
  console.log('='.repeat(60))
  console.log('\nReady for testing with clean data!\n')
}

cleanupTransactions()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
