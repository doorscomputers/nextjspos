import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function testReturnApproval() {
  console.log('🔍 Testing Purchase Return Approval...\n')

  try {
    // Find RET-000001
    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: {
        returnNumber: 'RET-000001',
      },
      include: {
        supplier: true,
        purchaseReceipt: {
          include: {
            purchase: true,
          },
        },
        items: {
          include: {
            purchaseReceiptItem: true,
            product: true,
            productVariation: true,
          },
        },
      },
    })

    if (!purchaseReturn) {
      console.log('❌ RET-000001 not found')
      return
    }

    console.log(`✅ Found ${purchaseReturn.returnNumber}`)
    console.log(`   Status: ${purchaseReturn.status}`)
    console.log(`   Location ID: ${purchaseReturn.locationId}`)
    console.log(`   Supplier: ${purchaseReturn.supplier.name}`)
    console.log(`   Total Amount: ₱${purchaseReturn.totalAmount}`)
    console.log(`   Items: ${purchaseReturn.items.length}\n`)

    // Check each item's current inventory before approval
    console.log('📦 Current Inventory Before Approval:\n')
    console.log(`   Total items in return: ${purchaseReturn.items.length}`)

    if (!purchaseReturn.items || purchaseReturn.items.length === 0) {
      console.log('   ⚠️  No items found in return!')
      return
    }

    for (const item of purchaseReturn.items) {
      console.log(`   Processing item ID: ${item.id}`)
      const inventory = await prisma.inventory.findFirst({
        where: {
          businessId: purchaseReturn.businessId,
          locationId: purchaseReturn.locationId,
          productId: item.productId,
          productVariationId: item.productVariationId,
        },
      })

      console.log(`   ${item.product?.name || `Product ${item.productId}`}`)
      console.log(`   Current Qty: ${inventory?.quantity || 0}`)
      console.log(`   Qty to Return: ${item.quantityReturned}`)
      console.log(`   Expected After: ${(inventory?.quantity || 0) - item.quantityReturned}\n`)
    }

    // Check if there's enough inventory
    console.log('⚠️  Validation Checks:\n')
    for (const item of purchaseReturn.items) {
      const inventory = await prisma.inventory.findFirst({
        where: {
          businessId: purchaseReturn.businessId,
          locationId: purchaseReturn.locationId,
          productId: item.productId,
          productVariationId: item.productVariationId,
        },
      })

      const currentQty = inventory?.quantity ? parseFloat(String(inventory.quantity)) : 0
      const returnQty = parseFloat(String(item.quantityReturned))

      if (currentQty < returnQty) {
        console.log(`   ❌ INSUFFICIENT STOCK for ${item.product?.name || `Product ${item.productId}`}`)
        console.log(`      Available: ${currentQty}, Need: ${returnQty}`)
      } else {
        console.log(`   ✅ Sufficient stock for ${item.product?.name || `Product ${item.productId}`}`)
      }
    }

    // Check if accounts payable exists
    if (purchaseReturn.purchaseReceipt.purchaseId) {
      const accountsPayable = await prisma.accountsPayable.findFirst({
        where: {
          businessId: purchaseReturn.businessId,
          purchaseId: purchaseReturn.purchaseReceipt.purchaseId,
        },
      })

      console.log('\n💰 Accounts Payable:')
      if (accountsPayable) {
        console.log(`   ✅ Found AP record`)
        console.log(`   Current Balance: ₱${accountsPayable.balanceAmount}`)
        console.log(`   Return Amount: ₱${purchaseReturn.totalAmount}`)
        console.log(`   New Balance: ₱${Math.max(0, parseFloat(String(accountsPayable.balanceAmount)) - parseFloat(String(purchaseReturn.totalAmount)))}`)
      } else {
        console.log(`   ⚠️  No AP record found for Purchase ID ${purchaseReturn.purchaseReceipt.purchaseId}`)
      }
    }

    console.log('\n📋 Ready to approve? The approval would:')
    console.log('   1. Update return status to "approved"')
    console.log('   2. Reduce inventory by returned quantities')
    console.log('   3. Create debit note')
    console.log('   4. Reduce accounts payable balance')
    console.log('   5. Mark serial numbers as returned (if any)')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testReturnApproval().catch(console.error)
