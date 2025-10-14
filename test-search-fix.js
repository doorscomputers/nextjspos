const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSearch() {
  try {
    const businessId = 1;
    const searchTrimmed = 'gener';

    console.log('Testing the fuzzy search query...\n');
    console.log(`Search term: "${searchTrimmed}"`);
    console.log(`Business ID: ${businessId}\n`);

    // This is the FIXED query - should return ALL variations
    const fuzzyMatches = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [
          { name: { contains: searchTrimmed, mode: 'insensitive' } },
          {
            variations: {
              some: {
                name: { contains: searchTrimmed, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      include: {
        variations: {
          // Return ALL variations of matching products, not filtered by search term
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    console.log(`Found ${fuzzyMatches.length} products:\n`);
    fuzzyMatches.forEach(p => {
      console.log(`Product: ${p.name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Variations: ${p.variations.length}`);
      p.variations.forEach(v => {
        console.log(`    - ${v.name} (SKU: ${v.sku})`);
      });
      console.log('');
    });

    const results = fuzzyMatches
      .filter(p => p.variations && p.variations.length > 0)
      .map(product => ({
        id: product.id,
        name: product.name,
        variationCount: product.variations.length,
      }));

    console.log(`After filtering (should have ${results.length} products with variations):`);
    results.forEach(r => {
      console.log(`  - ${r.name}: ${r.variationCount} variations`);
    });

    if (results.length === 0) {
      console.log('\n⚠️ ERROR: No products returned after filtering!');
    } else {
      console.log(`\n✅ SUCCESS: ${results.length} products will be shown in dropdown`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSearch();
