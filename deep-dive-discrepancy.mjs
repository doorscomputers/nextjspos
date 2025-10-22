import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deepDiveAnalysis() {
  try {
    console.log('='.repeat(100));
    console.log('DEEP DIVE: Root Cause Analysis of Inventory Discrepancy');
    console.log('='.repeat(100));

    const variationId = 343;
    const locationId = 2;

    // Get StockTransactions
    console.log('\n[1] STOCK TRANSACTIONS (Raw Data):\n');
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log('ID | Type             | Qty    | Balance | UnitCost | Ref Type         | Ref ID | Created At');
    console.log('-'.repeat(110));
    stockTransactions.forEach(st => {
      console.log(
        `${st.id.toString().padStart(2)} | ${st.type.padEnd(16)} | ${parseFloat(st.quantity).toFixed(2).padStart(6)} | ${parseFloat(st.balanceQty).toFixed(2).padStart(7)} | ${st.unitCost ? parseFloat(st.unitCost).toFixed(2).padStart(8) : 'N/A'.padStart(8)} | ${(st.referenceType || 'N/A').padEnd(16)} | ${(st.referenceId || 'N/A').toString().padStart(6)} | ${new Date(st.createdAt).toLocaleString()}`
      );
    });

    // Get ProductHistory
    console.log('\n\n[2] PRODUCT HISTORY (Raw Data):\n');
    const productHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      orderBy: [
        { transactionDate: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log('ID | Type             | Qty Change | Balance  | UnitCost | Ref Type         | Ref ID | Transaction Date');
    console.log('-'.repeat(120));
    productHistory.forEach(ph => {
      console.log(
        `${ph.id.toString().padStart(2)} | ${ph.transactionType.padEnd(16)} | ${parseFloat(ph.quantityChange).toFixed(2).padStart(10)} | ${parseFloat(ph.balanceQuantity).toFixed(2).padStart(8)} | ${ph.unitCost ? parseFloat(ph.unitCost).toFixed(2).padStart(8) : 'N/A'.padStart(8)} | ${ph.referenceType.padEnd(16)} | ${ph.referenceId.toString().padStart(6)} | ${new Date(ph.transactionDate).toLocaleDateString()}`
      );
    });

    // Check VariationLocationDetails
    console.log('\n\n[3] VARIATION LOCATION DETAILS:\n');
    const vld = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variationId,
          locationId: locationId
        }
      }
    });

    if (vld) {
      console.log(`Quantity Available: ${vld.qtyAvailable}`);
      console.log(`Opening Stock: ${vld.openingStock || 'N/A'}`);
      console.log(`Opening Stock Set By: ${vld.openingStockSetBy || 'N/A'}`);
      console.log(`Opening Stock Date: ${vld.openingStockDate || 'N/A'}`);
    }

    // THE PROBLEM IDENTIFICATION
    console.log('\n\n[4] ROOT CAUSE ANALYSIS:\n');
    console.log('='.repeat(100));

    console.log('\n🔍 ISSUE #1: Missing Opening Stock Transaction in StockTransaction');
    console.log('-'.repeat(100));
    console.log('ProductHistory has an opening_stock entry of +11.00');
    console.log('StockTransaction has NO opening_stock entry!');
    console.log('');
    console.log('This means:');
    console.log('  - When opening stock was set, only ProductHistory was created');
    console.log('  - StockTransaction was NOT created for opening stock');
    console.log('  - This causes an 11-unit discrepancy from the start');

    console.log('\n🔍 ISSUE #2: Incorrect Balance Calculation in StockTransaction');
    console.log('-'.repeat(100));
    console.log('StockTransaction #1 (purchase +1.00):');
    console.log('  - Should start from 0 (no opening stock in StockTransaction)');
    console.log('  - Expected balance: 0 + 1 = 1.00');
    console.log('  - ACTUAL balance: 12.00 ❌');
    console.log('  - This suggests it included the opening stock (11) PLUS the purchase (1)');
    console.log('');
    console.log('StockTransaction #2 (purchase +10.00):');
    console.log('  - Expected balance: 12 + 10 = 22.00');
    console.log('  - ACTUAL balance: 22.00 ✅');
    console.log('');
    console.log('StockTransaction #5 (supplier_return -1.00):');
    console.log('  - Expected balance: 22 - 1 = 21.00');
    console.log('  - ACTUAL balance: 21.00 ✅');

    console.log('\n🔍 ISSUE #3: The StockTransaction Table is Inconsistent');
    console.log('-'.repeat(100));
    console.log('The balanceQty field includes opening stock in the calculation,');
    console.log('BUT there is no opening_stock transaction in StockTransaction table.');
    console.log('');
    console.log('This makes StockTransaction unreliable for historical analysis.');

    console.log('\n\n[5] EXPECTED vs ACTUAL:\n');
    console.log('='.repeat(100));

    // Calculate from ProductHistory
    let phBalance = 0;
    console.log('\nCalculation from ProductHistory:');
    productHistory.forEach(ph => {
      phBalance += parseFloat(ph.quantityChange);
      console.log(`  ${ph.transactionType}: ${parseFloat(ph.quantityChange) > 0 ? '+' : ''}${parseFloat(ph.quantityChange).toFixed(2)} → Balance: ${phBalance.toFixed(2)}`);
    });
    console.log(`ProductHistory Final Balance: ${phBalance.toFixed(2)}`);

    // Calculate from StockTransaction (without opening stock adjustment)
    let stBalance = 0;
    console.log('\nCalculation from StockTransaction (raw):');
    stockTransactions.forEach(st => {
      stBalance += parseFloat(st.quantity);
      console.log(`  ${st.type}: ${parseFloat(st.quantity) > 0 ? '+' : ''}${parseFloat(st.quantity).toFixed(2)} → Calculated: ${stBalance.toFixed(2)}, Recorded: ${parseFloat(st.balanceQty).toFixed(2)}`);
    });
    console.log(`StockTransaction Final Calculated Balance: ${stBalance.toFixed(2)}`);
    console.log(`StockTransaction Final Recorded Balance: ${stockTransactions[stockTransactions.length - 1]?.balanceQty || 0}`);

    console.log('\n\n[6] THE FIX:\n');
    console.log('='.repeat(100));
    console.log('Option 1: Add Missing Opening Stock Transaction');
    console.log('  - Insert an opening_stock transaction in StockTransaction table');
    console.log('  - Type: opening_stock, Quantity: +11.00, Balance: 11.00');
    console.log('  - This will make StockTransaction complete and consistent');
    console.log('');
    console.log('Option 2: Recalculate All StockTransaction Balances');
    console.log('  - Recalculate balanceQty for all transactions chronologically');
    console.log('  - Start from 0, add opening stock, then purchases, then returns');
    console.log('');
    console.log('Option 3: Use ProductHistory Instead');
    console.log('  - ProductHistory is more complete and accurate');
    console.log('  - Update reports to use ProductHistory instead of StockTransaction');
    console.log('  - Consider StockTransaction deprecated or for reference only');

    console.log('\n\n[7] RECOMMENDED ACTION:\n');
    console.log('='.repeat(100));
    console.log('✅ Insert the missing opening_stock transaction in StockTransaction');
    console.log('');
    console.log('SQL to fix:');
    console.log('```sql');
    console.log(`INSERT INTO stock_transactions (business_id, product_id, product_variation_id, location_id, type, quantity, unit_cost, balance_qty, reference_type, reference_id, created_by, created_at)`);
    console.log(`VALUES (1, 343, 343, 2, 'opening_stock', 11.00, NULL, 11.00, NULL, NULL, 1, (SELECT MIN(created_at) FROM stock_transactions WHERE product_variation_id = 343 AND location_id = 2));`);
    console.log('```');
    console.log('');
    console.log('This will add the missing opening stock and make everything consistent.');

    console.log('\n' + '='.repeat(100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deepDiveAnalysis();
