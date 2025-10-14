const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTables() {
  try {
    // Try to query the purchase_receipts table
    const count = await prisma.purchaseReceipt.count()
    console.log('✓ purchase_receipts table exists! Count:', count)

    // Try to query the purchase_receipt_items table
    const itemCount = await prisma.purchaseReceiptItem.count()
    console.log('✓ purchase_receipt_items table exists! Count:', itemCount)

    process.exit(0)
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()
