import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
    },
  },
});

async function investigateProduct() {
  try {
    console.log('========================================');
    console.log('INVESTIGATION: Product INATX750W Price Changes');
    console.log('========================================\n');

    // Query 1: Get the product
    console.log('1. PRODUCT DETAILS FOR INATX750W');
    console.log('-----------------------------------');
    const product = await prisma.product.findFirst({
      where: { sku: 'INATX750W' },
      select: {
        id: true,
        businessId: true,
        name: true,
        sku: true,
        purchasePrice: true,
        sellingPrice: true,
        marginPercentage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      console.log('ERROR: Product with SKU "INATX750W" not found!');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(JSON.stringify(product, null, 2));
    console.log(`\nProduct ID: ${product.id}`);
    console.log(`Business ID: ${product.businessId}`);

    // Query 2: Check ProductHistory for this product
    console.log('\n\n2. PRODUCT HISTORY (Stock Transactions)');
    console.log('----------------------------------------');
    const history = await prisma.productHistory.findMany({
      where: { productId: product.id },
      orderBy: { transactionDate: 'desc' },
      take: 50,
      select: {
        id: true,
        transactionType: true,
        transactionDate: true,
        referenceType: true,
        referenceId: true,
        quantityChange: true,
        balanceQuantity: true,
        unitCost: true,
        totalValue: true,
        createdByName: true,
        createdAt: true,
      },
    });

    console.log(`Found ${history.length} history records:`);
    console.log(JSON.stringify(history, null, 2));

    // Query 3: Check ProductUnitPrice
    console.log('\n\n3. PRODUCT UNIT PRICES');
    console.log('----------------------');
    const unitPrices = await prisma.productUnitPrice.findMany({
      where: { productId: product.id },
      select: {
        id: true,
        productId: true,
        unitId: true,
        baseUnitPrice: true,
        saleUnitPrice: true,
        marginPercentage: true,
        lastPriceUpdatedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`Found ${unitPrices.length} unit price records:`);
    console.log(JSON.stringify(unitPrices, null, 2));

    // Query 4: Check ProductUnitLocationPrice
    console.log('\n\n4. PRODUCT UNIT LOCATION PRICES');
    console.log('-------------------------------');
    const locationPrices = await prisma.productUnitLocationPrice.findMany({
      where: { productId: product.id },
      select: {
        id: true,
        productId: true,
        locationId: true,
        unitId: true,
        salePrice: true,
        costPrice: true,
        lastPriceUpdatedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`Found ${locationPrices.length} location price records:`);
    console.log(JSON.stringify(locationPrices, null, 2));

    // Query 5: Check VariationLocationDetails for variations
    console.log('\n\n5. VARIATION LOCATION DETAILS');
    console.log('----------------------------');
    const variations = await prisma.productVariation.findMany({
      where: { productId: product.id },
      select: {
        id: true,
        sku: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (variations.length > 0) {
      console.log(`Found ${variations.length} variations:`);
      for (const variation of variations) {
        const varDetails = await prisma.variationLocationDetails.findMany({
          where: { productVariationId: variation.id },
          select: {
            id: true,
            locationId: true,
            costPrice: true,
            salePrice: true,
            lastPriceUpdatedBy: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        console.log(`\n  Variation ID ${variation.id} (${variation.sku}):`);
        console.log(JSON.stringify(varDetails, null, 2));
      }
    } else {
      console.log('No variations found for this product');
    }

    // Query 6: Check AuditLog for product changes
    console.log('\n\n6. AUDIT LOG (Product Changes)');
    console.log('-----------------------------');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Product',
        entityId: product.id.toString(),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        businessId: true,
        entityType: true,
        entityId: true,
        action: true,
        userId: true,
        changes: true,
        createdAt: true,
      },
    });

    console.log(`Found ${auditLogs.length} audit log records:`);
    console.log(JSON.stringify(auditLogs, null, 2));

    console.log('\n\n========================================');
    console.log('INVESTIGATION COMPLETE');
    console.log('========================================');
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateProduct();
