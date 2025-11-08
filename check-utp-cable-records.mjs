import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUTPCableRecords() {
  try {
    console.log('\n=== CHECKING SAMPLE UTP CABLE RECORDS ===\n')

    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: 'Sample UTP CABLE' },
        businessId: 1
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    if (!product) {
      console.log('❌ Product not found')
      return
    }

    console.log(`✅ Product: ${product.name} (ID: ${product.id})`)
    const variation = product.variations[0]
    console.log(`✅ Variation: ${variation.name} (ID: ${variation.id})\n`)

    // Check current stock
    console.log('=== CURRENT STOCK (variationLocationDetails) ===')
    for (const vld of variation.variationLocationDetails) {
      console.log(`Location ${vld.locationId}: ${vld.qtyAvailable} units`)
    }

    // Check stock transactions
    console.log('\n=== STOCK TRANSACTIONS ===')
    const stockTxs = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variation.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    if (stockTxs.length === 0) {
      console.log('❌ NO STOCK TRANSACTIONS FOUND!')
    } else {
      for (const tx of stockTxs) {
        console.log(`ID: ${tx.id}, Type: ${tx.type}, Qty: ${tx.quantity}, Balance: ${tx.balanceQty}, Location: ${tx.locationId}, Date: ${tx.createdAt}`)
      }
    }

    // Check product history
    console.log('\n=== PRODUCT HISTORY ===')
    const histories = await prisma.productHistory.findMany({
      where: {
        productVariationId: variation.id
      },
      orderBy: {
        transactionDate: 'desc'
      },
      take: 5
    })

    if (histories.length === 0) {
      console.log('❌ NO PRODUCT HISTORY FOUND!')
    } else {
      for (const hist of histories) {
        console.log(`ID: ${hist.id}, Type: ${hist.transactionType}, Qty Change: ${hist.quantityChange}, Balance: ${hist.balanceQuantity}, Location: ${hist.locationId}, Date: ${hist.transactionDate}`)
      }
    }

    // Check purchase receipts
    console.log('\n=== PURCHASE RECEIPTS ===')
    const receipts = await prisma.purchaseReceipt.findMany({
      where: {
        items: {
          some: {
            productVariationId: variation.id
          }
        }
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3
    })

    if (receipts.length === 0) {
      console.log('❌ NO PURCHASE RECEIPTS FOUND!')
    } else {
      for (const receipt of receipts) {
        console.log(`Receipt: ${receipt.receiptNumber}, Status: ${receipt.status}, Date: ${receipt.receiptDate}`)
        for (const item of receipt.items) {
          if (item.productVariationId === variation.id) {
            console.log(`  Item: Qty Received=${item.quantityReceived}`)
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUTPCableRecords()
