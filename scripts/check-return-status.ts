import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkStatus() {
  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { returnNumber: 'RET-000001' },
    include: {
      debitNotes: true,
    },
  })

  if (!purchaseReturn) {
    console.log('❌ Return not found')
    return
  }

  console.log('\n📋 Purchase Return Status:\n')
  console.log(`   Return Number: ${purchaseReturn.returnNumber}`)
  console.log(`   Status: ${purchaseReturn.status}`)
  console.log(`   Approved By: ${purchaseReturn.approvedBy || 'N/A'}`)
  console.log(`   Approved At: ${purchaseReturn.approvedAt ? new Date(purchaseReturn.approvedAt).toLocaleString() : 'N/A'}`)
  console.log(`   Debit Notes: ${purchaseReturn.debitNotes.length}`)

  if (purchaseReturn.debitNotes.length > 0) {
    console.log('\n💰 Debit Notes:')
    purchaseReturn.debitNotes.forEach(dn => {
      console.log(`   - ${dn.debitNoteNumber}: ₱${dn.amount} (${dn.status})`)
    })
  }

  // Check inventory for the items
  const items = await prisma.purchaseReturnItem.findMany({
    where: { purchaseReturnId: purchaseReturn.id },
    include: {
      product: true,
      productVariation: true,
    },
  })

  console.log('\n📦 Items & Current Inventory:\n')
  for (const item of items) {
    const inventory = await prisma.inventory.findFirst({
      where: {
        businessId: purchaseReturn.businessId,
        locationId: purchaseReturn.locationId,
        productId: item.productId,
        productVariationId: item.productVariationId,
      },
    })

    console.log(`   ${item.product.name}`)
    console.log(`      Returned Qty: ${item.quantityReturned}`)
    console.log(`      Current Stock: ${inventory?.quantity || 0}`)
    console.log('')
  }

  await prisma.$disconnect()
}

checkStatus().catch(console.error)
