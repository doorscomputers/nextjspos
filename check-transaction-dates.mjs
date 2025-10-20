import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDates() {
  const productId = 306
  const variationId = 306
  const locationId = 2
  const businessId = 1

  console.log('=== Checking Transaction Dates ===\n')

  // Purchase Receipts
  const purchaseReceipts = await prisma.purchaseReceipt.findMany({
    where: {
      businessId,
      locationId,
      status: 'approved',
    },
    include: {
      items: {
        where: { productId, productVariationId: variationId }
      }
    }
  })

  console.log('Purchase Receipts:')
  purchaseReceipts.forEach(pr => {
    if (pr.items.length > 0) {
      console.log(`  - ${pr.receiptNumber}: approvedAt = ${pr.approvedAt}`)
    }
  })

  // Transfers Out
  const transfersOut = await prisma.stockTransfer.findMany({
    where: {
      businessId,
      fromLocationId: locationId,
      stockDeducted: true,
    },
    include: {
      items: {
        where: { productId, productVariationId: variationId }
      }
    }
  })

  console.log('\nTransfers Out:')
  transfersOut.forEach(t => {
    if (t.items.length > 0) {
      console.log(`  - ${t.transferNumber}: sentAt = ${t.sentAt}, status = ${t.status}`)
    }
  })

  // Product History
  const productHistory = await prisma.productHistory.findMany({
    where: {
      businessId,
      locationId,
      productId,
      productVariationId: variationId,
    }
  })

  console.log('\nProduct History:')
  productHistory.forEach(h => {
    console.log(`  - ${h.transactionType}: transactionDate = ${h.transactionDate}`)
  })
}

checkDates()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
