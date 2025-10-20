import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkProductHistory() {
  console.log('\n=== CHECKING PRODUCT HISTORY FOR TRANSFERS ===\n');

  // Find recent transfers
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: {
        in: ['in_transit', 'received', 'completed']
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      items: true,
      fromLocation: true,
      toLocation: true
    }
  });

  console.log(`Found ${transfers.length} recent transfers:\n`);

  for (const transfer of transfers) {
    console.log(`Transfer #${transfer.transferNumber}`);
    console.log(`  Status: ${transfer.status}`);
    console.log(`  From: ${transfer.fromLocation.name} (ID: ${transfer.fromLocationId})`);
    console.log(`  To: ${transfer.toLocation.name} (ID: ${transfer.toLocationId})`);
    console.log(`  Stock Deducted: ${transfer.stockDeducted ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Sent At: ${transfer.sentAt || 'Not sent'}`);
    console.log(`  Completed At: ${transfer.completedAt || 'Not completed'}`);
    console.log(`  Items: ${transfer.items.length}`);

    // Check product history for this transfer
    for (const item of transfer.items) {
      console.log(`\n  Product Variation ID: ${item.productVariationId}, Quantity: ${item.quantity}`);

      // Check for TRANSFER_OUT entries
      const transferOutHistory = await prisma.productHistory.findMany({
        where: {
          productVariationId: item.productVariationId,
          transactionType: 'transfer_out',
          referenceId: transfer.id,
          referenceType: 'transfer'
        }
      });

      console.log(`    TRANSFER_OUT entries: ${transferOutHistory.length}`);
      transferOutHistory.forEach(h => {
        console.log(`      - Date: ${h.transactionDate}, Qty: ${h.quantityChange}, Location: ${h.locationId}, Balance: ${h.balanceQuantity}`);
      });

      // Check for TRANSFER_IN entries
      const transferInHistory = await prisma.productHistory.findMany({
        where: {
          productVariationId: item.productVariationId,
          transactionType: 'transfer_in',
          referenceId: transfer.id,
          referenceType: 'transfer'
        }
      });

      console.log(`    TRANSFER_IN entries: ${transferInHistory.length}`);
      transferInHistory.forEach(h => {
        console.log(`      - Date: ${h.transactionDate}, Qty: ${h.quantityChange}, Location: ${h.locationId}, Balance: ${h.balanceQuantity}`);
      });
    }

    console.log('');
  }

  await prisma.$disconnect();
}

checkProductHistory().catch(console.error);
