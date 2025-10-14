const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProductVariations() {
  const products = await prisma.product.findMany({
    where: { businessId: 1, deletedAt: null },
    include: {
      variations: {
        where: { deletedAt: null }
      }
    }
  });

  console.log(`Total products: ${products.length}\n`);

  products.forEach(p => {
    console.log(`Product: ${p.sku} - ${p.name}`);
    console.log(`  Variations: ${p.variations.length}`);
    p.variations.forEach(v => {
      console.log(`    - ${v.sku}: ${v.name || v.variationName}`);
    });
    console.log('');
  });

  await prisma.$disconnect();
}

checkProductVariations().catch(console.error);
