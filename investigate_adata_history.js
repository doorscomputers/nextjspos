const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateAdata() {
  console.log('='.repeat(80));
  console.log('INVESTIGATING ADATA 512GB 2.5 SSD INVENTORY HISTORY');
  console.log('='.repeat(80));
  console.log('');

  // Find the product by SKU
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: '4711085931528' },
        { name: { contains: 'ADATA 512GB', mode: 'insensitive' } }
      ]
    },
    include: {
      variations: {
        include: {
          variationLocationDetails: true
        }
      }
    }
  });

  if (!product) {
    console.log('❌ Product not found');
    return;
  }

  // Fetch locations separately
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: product.businessId }
  });
  const locationMap = new Map(locations.map(l => [l.id, l.name]));

  console.log('✅ PRODUCT FOUND:');
  console.log('  Product ID:', product.id);
  console.log('  Product Name:', product.name);
  console.log('  SKU:', product.sku);
  console.log('  Variation ID:', product.variations[0]?.id);
  console.log('');

  const variationId = product.variations[0]?.id;
  if (!variationId) {
    console.log('❌ No variation found');
    return;
  }

  // Check current stock at all locations
  console.log('📦 CURRENT STOCK (variationLocationDetails.qtyAvailable):');
  console.log('-'.repeat(80));
  for (const vld of product.variations[0].variationLocationDetails) {
    const locationName = locationMap.get(vld.locationId) || 'Unknown';
    console.log(`  Location: ${locationName} (ID: ${vld.locationId})`);
    console.log(`  Current Stock: ${vld.qtyAvailable.toString()}`);
    console.log('');
  }

  // Get recent sales for this product
  console.log('💰 RECENT SALES (last 5):');
  console.log('-'.repeat(80));
  const salesItems = await prisma.saleItem.findMany({
    where: {
      productVariationId: variationId
    },
    include: {
      sale: {
        include: {
          location: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  if (salesItems.length === 0) {
    console.log('  No sales found');
  } else {
    for (const item of salesItems) {
      console.log(`  Invoice: ${item.sale.invoiceNumber}`);
      console.log(`  Date: ${new Date(item.sale.saleDate).toISOString()}`);
      console.log(`  Location: ${item.sale.location.name}`);
      console.log(`  Qty Sold: ${item.quantity.toString()}`);
      console.log(`  Unit Price: ${item.unitPrice.toString()}`);
      console.log(`  Status: ${item.sale.status}`);
      console.log('  ---');
    }
  }
  console.log('');

  // Get product history for Main Store (Location ID 1)
  console.log('📜 PRODUCT HISTORY at Main Store (Location ID 1):');
  console.log('-'.repeat(80));
  const history = await prisma.productHistory.findMany({
    where: {
      productVariationId: variationId,
      locationId: 1
    },
    orderBy: {
      transactionDate: 'desc'
    },
    take: 10
  });

  if (history.length === 0) {
    console.log('  No history found');
  } else {
    console.log('  Recent transactions (last 10):');
    for (const h of history) {
      console.log(`  Date: ${new Date(h.transactionDate).toISOString()}`);
      console.log(`  Type: ${h.transactionType}`);
      console.log(`  Reference: ${h.referenceType} #${h.referenceId}`);
      console.log(`  Quantity Change: ${h.quantityChange.toString()}`);
      console.log(`  Balance After: ${h.balanceQuantity.toString()}`);
      console.log(`  Created By: User #${h.createdBy}`);
      console.log('  ---');
    }
  }
  console.log('');

  // Check stock transactions
  console.log('📋 STOCK TRANSACTIONS at Main Store:');
  console.log('-'.repeat(80));
  const stockTxns = await prisma.stockTransaction.findMany({
    where: {
      productVariationId: variationId,
      locationId: 1
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  if (stockTxns.length === 0) {
    console.log('  No stock transactions found');
  } else {
    console.log('  Recent stock transactions (last 10):');
    for (const txn of stockTxns) {
      console.log(`  Date: ${new Date(txn.createdAt).toISOString()}`);
      console.log(`  Type: ${txn.type}`);
      console.log(`  Quantity: ${txn.quantity.toString()}`);
      console.log(`  Reference: ${txn.referenceType || 'N/A'} #${txn.referenceId || 'N/A'}`);
      console.log('  ---');
    }
  }
  console.log('');

  // Calculate expected balance from productHistory
  console.log('🧮 CALCULATED BALANCE from productHistory:');
  console.log('-'.repeat(80));

  const allHistory = await prisma.productHistory.findMany({
    where: {
      productVariationId: variationId,
      locationId: 1
    },
    orderBy: [
      { transactionDate: 'asc' },
      { id: 'asc' }
    ]
  });

  let calculatedBalance = 0;
  let lastTransaction = null;

  for (const h of allHistory) {
    calculatedBalance += parseFloat(h.quantityChange.toString());
    lastTransaction = h;
  }

  console.log(`  Calculated Balance (sum of all changes): ${calculatedBalance}`);
  console.log(`  Last Recorded Balance in History: ${lastTransaction?.balanceQuantity.toString() || 'N/A'}`);
  console.log(`  Current Stock in variationLocationDetails: ${product.variations[0].variationLocationDetails.find(vld => vld.locationId === 1)?.qtyAvailable.toString() || 'N/A'}`);
  console.log('');

  // Compare values
  const currentStock = parseFloat(product.variations[0].variationLocationDetails.find(vld => vld.locationId === 1)?.qtyAvailable.toString() || '0');
  const lastBalance = parseFloat(lastTransaction?.balanceQuantity.toString() || '0');

  if (currentStock !== calculatedBalance) {
    console.log('⚠️  WARNING: Mismatch detected!');
    console.log(`  Current Stock (${currentStock}) ≠ Calculated Balance (${calculatedBalance})`);
    console.log(`  Variance: ${currentStock - calculatedBalance}`);
  } else {
    console.log('✅ Current stock matches calculated balance from history');
  }

  if (currentStock !== lastBalance) {
    console.log('⚠️  WARNING: Stock doesn\'t match last history balance!');
    console.log(`  Current Stock (${currentStock}) ≠ Last History Balance (${lastBalance})`);
    console.log(`  Variance: ${currentStock - lastBalance}`);
  } else {
    console.log('✅ Current stock matches last history record');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

investigateAdata().catch(console.error);
