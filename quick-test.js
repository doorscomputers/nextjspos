const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickTest() {
  console.log('=== QUICK SYSTEM VERIFICATION ===\n');

  try {
    // Check database connectivity
    const business = await prisma.business.findFirst();
    console.log('✅ Database connected');
    console.log('   Business:', business.name);

    // Check products
    const productCount = await prisma.product.count({ where: { businessId: business.id } });
    console.log('✅ Products:', productCount);

    // Check sales
    const salesCount = await prisma.sale.count({ where: { businessId: business.id } });
    console.log('✅ Sales:', salesCount);

    // Check purchases
    const purchaseCount = await prisma.purchase.count({ where: { businessId: business.id } });
    console.log('✅ Purchases:', purchaseCount);

    // Check stock transfers
    const transferCount = await prisma.stockTransfer.count({ where: { businessId: business.id } });
    console.log('✅ Stock Transfers:', transferCount);

    // Check audit logs
    const auditCount = await prisma.auditLog.count({ where: { businessId: business.id } });
    console.log('✅ Audit Logs:', auditCount);

    // Check locations
    const locationCount = await prisma.businessLocation.count({ where: { businessId: business.id } });
    console.log('✅ Business Locations:', locationCount);

    console.log('\n✅ System is operational!\n');
    console.log('Ready to build dashboard...\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
