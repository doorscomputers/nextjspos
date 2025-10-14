const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVariationsWithDeleted() {
  const products = await prisma.product.findMany({
    where: { businessId: 1, deletedAt: null },
    include: {
      variations: {} // Include ALL variations, even deleted ones
    }
  });

  console.log(`Total products: ${products.length}\n`);

  products.forEach(p => {
    console.log(`Product: ${p.sku} - ${p.name}`);
    console.log(`  Total variations: ${p.variations.length}`);
    const active = p.variations.filter(v => !v.deletedAt);
    const deleted = p.variations.filter(v => v.deletedAt);
    console.log(`  Active: ${active.length}, Deleted: ${deleted.length}`);

    p.variations.forEach(v => {
      const status = v.deletedAt ? '[DELETED]' : '[ACTIVE]';
      console.log(`    ${status} ${v.sku}: ${v.name || v.variationName}`);
    });
    console.log('');
  });

  await prisma.$disconnect();
}

checkVariationsWithDeleted().catch(console.error);
