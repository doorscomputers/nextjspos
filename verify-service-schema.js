const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySchema() {
  console.log('\n=== Technical Service & Warranty Management Schema Verification ===\n');

  try {
    // Check if all new models are accessible
    const models = [
      'technicalServiceEmployee',
      'serviceTechnician',
      'repairServiceType',
      'serviceWarrantyClaim',
      'repairJobOrder',
      'repairJobOrderPart',
      'serviceRepairPayment'
    ];

    console.log('Checking Prisma Client models...\n');

    for (const model of models) {
      const exists = prisma[model] !== undefined;
      console.log(`${exists ? '✓' : '✗'} ${model}: ${exists ? 'Available' : 'NOT FOUND'}`);
    }

    console.log('\n=== Schema Verification Complete ===\n');

    // Try to count records (should be 0 for new installation)
    console.log('Checking table accessibility...\n');

    const counts = await Promise.all([
      prisma.technicalServiceEmployee.count(),
      prisma.serviceTechnician.count(),
      prisma.repairServiceType.count(),
      prisma.serviceWarrantyClaim.count(),
      prisma.repairJobOrder.count(),
      prisma.repairJobOrderPart.count(),
      prisma.serviceRepairPayment.count()
    ]);

    console.log('Record counts (should be 0 for new installation):\n');
    models.forEach((model, index) => {
      console.log(`  ${model}: ${counts[index]} records`);
    });

    console.log('\n✓ All tables are accessible and ready for use!\n');

  } catch (error) {
    console.error('\n✗ Error verifying schema:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
