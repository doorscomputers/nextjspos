const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  // Get user Jheirone
  const user = await prisma.user.findFirst({
    where: { username: 'Jheirone' }
  });

  if (!user) {
    console.log('User "jheirone" not found');
    return;
  }

  console.log('User found:');
  console.log('- ID:', user.id);
  console.log('- Username:', user.username);
  console.log('- Business ID:', user.businessId);
  console.log('- Is Active:', user.isActive);

  // Get products for this business
  const productCount = await prisma.product.count({
    where: { businessId: user.businessId, deletedAt: null }
  });

  console.log(`\nProducts for business ${user.businessId}:`, productCount);

  await prisma.$disconnect();
}

checkUser().catch(console.error);
