import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function findTestData() {
  console.log('\n🔍 Scanning for test data...\n')

  const results = {
    supplierReturns: [],
    purchaseReceipts: [],
    purchases: [],
    transfers: [],
    products: [],
    suppliers: [],
    customers: [],
    sales: [],
    inventoryCorrections: [],
  }

  // Find test supplier returns
  results.supplierReturns = await prisma.supplierReturn.findMany({
    where: {
      OR: [
        { returnNumber: { contains: 'TEST' } },
        { notes: { contains: 'test', mode: 'insensitive' } },
        { notes: { contains: 'Test' } },
      ],
    },
    include: {
      supplier: { select: { name: true } },
      items: true,
    },
  })

  // Find test purchase receipts (GRNs)
  results.purchaseReceipts = await prisma.purchaseReceipt.findMany({
    where: {
      OR: [
        { receiptNumber: { contains: 'TEST' } },
        { notes: { contains: 'test', mode: 'insensitive' } },
        { notes: { contains: 'Test' } },
      ],
    },
    include: {
      supplier: { select: { name: true } },
      items: true,
    },
  })

  // Find test purchases (POs)
  results.purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        { purchaseOrderNumber: { contains: 'TEST' } },
        { notes: { contains: 'test', mode: 'insensitive' } },
        { notes: { contains: 'Test' } },
      ],
    },
    include: {
      supplier: { select: { name: true } },
      items: true,
    },
  })

  // Find test transfers
  results.transfers = await prisma.stockTransfer.findMany({
    where: {
      OR: [
        { transferNumber: { contains: 'TEST' } },
        { notes: { contains: 'test', mode: 'insensitive' } },
        { notes: { contains: 'Test' } },
      ],
    },
    include: {
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
      items: true,
    },
  })

  // Find DUMMY products
  results.products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'DUMMY' } },
        { name: { contains: 'TEST' } },
        { name: { contains: 'test', mode: 'insensitive' } },
        { sku: { contains: 'DUMMY' } },
        { sku: { contains: 'TEST' } },
      ],
    },
    include: {
      variations: true,
    },
  })

  // Find test suppliers
  results.suppliers = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: { contains: 'TEST' } },
        { name: { contains: 'ADECS' } },
        { name: { contains: 'test', mode: 'insensitive' } },
      ],
    },
  })

  // Find test customers
  results.customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'TEST' } },
        { name: { contains: 'test', mode: 'insensitive' } },
      ],
    },
  })

  // Find test sales
  results.sales = await prisma.sale.findMany({
    where: {
      OR: [
        { invoiceNumber: { contains: 'TEST' } },
        { notes: { contains: 'test', mode: 'insensitive' } },
        { notes: { contains: 'Test' } },
      ],
    },
    include: {
      items: true,
    },
  })

  // Find test inventory corrections
  results.inventoryCorrections = await prisma.inventoryCorrection.findMany({
    where: {
      OR: [
        { reason: { contains: 'test', mode: 'insensitive' } },
        { reason: { contains: 'TEST' } },
      ],
    },
  })

  return results
}

