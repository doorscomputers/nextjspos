import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking ALL transaction sources for Product 306 ===\n')

  // 1. Product History (opening stock, etc.)
  const productHistory = await prisma.productHistory.findMany({
    where: { productId: 306, locationId: 1 },
    orderBy: { createdAt: 'asc' }
  })
  console.log(`1. Product History: ${productHistory.length} records`)
  productHistory.forEach(r => {
    console.log(`   - ${r.transactionType}: ${r.quantityChange} units (${r.referenceNumber || r.reason})`)
  })

  // 2. Purchase Receipts
  const purchaseReceipts = await prisma.purchaseReceipt.findMany({
    where: { locationId: 1, status: 'approved' },
    include: {
      items: {
        where: { productId: 306 }
      }
    }
  })
  console.log(`\n2. Purchase Receipts: ${purchaseReceipts.filter(pr => pr.items.length > 0).length} records`)
  purchaseReceipts.forEach(pr => {
    if (pr.items.length > 0) {
      pr.items.forEach(item => {
        console.log(`   - ${pr.receiptNumber}: ${item.quantityReceived} units`)
      })
    }
  })

  // 3. Stock Transfers OUT (from location 1)
  const transfersOut = await prisma.stockTransfer.findMany({
    where: { fromLocationId: 1, stockDeducted: true },
    include: {
      items: {
        where: { productId: 306 }
      }
    }
  })
  console.log(`\n3. Transfers OUT: ${transfersOut.filter(t => t.items.length > 0).length} records`)
  transfersOut.forEach(t => {
    if (t.items.length > 0) {
      t.items.forEach(item => {
        console.log(`   - ${t.transferNumber}: ${item.quantity} units`)
      })
    }
  })

  // 4. Stock Transfers IN (to location 1)
  const transfersIn = await prisma.stockTransfer.findMany({
    where: { toLocationId: 1, status: 'completed' },
    include: {
      items: {
        where: { productId: 306 }
      }
    }
  })
  console.log(`\n4. Transfers IN: ${transfersIn.filter(t => t.items.length > 0).length} records`)
  transfersIn.forEach(t => {
    if (t.items.length > 0) {
      t.items.forEach(item => {
        console.log(`   - ${t.transferNumber}: ${item.quantity} units`)
      })
    }
  })

  // 5. Inventory Corrections
  const corrections = await prisma.inventoryCorrection.findMany({
    where: { locationId: 1, status: 'approved' },
    include: {
      items: {
        where: { productId: 306 }
      }
    }
  })
  console.log(`\n5. Inventory Corrections: ${corrections.filter(c => c.items.length > 0).length} records`)
  corrections.forEach(c => {
    if (c.items.length > 0) {
      c.items.forEach(item => {
        console.log(`   - ${c.correctionNumber}: ${item.adjustment} units`)
      })
    }
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
