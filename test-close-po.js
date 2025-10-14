const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testClosePO() {
  try {
    console.log('=== Testing Close PO Feature ===\n')

    // 1. Check current status of PO-202510-0004
    console.log('BEFORE CLOSING:')
    const poBefore = await prisma.purchase.findFirst({
      where: {
        purchaseOrderNumber: 'PO-202510-0004'
      },
      include: {
        items: true,
        accountsPayable: true,
      }
    })

    if (!poBefore) {
      console.log('❌ PO-202510-0004 not found!')
      return
    }

    console.log(`PO Number: ${poBefore.purchaseOrderNumber}`)
    console.log(`Status: ${poBefore.status}`)
    console.log(`Total Amount: ${poBefore.totalAmount}`)
    console.log(`Accounts Payable exists: ${poBefore.accountsPayable.length > 0 ? 'YES' : 'NO'}`)

    console.log('\nItems:')
    poBefore.items.forEach((item, idx) => {
      const ordered = parseFloat(item.quantity.toString())
      const received = parseFloat(item.quantityReceived.toString())
      const pending = ordered - received
      console.log(`  ${idx + 1}. Product ${item.productId}: ${received}/${ordered} (${pending} pending)`)
    })

    // 2. Simulate closing via API (we'll do this manually via UI)
    console.log('\n\n=== Instructions ===')
    console.log('1. Navigate to: http://localhost:3000/dashboard/purchases/' + poBefore.id)
    console.log('2. You should see an orange "Close PO (Partial Delivery)" button')
    console.log('3. Click it and enter reason: "Supplier confirmed remaining 1 item out of stock"')
    console.log('4. After closing, check Accounts Payable page - you should now see 3 entries')

    console.log('\n\n=== What will happen when you close: ===')

    // Calculate what the final amount will be
    let actualAmount = 0
    poBefore.items.forEach((item) => {
      const received = parseFloat(item.quantityReceived.toString())
      const unitCost = parseFloat(item.unitCost.toString())
      actualAmount += received * unitCost
    })

    const originalSubtotal = parseFloat(poBefore.subtotal.toString())
    const proportionReceived = originalSubtotal > 0 ? actualAmount / originalSubtotal : 0

    const proportionalTax = parseFloat(poBefore.taxAmount.toString()) * proportionReceived
    const proportionalDiscount = parseFloat(poBefore.discountAmount.toString()) * proportionReceived
    const proportionalShipping = parseFloat(poBefore.shippingCost.toString()) * proportionReceived

    const finalAmount = actualAmount + proportionalTax - proportionalDiscount + proportionalShipping

    console.log(`Original PO Total: ₱${parseFloat(poBefore.totalAmount.toString()).toFixed(2)}`)
    console.log(`New Total (based on received qty): ₱${finalAmount.toFixed(2)}`)
    console.log(`Proportion Received: ${Math.round(proportionReceived * 100)}%`)
    console.log(`AP Entry will be created for: ₱${finalAmount.toFixed(2)}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testClosePO()
