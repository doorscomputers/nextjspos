/**
 * DATABASE CLEANUP SCRIPT - RESET INVENTORY
 *
 * This script safely deletes all products, variations, inventory, and transactions
 * while preserving categories, brands, users, locations, and business settings.
 *
 * USAGE:
 *   node reset_inventory_database.js              (DRY RUN - shows what will be deleted)
 *   node reset_inventory_database.js --confirm    (LIVE - actually deletes data)
 *
 * SAFETY FEATURES:
 * - Dry-run mode by default
 * - Requires explicit --confirm flag
 * - Shows detailed preview before deletion
 * - 10-second countdown before executing
 * - Creates backup recommendations
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetInventoryDatabase(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   DATABASE CLEANUP - INVENTORY RESET');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (Preview Only)' : '🔥 LIVE MODE (Will Delete Data)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!dryRun) {
    console.log('⚠️  WARNING: THIS WILL PERMANENTLY DELETE DATA!\n');
    console.log('The following will be DELETED:');
    console.log('  ❌ All Products and Variations');
    console.log('  ❌ All Inventory Records');
    console.log('  ❌ All Stock Transactions');
    console.log('  ❌ All Product History');
    console.log('  ❌ All Sales and Sale Items');
    console.log('  ❌ All Purchases and Purchase Items');
    console.log('  ❌ All Stock Transfers');
    console.log('  ❌ All Inventory Corrections');
    console.log('  ❌ All Serial Numbers');
    console.log('  ❌ All Supplier Returns');
    console.log('  ❌ All Customer Returns\n');

    console.log('The following will be PRESERVED:');
    console.log('  ✅ Categories');
    console.log('  ✅ Brands');
    console.log('  ✅ Users and Roles');
    console.log('  ✅ Business Locations');
    console.log('  ✅ Business Settings');
    console.log('  ✅ Suppliers and Customers\n');
  }

  const startTime = Date.now();

  // Count records to be deleted
  console.log('Analyzing database...\n');

  const counts = {
    products: await prisma.product.count(),
    productVariations: await prisma.productVariation.count(),
    variationLocationDetails: await prisma.variationLocationDetails.count(),
    stockTransactions: await prisma.stockTransaction.count(),
    productHistory: await prisma.productHistory.count(),
    sales: await prisma.sale.count(),
    saleItems: await prisma.saleItem.count(),
    purchases: await prisma.purchase.count(),
    purchaseItems: await prisma.purchaseItem.count(),
    purchaseReceipts: await prisma.purchaseReceipt.count(),
    purchaseReceiptItems: await prisma.purchaseReceiptItem.count(),
    stockTransfers: await prisma.stockTransfer.count(),
    stockTransferItems: await prisma.stockTransferItem.count(),
    inventoryCorrections: await prisma.inventoryCorrection.count(),
    serialNumbers: await prisma.serialNumber.count(),
    supplierReturns: await prisma.supplierReturn.count(),
    supplierReturnItems: await prisma.supplierReturnItem.count(),
    customerReturns: await prisma.customerReturn.count(),
    customerReturnItems: await prisma.customerReturnItem.count(),
  };

  // Count preserved records
  const preserved = {
    categories: await prisma.productCategory.count(),
    brands: await prisma.brand.count(),
    users: await prisma.user.count(),
    locations: await prisma.businessLocation.count(),
    businesses: await prisma.business.count(),
    suppliers: await prisma.supplier.count(),
    customers: await prisma.customer.count(),
  };

  console.log('RECORDS TO BE DELETED:');
  console.log('─────────────────────────────────────────');
  Object.entries(counts).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`  ${table.padEnd(30)} ${count.toLocaleString()}`);
    }
  });
  console.log('─────────────────────────────────────────');
  const totalToDelete = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(`  TOTAL RECORDS TO DELETE:     ${totalToDelete.toLocaleString()}\n`);

  console.log('RECORDS TO BE PRESERVED:');
  console.log('─────────────────────────────────────────');
  Object.entries(preserved).forEach(([table, count]) => {
    console.log(`  ${table.padEnd(30)} ${count.toLocaleString()}`);
  });
  console.log('─────────────────────────────────────────\n');

  if (dryRun) {
    console.log('✓ DRY RUN COMPLETE - No data was deleted\n');
    console.log('To actually delete the data, run:');
    console.log('  node reset_inventory_database.js --confirm\n');

    console.log('⚠️  IMPORTANT: Before running with --confirm:');
    console.log('  1. Backup your database:');
    console.log('     pg_dump ultimatepos_modern > backup_$(date +%Y%m%d_%H%M%S).sql');
    console.log('  2. Make sure you have a fresh CSV import file ready');
    console.log('  3. Inform all users that system will be unavailable\n');

    await prisma.$disconnect();
    return { success: true, dryRun: true, counts };
  }

  // LIVE MODE - Actually delete data
  console.log('🔥 LIVE MODE - Deletion will start in 10 seconds...');
  console.log('Press Ctrl+C to cancel!\n');

  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('Starting deletion...\n');

  const results = {
    deleted: {},
    errors: []
  };

  try {
    // Delete in correct order to respect foreign key constraints
    console.log('Deleting transaction-related data...');

    // Sales and related
    if (counts.saleItems > 0) {
      results.deleted.saleItems = await prisma.saleItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.saleItems.count} sale items`);
    }
    if (counts.sales > 0) {
      results.deleted.sales = await prisma.sale.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.sales.count} sales`);
    }

    // Purchases and related
    if (counts.purchaseItems > 0) {
      results.deleted.purchaseItems = await prisma.purchaseItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.purchaseItems.count} purchase items`);
    }
    if (counts.purchases > 0) {
      results.deleted.purchases = await prisma.purchase.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.purchases.count} purchases`);
    }

    // Purchase Receipts
    if (counts.purchaseReceiptItems > 0) {
      results.deleted.purchaseReceiptItems = await prisma.purchaseReceiptItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.purchaseReceiptItems.count} receipt items`);
    }
    if (counts.purchaseReceipts > 0) {
      results.deleted.purchaseReceipts = await prisma.purchaseReceipt.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.purchaseReceipts.count} receipts`);
    }

    // Transfers
    if (counts.stockTransferItems > 0) {
      results.deleted.stockTransferItems = await prisma.stockTransferItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.stockTransferItems.count} transfer items`);
    }
    if (counts.stockTransfers > 0) {
      results.deleted.stockTransfers = await prisma.stockTransfer.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.stockTransfers.count} transfers`);
    }

    // Returns
    if (counts.supplierReturnItems > 0) {
      results.deleted.supplierReturnItems = await prisma.supplierReturnItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.supplierReturnItems.count} supplier return items`);
    }
    if (counts.supplierReturns > 0) {
      results.deleted.supplierReturns = await prisma.supplierReturn.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.supplierReturns.count} supplier returns`);
    }
    if (counts.customerReturnItems > 0) {
      results.deleted.customerReturnItems = await prisma.customerReturnItem.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.customerReturnItems.count} customer return items`);
    }
    if (counts.customerReturns > 0) {
      results.deleted.customerReturns = await prisma.customerReturn.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.customerReturns.count} customer returns`);
    }

    // Inventory and transactions
    console.log('\nDeleting inventory records...');
    if (counts.inventoryCorrections > 0) {
      results.deleted.inventoryCorrections = await prisma.inventoryCorrection.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.inventoryCorrections.count} corrections`);
    }
    if (counts.stockTransactions > 0) {
      results.deleted.stockTransactions = await prisma.stockTransaction.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.stockTransactions.count} stock transactions`);
    }
    if (counts.productHistory > 0) {
      results.deleted.productHistory = await prisma.productHistory.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.productHistory.count} product history`);
    }
    if (counts.variationLocationDetails > 0) {
      results.deleted.variationLocationDetails = await prisma.variationLocationDetails.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.variationLocationDetails.count} inventory records`);
    }
    if (counts.serialNumbers > 0) {
      results.deleted.serialNumbers = await prisma.serialNumber.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.serialNumbers.count} serial numbers`);
    }

    // Products
    console.log('\nDeleting products...');
    if (counts.productVariations > 0) {
      results.deleted.productVariations = await prisma.productVariation.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.productVariations.count} variations`);
    }
    if (counts.products > 0) {
      results.deleted.products = await prisma.product.deleteMany({});
      console.log(`  ✓ Deleted ${results.deleted.products.count} products`);
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   DELETION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalDeleted = Object.values(results.deleted).reduce((sum, result) => sum + (result.count || 0), 0);
    console.log(`✓ Successfully deleted ${totalDeleted.toLocaleString()} records in ${elapsedTime} seconds\n`);

    console.log('Next steps:');
    console.log('  1. Import your categories (if needed)');
    console.log('  2. Import your brands (if needed)');
    console.log('  3. Import your products with CSV import');
    console.log('  4. Run inventory audit to verify: node inventory_audit.js\n');

    await prisma.$disconnect();
    return { success: true, dryRun: false, results };

  } catch (error) {
    console.error('\n❌ ERROR during deletion:', error);
    results.errors.push(error.message);
    await prisma.$disconnect();
    return { success: false, error: error.message, results };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--confirm');

resetInventoryDatabase(!isLive)
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      console.error('\n❌ Operation failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(2);
  });
