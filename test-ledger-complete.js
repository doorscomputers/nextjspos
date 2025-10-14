/**
 * Complete Inventory Ledger Test
 *
 * This script:
 * 1. Cleans up existing test data
 * 2. Creates fresh transactions for two scenarios
 * 3. Verifies the Inventory Ledger calculations
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BUSINESS_ID = 1;
const LOCATION_ID = 1;
const USER_ID = 1;

// Test products
const MOUSE = {
  productId: 10002,
  variationId: 10002,
  name: 'Logitech MX Master 3 Mouse'
};

const MONITOR = {
  productId: 10004,
  variationId: 10004,
  name: 'Dell 27" UltraSharp Monitor'
};

/**
 * Clean up test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  // Delete corrections
  await prisma.inventoryCorrection.deleteMany({
    where: {
      productVariationId: { in: [MOUSE.variationId, MONITOR.variationId] }
    }
  });

  // Delete sale items first (due to foreign keys)
  await prisma.saleItem.deleteMany({
    where: {
      productVariationId: { in: [MOUSE.variationId, MONITOR.variationId] }
    }
  });

  // Delete sales
  await prisma.sale.deleteMany({
    where: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      invoiceNumber: { startsWith: 'INV-' }
    }
  });

  // Delete purchase receipt items
  await prisma.purchaseReceiptItem.deleteMany({
    where: {
      productVariationId: { in: [MOUSE.variationId, MONITOR.variationId] }
    }
  });

  // Delete purchase receipts
  await prisma.purchaseReceipt.deleteMany({
    where: {
      businessId: BUSINESS_ID,
      receiptNumber: { startsWith: 'GRN-' }
    }
  });

  // Delete purchase items
  await prisma.purchaseItem.deleteMany({
    where: {
      productVariationId: { in: [MOUSE.variationId, MONITOR.variationId] }
    }
  });

  // Delete purchases
  await prisma.purchase.deleteMany({
    where: {
      businessId: BUSINESS_ID,
      purchaseOrderNumber: { startsWith: 'PO-' }
    }
  });

  // Reset stock to 0
  await prisma.variationLocationDetails.updateMany({
    where: {
      productVariationId: { in: [MOUSE.variationId, MONITOR.variationId] },
      locationId: LOCATION_ID
    },
    data: {
      qtyAvailable: 0
    }
  });

  console.log('   ✓ Cleanup complete\n');
}

/**
 * Update stock level
 */
async function updateStock(productId, variationId, locationId, quantity) {
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: variationId,
        locationId: locationId
      }
    },
    update: {
      qtyAvailable: quantity
    },
    create: {
      productId: productId,
      productVariationId: variationId,
      locationId: locationId,
      qtyAvailable: quantity
    }
  });
}

/**
 * Create inventory correction
 */
async function createCorrection(productId, variationId, quantity) {
  const correction = await prisma.inventoryCorrection.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      productId: productId,
      productVariationId: variationId,
      systemCount: 0,
      physicalCount: quantity,
      difference: quantity,
      reason: 'count_error',
      remarks: 'Initial stock correction',
      createdBy: USER_ID,
      createdByName: 'Test User',
      status: 'approved',
      approvedBy: USER_ID,
      approvedAt: new Date()
    }
  });

  await updateStock(productId, variationId, LOCATION_ID, quantity);
  console.log(`   ✓ Correction: +${quantity} units (ID: ${correction.id})`);
}

/**
 * Create purchase receipt
 */
async function createPurchaseReceipt(productId, variationId, quantity) {
  const poNumber = `PO-TEST-${Date.now()}`;

  const po = await prisma.purchase.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      supplierId: 1,
      purchaseOrderNumber: poNumber,
      purchaseDate: new Date(),
      status: 'received',
      subtotal: quantity * 100,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: quantity * 100,
      createdBy: USER_ID,
      items: {
        create: [{
          productId: productId,
          productVariationId: variationId,
          quantity: quantity,
          unitCost: 100,
          quantityReceived: quantity
        }]
      }
    },
    include: {
      items: true
    }
  });

  const receipt = await prisma.purchaseReceipt.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      purchaseId: po.id,
      supplierId: 1,
      receiptNumber: `GRN-TEST-${Date.now()}`,
      receiptDate: new Date(),
      status: 'approved',
      receivedBy: USER_ID,
      approvedBy: USER_ID,
      approvedAt: new Date(),
      items: {
        create: [{
          purchaseItemId: po.items[0].id,
          productId: productId,
          productVariationId: variationId,
          quantityReceived: quantity
        }]
      }
    }
  });

  const current = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId: variationId,
        locationId: LOCATION_ID
      }
    }
  });

  const currentQty = current?.qtyAvailable ? parseFloat(current.qtyAvailable.toString()) : 0;
  const newQty = currentQty + quantity;
  await updateStock(productId, variationId, LOCATION_ID, newQty);

  console.log(`   ✓ Purchase: +${quantity} units → ${newQty} total (${receipt.receiptNumber})`);
}

