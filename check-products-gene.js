const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
  try {
    console.log('Checking for products starting with "Gene" or "gener"...\n');

    // Check all products with Gene in the name
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: 'Gene', mode: 'insensitive' } },
          { name: { contains: 'gener', mode: 'insensitive' } },
          { name: { startsWith: 'Gene', mode: 'insensitive' } },
        ],
        isActive: true,
      },
      include: {
        variations: true,
      },
    });

    console.log(`Found ${products.length} products:`);

    products.forEach(product => {
      console.log(`\nProduct ID: ${product.id}`);
      console.log(`  Name: ${product.name}`);
      console.log(`  Business ID: ${product.businessId}`);
      console.log(`  Active: ${product.isActive}`);
      console.log(`  Variations: ${product.variations.length}`);
      product.variations.forEach(v => {
        console.log(`    - ${v.name} (SKU: ${v.sku})`);
      });
    });

    if (products.length === 0) {
      console.log('\n⚠️ No products found with "Gene" in the name!');
      console.log('\nLet me check all products:');

      const allProducts = await prisma.product.findMany({
        take: 10,
        include: {
          variations: {
            take: 1,
          },
        },
      });

      console.log(`\nFirst 10 products in database:`);
      allProducts.forEach(p => {
        console.log(`  - ${p.name} (ID: ${p.id}, Business: ${p.businessId})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
