const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSales() {
  console.log('='.repeat(80));
  console.log('CHECKING SALES for 2 DOOR DRAWER');
  console.log('='.repeat(80));
  console.log('');

  // Find product
  const product = await prisma.product.findFirst({
    where: { name: { contains: '2 DOOR DRAWER', mode: 'insensitive' } },
    include: { variations: true }
  });

  if (!product || !product.variations[0]) {
    console.log('Product not found');
    return;
  }

  const variationId = product.variations[0].id;
  console.log('Product:', product.name);
  console.log('Variation ID:', variationId);
  console.log('');

  // Find recent sales
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
    take: 10
  });

  console.log('Recent Sales (last 10):');
  for (const item of salesItems) {
    console.log('  Sale ID:', item.sale.id);
    console.log('  Invoice:', item.sale.invoiceNumber);
    console.log('  Date:', new Date(item.sale.saleDate).toISOString());
    console.log('  Location:', item.sale.location?.name || 'Unknown');
    console.log('  Qty Sold:', item.quantity.toString());
    console.log('  Sale Status:', item.sale.status);
    console.log('  Created:', new Date(item.createdAt).toISOString());
    console.log('  ---');
  }

  // Compare with productHistory
  console.log('');
  console.log('Comparing with productHistory for Main Store (Location ID 1):');
  const history = await prisma.productHistory.findMany({
    where: {
      productVariationId: variationId,
      locationId: 1, // Main Store
      transactionType: 'sale'
    },
    orderBy: { transactionDate: 'desc' },
    take: 10
  });

  console.log('Product History (sales):');
  for (const h of history) {
    console.log('  Date:', new Date(h.transactionDate).toISOString());
    console.log('  Reference:', h.referenceType, h.referenceId);
    console.log('  Change:', h.quantityChange.toString());
    console.log('  Balance:', h.balanceQuantity.toString());
    console.log('  ---');
  }

  await prisma.$disconnect();
}

checkSales().catch(console.error);
