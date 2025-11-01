import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugTransferComplete() {
  try {
    // Get the transfer from the screenshot (TR-202511-0001)
    const transferNumber = 'TR-202511-0001'
    
    console.log(`\n🔍 Debugging Transfer: ${transferNumber}\n`)
    
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        transferNumber: transferNumber,
        deletedAt: null
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            productVariation: { select: { name: true } }
          }
        },
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } }
      }
    })
    
    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }
    
    // Get business workflow mode
    const business = await prisma.business.findUnique({
      where: { id: transfer.businessId },
      select: { transferWorkflowMode: true }
    })
    
    console.log('📦 Transfer Status:', transfer.status)
    console.log('💰 Stock Deducted:', transfer.stockDeducted)
    console.log('📍 From Location:', transfer.fromLocation.name, `(ID: ${transfer.fromLocation.id})`)
    console.log('📍 To Location:', transfer.toLocation.name, `(ID: ${transfer.toLocation.id})`)
    console.log('🔧 Workflow Mode:', business?.transferWorkflowMode || 'full')
    console.log()
    
    console.log('📋 Items:')
    transfer.items.forEach((item, idx) => {
      console.log(`\n  Item ${idx + 1}:`)
      console.log(`    Product: ${item.product.name} - ${item.productVariation.name}`)
      console.log(`    Quantity Sent: ${item.quantity}`)
      console.log(`    Quantity Received: ${item.receivedQuantity}`)
      console.log(`    Verified: ${item.verified}`)
      console.log(`    Has Discrepancy: ${item.hasDiscrepancy}`)
      
      // Check if receivedQuantity is set
      if (!item.receivedQuantity || item.receivedQuantity === '0' || item.receivedQuantity === 0) {
        console.log(`    ⚠️  WARNING: receivedQuantity is ${item.receivedQuantity} (will use quantity ${item.quantity})`)
      }
      
      // Check serial numbers
      if (item.serialNumbersSent) {
        const serialsSent = Array.isArray(item.serialNumbersSent) 
          ? item.serialNumbersSent 
          : JSON.parse(item.serialNumbersSent)
        console.log(`    Serial Numbers Sent: ${serialsSent.length} serials`)
      }
      
      if (item.serialNumbersReceived) {
        const serialsReceived = Array.isArray(item.serialNumbersReceived) 
          ? item.serialNumbersReceived 
          : JSON.parse(item.serialNumbersReceived)
        console.log(`    Serial Numbers Received: ${serialsReceived.length} serials`)
      }
    })
    
    console.log('\n\n✅ Validation Checks:')
    
    // Check 1: Status validation
    const validStatuses = ['in_transit', 'arrived', 'verified', 'verifying']
    if (validStatuses.includes(transfer.status)) {
      console.log(`✓ Status "${transfer.status}" is valid for completion`)
    } else {
      console.log(`❌ Status "${transfer.status}" is NOT valid for completion`)
      console.log(`   Valid statuses: ${validStatuses.join(', ')}`)
    }
    
    // Check 2: All items verified (if status is verified/verifying)
    if (['verified', 'verifying'].includes(transfer.status)) {
      const unverifiedItems = transfer.items.filter(item => !item.verified)
      if (unverifiedItems.length === 0) {
        console.log(`✓ All ${transfer.items.length} items are verified`)
      } else {
        console.log(`❌ ${unverifiedItems.length} items NOT verified:`)
        unverifiedItems.forEach(item => {
          console.log(`   - ${item.product.name} - ${item.productVariation.name}`)
        })
      }
    }
    
    // Check 3: Stock at destination location
    console.log('\n\n📊 Stock at Destination Location:')
    for (const item of transfer.items) {
      const destStock = await prisma.variationLocationDetails.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId
        }
      })
      
      console.log(`\n  ${item.product.name} - ${item.productVariation.name}:`)
      if (destStock) {
        console.log(`    Current Stock: ${destStock.qtyAvailable}`)
        
        const receivedQty = item.receivedQuantity && parseFloat(item.receivedQuantity.toString()) > 0
          ? parseFloat(item.receivedQuantity.toString())
          : parseFloat(item.quantity.toString())
        console.log(`    Will Add: ${receivedQty}`)
        console.log(`    After Completion: ${parseFloat(destStock.qtyAvailable.toString()) + receivedQty}`)
      } else {
        console.log(`    ⚠️  No stock record exists (will be created with qty: ${item.receivedQuantity || item.quantity})`)
      }
    }
    
    // Check 4: Stock at source location
    console.log('\n\n📊 Stock at Source Location (Already Deducted):')
    for (const item of transfer.items) {
      const sourceStock = await prisma.variationLocationDetails.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId
        }
      })
      
      console.log(`\n  ${item.product.name} - ${item.productVariation.name}:`)
      if (sourceStock) {
        console.log(`    Current Stock: ${sourceStock.qtyAvailable}`)
        console.log(`    (Stock was deducted: ${transfer.stockDeducted})`)
      } else {
        console.log(`    ⚠️  No stock record exists at source`)
      }
    }
    
    // Check 5: Serial numbers status
    if (transfer.items.some(item => item.serialNumbersSent)) {
      console.log('\n\n🔢 Serial Numbers Status:')
      for (const item of transfer.items) {
        if (item.serialNumbersSent) {
          const serialIds = Array.isArray(item.serialNumbersSent) 
            ? item.serialNumbersSent 
            : JSON.parse(item.serialNumbersSent)
          
          if (serialIds.length > 0) {
            const serials = await prisma.productSerialNumber.findMany({
              where: { id: { in: serialIds } },
              select: { id: true, serialNumber: true, status: true, currentLocationId: true }
            })
            
            console.log(`\n  ${item.product.name} - ${item.productVariation.name}:`)
            serials.forEach(serial => {
              console.log(`    Serial ${serial.serialNumber}: status=${serial.status}, location=${serial.currentLocationId}`)
            })
            
            const notInTransit = serials.filter(s => s.status !== 'in_transit')
            if (notInTransit.length > 0) {
              console.log(`    ⚠️  WARNING: ${notInTransit.length} serials NOT in "in_transit" status`)
            }
          }
        }
      }
    }
    
    console.log('\n\n💡 Next Steps:')
    console.log('1. Check if all validation checks passed above')
    console.log('2. If any check failed, that is likely the issue')
    console.log('3. Check the server logs (terminal running npm run dev) for detailed error messages')
    console.log('4. Check browser console (F12) for frontend error details')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugTransferComplete()

