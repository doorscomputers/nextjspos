/**
 * Cleanup ALL Data Script
 *
 * This script removes ALL transactional data from the database while preserving:
 * - Database structure (tables, schema)
 * - Business and location settings
 * - Roles and permissions
 * - Admin users
 *
 * USE CASE: After testing your deployed app online, run this to DELETE EVERYTHING
 * and start completely fresh with real production data.
 *
 * WARNING: This will DELETE ALL DATA permanently. Make a backup first!
 *
 * Usage:
 *   node scripts/cleanup-all-data.mjs
 *
 * You will be prompted to confirm before deletion.
 */

import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function countRecords() {
  console.log('\n📊 Counting current database records...\n');

  const counts = {
    sales: await prisma.sale.count(),
    saleItems: await prisma.saleItem.count(),
    purchases: await prisma.purchase.count(),
    purchaseItems: await prisma.purchaseItem.count(),
    purchaseReceipts: await prisma.purchaseReceipt.count(),
    purchaseReceiptItems: await prisma.purchaseReceiptItem.count(),
    transfers: await prisma.stockTransfer.count(),
    transferItems: await prisma.stockTransferItem.count(),
    supplierReturns: await prisma.supplierReturn.count(),
    supplierReturnItems: await prisma.supplierReturnItem.count(),
    products: await prisma.product.count(),
    productVariations: await prisma.productVariation.count(),
    productHistory: await prisma.productHistory.count(),
    suppliers: await prisma.supplier.count(),
    customers: await prisma.customer.count(),
    inventoryCorrections: await prisma.inventoryCorrection.count(),
  };

  // Try optional tables
  try {
    counts.auditLogs = await prisma.auditLog?.count() || 0;
  } catch {
    counts.auditLogs = 0;
  }

  try {
    counts.itemLedger = await prisma.itemLedger?.count() || 0;
  } catch {
    counts.itemLedger = 0;
  }

  return counts;
}

