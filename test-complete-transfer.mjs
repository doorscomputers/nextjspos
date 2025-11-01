import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCompleteTransfer() {
  try {
    const transferNumber = 'TR-202511-0001'
    
    console.log(`\n🔍 Testing Complete Transfer: ${transferNumber}\n`)
    
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        transferNumber: transferNumber,
        deletedAt: null
      },
      include: {
        items: true
      }
    })
    
    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }
    
    console.log('Transfer ID:', transfer.id)
    console.log('Status:', transfer.status)
    console.log('Business ID:', transfer.businessId)
    
    // Simulate what the complete endpoint does
    console.log('\n\n🔄 Simulating Complete Endpoint Logic:\n')
    
    // Step 1: Check status
    const validStatuses = ['in_transit', 'arrived', 'verified', 'verifying']
    console.log(`1. Status Check: "${transfer.status}" in [${validStatuses.join(', ')}]`)
    if (validStatuses.includes(transfer.status)) {
      console.log('   ✓ PASS')
    } else {
      console.log('   ❌ FAIL')
      return
    }
    
    // Step 2: Check all items verified
    if (['verified', 'verifying'].includes(transfer.status)) {
      const unverifiedItems = transfer.items.filter(item => !item.verified)
      console.log(`2. Verification Check: ${transfer.items.length - unverifiedItems.length}/${transfer.items.length} items verified`)
      if (unverifiedItems.length === 0) {
        console.log('   ✓ PASS')
      } else {
        console.log('   ❌ FAIL - Unverified items:', unverifiedItems.map(i => i.id))
        return
      }
    }
    
    // Step 3: Try to update stock at destination
    console.log('\n3. Stock Operations:')
    
    for (const item of transfer.items) {
      const receivedQtyValue = item.receivedQuantity
        ? parseFloat(item.receivedQuantity.toString())
        : 0
      const receivedQty = receivedQtyValue > 0
        ? receivedQtyValue
        : parseFloat(item.quantity.toString())
      
      console.log(`\n   Item: Product ${item.productId}, Variation ${item.productVariationId}`)
      console.log(`   Quantity to add: ${receivedQty}`)
      
      // Get destination stock
      const destStock = await prisma.variationLocationDetails.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId
        }
      })
      
      if (destStock) {
        console.log(`   Current stock at destination: ${destStock.qtyAvailable}`)
        const newQty = parseFloat(destStock.qtyAvailable.toString()) + receivedQty
        console.log(`   New stock after completion: ${newQty}`)
        console.log('   ✓ Stock record exists')
      } else {
        console.log('   ⚠️  Stock record does not exist (will be created)')
      }
    }
    
    // Step 4: Test InventoryImpactTracker
    console.log('\n\n4. Testing InventoryImpactTracker:')
    try {
      // Import the tracker
      const { InventoryImpactTracker } = await import('./src/lib/inventory-impact-tracker.ts')
      
      const impactTracker = new InventoryImpactTracker()
      const productVariationIds = transfer.items.map(item => item.productVariationId)
      const locationIds = [transfer.fromLocationId, transfer.toLocationId]
      
      console.log('   Product Variation IDs:', productVariationIds)
      console.log('   Location IDs:', locationIds)
      
      await impactTracker.captureBefore(productVariationIds, locationIds)
      console.log('   ✓ InventoryImpactTracker.captureBefore() succeeded')
    } catch (error) {
      console.log('   ❌ InventoryImpactTracker ERROR:', error.message)
      console.log('   Full error:', error)
    }
    
    console.log('\n\n💡 Summary:')
    console.log('If all checks passed above, the issue might be:')
    console.log('1. SOD (Separation of Duties) validation failing')
    console.log('2. User permissions issue')
    console.log('3. User location access issue')
    console.log('4. Database constraint or trigger')
    console.log('\nTo test manually, try:')
    console.log(`curl -X POST http://localhost:3000/api/transfers/${transfer.id}/complete \\`)
    console.log(`  -H "Content-Type: application/json" \\`)
    console.log(`  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \\`)
    console.log(`  -d '{}'`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testCompleteTransfer()

