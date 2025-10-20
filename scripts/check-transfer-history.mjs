import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTransferHistory() {
  console.log('\n🔍 Checking Transfer History...\n');

  try {
    // Get transfer #1
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: 1 },
      include: {
        fromLocation: true,
        toLocation: true,
        items: true
      }
    });

    console.log('Transfer:', transfer?.transferNumber);
    console.log('Status:', transfer?.status);
    console.log('From:', transfer?.fromLocation.name);
    console.log('To:', transfer?.toLocation.name);
    console.log('Items:', transfer?.items.length);

    // Check ProductHistory entries
    const historyEntries = await prisma.productHistory.findMany({
      where: {
        referenceType: 'transfer',
        referenceId: 1
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n📊 ProductHistory Entries Found: ${historyEntries.length}\n`);

    for (const entry of historyEntries) {
      console.log(`  Type: ${entry.transactionType}`);
      console.log(`  Product ID: ${entry.productId}, Variation ID: ${entry.productVariationId}`);
      console.log(`  Location ID: ${entry.locationId}`);
      console.log(`  Quantity Change: ${entry.quantityChange}`);
      console.log(`  Balance After: ${entry.balanceAfter}`);
      console.log(`  Created: ${entry.createdAt}`);
      console.log('  ---');
    }

    if (historyEntries.length === 0) {
      console.log('⚠️  NO PRODUCT HISTORY ENTRIES FOUND!');
      console.log('⚠️  This means the stock operations did not execute properly.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransferHistory();
