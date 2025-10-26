const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInventory() {
  const sku = '4711085931528';

  console.log('=== INVESTIGATING INVENTORY DISCREPANCY ===\n');

  // Find product by SKU
  const product = await prisma.product.findFirst({
    where: { sku },
    include: {
      variations: {
        include: {
          variationLocationDetails: true
        }
      }
    }
  });

  console.log('PRODUCT INFO:');
  console.log('  Name:', product?.name);
  console.log('  SKU:', product?.sku);
  console.log('  Product ID:', product?.id);
  console.log('');

  if (product?.variations) {
    for (const variation of product.variations) {
      console.log(`VARIATION: ${variation.name} (ID: ${variation.id})`);
      console.log('');

      for (const detail of variation.variationLocationDetails) {
        // Get location name
        const location = await prisma.businessLocation.findUnique({
          where: { id: detail.locationId }
        });

        console.log(`  Location: ${location?.name} (ID: ${detail.locationId})`);
        console.log(`    qtyAvailable: ${detail.qtyAvailable} units`);
        console.log(`    sellingPrice: ₱${detail.sellingPrice || 'null'}`);
        console.log('');
      }

      // Now check stock transactions for Main Store
      console.log('\n=== STOCK TRANSACTIONS FOR MAIN STORE ===\n');

      const transactions = await prisma.stockTransaction.findMany({
        where: {
          productId: product.id,
          productVariationId: variation.id,
        },
        include: {
          product: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 20
      });

      console.log(`Found ${transactions.length} stock transactions:\n`);

      for (const tx of transactions) {
        const location = await prisma.businessLocation.findUnique({
          where: { id: tx.locationId }
        });

        console.log(`[${tx.createdAt.toISOString().split('T')[0]}] ${tx.type}`);
        console.log(`  Location: ${location?.name}`);
        console.log(`  Quantity: ${tx.quantity}`);
        console.log(`  Reference: ${tx.refNo || 'N/A'}`);
        console.log('');
      }
    }
  }

  await prisma.$disconnect();
}

checkInventory().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});
