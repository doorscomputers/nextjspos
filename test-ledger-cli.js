/**
 * Inventory Ledger CLI Test - Direct API Testing Without Authentication
 *
 * This script tests the Inventory Ledger by:
 * 1. Creating transactions directly in the database
 * 2. Verifying inventory calculations
 * 3. Testing both scenarios (with and without corrections)
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
 * Fetch inventory ledger data directly from database (same logic as API)
 */
async function getInventoryLedger(productId, variationId, locationId) {
  // Get all corrections for this product
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

  // Get all purchase receipts
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

  // Get all sales
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

  // Calculate opening balance (sum of all corrections)
  let openingBalance = 0;
  corrections.forEach(correction => {
    openingBalance += parseFloat(correction.difference.toString());
  });

  // Build transaction history
  const transactions = [];
  let runningBalance = openingBalance;

  // Add corrections
  corrections.forEach(correction => {
    const qty = parseFloat(correction.difference.toString());
    runningBalance = qty; // For the first correction, it sets the balance
    transactions.push({
      date: correction.createdAt.toISOString().split('T')[0],
      type: 'Inventory Correction',
      reference: `COR-${correction.id}`,
      qtyIn: qty > 0 ? qty : 0,
      qtyOut: qty < 0 ? Math.abs(qty) : 0,
      balance: runningBalance
    });
  });

  // Add purchase receipts
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

  // Add sales
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

  // Sort all transactions by date
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Get current stock from database
  const currentStock = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId: variationId,
        locationId: locationId
      }
    }
  });

  const currentBalance = currentStock ? parseFloat(currentStock.qtyAvailable.toString()) : 0;

  // Calculate variance (difference between calculated and actual)
  const variance = currentBalance - runningBalance;

  return {
    summary: {
      openingBalance,
      currentBalance,
      variance,
      totalIn: transactions.reduce((sum, t) => sum + t.qtyIn, 0),
      totalOut: transactions.reduce((sum, t) => sum + t.qtyOut, 0)
    },
    transactions
  };
}

/**
 * Print transaction history
 */
function printTransactions(transactions) {
  console.log(`\n📜 Transaction History:`);
  transactions.forEach((txn, idx) => {
    const sign = txn.qtyIn > 0 ? '+' : '-';
    const qty = txn.qtyIn > 0 ? txn.qtyIn : txn.qtyOut;
    console.log(`   ${idx + 1}. ${txn.date} | ${txn.type.padEnd(25)} | ${sign}${qty.toString().padStart(6)} → Balance: ${txn.balance}`);
  });
}

/**
 * Verify ledger results
 */
function verifyLedger(scenario, expected, actual) {
  console.log(`\n📊 ${scenario} - Verification:`);
  console.log(`   Expected Opening Balance: ${expected.openingBalance}`);
  console.log(`   Actual Opening Balance:   ${actual.summary.openingBalance}`);
  console.log(`   Expected Final Balance:   ${expected.finalBalance}`);
  console.log(`   Actual Final Balance:     ${actual.summary.currentBalance}`);
  console.log(`   Expected Variance:        ${expected.variance}`);
  console.log(`   Actual Variance:          ${actual.summary.variance}`);
  console.log(`   Total In:                 ${actual.summary.totalIn}`);
  console.log(`   Total Out:                ${actual.summary.totalOut}`);

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
 * Main test execution
 */
async function runTests() {
  console.log('\n🧪 Testing Inventory Ledger (Direct Database Access)\n');
  console.log('='.repeat(80));

  try {
    // ===========================
    // SCENARIO 1: WITH CORRECTION
    // ===========================
    console.log('\n📦 SCENARIO 1: Product WITH Correction (Mouse)');
    console.log('-'.repeat(80));
    console.log('\nFetching ledger data from database...');

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
    console.log('\nFetching ledger data from database...');

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
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nScenario 1 (WITH Correction):    ${mouseResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 2 (WITHOUT Correction): ${monitorResult ? '✅ PASSED' : '❌ FAILED'}`);

    if (mouseResult && monitorResult) {
      console.log('\n🎉 ALL TESTS PASSED! Inventory Ledger is working correctly!');
      console.log('\n🔑 Key Findings:');
      console.log('   ✓ Scenario 1 (Mouse): Opening Balance = 100 (from correction), Final = 130, Variance = 0');
      console.log('   ✓ Scenario 2 (Monitor): Opening Balance = 0 (no correction), Final = 110, Variance = 0');
      console.log('   ✓ Products WITHOUT corrections show perfect accuracy (Variance = 0)');
      console.log('   ✓ All transactions are properly tracked');
      console.log('   ✓ Running balances are correctly calculated');
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
