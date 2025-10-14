const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPurchaseData() {
  try {
    console.log('=== CHECKING PURCHASE DATA FOR DASHBOARD ===\n');

    // Get all purchases
    const allPurchases = await prisma.purchase.findMany({
      take: 10,
      include: {
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Total Purchases Found: ${allPurchases.length}\n`);

    if (allPurchases.length > 0) {
      console.log('Sample Purchase Records:');
      allPurchases.forEach((p, idx) => {
        console.log(`\n${idx + 1}. Purchase Order: ${p.purchaseOrderNumber}`);
        console.log(`   Supplier: ${p.supplier?.name || 'N/A'}`);
        console.log(`   Location ID: ${p.locationId}`);
        console.log(`   Date: ${p.purchaseDate}`);
        console.log(`   Total Amount: ${p.totalAmount}`);
        console.log(`   Status: ${p.status}`);
        console.log(`   Business ID: ${p.businessId}`);
      });
    }

    // Get aggregate statistics
    console.log('\n=== PURCHASE STATISTICS ===\n');

    const totalPurchaseStats = await prisma.purchase.aggregate({
      _sum: { totalAmount: true },
      _count: true,
    });

    console.log('Total Purchase Amount (all):', totalPurchaseStats._sum.totalAmount);
    console.log('Total Purchase Count:', totalPurchaseStats._count);

    // Check purchase due calculation (purchases not cancelled)
    const purchaseDueStats = await prisma.purchase.aggregate({
      where: {
        status: { not: 'cancelled' },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    console.log('\nPurchase Due Amount (not cancelled):', purchaseDueStats._sum.totalAmount);
    console.log('Purchase Due Count:', purchaseDueStats._count);

    // Check purchases by status
    console.log('\n=== PURCHASES BY STATUS ===\n');
    const statusGroups = await prisma.purchase.groupBy({
      by: ['status'],
      _count: true,
      _sum: { totalAmount: true },
    });

    statusGroups.forEach(group => {
      console.log(`Status: ${group.status}`);
      console.log(`  Count: ${group._count}`);
      console.log(`  Total Amount: ${group._sum.totalAmount}\n`);
    });

    // Check GRN (Goods Received Notes) - these should be linked to purchases
    console.log('=== CHECKING GRN DATA ===\n');
    const grnCount = await prisma.goodsReceivedNote.count();
    console.log(`Total GRN Records: ${grnCount}`);

    if (grnCount > 0) {
      const sampleGrn = await prisma.goodsReceivedNote.findMany({
        take: 5,
        include: {
          purchase: { select: { purchaseOrderNumber: true, totalAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log('\nSample GRN Records:');
      sampleGrn.forEach((grn, idx) => {
        console.log(`\n${idx + 1}. GRN Number: ${grn.grnNumber}`);
        console.log(`   Purchase Order: ${grn.purchase?.purchaseOrderNumber || 'Direct GRN'}`);
        console.log(`   Total Amount: ${grn.totalAmount}`);
        console.log(`   Status: ${grn.status}`);
      });
    }

    // Check if there are any purchase payments
    console.log('\n=== CHECKING PURCHASE PAYMENTS ===\n');

    // First check if PurchasePayment table exists
    try {
      const paymentCount = await prisma.purchasePayment.count();
      console.log(`Total Purchase Payment Records: ${paymentCount}`);

      if (paymentCount > 0) {
        const payments = await prisma.purchasePayment.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        console.log('\nSample Payment Records:');
        payments.forEach((p, idx) => {
          console.log(`\n${idx + 1}. Payment Amount: ${p.amount}`);
          console.log(`   Payment Date: ${p.paymentDate}`);
          console.log(`   Payment Method: ${p.paymentMethod}`);
        });
      }
    } catch (e) {
      console.log('PurchasePayment table not found or error:', e.message);
    }

  } catch (error) {
    console.error('Error checking purchase data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPurchaseData();
