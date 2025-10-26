const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProductHistory() {
  const productId = 343;
  const variationId = 343;
  const locationId = 1; // Main Store

  console.log('=== CHECKING PRODUCT HISTORY TABLE ===\n');

  //Check for records in productHistory
  const historyRecords = await prisma.productHistory.findMany({
    where: {
      productId,
      productVariationId: variationId,
      locationId
    },
    orderBy: {
      transactionDate: 'asc'
    }
  });

  console.log(`Found ${historyRecords.length} records in productHistory table:\n`);

  for (const record of historyRecords) {
    console.log(`[${record.transactionDate.toISOString().split('T')[0]}] ${record.transactionType}`);
    console.log(`  Quantity Change: ${record.quantityChange}`);
    console.log(`  Balance After: ${record.balanceAfter}`);
    console.log(`  Reference: ${record.referenceNumber || 'N/A'}`);
    console.log(`  Reason: ${record.reason || 'N/A'}`);
    console.log(`  Created By: ${record.createdByName || 'Unknown'}`);
    console.log('');
  }

  // Also check if there's a mismatch in variationLocationDetails
  const inventory = await prisma.variationLocationDetails.findFirst({
    where: {
      productVariationId: variationId,
      locationId
    }
  });

  console.log('\n=== VARIATION LOCATION DETAILS ===');
  console.log(`qtyAvailable: ${inventory?.qtyAvailable} units`);
  console.log(`Opening Stock Locked: ${inventory?.openingStockLocked}`);
  console.log(`Opening Stock Set At: ${inventory?.openingStockSetAt || 'Never'}`);

  await prisma.$disconnect();
}

checkProductHistory().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});
