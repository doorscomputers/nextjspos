const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransfers() {
  console.log('='.repeat(80));
  console.log('CHECKING STOCK TRANSFERS FOR ADATA 512GB');
  console.log('='.repeat(80));
  console.log('');

  // Find product
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: '4711085931528' },
        { name: { contains: 'ADATA 512GB', mode: 'insensitive' } }
      ]
    },
    include: {
      variations: true
    }
  });

  if (!product || !product.variations[0]) {
    console.log('❌ Product not found');
    return;
  }

  const variationId = product.variations[0].id;
  console.log('✅ Product Found:', product.name);
  console.log('   Variation ID:', variationId);
  console.log('');

  // Check transfers TO Main Store (Location 1)
  console.log('📦 TRANSFERS TO MAIN STORE (Location ID 1):');
  console.log('-'.repeat(80));
  const transfersIn = await prisma.stockTransfer.findMany({
    where: {
      toLocationId: 1,
      items: {
        some: {
          productId: product.id,
          productVariationId: variationId
        }
      }
    },
    include: {
      items: {
        where: {
          productId: product.id,
          productVariationId: variationId
        }
      },
      fromLocation: true,
      toLocation: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (transfersIn.length === 0) {
    console.log('  No transfers IN to Main Store');
  } else {
    for (const transfer of transfersIn) {
      console.log(`  Transfer #${transfer.id}:`);
      console.log(`  Transfer Number: ${transfer.transferNumber}`);
      console.log(`  From: ${transfer.fromLocation.name}`);
      console.log(`  To: ${transfer.toLocation.name}`);
      console.log(`  Status: ${transfer.status}`);
      console.log(`  Stock Added: ${transfer.stockAdded ? 'YES' : 'NO'}`);
      console.log(`  Stock Deducted: ${transfer.stockDeducted ? 'YES' : 'NO'}`);
      console.log(`  Created: ${new Date(transfer.createdAt).toISOString()}`);
      console.log(`  Checked At: ${transfer.checkedAt ? new Date(transfer.checkedAt).toISOString() : 'Not checked'}`);
      console.log(`  Sent At: ${transfer.sentAt ? new Date(transfer.sentAt).toISOString() : 'Not sent'}`);
      console.log(`  Verified At: ${transfer.verifiedAt ? new Date(transfer.verifiedAt).toISOString() : 'Not verified'}`);
      console.log(`  Completed At: ${transfer.completedAt ? new Date(transfer.completedAt).toISOString() : 'NOT COMPLETED!'}`);
      for (const item of transfer.items) {
        console.log(`  Item Quantity: ${item.quantity.toString()}`);
      }
      console.log('  ---');
    }
  }
  console.log('');

  // Check transfers FROM Main Store (Location 1)
  console.log('📤 TRANSFERS FROM MAIN STORE (Location ID 1):');
  console.log('-'.repeat(80));
  const transfersOut = await prisma.stockTransfer.findMany({
    where: {
      fromLocationId: 1,
      items: {
        some: {
          productId: product.id,
          productVariationId: variationId
        }
      }
    },
    include: {
      items: {
        where: {
          productId: product.id,
          productVariationId: variationId
        }
      },
      fromLocation: true,
      toLocation: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (transfersOut.length === 0) {
    console.log('  No transfers OUT from Main Store');
  } else {
    for (const transfer of transfersOut) {
      console.log(`  Transfer #${transfer.id}:`);
      console.log(`  Transfer Number: ${transfer.transferNumber}`);
      console.log(`  From: ${transfer.fromLocation.name}`);
      console.log(`  To: ${transfer.toLocation.name}`);
      console.log(`  Status: ${transfer.status}`);
      console.log(`  Stock Added: ${transfer.stockAdded ? 'YES' : 'NO'}`);
      console.log(`  Stock Deducted: ${transfer.stockDeducted ? 'YES' : 'NO'}`);
      console.log(`  Created: ${new Date(transfer.createdAt).toISOString()}`);
      console.log(`  Sent At: ${transfer.sentAt ? new Date(transfer.sentAt).toISOString() : 'Not sent'}`);
      console.log(`  Completed At: ${transfer.completedAt ? new Date(transfer.completedAt).toISOString() : 'Not completed'}`);
      for (const item of transfer.items) {
        console.log(`  Item Quantity: ${item.quantity.toString()}`);
      }
      console.log('  ---');
    }
  }

  console.log('');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

checkTransfers().catch(console.error);
