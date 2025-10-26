const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOpeningStock() {
  const productId = 343;
  const variationId = 343;

  console.log('=== CHECKING OPENING STOCK ===\n');

  // Check for opening_stock transactions
  const openingStockTx = await prisma.stockTransaction.findMany({
    where: {
      productId,
      productVariationId: variationId,
      type: 'opening_stock'
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`Found ${openingStockTx.length} opening_stock transactions:\n`);

  for (const tx of openingStockTx) {
    const location = await prisma.businessLocation.findUnique({
      where: { id: tx.locationId }
    });

    console.log(`[${tx.createdAt.toISOString()}]`);
    console.log(`  Location: ${location?.name} (ID: ${tx.locationId})`);
    console.log(`  Quantity: ${tx.quantity}`);
    console.log(`  Unit Cost: ${tx.unitCost}`);
    console.log(`  Reference: ${tx.refNo || 'N/A'}`);
    console.log('');
  }

  // Check ALL transactions for Main Store (locationId = 1)
  console.log('\n=== ALL TRANSACTIONS FOR MAIN STORE (Location ID: 1) ===\n');

  const mainStoreTx = await prisma.stockTransaction.findMany({
    where: {
      productId,
      productVariationId: variationId,
      locationId: 1
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`Found ${mainStoreTx.length} transactions at Main Store:\n`);

  let runningBalance = 0;
  for (const tx of mainStoreTx) {
    runningBalance += parseFloat(tx.quantity);

    console.log(`[${tx.createdAt.toISOString().split('T')[0]}] ${tx.type.padEnd(20)} | Qty: ${String(tx.quantity).padStart(6)} | Balance: ${String(runningBalance).padStart(6)}`);
  }

  console.log(`\nFinal Calculated Balance: ${runningBalance} units`);

  // Check actual inventory
  const actualInventory = await prisma.variationLocationDetails.findFirst({
    where: {
      productVariationId: variationId,
      locationId: 1
    }
  });

  console.log(`Actual qtyAvailable in DB: ${actualInventory?.qtyAvailable} units`);
  console.log(`\nDISCREPANCY: ${runningBalance - parseFloat(actualInventory?.qtyAvailable || 0)} units`);

  await prisma.$disconnect();
}

checkOpeningStock().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});
