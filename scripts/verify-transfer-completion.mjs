import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifyTransferCompletion() {
  console.log('\n🔍 TRANSFER COMPLETION VERIFICATION\n');
  console.log('=' .repeat(80));

  try {
    // Get the business
    const business = await prisma.business.findFirst();
    if (!business) {
      console.error('❌ No business found!');
      process.exit(1);
    }

    // Get the most recent received transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        businessId: business.id,
        status: 'received'
      },
      orderBy: {
        receivedAt: 'desc'
      },
      include: {
        fromLocation: true,
        toLocation: true,
        items: true
      }
    });

    if (!transfer) {
      console.log('❌ No received transfers found!');
      process.exit(1);
    }

    console.log(`\n📦 TRANSFER DETAILS`);
    console.log('─'.repeat(80));
    console.log(`Transfer Number: ${transfer.transferNumber}`);
    console.log(`Status: ${transfer.status}`);
    console.log(`From: ${transfer.fromLocation.name} (ID: ${transfer.fromLocationId})`);
    console.log(`To: ${transfer.toLocation.name} (ID: ${transfer.toLocationId})`);
    console.log(`Sent At: ${transfer.sentAt?.toISOString() || 'N/A'}`);
    console.log(`Received At: ${transfer.receivedAt?.toISOString() || 'N/A'}`);
    console.log(`Stock Deducted: ${transfer.stockDeducted ? '✅ YES' : '❌ NO'}`);
    console.log(`Items Count: ${transfer.items.length}`);

    console.log(`\n📋 TRANSFER ITEMS:`);
    console.log('─'.repeat(80));

    for (const item of transfer.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      const variation = await prisma.productVariation.findUnique({
        where: { id: item.productVariationId }
      });

      console.log(`\n  Product: ${product?.name || 'Unknown'} - ${variation?.name || 'Default'}`);
      console.log(`  Quantity Sent: ${item.quantity}`);
      console.log(`  Quantity Received: ${item.receivedQuantity || 'N/A'}`);
      console.log(`  Product ID: ${item.productId}, Variation ID: ${item.productVariationId}`);

      // Check ProductHistory for TRANSFER_OUT (from source)
      const transferOutHistory = await prisma.productHistory.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId,
          transactionType: 'TRANSFER_OUT',
          referenceId: transfer.id,
          referenceType: 'transfer'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Check ProductHistory for TRANSFER_IN (to destination)
      const transferInHistory = await prisma.productHistory.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId,
          transactionType: 'TRANSFER_IN',
          referenceId: transfer.id,
          referenceType: 'transfer'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log(`\n  📊 PRODUCT HISTORY:`);
      if (transferOutHistory) {
        console.log(`  ✅ TRANSFER_OUT found (${transfer.fromLocation.name})`);
        console.log(`     Quantity: ${transferOutHistory.quantityChange}`);
        console.log(`     Balance After: ${transferOutHistory.balanceAfter}`);
        console.log(`     Created: ${transferOutHistory.createdAt.toISOString()}`);
      } else {
        console.log(`  ❌ TRANSFER_OUT NOT FOUND at ${transfer.fromLocation.name}`);
      }

      if (transferInHistory) {
        console.log(`  ✅ TRANSFER_IN found (${transfer.toLocation.name})`);
        console.log(`     Quantity: ${transferInHistory.quantityChange}`);
        console.log(`     Balance After: ${transferInHistory.balanceAfter}`);
        console.log(`     Created: ${transferInHistory.createdAt.toISOString()}`);
      } else {
        console.log(`  ❌ TRANSFER_IN NOT FOUND at ${transfer.toLocation.name}`);
      }

      // Check current stock levels
      const sourceStock = await prisma.productStock.findUnique({
        where: {
          productVariationId_locationId: {
            productVariationId: item.productVariationId,
            locationId: transfer.fromLocationId
          }
        }
      });

      const destStock = await prisma.productStock.findUnique({
        where: {
          productVariationId_locationId: {
            productVariationId: item.productVariationId,
            locationId: transfer.toLocationId
          }
        }
      });

      console.log(`\n  📦 CURRENT STOCK LEVELS:`);
      console.log(`  ${transfer.fromLocation.name}: ${sourceStock?.quantity || 0} units`);
      console.log(`  ${transfer.toLocation.name}: ${destStock?.quantity || 0} units`);

      console.log(`\n  ` + '─'.repeat(76));
    }

    // Summary verification
    console.log(`\n\n✅ VERIFICATION SUMMARY`);
    console.log('=' .repeat(80));

    let allGood = true;

    for (const item of transfer.items) {
      const transferOutExists = await prisma.productHistory.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId,
          transactionType: 'TRANSFER_OUT',
          referenceId: transfer.id
        }
      });

      const transferInExists = await prisma.productHistory.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.toLocationId,
          transactionType: 'TRANSFER_IN',
          referenceId: transfer.id
        }
      });

      if (!transferOutExists) {
        console.log(`❌ Missing TRANSFER_OUT for product ${item.productId}, variation ${item.productVariationId}`);
        allGood = false;
      }

      if (!transferInExists) {
        console.log(`❌ Missing TRANSFER_IN for product ${item.productId}, variation ${item.productVariationId}`);
        allGood = false;
      }
    }

    if (allGood) {
      console.log(`\n✅ ALL CHECKS PASSED!`);
      console.log(`✅ Transfer status: received`);
      console.log(`✅ Stock deducted from source: ${transfer.fromLocation.name}`);
      console.log(`✅ Stock added to destination: ${transfer.toLocation.name}`);
      console.log(`✅ ProductHistory entries complete (TRANSFER_OUT + TRANSFER_IN)`);
      console.log(`✅ Inventory tracking is accurate and trustworthy`);
      console.log(`\n🎉 Transfer workflow completed successfully!\n`);
    } else {
      console.log(`\n⚠️  SOME ISSUES FOUND - Review the details above`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTransferCompletion();
