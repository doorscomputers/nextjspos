import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifySupplierReturnApproval() {
  try {
    console.log('🔍 BEFORE APPROVAL - Current State\n')
    console.log('='.repeat(80))

    // Find the supplier return
    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        returnNumber: 'SR-202510-0001',
      },
      include: {
        items: true,
        supplier: true,
      },
    })

    if (!supplierReturn) {
      console.log('❌ Supplier return not found!')
      return
    }

    // Fetch location separately
    const location = await prisma.businessLocation.findUnique({
      where: { id: supplierReturn.locationId },
    })

    console.log(`\n📦 SUPPLIER RETURN DETAILS:`)
    console.log(`   Return #: ${supplierReturn.returnNumber}`)
    console.log(`   Status: ${supplierReturn.status}`)
    console.log(`   Supplier: ${supplierReturn.supplier.name}`)
    console.log(`   Location: ${location?.name || 'Unknown'}`)
    console.log(`   Total Amount: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log(`   Items: ${supplierReturn.items.length}`)

    // Get product details
    const item = supplierReturn.items[0]

    // Fetch product info separately
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    })

    const variation = await prisma.productVariation.findUnique({
      where: { id: item.productVariationId },
    })

    console.log(`\n📊 ITEM DETAILS:`)
    console.log(`   Product: ${product?.name || 'Unknown'}`)
    console.log(`   Variation: ${variation?.name || 'Default'}`)
    console.log(`   Variation ID: ${item.productVariationId}`)
    console.log(`   Quantity to return: ${item.quantity}`)
    console.log(`   Unit Cost: ₱${Number(item.unitCost).toFixed(2)}`)
    console.log(`   Condition: ${item.condition}`)

    // Check current stock
    const currentStock = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: item.productVariationId,
        locationId: supplierReturn.locationId,
      },
    })

    console.log(`\n📦 CURRENT INVENTORY:`)
    if (currentStock) {
      console.log(`   Current Stock: ${Number(currentStock.qtyAvailable)} units`)
      console.log(`   After approval: ${Number(currentStock.qtyAvailable) - Number(item.quantity)} units`)
    } else {
      console.log(`   ⚠️  No stock record found (qty: 0)`)
    }

    // Check existing product history
    const existingHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: item.productVariationId,
        locationId: supplierReturn.locationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    console.log(`\n📜 EXISTING PRODUCT HISTORY: ${existingHistory.length} records`)
    if (existingHistory.length > 0) {
      console.log(`   Latest record:`)
      const latest = existingHistory[0]
      console.log(`   - Type: ${latest.transactionType}`)
      console.log(`   - Quantity: ${Number(latest.quantityChange)}`)
      console.log(`   - Balance: ${Number(latest.balanceQuantity)}`)
      console.log(`   - Date: ${latest.transactionDate.toLocaleDateString()}`)
    }

    // Check existing stock transactions (ledger)
    const existingTransactions = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: item.productVariationId,
        locationId: supplierReturn.locationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    console.log(`\n💼 EXISTING STOCK TRANSACTIONS (LEDGER): ${existingTransactions.length} records`)
    if (existingTransactions.length > 0) {
      console.log(`   Latest transaction:`)
      const latest = existingTransactions[0]
      console.log(`   - Type: ${latest.type}`)
      console.log(`   - Quantity: ${Number(latest.quantity)}`)
      console.log(`   - Balance: ${Number(latest.balanceQty)}`)
      console.log(`   - Date: ${latest.createdAt.toLocaleDateString()}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n🎯 WHAT WILL HAPPEN WHEN YOU APPROVE:\n')
    console.log('   1. ✅ Create Stock Transaction (Ledger):')
    console.log(`      - Type: SUPPLIER_RETURN`)
    console.log(`      - Quantity: -${item.quantity}`)
    console.log(`      - Reference: supplier_return #${supplierReturn.id}`)

    console.log('\n   2. ✅ Create Product History:')
    console.log(`      - Transaction Type: SUPPLIER_RETURN`)
    console.log(`      - Quantity Change: -${item.quantity}`)
    if (currentStock) {
      console.log(`      - New Balance: ${Number(currentStock.qtyAvailable) - Number(item.quantity)}`)
    }
    console.log(`      - Unit Cost: ₱${Number(item.unitCost).toFixed(2)}`)

    console.log('\n   3. ✅ Update Inventory:')
    if (currentStock) {
      console.log(`      - Old Quantity: ${Number(currentStock.qtyAvailable)}`)
      console.log(`      - New Quantity: ${Number(currentStock.qtyAvailable) - Number(item.quantity)}`)
    }

    console.log('\n   4. ✅ Update Serial Numbers (if any):')
    console.log(`      - Status: in_stock → supplier_return`)
    console.log(`      - Location: Cleared`)

    console.log('\n   5. ✅ Update Return Status:')
    console.log(`      - Status: pending → approved`)

    console.log('\n' + '='.repeat(80))
    console.log('\n💡 TO APPROVE:')
    console.log('   1. Go to http://localhost:3000/dashboard/supplier-returns')
    console.log('   2. Click the eye icon (👁️) on the return')
    console.log('   3. Click "Approve Return" button')
    console.log('   4. Confirm the approval')
    console.log('\n   Then run this script again to see the changes!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifySupplierReturnApproval()
