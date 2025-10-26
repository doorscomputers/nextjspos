const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCorrections() {
  console.log('='.repeat(80));
  console.log('CHECKING INVENTORY CORRECTIONS FOR ADATA 512GB');
  console.log('='.repeat(80));
  console.log('');

  // Find product
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: '4711085931528' },
        { name: { contains: 'ADATA 512GB', mode: 'insensitive' } }
      ]
    },
    include: {
      variations: true
    }
  });

  if (!product || !product.variations[0]) {
    console.log('❌ Product not found');
    return;
  }

  const variationId = product.variations[0].id;
  console.log('✅ Product Found:', product.name);
  console.log('   Variation ID:', variationId);
  console.log('');

  // Check inventory corrections
  console.log('📋 INVENTORY CORRECTIONS:');
  console.log('-'.repeat(80));
  const corrections = await prisma.inventoryCorrection.findMany({
    where: {
      productId: product.id,
      productVariationId: variationId,
      locationId: 1 // Main Store
    },
    include: {
      stockTransaction: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (corrections.length === 0) {
    console.log('  No inventory corrections found');
  } else {
    for (const corr of corrections) {
      console.log(`  Correction #${corr.id}:`);
      console.log(`  Correction Number: ${corr.correctionNumber}`);
      console.log(`  Status: ${corr.status}`);
      console.log(`  Created: ${new Date(corr.createdAt).toISOString()}`);
      console.log(`  Approved: ${corr.approvedAt ? new Date(corr.approvedAt).toISOString() : 'Not approved'}`);
      console.log(`  Reason: ${corr.reason}`);
      console.log(`  Stock Transaction ID: ${corr.stockTransactionId}`);
      if (corr.stockTransaction) {
        console.log(`  Stock Transaction Quantity: ${corr.stockTransaction.quantity.toString()}`);
        console.log(`  Stock Transaction Type: ${corr.stockTransaction.type}`);
        console.log(`  Stock Transaction Balance: ${corr.stockTransaction.balanceQty.toString()}`);
      } else {
        console.log(`  ⚠️  NO LINKED STOCK TRANSACTION!`);
      }
      console.log('  ---');
    }
  }
  console.log('');

  // Check ALL productHistory for adjustments
  console.log('📜 PRODUCT HISTORY (adjustment type):');
  console.log('-'.repeat(80));
  const adjustments = await prisma.productHistory.findMany({
    where: {
      productVariationId: variationId,
      locationId: 1,
      transactionType: 'adjustment'
    },
    orderBy: {
      transactionDate: 'desc'
    }
  });

  if (adjustments.length === 0) {
    console.log('  No adjustment records in productHistory');
  } else {
    for (const adj of adjustments) {
      console.log(`  Date: ${new Date(adj.transactionDate).toISOString()}`);
      console.log(`  Reference: ${adj.referenceType} #${adj.referenceId}`);
      console.log(`  Quantity Change: ${adj.quantityChange.toString()}`);
      console.log(`  Balance After: ${adj.balanceQuantity.toString()}`);
      console.log(`  Reason: ${adj.reason || 'N/A'}`);
      console.log('  ---');
    }
  }
  console.log('');

  // Check current stock
  console.log('💾 CURRENT STOCK IN DATABASE:');
  console.log('-'.repeat(80));
  const vld = await prisma.variationLocationDetails.findFirst({
    where: {
      productId: product.id,
      productVariationId: variationId,
      locationId: 1
    }
  });

  if (vld) {
    console.log(`  Current qtyAvailable: ${vld.qtyAvailable.toString()}`);
  } else {
    console.log('  ❌ No stock record found');
  }

  console.log('');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

checkCorrections().catch(console.error);
