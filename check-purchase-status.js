const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPurchaseStatus() {
  try {
    console.log('Checking Purchase Orders and GRN status...\n')

    // Get all purchases with their receipts
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseOrderNumber: {
          in: ['PO-202510-0001', 'PO-202510-0002', 'PO-202510-0004']
        }
      },
      include: {
        items: true,
        receipts: {
          where: {
            status: 'approved'
          }
        },
        accountsPayable: true,
      }
    })

    for (const po of purchases) {
      console.log(`\n=== ${po.purchaseOrderNumber} ===`)
      console.log(`Status: ${po.status}`)
      console.log(`Total Amount: ${po.totalAmount}`)
      console.log(`Items: ${po.items.length}`)
      console.log(`Approved GRNs: ${po.receipts.length}`)

      // Check if all items are fully received
      let allItemsReceived = true
      for (const item of po.items) {
        const received = parseFloat(item.quantityReceived.toString())
        const ordered = parseFloat(item.quantity.toString())
        const pending = ordered - received

        console.log(`  - Product ID ${item.productId}: Ordered ${ordered}, Received ${received}, Pending ${pending}`)

        if (received < ordered) {
          allItemsReceived = false
        }
      }

      console.log(`All items fully received: ${allItemsReceived ? 'YES' : 'NO'}`)
      console.log(`Accounts Payable exists: ${po.accountsPayable.length > 0 ? 'YES' : 'NO'}`)

      if (po.accountsPayable.length > 0) {
        console.log(`AP Invoice: ${po.accountsPayable[0].invoiceNumber}`)
        console.log(`AP Balance: ${po.accountsPayable[0].balanceAmount}`)
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPurchaseStatus()
