import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeInventoryDiscrepancy() {
  try {
    console.log('='.repeat(80));
    console.log('FORENSIC INVENTORY ANALYSIS - ADATA 512GB 2.5 SSD');
    console.log('='.repeat(80));

    // Step 1: Find the product
    console.log('\n[STEP 1] Finding Product...\n');
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: '4711085591528' },
          { name: { contains: 'ADATA 512GB 2.5 SSD' } }
        ]
      },
      include: {
        category: true
      }
    });

    if (!product) {
      console.log('❌ Product not found!');
      return;
    }

    console.log('✅ Product Found:');
    console.log(`   ID: ${product.id}`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Business ID: ${product.businessId}`);
    console.log(`   Type: ${product.type}`);
    console.log(`   Category: ${product.category?.name || 'N/A'}`);

    // Step 1.5: Get Product Variations
    console.log('\n[STEP 1.5] Finding Product Variations...\n');
    const variations = await prisma.productVariation.findMany({
      where: {
        productId: product.id,
        deletedAt: null
      }
    });

    console.log(`✅ Found ${variations.length} active variation(s):`);
    variations.forEach(v => {
      console.log(`   - Variation ID: ${v.id}, Name: ${v.name}, SKU: ${v.sku}`);
    });

    if (variations.length === 0) {
      console.log('❌ No variations found! This is a problem.');
      return;
    }

    const variation = variations[0]; // Use first variation

    // Step 2: Find Main Warehouse
    console.log('\n[STEP 2] Finding Main Warehouse...\n');
    const mainWarehouse = await prisma.businessLocation.findFirst({
      where: {
        businessId: product.businessId,
        name: { contains: 'Main Warehouse' }
      }
    });

    if (!mainWarehouse) {
      console.log('❌ Main Warehouse not found!');
      return;
    }

    console.log('✅ Main Warehouse Found:');
    console.log(`   ID: ${mainWarehouse.id}`);
    console.log(`   Name: ${mainWarehouse.name}`);

    // Step 3: Get current stock from VariationLocationDetails
    console.log('\n[STEP 3] Current Stock from VariationLocationDetails...\n');
    const stockDetails = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variation.id,
          locationId: mainWarehouse.id
        }
      }
    });

    console.log('Current Stock Record:');
    console.log(`   Variation ID: ${variation.id}`);
    console.log(`   Quantity on Hand: ${stockDetails?.qtyAvailable || 0}`);
    console.log(`   Deleted: ${stockDetails?.deletedAt ? 'YES ⚠️' : 'NO'}`);

    // Step 4: Get ALL StockTransaction records
    console.log('\n[STEP 4] ALL StockTransaction Records...\n');

    const allHistory = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variation.id,
        locationId: mainWarehouse.id
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log(`Total Records Found: ${allHistory.length}`);
    console.log('\nTransaction History (Chronological):');
    console.log('-'.repeat(140));
    console.log('ID   | Date                | Type              | Qty Change | Balance After | Unit Cost | Reference         | Notes');
    console.log('-'.repeat(140));

    let runningBalance = 0;
    let expectedBalance = 0;

    allHistory.forEach((record, index) => {
      const id = record.id.toString().padStart(4);
      const date = new Date(record.createdAt).toLocaleString();
      const type = record.type.padEnd(17);
      const qty = parseFloat(record.quantity).toFixed(2).padStart(10);
      const balance = parseFloat(record.balanceQty).toFixed(2).padStart(13);
      const unitCost = record.unitCost ? parseFloat(record.unitCost).toFixed(2).padStart(9) : 'N/A'.padStart(9);
      const ref = `${record.referenceType || 'N/A'}:${record.referenceId || 'N/A'}`.padEnd(17);
      const note = (record.notes || '').substring(0, 30);

      console.log(`${id} | ${date} | ${type} | ${qty} | ${balance} | ${unitCost} | ${ref} | ${note}`);

      expectedBalance = parseFloat(record.balanceQty);
    });

    console.log('-'.repeat(140));

    // Step 5: Calculate expected vs actual
    console.log('\n[STEP 5] Balance Verification...\n');

    const lastRecord = allHistory[allHistory.length - 1];

    console.log(`Total Transactions: ${allHistory.length}`);
    console.log(`Last Transaction Balance: ${lastRecord?.balanceQty || 0}`);
    console.log(`Current Stock Details: ${stockDetails?.qtyAvailable || 0}`);
    console.log(`Discrepancy: ${(stockDetails?.qtyAvailable || 0) - (lastRecord?.balanceQty || 0)}`);

    // Step 6: Aggregate by transaction type
    console.log('\n[STEP 6] Transaction Type Summary...\n');

    const typeSummary = {};
    allHistory.forEach(record => {
      const type = record.type;
      if (!typeSummary[type]) {
        typeSummary[type] = { count: 0, totalQty: 0 };
      }
      typeSummary[type].count++;
      typeSummary[type].totalQty += parseFloat(record.quantity);
    });

    console.log('Transaction Type    | Count | Total Quantity');
    console.log('-'.repeat(50));
    for (const [type, data] of Object.entries(typeSummary)) {
      console.log(`${type.padEnd(19)} | ${data.count.toString().padStart(5)} | ${data.totalQty.toFixed(2).padStart(14)}`);
    }

    // Step 7: Check for orphaned or missing references
    console.log('\n[STEP 7] Checking Reference Integrity...\n');

    for (const record of allHistory) {
      if (record.referenceType && record.referenceId) {
        try {
          switch (record.referenceType) {
            case 'purchase_receipt':
              const receipt = await prisma.purchaseReceipt.findUnique({
                where: { id: record.referenceId },
                select: { id: true, status: true }
              });
              if (!receipt) {
                console.log(`❌ Transaction ${record.id}: Purchase receipt ${record.referenceId} NOT FOUND!`);
              } else if (receipt.status !== 'approved') {
                console.log(`⚠️  Transaction ${record.id}: Purchase receipt ${record.referenceId} status is ${receipt.status}!`);
              }
              break;
            case 'sale':
              const sale = await prisma.sale.findUnique({
                where: { id: record.referenceId },
                select: { id: true, deletedAt: true }
              });
              if (!sale) {
                console.log(`❌ Transaction ${record.id}: Sale ${record.referenceId} NOT FOUND!`);
              } else if (sale.deletedAt) {
                console.log(`⚠️  Transaction ${record.id}: Sale ${record.referenceId} is SOFT-DELETED!`);
              }
              break;
            case 'transfer':
              const transfer = await prisma.stockTransfer.findUnique({
                where: { id: record.referenceId },
                select: { id: true, status: true }
              });
              if (!transfer) {
                console.log(`❌ Transaction ${record.id}: Transfer ${record.referenceId} NOT FOUND!`);
              }
              break;
          }
        } catch (error) {
          console.log(`❌ Error checking ${record.referenceType}:${record.referenceId} - ${error.message}`);
        }
      }
    }

    // Step 8: Check for purchases without history
    console.log('\n[STEP 8] Checking for Missing Purchase Transaction History...\n');

    const purchaseReceipts = await prisma.purchaseReceipt.findMany({
      where: {
        businessId: product.businessId,
        status: 'approved',
        items: {
          some: {
            productVariationId: variation.id
          }
        }
      },
      include: {
        items: {
          where: {
            productVariationId: variation.id
          }
        }
      }
    });

    console.log(`Total Approved Purchase Receipts for this variation: ${purchaseReceipts.length}`);

    for (const receipt of purchaseReceipts) {
      const hasHistory = allHistory.some(h =>
        h.referenceType === 'purchase_receipt' && h.referenceId === receipt.id
      );

      if (!hasHistory) {
        console.log(`❌ MISSING HISTORY: Purchase Receipt ${receipt.id} (${receipt.receiptNumber}) has NO StockTransaction!`);
        receipt.items.forEach(item => {
          console.log(`   Item Qty: ${item.quantity}, Unit Cost: ${item.unitCost}`);
        });
      }
    }

    // Step 9: Manual calculation from transactions
    console.log('\n[STEP 9] Manual Balance Calculation...\n');

    let manualBalance = 0;
    console.log('Recalculating balance from transactions:');

    allHistory.forEach((record, index) => {
      const previousBalance = manualBalance;
      manualBalance += parseFloat(record.quantity);

      const qtyStr = parseFloat(record.quantity) > 0 ? `+${parseFloat(record.quantity).toFixed(2)}` : parseFloat(record.quantity).toFixed(2);
      console.log(`${index + 1}. ${record.type}: ${qtyStr} | ${previousBalance.toFixed(2)} → ${manualBalance.toFixed(2)} (Recorded: ${parseFloat(record.balanceQty).toFixed(2)})`);

      if (Math.abs(manualBalance - parseFloat(record.balanceQty)) > 0.01) {
        console.log(`   ⚠️  MISMATCH! Calculated: ${manualBalance.toFixed(2)}, Recorded: ${parseFloat(record.balanceQty).toFixed(2)}`);
      }
    });

    console.log(`\nFinal Manual Balance: ${manualBalance.toFixed(2)}`);
    console.log(`Current Stock Details: ${(stockDetails?.qtyAvailable || 0)}`);
    console.log(`Difference: ${((stockDetails?.qtyAvailable || 0) - manualBalance).toFixed(2)}`);

    // Step 10: Check ProductHistory table
    console.log('\n[STEP 10] Checking ProductHistory Table...\n');

    const productHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variation.id,
        locationId: mainWarehouse.id
      },
      orderBy: [
        { transactionDate: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log(`ProductHistory Records Found: ${productHistory.length}`);

    if (productHistory.length > 0) {
      console.log('\nProductHistory Summary:');
      const phSummary = {};
      productHistory.forEach(ph => {
        const type = ph.transactionType;
        if (!phSummary[type]) {
          phSummary[type] = { count: 0, totalQty: 0 };
        }
        phSummary[type].count++;
        phSummary[type].totalQty += parseFloat(ph.quantityChange);
      });

      for (const [type, data] of Object.entries(phSummary)) {
        console.log(`  ${type}: ${data.count} transactions, Total: ${data.totalQty.toFixed(2)}`);
      }
    }

    // Step 11: Recommendations
    console.log('\n[STEP 11] DIAGNOSIS & RECOMMENDATIONS...\n');
    console.log('='.repeat(80));

    if (Math.abs((stockDetails?.qtyAvailable || 0) - manualBalance) > 0.01) {
      console.log('❌ DISCREPANCY CONFIRMED!');
      console.log('\nPossible Causes:');
      console.log('1. VariationLocationDetails was updated without creating StockTransaction');
      console.log('2. StockTransaction balance was calculated incorrectly');
      console.log('3. A transaction was processed with incorrect quantity');
      console.log('4. Database integrity issue or concurrent update problem');
      console.log('5. ProductHistory and StockTransaction are out of sync');

      console.log('\nRecommended Actions:');
      console.log('1. Review the transactions listed above to identify the error');
      console.log('2. Create a stock adjustment to correct the physical count');
      console.log('3. Audit recent transactions for data integrity');
      console.log('4. Verify both StockTransaction and ProductHistory tables');
      console.log('5. Add database constraints and transaction locks');
    } else {
      console.log('✅ Stock is consistent with transaction history!');
      console.log('\nThe discrepancy shown in the report may be due to:');
      console.log('1. Report is using ProductHistory instead of StockTransaction');
      console.log('2. Report is aggregating opening_stock incorrectly');
      console.log('3. Report is filtering transactions differently');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeInventoryDiscrepancy();
