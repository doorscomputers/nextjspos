const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProducts() {
  const count = await prisma.product.count({
    where: { businessId: 1, deletedAt: null }
  });

  console.log('Total products for business 1:', count);

  const products = await prisma.product.findMany({
    where: { businessId: 1, deletedAt: null },
    select: { id: true, sku: true, name: true, isActive: true },
    take: 5
  });

  console.log('\nFirst 5 products:');
  products.forEach(p => {
    console.log(`- ${p.sku}: ${p.name} (active: ${p.isActive})`);
  });

  await prisma.$disconnect();
}

checkProducts().catch(console.error);
