import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const searchTerms = [
    'MCDODO CA4770',
    'MCDODO CH-1533',
    'UGREEN PB572',
    'UGREEN LP451',
    'VENTION 20000MAH POWER BANK',
    'VENTION 10000MAH POWER BANK'
  ];

  for (const term of searchTerms) {
    const products = await prisma.product.findMany({
      where: {
        businessId: 1,
        name: { contains: term, mode: 'insensitive' }
      },
      include: {
        variations: {
          select: { id: true, sku: true, sellingPrice: true }
        }
      }
    });

    if (products.length > 0) {
      products.forEach(p => {
        console.log('Product:', p.name);
        console.log('  SKU:', p.sku || 'N/A');
        p.variations.forEach(v => {
          console.log('  Variation SKU:', v.sku, '| Price:', v.sellingPrice);
        });
      });
    } else {
      console.log('NOT FOUND:', term);
    }
    console.log('---');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
