const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStockAlertFix() {
  try {
    console.log('=== TESTING PRODUCT STOCK ALERT FIX ===\n');

    const businessId = 1;
    const locationId = null;

    console.log('1. Fetching ALL products with alert quantity set...');
    const allProductsWithAlerts = await prisma.variationLocationDetails.findMany({
      where: {
        ...(locationId && locationId !== 'all' ? { locationId: parseInt(locationId) } : {}),
        product: {
          businessId,
          alertQuantity: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            alertQuantity: true,
          },
        },
        productVariation: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`   Found ${allProductsWithAlerts.length} products with alert quantity set\n`);

    console.log('2. Filtering for products where current stock <= alert quantity...');
    const stockAlerts = allProductsWithAlerts.filter((item) => {
      const alertQty = item.product.alertQuantity
        ? parseFloat(item.product.alertQuantity.toString())
        : 0;
      const currentQty = parseFloat(item.qtyAvailable.toString());
      return alertQty > 0 && currentQty <= alertQty;
    });

    console.log(`   Found ${stockAlerts.length} products with low stock\n`);

    console.log('3. Taking top 10 for dashboard display...');
    const top10 = stockAlerts.slice(0, 10);
    console.log(`   Will display ${top10.length} items on dashboard\n`);

    if (top10.length > 0) {
      console.log('=== LOW STOCK PRODUCTS (Top 10) ===\n');
      top10.forEach((item, idx) => {
        const alertQty = parseFloat(item.product.alertQuantity.toString());
        const currentQty = parseFloat(item.qtyAvailable.toString());
        console.log(`${idx + 1}. ${item.product.name} (${item.productVariation.name})`);
        console.log(`   SKU: ${item.product.sku}`);
        console.log(`   Current Stock: ${currentQty}`);
        console.log(`   Alert Level: ${alertQty}`);
        console.log(`   Status: ⚠️  BELOW ALERT LEVEL\n`);
      });
    } else {
      console.log('✅ No products currently below alert levels\n');
    }

    console.log('=== VERIFICATION COMPLETE ===');
    console.log('The Product Stock Alert logic is now:');
    console.log('1. Fetch ALL products with alertQuantity set');
    console.log('2. Filter to find products where current stock <= alert level');
    console.log('3. Take top 10 after filtering');
    console.log('\nThis ensures we never miss low-stock items that are beyond the first 10 records.\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testStockAlertFix();
