import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('\n📦 STOCK VERIFICATION AFTER TRANSFER\n');

const variationIds = [824, 306, 1329];
const locations = [
  { id: 1, name: 'Main Store' },
  { id: 2, name: 'Main Warehouse' }
];

for (const varId of variationIds) {
  console.log(`\n─── Variation ID: ${varId} ───`);

  for (const loc of locations) {
    const stock = await prisma.productStock.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: varId,
          locationId: loc.id
        }
      }
    });

    console.log(`  ${loc.name}: ${stock?.quantity || 0} units`);
  }
}

console.log('\n\n📊 ProductHistory Summary:\n');

const history = await prisma.productHistory.findMany({
  where: {
    referenceType: 'transfer',
    referenceId: 1
  },
  orderBy: {
    createdAt: 'asc'
  }
});

const outEntries = history.filter(h => h.transactionType === 'transfer_out');
const inEntries = history.filter(h => h.transactionType === 'transfer_in');

console.log(`✅ TRANSFER_OUT entries: ${outEntries.length}`);
console.log(`✅ TRANSFER_IN entries: ${inEntries.length}`);

console.log('\n\n✅ VERIFICATION COMPLETE\n');
console.log('If stock numbers match expectations and both');
console.log('TRANSFER_OUT and TRANSFER_IN entries exist,');
console.log('the system is tracking inventory correctly!\n');

await prisma.$disconnect();
