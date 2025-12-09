import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the product
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '6941876243273' },
    include: {
      product: { select: { name: true } },
      variationLocationDetails: {
        include: {
          location: { select: { name: true } }
        }
      }
    }
  });

  if (variation) {
    console.log('Product:', variation.product.name);
    console.log('Base Variation Price (sellingPrice):', variation.sellingPrice);
    console.log('\nLocation-specific prices:');
    variation.variationLocationDetails.forEach(vld => {
      console.log('  -', vld.location.name, ':', vld.sellingPrice);
    });

    // Show MAX price (what Branch Stock Pivot uses)
    const prices = variation.variationLocationDetails
      .filter(vld => vld.sellingPrice !== null)
      .map(vld => Number(vld.sellingPrice));

    console.log('\nMAX price across locations:', Math.max(...prices));
    console.log('This is what Branch Stock Pivot shows!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
