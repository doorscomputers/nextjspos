import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingOpeningStock() {
  console.log('='.repeat(100));
  console.log('FIX: Adding Missing Opening Stock Transactions to StockTransaction Table');
  console.log('='.repeat(100));

  try {
    // Find all opening_stock records in ProductHistory that don't have
    // corresponding opening_stock records in StockTransaction
    console.log('\n[STEP 1] Finding ProductHistory opening_stock records without StockTransaction...\n');

    const missingOpeningStock = await prisma.$queryRaw`
      SELECT DISTINCT
        ph.id as ph_id,
        ph.business_id,
        ph.product_id,
        ph.product_variation_id,
        ph.location_id,
        ph.quantity_change,
        ph.balance_quantity,
        ph.unit_cost,
        ph.transaction_date,
        ph.created_by,
        ph.created_by_name,
        p.name as product_name,
        p.sku as product_sku,
        pv.name as variation_name,
        pv.sku as variation_sku,
        bl.name as location_name
      FROM product_history ph
      INNER JOIN products p ON ph.product_id = p.id
      INNER JOIN product_variations pv ON ph.product_variation_id = pv.id
      INNER JOIN business_locations bl ON ph.location_id = bl.id
      LEFT JOIN stock_transactions st
        ON st.product_variation_id = ph.product_variation_id
        AND st.location_id = ph.location_id
        AND st.type = 'opening_stock'
      WHERE ph.transaction_type = 'opening_stock'
        AND st.id IS NULL
      ORDER BY ph.product_id, ph.location_id
    `;

    console.log(`Found ${missingOpeningStock.length} products with missing opening_stock in StockTransaction\n`);

    if (missingOpeningStock.length === 0) {
      console.log('✅ No missing opening stock transactions found. System is consistent!');
      return;
    }

    // Display what will be fixed
    console.log('[STEP 2] Missing Opening Stock Records:\n');
    console.log('Product                        | Variation SKU      | Location          | Qty    | Date       ');
    console.log('-'.repeat(100));

    missingOpeningStock.forEach(record => {
      const productName = record.product_name.substring(0, 30).padEnd(30);
      const variationSku = record.variation_sku.substring(0, 18).padEnd(18);
      const locationName = record.location_name.substring(0, 17).padEnd(17);
      const qty = parseFloat(record.quantity_change).toFixed(2).padStart(6);
      const date = new Date(record.transaction_date).toLocaleDateString();

      console.log(`${productName} | ${variationSku} | ${locationName} | ${qty} | ${date}`);
    });

    console.log('-'.repeat(100));
    console.log(`\nTotal records to insert: ${missingOpeningStock.length}\n`);

    // Ask for confirmation (in real scenario)
    console.log('[STEP 3] Inserting Missing Opening Stock Transactions...\n');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const record of missingOpeningStock) {
      try {
        // Get the earliest transaction date for this product/location to insert before it
        const earliestTransaction = await prisma.stockTransaction.findFirst({
          where: {
            productVariationId: record.product_variation_id,
            locationId: record.location_id
          },
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            createdAt: true
          }
        });

        // Set the opening stock transaction date to be before the earliest transaction
        // or use the transaction_date from ProductHistory
        let openingStockDate = record.transaction_date;
        if (earliestTransaction) {
          const earliestDate = new Date(earliestTransaction.createdAt);
          const recordDate = new Date(record.transaction_date);

          // If ProductHistory date is after the earliest transaction, use one second before
          if (recordDate >= earliestDate) {
            openingStockDate = new Date(earliestDate.getTime() - 1000);
          }
        }

        // Insert the missing opening_stock transaction
        await prisma.stockTransaction.create({
          data: {
            businessId: record.business_id,
            productId: record.product_id,
            productVariationId: record.product_variation_id,
            locationId: record.location_id,
            type: 'opening_stock',
            quantity: record.quantity_change,
            unitCost: record.unit_cost,
            balanceQty: record.quantity_change, // Opening stock balance is just the quantity
            referenceType: 'opening_stock',
            referenceId: null,
            createdBy: record.created_by,
            notes: `Opening Stock - Migrated from ProductHistory (ID: ${record.ph_id})`,
            createdAt: openingStockDate
          }
        });

        console.log(`✅ ${record.product_name} (${record.variation_sku}) @ ${record.location_name}`);
        successCount++;

      } catch (error) {
        console.log(`❌ ${record.product_name} (${record.variation_sku}) @ ${record.location_name} - ERROR: ${error.message}`);
        errorCount++;
        errors.push({
          product: record.product_name,
          variation: record.variation_sku,
          location: record.location_name,
          error: error.message
        });
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('[STEP 4] Summary\n');
    console.log(`Total Records Processed: ${missingOpeningStock.length}`);
    console.log(`✅ Successfully Inserted: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.product} (${err.variation}) @ ${err.location}: ${err.error}`);
      });
    }

    console.log('\n[STEP 5] Verification - Recalculating Balances...\n');
    console.log('⚠️  WARNING: After inserting opening stock, you need to recalculate balances for all subsequent transactions!');
    console.log('This is because the balanceQty field in existing transactions did not account for the missing opening stock.');
    console.log('\nRecommended next step: Run balance recalculation script.');

    console.log('\n' + '='.repeat(100));
    console.log('✅ Opening Stock Migration Complete!');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('Fatal error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with confirmation prompt in production
console.log('\n⚠️  WARNING: This script will INSERT records into the stock_transactions table.\n');
console.log('This is a DATA MIGRATION operation. Make sure you have a database backup!\n');
console.log('Press Ctrl+C to cancel or wait 5 seconds to proceed...\n');

setTimeout(() => {
  fixMissingOpeningStock();
}, 5000);
