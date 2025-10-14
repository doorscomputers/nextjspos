const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function restoreDeletedVariation() {
  const variation = await prisma.productVariation.findFirst({
    where: {
      sku: 'PCI-0001',
      deletedAt: { not: null }
    }
  });

  if (!variation) {
    console.log('No deleted variation found for PCI-0001');
    return;
  }

  console.log('Found deleted variation:', variation.id, variation.sku);
  console.log('Restoring...');

  await prisma.productVariation.update({
    where: { id: variation.id },
    data: { deletedAt: null }
  });

  console.log('✅ Variation restored successfully');

  await prisma.$disconnect();
}

restoreDeletedVariation().catch(console.error);
