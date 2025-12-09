import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const variation = await prisma.productVariation.findFirst({
    where: { sku: 'C11CF11406' },
    select: {
      id: true,
      sku: true,
      sellingPrice: true,
      product: { select: { name: true } }
    }
  });

  console.log('Product:', variation?.product.name);
  console.log('Variation SKU:', variation?.sku);
  console.log('sellingPrice (raw):', variation?.sellingPrice);
  console.log('sellingPrice (type):', typeof variation?.sellingPrice);
  console.log('sellingPrice as Number:', Number(variation?.sellingPrice));
}

main().catch(console.error).finally(() => prisma.$disconnect());
