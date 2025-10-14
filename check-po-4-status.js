const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPO4() {
  try {
    const po = await prisma.purchase.findUnique({
      where: { id: 4 },
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        totalAmount: true,
        subtotal: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            quantityReceived: true,
          }
        },
        accountsPayable: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          }
        }
      }
    })

    console.log('PO-4 Current Status:')
    console.log(JSON.stringify(po, null, 2))

    if (po) {
      console.log('\n=== Analysis ===')
      console.log(`Status: ${po.status}`)
      console.log(`Has AP Entry: ${po.accountsPayable.length > 0 ? 'YES' : 'NO'}`)

      console.log('\nItems:')
      po.items.forEach((item, idx) => {
        const ordered = parseFloat(item.quantity.toString())
        const received = parseFloat(item.quantityReceived.toString())
        const pending = ordered - received
        console.log(`  ${idx + 1}. Product ${item.productId}: ${received}/${ordered} (${pending} pending)`)
      })

      const allReceived = po.items.every(item => {
        const ordered = parseFloat(item.quantity.toString())
        const received = parseFloat(item.quantityReceived.toString())
        return received >= ordered
      })

      console.log(`\nAll items received: ${allReceived ? 'YES' : 'NO'}`)
      console.log(`\nClose PO button should be visible: ${po.status === 'partially_received' ? 'YES' : 'NO (status is not partially_received)'}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPO4()
