const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking GRN Serial Numbers ===\n')

  // Get recent GRNs
  const receipts = await prisma.purchaseReceipt.findMany({
    where: { businessId: 1 },
    include: {
      items: true,
      purchase: {
        select: {
          purchaseOrderNumber: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log(`Found ${receipts.length} recent GRNs:\n`)

  receipts.forEach(receipt => {
    console.log(`📄 ${receipt.receiptNumber} (Status: ${receipt.status})`)
    console.log(`   PO: ${receipt.purchase.purchaseOrderNumber}`)
    console.log(`   Items: ${receipt.items.length}`)

    receipt.items.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}:`)
      console.log(`     - Quantity Received: ${item.quantityReceived}`)
      console.log(`     - Serial Numbers:`, item.serialNumbers)
    })
    console.log('')
  })

  // Check if serials are in ProductSerialNumber table
  console.log('\n=== Checking ProductSerialNumber Table ===\n')
  const serialsInDb = await prisma.productSerialNumber.findMany({
    where: { businessId: 1 },
    take: 10,
    orderBy: { createdAt: 'desc' }
  })

  console.log(`Found ${serialsInDb.length} serial numbers in database (showing last 10):`)
  serialsInDb.forEach(sn => {
    console.log(`  - ${sn.serialNumber} (Status: ${sn.status}, Receipt ID: ${sn.purchaseReceiptId || 'NULL'})`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)
