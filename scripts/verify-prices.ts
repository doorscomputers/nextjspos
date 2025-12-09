import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Verify a few updated products
  const samples = [
    '619659136710', // SANDISK ULTRA FLAIR - should be 756.25
    '4711421965354', // A4TECH 3330N - should be 890
    '8886482303110', // EPSON L3210 - should be 8700
  ];

  console.log('=== Verification of Updated Prices ===\n');

  // Get location names
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });
  const locMap: Record<number, string> = {};
  locations.forEach(l => { locMap[l.id] = l.name; });

  for (const sku of samples) {
    const variation = await prisma.productVariation.findFirst({
      where: { sku },
      include: {
        product: { select: { name: true } },
      }
    });

    if (variation) {
      console.log(`Product: ${variation.product.name}`);
      console.log(`  SKU: ${variation.sku}`);
      console.log(`  Base Price: P${variation.sellingPrice}`);

      // Get location prices
      const locationPrices = await prisma.variationLocationDetails.findMany({
        where: { productVariationId: variation.id },
      });

      console.log('  Location Prices:');
      for (const lp of locationPrices) {
        const locName = locMap[lp.locationId] || `Location ${lp.locationId}`;
        console.log(`    - ${locName}: P${lp.sellingPrice}`);
      }
      console.log('');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