/**
 * Create sale
 */
async function createSale(productId, variationId, quantity) {
  const sale = await prisma.sale.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      invoiceNumber: `INV-TEST-${Date.now()}`,
      saleDate: new Date(),
      status: 'completed',
      subtotal: quantity * 150,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: quantity * 150,
      createdBy: USER_ID,
      items: {
        create: [{
          productId: productId,
          productVariationId: variationId,
          quantity: quantity,
          unitPrice: 150,
          unitCost: 100
        }]
      }
    }
  });

  const current = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId: variationId,
        locationId: LOCATION_ID
      }
    }
  });

  const currentQty = current?.qtyAvailable ? parseFloat(current.qtyAvailable.toString()) : 0;
  const newQty = currentQty - quantity;
  await updateStock(productId, variationId, LOCATION_ID, newQty);

  console.log(`   ✓ Sale: -${quantity} units → ${newQty} total (${sale.invoiceNumber})`);
}

/**
 * Get inventory ledger
 */
async function getInventoryLedger(productId, variationId, locationId) {
  const corrections = await prisma.inventoryCorrection.findMany({
    where: {
      businessId: BUSINESS_ID,
      locationId: locationId,
      productVariationId: variationId,
      status: 'approved'
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const purchaseReceipts = await prisma.purchaseReceiptItem.findMany({
    where: {
      productVariationId: variationId,
      purchaseReceipt: {
        businessId: BUSINESS_ID,
        locationId: locationId,
        status: 'approved'
      }
    },
    include: {
      purchaseReceipt: true
    },
    orderBy: {
      purchaseReceipt: {
        receiptDate: 'asc'
      }
    }
  });

  const sales = await prisma.saleItem.findMany({
    where: {
      productVariationId: variationId,
      sale: {
        businessId: BUSINESS_ID,
        locationId: locationId,
        status: 'completed'
      }
    },
    include: {
      sale: true
    },
    orderBy: {
      sale: {
        saleDate: 'asc'
      }
    }
  });

  let openingBalance = 0;
  corrections.forEach(correction => {
    openingBalance += parseFloat(correction.difference.toString());
  });

  const transactions = [];
  let runningBalance = openingBalance;

  corrections.forEach(correction => {
    const qty = parseFloat(correction.difference.toString());
    transactions.push({
      date: correction.createdAt.toISOString().split('T')[0],
      type: 'Inventory Correction',
      reference: `COR-${correction.id}`,
      qtyIn: qty > 0 ? qty : 0,
      qtyOut: qty < 0 ? Math.abs(qty) : 0,
      balance: runningBalance
    });
  });

  purchaseReceipts.forEach(receipt => {
    const qty = parseFloat(receipt.quantityReceived.toString());
    runningBalance += qty;
    transactions.push({
      date: receipt.purchaseReceipt.receiptDate.toISOString().split('T')[0],
      type: 'Purchase Receipt',
      reference: receipt.purchaseReceipt.receiptNumber,
      qtyIn: qty,
      qtyOut: 0,
      balance: runningBalance
    });
  });

  sales.forEach(sale => {
    const qty = parseFloat(sale.quantity.toString());
    runningBalance -= qty;
    transactions.push({
      date: sale.sale.saleDate.toISOString().split('T')[0],
      type: 'Sale',
      reference: sale.sale.invoiceNumber,
      qtyIn: 0,
      qtyOut: qty,
      balance: runningBalance
    });
  });

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  const currentStock = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId: variationId,
        locationId: locationId
      }
    }
  });

  const currentBalance = currentStock ? parseFloat(currentStock.qtyAvailable.toString()) : 0;
  const variance = currentBalance - runningBalance;

  return {
    summary: {
      openingBalance,
      currentBalance,
      calculatedBalance: runningBalance,
      variance,
      totalIn: transactions.reduce((sum, t) => sum + t.qtyIn, 0),
      totalOut: transactions.reduce((sum, t) => sum + t.qtyOut, 0)
    },
    transactions
  };
}

