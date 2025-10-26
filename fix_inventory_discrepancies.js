/**
 * INVENTORY DISCREPANCY CORRECTION SCRIPT
 *
 * This script backfills missing stockTransaction records for all products
 * that have inventory (qtyAvailable > 0) but no corresponding transaction history.
 *
 * SAFE TO RUN MULTIPLE TIMES - Only creates missing records, never duplicates.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInventoryDiscrepancies(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   INVENTORY DISCREPANCY CORRECTION');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (No changes will be made)' : 'LIVE RUN (Will modify database)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  // Get all variation location details with inventory
  const inventoryRecords = await prisma.variationLocationDetails.findMany({
    where: {
      qtyAvailable: {
        gt: 0
      }
    },
    include: {
      product: true,
      productVariation: true
    }
  });

  console.log(`Found ${inventoryRecords.length} inventory records with stock > 0\n`);
  console.log('Checking for missing stock transactions...\n');

  const results = {
    total: inventoryRecords.length,
    alreadyHasTransaction: 0,
    needsCorrection: 0,
    corrected: 0,
    failed: 0,
    errors: []
  };

  // Get super admin user for created_by field
  const superAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'superadmin' },
        { username: 'admin' }
      ]
    }
  });

  const createdById = superAdmin ? superAdmin.id : 1;
  const createdByName = superAdmin ? superAdmin.username : 'System';

  for (const record of inventoryRecords) {
    try {
      // Check if opening_stock transaction already exists
      const existingTransaction = await prisma.stockTransaction.findFirst({
        where: {
          productId: record.productId,
          productVariationId: record.productVariationId,
          locationId: record.locationId,
          type: 'opening_stock'
        }
      });

      if (existingTransaction) {
        results.alreadyHasTransaction++;
        continue;
      }

      // Missing transaction - needs correction
      results.needsCorrection++;

      const qty = parseFloat(record.qtyAvailable);
      const unitCost = parseFloat(record.productVariation.purchasePrice || record.productVariation.sellingPrice || 0);
      const businessId = record.product.businessId;

      if (!dryRun) {
        // Create the missing opening stock transaction
        await prisma.stockTransaction.create({
          data: {
            businessId,
            locationId: record.locationId,
            productId: record.productId,
            productVariationId: record.productVariationId,
            type: 'opening_stock',
            quantity: qty,
            balanceQty: qty, // For opening stock, balance equals quantity
            unitCost: unitCost,
            referenceType: 'inventory_correction',
            referenceId: record.productId,
            notes: `Opening stock backfilled by inventory correction script (CORRECTION-${record.productId}-${record.locationId})`,
            createdBy: createdById
          }
        });

        results.corrected++;

        if (results.corrected % 100 === 0) {
          console.log(`  Corrected ${results.corrected}/${results.needsCorrection} records...`);
        }
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId: record.productId,
        variationId: record.productVariationId,
        locationId: record.locationId,
        error: error.message
      });
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   CORRECTION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Inventory Records Checked:     ${results.total}`);
  console.log(`Already Has Transaction:             ${results.alreadyHasTransaction}`);
  console.log(`Needs Correction:                    ${results.needsCorrection}`);

  if (dryRun) {
    console.log(`\nWould Create:                        ${results.needsCorrection} stock transactions`);
    console.log('\n⚠ DRY RUN MODE - No changes were made to the database');
    console.log('To apply corrections, run: node fix_inventory_discrepancies.js --live');
  } else {
    console.log(`\n✓ Successfully Corrected:            ${results.corrected}`);
    console.log(`✗ Failed:                            ${results.failed}`);

    if (results.failed > 0) {
      console.log('\nErrors:');
      results.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`  ${idx + 1}. Product ${err.productId}, Variation ${err.variationId}, Location ${err.locationId}`);
        console.log(`     Error: ${err.error}`);
      });
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more errors`);
      }
    }
  }

  console.log(`\nCompleted in ${elapsedTime} seconds`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  return results;
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live') || args.includes('-l');

if (isLive) {
  console.log('\n⚠️  WARNING: You are about to run in LIVE mode!');
  console.log('This will CREATE stock transaction records in your database.\n');
  console.log('Press Ctrl+C within 5 seconds to cancel...\n');

  setTimeout(() => {
    fixInventoryDiscrepancies(false)
      .then((results) => {
        if (results.failed === 0) {
          console.log('✓ All corrections applied successfully!');
          console.log('\nNext steps:');
          console.log('1. Run: node inventory_audit.js (to verify corrections)');
          console.log('2. Test Stock History V2 report');
          console.log('3. Verify a few products manually');
          process.exit(0);
        } else {
          console.log('⚠ Some corrections failed. Review errors above.');
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error('CORRECTION FAILED:', error);
        process.exit(2);
      });
  }, 5000);
} else {
  // DRY RUN mode (default)
  fixInventoryDiscrepancies(true)
    .then((results) => {
      console.log('\nReview the summary above.');
      console.log('If everything looks correct, run with --live flag:');
      console.log('  node fix_inventory_discrepancies.js --live');
      process.exit(0);
    })
    .catch((error) => {
      console.error('ANALYSIS FAILED:', error);
      process.exit(2);
    });
}
