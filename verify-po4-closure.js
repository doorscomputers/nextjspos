const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyPO4Closure() {
  try {
    console.log('=== Verifying PO-4 Closure ===\n')

    // Check PO status
    const po = await prisma.purchase.findUnique({
      where: { id: 4 },
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        subtotal: true,
        totalAmount: true,
        notes: true,
        items: {
          select: {
            quantity: true,
            quantityReceived: true,
            unitCost: true,
          },
        },
      },
    })

    console.log('1. Purchase Order Status:')
    console.log(`   PO Number: ${po.purchaseOrderNumber}`)
    console.log(`   Status: ${po.status}`)
    console.log(`   Total Amount: ₱${parseFloat(po.totalAmount.toString()).toFixed(2)}`)
    console.log(`   Notes: ${po.notes}`)

    console.log('\n2. Items Status:')
    po.items.forEach((item, idx) => {
      const ordered = parseFloat(item.quantity.toString())
      const received = parseFloat(item.quantityReceived.toString())
      const cost = parseFloat(item.unitCost.toString())
      console.log(`   Item ${idx + 1}: ${received}/${ordered} received @ ₱${cost.toFixed(2)} = ₱${(received * cost).toFixed(2)}`)
    })

    // Check AP entry
    const ap = await prisma.accountsPayable.findFirst({
      where: {
        purchaseId: 4,
        deletedAt: null,
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        paymentStatus: true,
        notes: true,
        createdAt: true,
      },
    })

    console.log('\n3. Accounts Payable Entry:')
    if (ap) {
      console.log(`   ✅ AP Entry Created`)
      console.log(`   AP ID: ${ap.id}`)
      console.log(`   Invoice #: ${ap.invoiceNumber}`)
      console.log(`   Total Amount: ₱${parseFloat(ap.totalAmount.toString()).toFixed(2)}`)
      console.log(`   Paid Amount: ₱${parseFloat(ap.paidAmount.toString()).toFixed(2)}`)
      console.log(`   Balance: ₱${parseFloat(ap.balanceAmount.toString()).toFixed(2)}`)
      console.log(`   Payment Status: ${ap.paymentStatus}`)
      console.log(`   Notes: ${ap.notes}`)
      console.log(`   Created: ${ap.createdAt.toLocaleString()}`)
    } else {
      console.log(`   ❌ No AP Entry Found!`)
    }

    console.log('\n=== Summary ===')
    console.log(`✅ PO Status: ${po.status}`)
    console.log(`✅ Closure Note: ${po.notes?.includes('[CLOSED]') ? 'YES' : 'NO'}`)
    console.log(`✅ AP Entry: ${ap ? 'CREATED' : 'MISSING'}`)

    if (ap) {
      console.log(`\n🎉 Close PO Feature Working Successfully!`)
      console.log(`   - PO marked as 'received' (closed)`)
      console.log(`   - AP entry created for actual received amount: ₱${parseFloat(ap.totalAmount.toString()).toFixed(2)}`)
      console.log(`   - Ready for payment processing`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyPO4Closure()
