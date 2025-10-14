const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixProductVariation() {
  // Find product PCI-0001 which has no variations
  const product = await prisma.product.findFirst({
    where: { sku: 'PCI-0001', businessId: 1 },
    include: { variations: true }
  });

  if (!product) {
    console.log('Product PCI-0001 not found');
    return;
  }

  console.log(`Product: ${product.sku} - ${product.name}`);
  console.log(`Current variations: ${product.variations.length}`);

  if (product.variations.length === 0) {
    console.log('\nCreating default variation...');

    await prisma.productVariation.create({
      data: {
        businessId: product.businessId,
        productId: product.id,
        name: 'Default',
        sku: product.sku,
        purchasePrice: product.purchasePrice || 0,
        sellingPrice: product.sellingPrice || 0,
        isDefault: true,
        unitId: product.unitId
      }
    });

    console.log('✅ Default variation created successfully');
  } else {
    console.log('Product already has variations');
  }

  await prisma.$disconnect();
}

fixProductVariation().catch(console.error);
