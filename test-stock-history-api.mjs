import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testStockHistory() {
  const productId = 306
  const variationId = 306
  const locationId = 2
  const businessId = 1

  console.log('=== Testing Stock History Query ===\n')

  try {
    // Test Purchase Receipts
    const purchaseReceipts = await prisma.purchaseReceipt.findMany({
      where: {
        businessId,
        locationId,
        status: 'approved',
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        supplier: { select: { name: true } }
      }
    })
    console.log('Purchase Receipts:', purchaseReceipts.length)
    console.log('  With matching items:', purchaseReceipts.filter(pr => pr.items.length > 0).length)

    // Test Transfers Out
    const transfersOut = await prisma.stockTransfer.findMany({
      where: {
        businessId,
        fromLocationId: locationId,
        stockDeducted: true,
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        }
      }
    })
    console.log('\nTransfers Out:', transfersOut.length)
    console.log('  With matching items:', transfersOut.filter(t => t.items.length > 0).length)

    // Test Product History
    const productHistory = await prisma.productHistory.findMany({
      where: {
        businessId,
        locationId,
        productId,
        productVariationId: variationId,
        transactionType: {
          notIn: ['purchase', 'sale', 'transfer_in', 'transfer_out', 'purchase_return', 'customer_return']
        }
      }
    })
    console.log('\nProduct History:', productHistory.length)
    productHistory.forEach(h => {
      console.log(`  - ${h.transactionType}: ${h.quantityChange} units`)
    })

  } catch (error) {
    console.error('ERROR:', error.message)
    console.error(error)
  }
}

testStockHistory()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
