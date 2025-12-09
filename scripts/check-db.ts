import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });
  console.log('Active Locations:', JSON.stringify(locations, null, 2));

  // Find a sample product by SKU
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '619659136710' },
    select: {
      id: true,
      sku: true,
      sellingPrice: true,
      product: { select: { name: true } }
    }
  });
  console.log('\nSample Variation (SKU 619659136710):', JSON.stringify(variation, null, 2));

  // Count total variations
  const count = await prisma.productVariation.count();
  console.log('\nTotal ProductVariations:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
