import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sku = 'C11CF11406';
  const correctPrice = 103999;
  const businessId = 1;

  console.log(`Fixing price for SKU: ${sku}`);
  console.log(`Setting price to: ${correctPrice}`);

  // Update base variation price
  const variation = await prisma.productVariation.update({
    where: { businessId_sku: { businessId, sku } },
    data: { sellingPrice: correctPrice }
  });

  console.log(`✅ Updated product_variations.selling_price to ${correctPrice}`);

  // Update Main Warehouse location price (location_id = 1)
  await prisma.variationLocationDetails.updateMany({
    where: {
      productVariationId: variation.id,
      locationId: 1
    },
    data: { sellingPrice: correctPrice }
  });

  console.log(`✅ Updated variation_location_details for Main Warehouse to ${correctPrice}`);

  // Verify
  const updated = await prisma.productVariation.findUnique({
    where: { sku },
    include: { variationLocationDetails: true }
  });

  console.log('\n=== VERIFICATION ===');
  console.log('Base price:', updated?.sellingPrice);
  updated?.variationLocationDetails.forEach(vld => {
    console.log(`  Location ${vld.locationId}: ${vld.sellingPrice}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