function displayResults(results) {
  let totalItems = 0

  console.log('=' .repeat(80))
  console.log('TEST DATA FOUND:')
  console.log('=' .repeat(80))

  if (results.supplierReturns.length > 0) {
    console.log(`\n📦 Supplier Returns (${results.supplierReturns.length}):`)
    results.supplierReturns.forEach((sr) => {
      console.log(`  - ${sr.returnNumber} | ${sr.supplier.name} | ₱${sr.totalAmount} | ${sr.status} | ${sr.items.length} items`)
      totalItems++
    })
  }

  if (results.purchaseReceipts.length > 0) {
    console.log(`\n📋 Purchase Receipts/GRNs (${results.purchaseReceipts.length}):`)
    results.purchaseReceipts.forEach((grn) => {
      console.log(`  - ${grn.receiptNumber} | ${grn.supplier.name} | ${grn.status} | ${grn.items.length} items`)
      totalItems++
    })
  }

  if (results.purchases.length > 0) {
    console.log(`\n🛒 Purchase Orders (${results.purchases.length}):`)
    results.purchases.forEach((po) => {
      console.log(`  - ${po.purchaseOrderNumber} | ${po.supplier.name} | ₱${po.totalAmount} | ${po.items.length} items`)
      totalItems++
    })
  }

  if (results.transfers.length > 0) {
    console.log(`\n🔄 Transfers (${results.transfers.length}):`)
    results.transfers.forEach((t) => {
      console.log(`  - ${t.transferNumber} | ${t.fromLocation.name} → ${t.toLocation.name} | ${t.items.length} items`)
      totalItems++
    })
  }

  if (results.products.length > 0) {
    console.log(`\n📦 Products (${results.products.length}):`)
    results.products.forEach((p) => {
      console.log(`  - ${p.name} | SKU: ${p.sku} | ${p.variations.length} variations`)
      totalItems++
    })
  }

  if (results.suppliers.length > 0) {
    console.log(`\n🏢 Suppliers (${results.suppliers.length}):`)
    results.suppliers.forEach((s) => {
      console.log(`  - ${s.name} | ${s.mobile || 'No phone'}`)
      totalItems++
    })
  }

  if (results.customers.length > 0) {
    console.log(`\n👥 Customers (${results.customers.length}):`)
    results.customers.forEach((c) => {
      console.log(`  - ${c.name} | ${c.mobile || 'No phone'}`)
      totalItems++
    })
  }

  if (results.sales.length > 0) {
    console.log(`\n💰 Sales (${results.sales.length}):`)
    results.sales.forEach((s) => {
      console.log(`  - ${s.invoiceNumber} | ₱${s.grandTotal} | ${s.items.length} items`)
      totalItems++
    })
  }

  if (results.inventoryCorrections.length > 0) {
    console.log(`\n📊 Inventory Corrections (${results.inventoryCorrections.length}):`)
    results.inventoryCorrections.forEach((ic) => {
      console.log(`  - ID: ${ic.id} | ${ic.type} | Qty: ${ic.quantity}`)
      totalItems++
    })
  }

  console.log('\n' + '=' .repeat(80))
  console.log(`TOTAL TEST RECORDS FOUND: ${totalItems}`)
  console.log('=' .repeat(80))

  return totalItems
}

