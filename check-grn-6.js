const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkGRN6() {
  try {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id: 6 },
      include: {
        purchase: true,
        items: {
          include: {
            purchaseItem: true,
          },
        },
      },
    })

    console.log('=== GRN-6 Details ===\n')
    console.log('Receipt Number:', receipt.receiptNumber)
    console.log('Status:', receipt.status)
    console.log('Purchase ID:', receipt.purchaseId)
    console.log('Has Purchase Object:', receipt.purchase ? 'YES' : 'NO')

    if (receipt.purchase) {
      console.log('Purchase Order Number:', receipt.purchase.purchaseOrderNumber)
    }

    console.log('\nItems:')
    receipt.items.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Product ${item.productId}, Variation ${item.productVariationId}`)
      console.log(`     Quantity: ${item.quantityReceived}`)
      console.log(`     Has PurchaseItem:', ${item.purchaseItem ? 'YES' : 'NO'}`)
    })

    console.log('\n=== Issue ===')
    if (!receipt.purchase) {
      console.log('❌ This is a DIRECT ENTRY GRN (No PO)')
      console.log('The approval code expects receipt.purchase to exist!')
      console.log('This causes the error when trying to access receipt.purchase.items')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkGRN6()
