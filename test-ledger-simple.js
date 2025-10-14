/**
 * Inventory Ledger API Test Script
 *
 * Tests two scenarios:
 * 1. Product WITH correction (Mouse - 10002)
 * 2. Product WITHOUT correction (Monitor - 10004) - Proves accuracy for always-correct products
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
 * Update stock level for a product variation
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
  console.log(`   ✓ Updated stock: Variation ${variationId} → ${quantity} units`);
}

/**
 * Create an inventory correction
 */
async function createCorrection(variationId, productId, quantity, note) {
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
      remarks: note || 'Initial stock correction',
      createdBy: USER_ID,
      createdByName: 'Test User',
      status: 'approved',
      approvedBy: USER_ID,
      approvedAt: new Date()
    }
  });

  await updateStock(productId, variationId, LOCATION_ID, quantity);
  console.log(`   ✓ Created correction: +${quantity} units (ID: ${correction.id})`);
  return correction;
}

/**
 * Create a purchase receipt
 */
async function createPurchaseReceipt(productId, variationId, quantity, note) {
  const poNumber = `PO-${Date.now()}`;

  // First, create a purchase order
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

  // Create the receipt
  const receipt = await prisma.purchaseReceipt.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      purchaseId: po.id,
      supplierId: 1,
      receiptNumber: `GRN-${Date.now()}`,
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

  // Update stock
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

  console.log(`   ✓ Created purchase receipt: +${quantity} units → ${newQty} total (GRN: ${receipt.receiptNumber})`);
  return receipt;
}

/**
 * Create a sale
 */
async function createSale(productId, variationId, quantity, note) {
  const sale = await prisma.sale.create({
    data: {
      businessId: BUSINESS_ID,
      locationId: LOCATION_ID,
      invoiceNumber: `INV-${Date.now()}`,
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

  // Update stock
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

  console.log(`   ✓ Created sale: -${quantity} units → ${newQty} total (INV: ${sale.invoiceNumber})`);
  return sale;
}

/**
 * Fetch Inventory Ledger from API
 */
async function fetchLedger(productId, variationId) {
  const url = `http://localhost:3000/api/reports/inventory-ledger?productId=${productId}&variationId=${variationId}&locationId=${LOCATION_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': 'next-auth.session-token=test'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Verify ledger results
 */
function verifyLedger(scenario, expected, actual) {
  console.log(`\n📊 ${scenario} - Verification:`);
  console.log(`   Expected Opening Balance: ${expected.openingBalance}`);
  console.log(`   Actual Opening Balance: ${actual.summary.openingBalance}`);
  console.log(`   Expected Final Balance: ${expected.finalBalance}`);
  console.log(`   Actual Final Balance: ${actual.summary.currentBalance}`);
  console.log(`   Expected Variance: ${expected.variance}`);
  console.log(`   Actual Variance: ${actual.summary.variance}`);

  const passed =
    actual.summary.openingBalance === expected.openingBalance &&
    actual.summary.currentBalance === expected.finalBalance &&
    actual.summary.variance === expected.variance;

  if (passed) {
    console.log(`   ✅ PASSED - Perfect reconciliation!`);
  } else {
    console.log(`   ❌ FAILED - Discrepancies found!`);
  }

  return passed;
}

/**
 * Print transaction history
 */
function printTransactions(transactions) {
  console.log(`\n📜 Transaction History:`);
  transactions.forEach((txn, idx) => {
    const sign = txn.qtyIn > 0 ? '+' : '-';
    const qty = txn.qtyIn > 0 ? txn.qtyIn : txn.qtyOut;
    console.log(`   ${idx + 1}. ${txn.date} | ${txn.type.padEnd(20)} | ${sign}${qty} → Balance: ${txn.balance}`);
  });
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('\n🧪 Starting Inventory Ledger API Test\n');
  console.log('=' .repeat(80));

  try {
    // ===========================
    // SCENARIO 1: WITH CORRECTION
    // ===========================
    console.log('\n📦 SCENARIO 1: Product WITH Correction (Mouse)');
    console.log('-'.repeat(80));

    console.log('\n1. Creating inventory correction (+100 units)...');
    await createCorrection(MOUSE.variationId, MOUSE.productId, 100, 'Initial stock count');

    console.log('\n2. Creating purchase receipt (+50 units)...');
    await createPurchaseReceipt(MOUSE.productId, MOUSE.variationId, 50, 'Restocking');

    console.log('\n3. Creating sale (-20 units)...');
    await createSale(MOUSE.productId, MOUSE.variationId, 20, 'Customer purchase');

    console.log('\n4. Fetching Inventory Ledger from API...');
    const mouseLedger = await fetchLedger(MOUSE.productId, MOUSE.variationId);

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

    console.log('\n1. Creating purchase receipt #1 (+100 units)...');
    await createPurchaseReceipt(MONITOR.productId, MONITOR.variationId, 100, 'Initial stock');

    console.log('\n2. Creating sale #1 (-25 units)...');
    await createSale(MONITOR.productId, MONITOR.variationId, 25, 'Customer purchase');

    console.log('\n3. Creating purchase receipt #2 (+50 units)...');
    await createPurchaseReceipt(MONITOR.productId, MONITOR.variationId, 50, 'Restocking');

    console.log('\n4. Creating sale #2 (-15 units)...');
    await createSale(MONITOR.productId, MONITOR.variationId, 15, 'Customer purchase');

    console.log('\n5. Fetching Inventory Ledger from API...');
    const monitorLedger = await fetchLedger(MONITOR.productId, MONITOR.variationId);

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
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nScenario 1 (WITH Correction): ${mouseResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 2 (WITHOUT Correction): ${monitorResult ? '✅ PASSED' : '❌ FAILED'}`);

    if (mouseResult && monitorResult) {
      console.log('\n🎉 ALL TESTS PASSED! Inventory Ledger is working correctly!');
      console.log('\n🔑 Key Finding: Products WITHOUT corrections (Scenario 2) show:');
      console.log('   - Opening Balance = 0 (no correction)');
      console.log('   - Variance = 0 (perfect accuracy)');
      console.log('   - All transactions properly tracked');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Review the discrepancies above');
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
runTests();