async function deleteTestData(results) {
  console.log('\n🗑️  Starting deletion process...\n')

  let deletedCount = 0

  // Delete in correct order (child records first)

  // 1. Delete supplier return items
  if (results.supplierReturns.length > 0) {
    const returnIds = results.supplierReturns.map((sr) => sr.id)
    const deletedItems = await prisma.supplierReturnItem.deleteMany({
      where: { supplierReturnId: { in: returnIds } },
    })
    console.log(`✅ Deleted ${deletedItems.count} supplier return items`)

    const deletedReturns = await prisma.supplierReturn.deleteMany({
      where: { id: { in: returnIds } },
    })
    console.log(`✅ Deleted ${deletedReturns.count} supplier returns`)
    deletedCount += deletedReturns.count
  }

  // 2. Delete purchase receipt items and receipts
  if (results.purchaseReceipts.length > 0) {
    const receiptIds = results.purchaseReceipts.map((grn) => grn.id)
    const deletedItems = await prisma.purchaseReceiptItem.deleteMany({
      where: { purchaseReceiptId: { in: receiptIds } },
    })
    console.log(`✅ Deleted ${deletedItems.count} purchase receipt items`)

    const deletedReceipts = await prisma.purchaseReceipt.deleteMany({
      where: { id: { in: receiptIds } },
    })
    console.log(`✅ Deleted ${deletedReceipts.count} purchase receipts`)
    deletedCount += deletedReceipts.count
  }

  // 3. Delete purchase items and purchases
  if (results.purchases.length > 0) {
    const purchaseIds = results.purchases.map((po) => po.id)
    const deletedItems = await prisma.purchaseItem.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    })
    console.log(`✅ Deleted ${deletedItems.count} purchase items`)

    const deletedPurchases = await prisma.purchase.deleteMany({
      where: { id: { in: purchaseIds } },
    })
    console.log(`✅ Deleted ${deletedPurchases.count} purchases`)
    deletedCount += deletedPurchases.count
  }

  // 4. Delete transfer items and transfers
  if (results.transfers.length > 0) {
    const transferIds = results.transfers.map((t) => t.id)
    const deletedItems = await prisma.stockTransferItem.deleteMany({
      where: { stockTransferId: { in: transferIds } },
    })
    console.log(`✅ Deleted ${deletedItems.count} transfer items`)

    const deletedTransfers = await prisma.stockTransfer.deleteMany({
      where: { id: { in: transferIds } },
    })
    console.log(`✅ Deleted ${deletedTransfers.count} transfers`)
    deletedCount += deletedTransfers.count
  }

  // 5. Delete sale items and sales
  if (results.sales.length > 0) {
    const saleIds = results.sales.map((s) => s.id)
    const deletedItems = await prisma.saleItem.deleteMany({
      where: { saleId: { in: saleIds } },
    })
    console.log(`✅ Deleted ${deletedItems.count} sale items`)

    const deletedSales = await prisma.sale.deleteMany({
      where: { id: { in: saleIds } },
    })
    console.log(`✅ Deleted ${deletedSales.count} sales`)
    deletedCount += deletedSales.count
  }

  // 6. Delete inventory corrections
  if (results.inventoryCorrections.length > 0) {
    const deletedCorrections = await prisma.inventoryCorrection.deleteMany({
      where: { id: { in: results.inventoryCorrections.map((ic) => ic.id) } },
    })
    console.log(`✅ Deleted ${deletedCorrections.count} inventory corrections`)
    deletedCount += deletedCorrections.count
  }

  // 7. Delete product variations and products
  if (results.products.length > 0) {
    const productIds = results.products.map((p) => p.id)
    const deletedVariations = await prisma.productVariation.deleteMany({
      where: { productId: { in: productIds } },
    })
    console.log(`✅ Deleted ${deletedVariations.count} product variations`)

    const deletedProducts = await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    })
    console.log(`✅ Deleted ${deletedProducts.count} products`)
    deletedCount += deletedProducts.count
  }

  // 8. Delete suppliers
  if (results.suppliers.length > 0) {
    const deletedSuppliers = await prisma.supplier.deleteMany({
      where: { id: { in: results.suppliers.map((s) => s.id) } },
    })
    console.log(`✅ Deleted ${deletedSuppliers.count} suppliers`)
    deletedCount += deletedSuppliers.count
  }

  // 9. Delete customers
  if (results.customers.length > 0) {
    const deletedCustomers = await prisma.customer.deleteMany({
      where: { id: { in: results.customers.map((c) => c.id) } },
    })
    console.log(`✅ Deleted ${deletedCustomers.count} customers`)
    deletedCount += deletedCustomers.count
  }

  console.log(`\n🎉 Successfully deleted ${deletedCount} test records!\n`)
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('TEST DATA CLEANUP SCRIPT')
    console.log('='.repeat(80))

    // Find all test data
    const results = await findTestData()

    // Display what was found
    const totalItems = displayResults(results)

    if (totalItems === 0) {
      console.log('\n✅ No test data found! Database is clean.\n')
      await prisma.$disconnect()
      rl.close()
      process.exit(0)
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE all the test data listed above!')
    const answer = await question('\nAre you sure you want to continue? (yes/no): ')

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled. No data was deleted.\n')
      await prisma.$disconnect()
      rl.close()
      process.exit(0)
    }

    // Delete the data
    await deleteTestData(results)

    console.log('✅ Cleanup complete! You can now run your own tests with clean data.\n')

    await prisma.$disconnect()
    rl.close()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    await prisma.$disconnect()
    rl.close()
    process.exit(1)
  }
}

main()
