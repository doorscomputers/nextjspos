import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const variation = await prisma.productVariation.findFirst({
    where: { sku: 'C11CF11406' },
    include: {
      product: { select: { name: true } },
      variationLocationDetails: true
    }
  });

  if (variation) {
    console.log('=== PRODUCT VARIATION ===');
    console.log('Product:', variation.product.name);
    console.log('Variation SKU:', variation.sku);
    console.log('Base sellingPrice:', variation.sellingPrice, '(type:', typeof variation.sellingPrice, ')');

    // Get location names
    const locationIds = variation.variationLocationDetails.map(vld => vld.locationId);
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true }
    });
    const locMap = new Map(locations.map(l => [l.id, l.name]));

    console.log('\n=== LOCATION PRICES (variationLocationDetails) ===');
    variation.variationLocationDetails.forEach(vld => {
      console.log(`  ${locMap.get(vld.locationId) || vld.locationId}: ${vld.sellingPrice} (type: ${typeof vld.sellingPrice})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