function displayCounts(counts) {
  console.log('=' .repeat(80));
  console.log('CURRENT DATABASE CONTENTS:');
  console.log('=' .repeat(80));

  console.log('\n📦 PRODUCTS & INVENTORY:');
  console.log(`  • Products: ${counts.products}`);
  console.log(`  • Product Variations: ${counts.productVariations}`);
  console.log(`  • Product History: ${counts.productHistory}`);
  console.log(`  • Inventory Corrections: ${counts.inventoryCorrections}`);
  if (counts.itemLedger > 0) {
    console.log(`  • Item Ledger Entries: ${counts.itemLedger}`);
  }

  console.log('\n💰 SALES:');
  console.log(`  • Sales Transactions: ${counts.sales}`);
  console.log(`  • Sale Items: ${counts.saleItems}`);

  console.log('\n🛒 PURCHASES:');
  console.log(`  • Purchase Orders: ${counts.purchases}`);
  console.log(`  • Purchase Items: ${counts.purchaseItems}`);
  console.log(`  • Purchase Receipts (GRNs): ${counts.purchaseReceipts}`);
  console.log(`  • Receipt Items: ${counts.purchaseReceiptItems}`);

  console.log('\n🔄 TRANSFERS:');
  console.log(`  • Stock Transfers: ${counts.transfers}`);
  console.log(`  • Transfer Items: ${counts.transferItems}`);

  console.log('\n📦 RETURNS:');
  console.log(`  • Supplier Returns: ${counts.supplierReturns}`);
  console.log(`  • Return Items: ${counts.supplierReturnItems}`);

  console.log('\n👥 BUSINESS CONTACTS:');
  console.log(`  • Suppliers: ${counts.suppliers}`);
  console.log(`  • Customers: ${counts.customers}`);

  if (counts.auditLogs > 0) {
    console.log('\n📋 AUDIT:');
    console.log(`  • Audit Logs: ${counts.auditLogs}`);
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  console.log('\n' + '=' .repeat(80));
  console.log(`TOTAL RECORDS TO DELETE: ${total.toLocaleString()}`);
  console.log('=' .repeat(80));

  return total;
}

async function deleteAllData() {
  console.log('\n🗑️  Starting deletion process...\n');

  const results = {
    deleted: 0,
    steps: [],
  };

  try {
    // Step 1: Delete all child records first (to avoid foreign key constraints)

    console.log('🗑️  Step 1/14: Deleting sale items...');
    const deletedSaleItems = await prisma.saleItem.deleteMany({});
    results.steps.push({ name: 'Sale Items', count: deletedSaleItems.count });
    console.log(`   ✓ Deleted ${deletedSaleItems.count} sale items`);

    console.log('🗑️  Step 2/14: Deleting sales...');
    const deletedSales = await prisma.sale.deleteMany({});
    results.steps.push({ name: 'Sales', count: deletedSales.count });
    console.log(`   ✓ Deleted ${deletedSales.count} sales`);

    console.log('🗑️  Step 3/14: Deleting purchase receipt items...');
    const deletedReceiptItems = await prisma.purchaseReceiptItem.deleteMany({});
    results.steps.push({ name: 'Purchase Receipt Items', count: deletedReceiptItems.count });
    console.log(`   ✓ Deleted ${deletedReceiptItems.count} receipt items`);

    console.log('🗑️  Step 4/14: Deleting purchase receipts...');
    const deletedReceipts = await prisma.purchaseReceipt.deleteMany({});
    results.steps.push({ name: 'Purchase Receipts', count: deletedReceipts.count });
    console.log(`   ✓ Deleted ${deletedReceipts.count} purchase receipts`);

    console.log('🗑️  Step 5/14: Deleting purchase items...');
    const deletedPurchaseItems = await prisma.purchaseItem.deleteMany({});
    results.steps.push({ name: 'Purchase Items', count: deletedPurchaseItems.count });
    console.log(`   ✓ Deleted ${deletedPurchaseItems.count} purchase items`);

    console.log('🗑️  Step 6/14: Deleting purchases...');
    const deletedPurchases = await prisma.purchase.deleteMany({});
    results.steps.push({ name: 'Purchases', count: deletedPurchases.count });
    console.log(`   ✓ Deleted ${deletedPurchases.count} purchases`);

    console.log('🗑️  Step 7/14: Deleting stock transfer items...');
    const deletedTransferItems = await prisma.stockTransferItem.deleteMany({});
    results.steps.push({ name: 'Transfer Items', count: deletedTransferItems.count });
    console.log(`   ✓ Deleted ${deletedTransferItems.count} transfer items`);

    console.log('🗑️  Step 8/14: Deleting stock transfers...');
    const deletedTransfers = await prisma.stockTransfer.deleteMany({});
    results.steps.push({ name: 'Transfers', count: deletedTransfers.count });
    console.log(`   ✓ Deleted ${deletedTransfers.count} transfers`);

    console.log('🗑️  Step 9/14: Deleting supplier return items...');
    const deletedReturnItems = await prisma.supplierReturnItem.deleteMany({});
    results.steps.push({ name: 'Supplier Return Items', count: deletedReturnItems.count });
    console.log(`   ✓ Deleted ${deletedReturnItems.count} return items`);

    console.log('🗑️  Step 10/14: Deleting supplier returns...');
    const deletedReturns = await prisma.supplierReturn.deleteMany({});
    results.steps.push({ name: 'Supplier Returns', count: deletedReturns.count });
    console.log(`   ✓ Deleted ${deletedReturns.count} supplier returns`);

    console.log('🗑️  Step 11/14: Deleting product history...');
    const deletedHistory = await prisma.productHistory.deleteMany({});
    results.steps.push({ name: 'Product History', count: deletedHistory.count });
    console.log(`   ✓ Deleted ${deletedHistory.count} history records`);

    console.log('🗑️  Step 12/14: Deleting product variations...');
    const deletedVariations = await prisma.productVariation.deleteMany({});
    results.steps.push({ name: 'Product Variations', count: deletedVariations.count });
    console.log(`   ✓ Deleted ${deletedVariations.count} variations`);

    console.log('🗑️  Step 13/14: Deleting products...');
    const deletedProducts = await prisma.product.deleteMany({});
    results.steps.push({ name: 'Products', count: deletedProducts.count });
    console.log(`   ✓ Deleted ${deletedProducts.count} products`);

    console.log('🗑️  Step 14/14: Deleting inventory corrections...');
    const deletedCorrections = await prisma.inventoryCorrection.deleteMany({});
    results.steps.push({ name: 'Inventory Corrections', count: deletedCorrections.count });
    console.log(`   ✓ Deleted ${deletedCorrections.count} corrections`);

    // Optional: Delete audit logs and item ledger if they exist
    try {
      console.log('🗑️  Deleting audit logs...');
      const deletedAudit = await prisma.auditLog?.deleteMany({});
      if (deletedAudit) {
        results.steps.push({ name: 'Audit Logs', count: deletedAudit.count });
        console.log(`   ✓ Deleted ${deletedAudit.count} audit logs`);
      }
    } catch (e) {
      console.log('   ℹ️  Audit logs table not found, skipping...');
    }

    try {
      console.log('🗑️  Deleting item ledger...');
      const deletedLedger = await prisma.itemLedger?.deleteMany({});
      if (deletedLedger) {
        results.steps.push({ name: 'Item Ledger', count: deletedLedger.count });
        console.log(`   ✓ Deleted ${deletedLedger.count} ledger entries`);
      }
    } catch (e) {
      console.log('   ℹ️  Item ledger table not found, skipping...');
    }

    // Optional: Delete suppliers and customers
    console.log('🗑️  Deleting suppliers...');
    const deletedSuppliers = await prisma.supplier.deleteMany({});
    results.steps.push({ name: 'Suppliers', count: deletedSuppliers.count });
    console.log(`   ✓ Deleted ${deletedSuppliers.count} suppliers`);

    console.log('🗑️  Deleting customers...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    results.steps.push({ name: 'Customers', count: deletedCustomers.count });
    console.log(`   ✓ Deleted ${deletedCustomers.count} customers`);

    results.deleted = results.steps.reduce((sum, step) => sum + step.count, 0);

  } catch (error) {
    console.error('\n❌ Error during deletion:', error.message);
    throw error;
  }

  return results;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  DELETE ALL DATA SCRIPT ⚠️');
  console.log('='.repeat(80));
  console.log('\nThis script will DELETE ALL transactional data from your database.');
  console.log('\n✅ PRESERVED (will NOT be deleted):');
  console.log('  • Database structure (tables, schema)');
  console.log('  • Business settings');
  console.log('  • Business locations/branches');
  console.log('  • Roles and permissions');
  console.log('  • User accounts\n');

  console.log('❌ DELETED (will be REMOVED):');
  console.log('  • All sales and sale items');
  console.log('  • All purchases and purchase items');
  console.log('  • All purchase receipts (GRNs)');
  console.log('  • All stock transfers');
  console.log('  • All supplier returns');
  console.log('  • All products and variations');
  console.log('  • All product history');
  console.log('  • All inventory corrections');
  console.log('  • All audit logs');
  console.log('  • All item ledger entries');
  console.log('  • All suppliers');
  console.log('  • All customers\n');

  try {
    // Count and display current records
    const counts = await countRecords();
    const total = displayCounts(counts);

    if (total === 0) {
      console.log('\n✅ Database is already empty. Nothing to delete.\n');
      await prisma.$disconnect();
      rl.close();
      process.exit(0);
    }

    // First confirmation
    console.log('\n' + '⚠️ '.repeat(40));
    console.log('WARNING: YOU ARE ABOUT TO DELETE ALL DATA LISTED ABOVE!');
    console.log('⚠️ '.repeat(40));

    const confirm1 = await question('\nType "DELETE ALL" to continue (or anything else to cancel): ');

    if (confirm1 !== 'DELETE ALL') {
      console.log('\n❌ Cleanup cancelled. No data was deleted.\n');
      await prisma.$disconnect();
      rl.close();
      process.exit(0);
    }

    // Second confirmation
    const confirm2 = await question('\n⚠️  FINAL WARNING: This CANNOT be undone! Type "I UNDERSTAND" to proceed: ');

    if (confirm2 !== 'I UNDERSTAND') {
      console.log('\n❌ Cleanup cancelled. No data was deleted.\n');
      await prisma.$disconnect();
      rl.close();
      process.exit(0);
    }

    // Delete all data
    console.log('\n🔄 Starting complete database cleanup...');
    const results = await deleteAllData();

    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\n📊 Deletion Summary:\n');

    results.steps.forEach((step) => {
      console.log(`  ✓ ${step.name}: ${step.count.toLocaleString()} deleted`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL RECORDS DELETED: ${results.deleted.toLocaleString()}`);
    console.log('='.repeat(80));

    console.log('\n✅ Your database is now clean and ready for production data!\n');
    console.log('📌 NEXT STEPS:');
    console.log('   1. Verify business settings are correct');
    console.log('   2. Verify locations/branches are correct');
    console.log('   3. Import your real products (or create them manually)');
    console.log('   4. Set beginning inventory quantities');
    console.log('   5. Create your real suppliers and customers');
    console.log('   6. Start using the system with real data!\n');

    await prisma.$disconnect();
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await prisma.$disconnect();
    rl.close();
    process.exit(1);
  }
}

main();
