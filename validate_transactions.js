const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateTransactions() {
  console.log('='.repeat(80));
  console.log('TRANSACTION VALIDATION: Checking for Phantom Transactions');
  console.log('='.repeat(80));
  console.log('');

  let phantomCount = 0;

  // 1. Check Purchase Receipts
  console.log('📦 Checking Purchase Receipts...');
  const approvedReceipts = await prisma.purchaseReceipt.findMany({
    where: { status: 'approved' },
    include: { items: true }
  });

  for (const receipt of approvedReceipts) {
    for (const item of receipt.items) {
      const historyEntry = await prisma.productHistory.findFirst({
        where: {
          referenceType: 'purchase_receipt',
          referenceId: receipt.id,
          productVariationId: item.productVariationId,
          locationId: receipt.locationId
        }
      });

      if (!historyEntry) {
        console.log(`⚠️ PHANTOM: Purchase Receipt ${receipt.receiptNumber} - Product ${item.productId} has NO productHistory entry!`);
        phantomCount++;
      }
    }
  }
  console.log(`✅ Checked ${approvedReceipts.length} receipts`);
  console.log('');

  // 2. Check Supplier Returns
  console.log('📤 Checking Purchase Returns (Supplier Returns)...');
  const approvedReturns = await prisma.supplierReturn.findMany({
    where: { status: 'approved' },
    include: { items: true }
  });

  for (const returnRec of approvedReturns) {
    for (const item of returnRec.items) {
      const historyEntry = await prisma.productHistory.findFirst({
        where: {
          referenceType: 'supplier_return',
          referenceId: returnRec.id,
          productVariationId: item.productVariationId,
          locationId: returnRec.locationId
        }
      });

      if (!historyEntry) {
        console.log(`⚠️ PHANTOM: Supplier Return ${returnRec.returnNumber} - Product ${item.productId} has NO productHistory entry!`);
        phantomCount++;
      }
    }
  }
  console.log(`✅ Checked ${approvedReturns.length} supplier returns`);
  console.log('');

  // 3. Check Customer Returns
  console.log('📥 Checking Customer Returns...');
  const approvedCustomerReturns = await prisma.customerReturn.findMany({
    where: { status: 'approved' },
    include: { items: true }
  });

  for (const returnRec of approvedCustomerReturns) {
    for (const item of returnRec.items) {
      const historyEntry = await prisma.productHistory.findFirst({
        where: {
          referenceType: 'customer_return',
          referenceId: returnRec.id,
          productVariationId: item.productVariationId,
          locationId: returnRec.locationId
        }
      });

      if (!historyEntry) {
        console.log(`⚠️ PHANTOM: Customer Return ${returnRec.returnNumber} - Product ${item.productId} has NO productHistory entry!`);
        phantomCount++;
      }
    }
  }
  console.log(`✅ Checked ${approvedCustomerReturns.length} customer returns`);
  console.log('');

  // 4. Check Inventory Corrections
  console.log('🔧 Checking Inventory Corrections...');
  const approvedCorrections = await prisma.inventoryCorrection.findMany({
    where: { status: 'approved' }
  });

  for (const correction of approvedCorrections) {
    const historyEntry = await prisma.productHistory.findFirst({
      where: {
        referenceType: 'inventory_correction',
        referenceId: correction.id,
        productVariationId: correction.productVariationId,
        locationId: correction.locationId
      }
    });

    if (!historyEntry) {
      console.log(`⚠️ PHANTOM: Inventory Correction ${correction.correctionNumber || correction.id} - Product ${correction.productId} has NO productHistory entry!`);
      phantomCount++;
    }
  }
  console.log(`✅ Checked ${approvedCorrections.length} inventory corrections`);
  console.log('');

  // 5. Check Stock Transfers (already fixed, but let's verify)
  console.log('🚚 Checking Stock Transfers...');
  const completedTransfers = await prisma.stockTransfer.findMany({
    where: { status: 'completed' },
    include: { items: true }
  });

  for (const transfer of completedTransfers) {
    for (const item of transfer.items) {
      // Check transfer_out history
      const historyOut = await prisma.productHistory.findFirst({
        where: {
          referenceType: 'transfer',
          referenceId: transfer.id,
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId,
          transactionType: 'transfer_out'
        }
      });

      // Check transfer_in history
      const historyIn = await prisma.productHistory.findFirst({
        where: {
          referenceType: 'transfer',
          referenceId: transfer.id,
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId,
          transactionType: 'transfer_in'
        }
      });

      if (!historyOut) {
        console.log(`⚠️ PHANTOM: Transfer ${transfer.transferNumber} - Transfer OUT has NO productHistory entry!`);
        phantomCount++;
      }

      if (!historyIn) {
        console.log(`⚠️ PHANTOM: Transfer ${transfer.transferNumber} - Transfer IN has NO productHistory entry!`);
        phantomCount++;
      }
    }
  }
  console.log(`✅ Checked ${completedTransfers.length} transfers`);
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  if (phantomCount === 0) {
    console.log('✅ NO PHANTOM TRANSACTIONS FOUND! All approved/completed transactions have productHistory entries.');
  } else {
    console.log(`⚠️ FOUND ${phantomCount} PHANTOM TRANSACTIONS!`);
    console.log('These transactions are marked as approved/completed but have NO productHistory entries.');
    console.log('They will cause incorrect Stock History reports.');
    console.log('');
    console.log('RECOMMENDATION: Review these transactions and either:');
    console.log('1. Create missing productHistory entries');
    console.log('2. Change transaction status back to pending');
    console.log('3. Delete invalid transactions');
  }
  console.log('');

  await prisma.$disconnect();
}

validateTransactions().catch(console.error);