/**
 * Print transactions
 */
function printTransactions(transactions) {
  console.log(`\n📜 Transaction History:`);
  if (transactions.length === 0) {
    console.log('   (No transactions)');
    return;
  }
  transactions.forEach((txn, idx) => {
    const sign = txn.qtyIn > 0 ? '+' : '-';
    const qty = txn.qtyIn > 0 ? txn.qtyIn : txn.qtyOut;
    console.log(`   ${idx + 1}. ${txn.date} | ${txn.type.padEnd(25)} | ${sign}${qty.toString().padStart(6)} → Balance: ${txn.balance}`);
  });
}

/**
 * Verify ledger
 */
function verifyLedger(scenario, expected, actual) {
  console.log(`\n📊 ${scenario} - Verification:`);
  console.log(`   Opening Balance:     ${actual.summary.openingBalance} (expected: ${expected.openingBalance})`);
  console.log(`   Calculated Balance:  ${actual.summary.calculatedBalance}`);
  console.log(`   Current DB Balance:  ${actual.summary.currentBalance} (expected: ${expected.finalBalance})`);
  console.log(`   Variance:            ${actual.summary.variance} (expected: ${expected.variance})`);
  console.log(`   Total In:            ${actual.summary.totalIn}`);
  console.log(`   Total Out:           ${actual.summary.totalOut}`);

  const passed =
    actual.summary.openingBalance === expected.openingBalance &&
    actual.summary.currentBalance === expected.finalBalance &&
    actual.summary.variance === expected.variance;

  if (passed) {
    console.log(`   ✅ PASSED`);
  } else {
    console.log(`   ❌ FAILED`);
  }

  return passed;
}

/**
 * Main test
 */
async function runTests() {
  console.log('\n🧪 Complete Inventory Ledger Test\n');
  console.log('='.repeat(80));

  try {
    await cleanup();

    // ===========================
    // SCENARIO 1: WITH CORRECTION
    // ===========================
    console.log('\n📦 SCENARIO 1: Product WITH Correction (Mouse)');
    console.log('-'.repeat(80));

    console.log('\nCreating transactions:');
    await createCorrection(MOUSE.productId, MOUSE.variationId, 100);
    await createPurchaseReceipt(MOUSE.productId, MOUSE.variationId, 50);
    await createSale(MOUSE.productId, MOUSE.variationId, 20);

    console.log('\nVerifying ledger...');
    const mouseLedger = await getInventoryLedger(MOUSE.productId, MOUSE.variationId, LOCATION_ID);
    printTransactions(mouseLedger.transactions);
    const mouseResult = verifyLedger(
      'SCENARIO 1 (Mouse)',
      { openingBalance: 100, finalBalance: 130, variance: 0 },
      mouseLedger
    );

    // ================================
    // SCENARIO 2: WITHOUT CORRECTION
    // ================================
    console.log('\n\n📦 SCENARIO 2: Product WITHOUT Correction (Monitor)');
    console.log('-'.repeat(80));

    console.log('\nCreating transactions:');
    await createPurchaseReceipt(MONITOR.productId, MONITOR.variationId, 100);
    await createSale(MONITOR.productId, MONITOR.variationId, 25);
    await createPurchaseReceipt(MONITOR.productId, MONITOR.variationId, 50);
    await createSale(MONITOR.productId, MONITOR.variationId, 15);

    console.log('\nVerifying ledger...');
    const monitorLedger = await getInventoryLedger(MONITOR.productId, MONITOR.variationId, LOCATION_ID);
    printTransactions(monitorLedger.transactions);
    const monitorResult = verifyLedger(
      'SCENARIO 2 (Monitor)',
      { openingBalance: 0, finalBalance: 110, variance: 0 },
      monitorLedger
    );

    // ================
    // FINAL SUMMARY
    // ================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nScenario 1 (WITH Correction):    ${mouseResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 2 (WITHOUT Correction): ${monitorResult ? '✅ PASSED' : '❌ FAILED'}`);

    if (mouseResult && monitorResult) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\n🔑 Key Findings:');
      console.log('   ✓ Products WITH corrections show opening balance from correction');
      console.log('   ✓ Products WITHOUT corrections have opening balance = 0');
      console.log('   ✓ Both scenarios show Variance = 0 (perfect accuracy)');
      console.log('   ✓ All transactions are properly tracked');
      console.log('   ✓ Running balances match database balances');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
