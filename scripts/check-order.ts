import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check the newest and oldest products
  const newest = await prisma.product.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, sku: true, createdAt: true }
  });

  const oldest = await prisma.product.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, sku: true, createdAt: true }
  });

  const cp678w = await prisma.product.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { sku: { equals: 'cp678w', mode: 'insensitive' } },
        { name: { contains: 'cp678w', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, sku: true, createdAt: true }
  });

  console.log('Newest product (first in DESC order):');
  console.log('  ', newest?.name, '- Created:', newest?.createdAt);

  console.log('\nOldest product (last in DESC order):');
  console.log('  ', oldest?.name, '- Created:', oldest?.createdAt);

  console.log('\nCP678W:');
  console.log('  ', cp678w?.name, '- Created:', cp678w?.createdAt);

  // Check if CP678W is the oldest
  if (cp678w && oldest && cp678w.id === oldest.id) {
    console.log('\n⚠️ CP678W IS THE OLDEST PRODUCT!');
    console.log('With DESC ordering, it will be LAST in the list.');
    console.log('Since MAX_PAGE_SIZE=1000, and you have 1543 products,');
    console.log('the API only returns products 1-1000, excluding CP678W.');
  }

  await prisma.$disconnect();
}

check();
